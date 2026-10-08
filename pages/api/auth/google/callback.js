const { getDb } = require('../../../../lib/db');
const { sign, verify } = require('../../../../lib/session');
const {
  redirectUriForRequest, decodeIdToken, validateGoogleClaims, decideLinkAction,
} = require('../../../../lib/oauth-google');

function redirectToLogin(res, errorCode) {
  res.setHeader('Set-Cookie', 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/auth/google');
  res.statusCode = 302;
  res.setHeader('Location', `/login.html?google_error=${errorCode}`);
  res.end();
}

module.exports = async (req, res) => {
  const { code, state: queryState, error } = req.query;

  if (error) return redirectToLogin(res, 'cancelled');

  const stateCookie = verify(req.cookies?.oauth_state, process.env.SESSION_SECRET);
  if (!stateCookie || stateCookie.state !== queryState) return redirectToLogin(res, 'expired');

  const next = stateCookie.next || '/';
  if (!code) return redirectToLogin(res, 'failed');

  try {
    const redirectUri = redirectUriForRequest({
      host: req.headers.host,
      forwardedProto: req.headers['x-forwarded-proto'],
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenRes.ok) return redirectToLogin(res, 'failed');
    const tokenBody = await tokenRes.json();
    const claims = decodeIdToken(tokenBody.id_token);
    const validated = validateGoogleClaims(claims, process.env.GOOGLE_CLIENT_ID);
    if (!validated.ok) return redirectToLogin(res, 'failed');

    const sql = getDb();
    const linkRows = await sql`select user_id from oauth_accounts where provider = 'google' and provider_account_id = ${validated.claims.sub}`;
    const existingLinkUserId = linkRows.length ? linkRows[0].user_id : null;

    let existingUserIdByEmail = null;
    if (!existingLinkUserId && validated.claims.email_verified) {
      const emailRows = await sql`select id from users where email = ${validated.claims.email}`;
      existingUserIdByEmail = emailRows.length ? emailRows[0].id : null;
    }

    const decision = decideLinkAction({
      existingLinkUserId,
      existingUserIdByEmail,
      emailVerified: validated.claims.email_verified === true,
    });

    let userId;
    if (decision.action === 'use_existing_link') {
      userId = decision.userId;
    } else if (decision.action === 'link_to_existing_user') {
      userId = decision.userId;
      await sql`insert into oauth_accounts (user_id, provider, provider_account_id) values (${userId}, 'google', ${validated.claims.sub})`;
    } else {
      const newUserRows = await sql`
        insert into users (email, password_hash, name)
        values (${validated.claims.email}, null, ${validated.claims.name || null})
        returning id
      `;
      userId = newUserRows[0].id;
      await sql`insert into oauth_accounts (user_id, provider, provider_account_id) values (${userId}, 'google', ${validated.claims.sub})`;
    }

    const userRows = await sql`select is_developer from users where id = ${userId}`;
    const isDeveloper = userRows.length ? userRows[0].is_developer === true : false;
    const token = sign({ userId, isDeveloper, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }, process.env.SESSION_SECRET);

    res.setHeader('Set-Cookie', [
      'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/auth/google',
      `session=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`,
    ]);
    res.statusCode = 302;
    res.setHeader('Location', next);
    res.end();
  } catch (err) {
    console.error('google oauth callback failed', err);
    redirectToLogin(res, 'failed');
  }
};
