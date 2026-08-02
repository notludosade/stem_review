const { getDb } = require('../../lib/db');
const { sign } = require('../../lib/session');

module.exports = async (req, res) => {
  const { code, state } = req.query;
  const cookieState = req.cookies?.oauth_state;

  if (!code || !state || !cookieState || state !== cookieState) {
    res.writeHead(302, { Location: '/?auth_error=1' });
    return res.end();
  }

  try {
    const redirectUri = `https://${req.headers.host}/api/auth/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error('token exchange failed');
    const { access_token } = await tokenRes.json();

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileRes.ok) throw new Error('profile fetch failed');
    const profile = await profileRes.json();

    const sql = getDb();
    const rows = await sql`
      insert into users (google_sub, email, name, avatar_url)
      values (${profile.sub}, ${profile.email}, ${profile.name}, ${profile.picture})
      on conflict (google_sub)
      do update set email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url
      returning id
    `;
    const userId = rows[0].id;

    const token = sign(
      { userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
      process.env.SESSION_SECRET
    );

    res.setHeader('Set-Cookie', [
      `session=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`,
      `oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`,
    ]);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    console.error('auth callback failed', err);
    res.writeHead(302, { Location: '/?auth_error=1' });
    res.end();
  }
};
