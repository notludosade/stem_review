const { getDb } = require('../../../../lib/db');
const { verify, sessionCookie } = require('../../../../lib/session');
const {
  redirectUriForRequest, decodeIdToken, validateGoogleClaims, decideLinkAction, safeNextPath,
} = require('../../../../lib/oauth-google');

function redirectToLogin(res, errorCode) {
  res.setHeader('Set-Cookie', 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/auth/google');
  res.statusCode = 302;
  res.setHeader('Location', `/login.html?google_error=${errorCode}`);
  res.end();
}

module.exports = async (req, res) => {
  const { code, state: queryState, error } = req.query;

  if (error) return redirectToLogin(res, error === 'access_denied' ? 'cancelled' : 'failed');

  // typ pins this to a state token: every cookie here is signed with the same
  // SESSION_SECRET and verify() doesn't care which kind it is. The explicit
  // string check on queryState matters because `undefined !== undefined` is
  // false — without it, a request with neither side present would pass.
  const stateCookie = verify(req.cookies?.oauth_state, process.env.SESSION_SECRET);
  if (!stateCookie || stateCookie.typ !== 'oauth_state' || typeof queryState !== 'string' || stateCookie.state !== queryState) {
    return redirectToLogin(res, 'expired');
  }

  const next = safeNextPath(stateCookie.next);
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
    if (!tokenRes.ok) {
      // Status only, never the body — it can echo back request params.
      console.error('google token exchange failed', tokenRes.status);
      return redirectToLogin(res, 'failed');
    }
    const tokenBody = await tokenRes.json();
    const claims = decodeIdToken(tokenBody.id_token);
    const validated = validateGoogleClaims(claims, process.env.GOOGLE_CLIENT_ID);
    if (!validated.ok) return redirectToLogin(res, 'failed');

    const sql = getDb();
    const linkRows = await sql`select user_id from oauth_accounts where provider = 'google' and provider_account_id = ${validated.claims.sub}`;
    const existingLinkUserId = linkRows.length ? linkRows[0].user_id : null;

    let existingUserIdByEmail = null;
    let existingUserHasPassword = false;
    if (!existingLinkUserId && validated.claims.email_verified) {
      const emailRows = await sql`select id, password_hash from users where lower(email) = lower(${validated.claims.email})`;
      if (emailRows.length) {
        existingUserIdByEmail = emailRows[0].id;
        existingUserHasPassword = emailRows[0].password_hash !== null;
      }
    }

    const decision = decideLinkAction({
      existingLinkUserId,
      existingUserIdByEmail,
      existingUserHasPassword,
      emailVerified: validated.claims.email_verified === true,
    });

    // An unverified Google email must never become a persisted users.email —
    // that row would then be a matchable linking key for a value nobody proved.
    if (decision.action === 'create_new_user' && validated.claims.email_verified !== true) {
      return redirectToLogin(res, 'failed');
    }

    let userId;
    if (decision.action === 'use_existing_link') {
      userId = decision.userId;
    } else if (decision.action === 'link_to_existing_user') {
      userId = decision.userId;
      await sql`insert into oauth_accounts (user_id, provider, provider_account_id) values (${userId}, 'google', ${validated.claims.sub})`;
    } else {
      // One statement, so a failure can't leave an orphaned passwordless
      // users row with no oauth_accounts link to reach it by.
      const newUserRows = await sql`
        with new_user as (
          insert into users (email, password_hash, name)
          values (${validated.claims.email.toLowerCase()}, null, ${validated.claims.name || null})
          returning id
        )
        insert into oauth_accounts (user_id, provider, provider_account_id)
        select id, 'google', ${validated.claims.sub} from new_user
        returning user_id
      `;
      userId = newUserRows[0].user_id;
    }

    const userRows = await sql`select is_developer from users where id = ${userId}`;
    const isDeveloper = userRows.length ? userRows[0].is_developer === true : false;

    res.setHeader('Set-Cookie', [
      'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/auth/google',
      sessionCookie(userId, isDeveloper),
    ]);
    res.statusCode = 302;
    res.setHeader('Location', next);
    res.end();
  } catch (err) {
    console.error('google oauth callback failed', err);
    redirectToLogin(res, 'failed');
  }
};
