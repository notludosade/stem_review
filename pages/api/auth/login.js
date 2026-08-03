const { getDb } = require('../../../lib/db');
const { verifyPassword, hashPassword } = require('../../../lib/password');
const { sign } = require('../../../lib/session');

// Decoy hash so a nonexistent email still pays the scrypt cost below —
// otherwise a missing row returns fast and a wrong password returns slow,
// leaking which emails have accounts via response timing.
const DECOY_HASH = hashPassword('decoy-password-for-timing');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ error: 'method not allowed' });
  }

  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.statusCode = 400;
    return res.json({ error: 'invalid email or password' });
  }

  try {
    const sql = getDb();
    const rows = await sql`select id, password_hash from users where email = ${email}`;
    const found = rows.length > 0;
    const passwordOk = verifyPassword(password, found ? rows[0].password_hash : DECOY_HASH);
    if (!found || !passwordOk) {
      res.statusCode = 401;
      return res.json({ error: 'invalid email or password' });
    }

    const token = sign(
      { userId: rows[0].id, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
      process.env.SESSION_SECRET
    );

    res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`);
    res.statusCode = 200;
    res.json({ ok: true });
  } catch (err) {
    console.error('login failed', err);
    res.statusCode = 500;
    res.json({ error: 'login failed, try again' });
  }
};
