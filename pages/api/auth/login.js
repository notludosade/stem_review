const { getDb } = require('../../../lib/db');
const { verifyPassword, hashPassword } = require('../../../lib/password');
const { sessionCookie } = require('../../../lib/session');

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
    const rows = await sql`select id, password_hash, is_developer from users where lower(email) = lower(${email})`;
    const found = rows.length > 0;
    // A Google-only account has a null password_hash; falling back to the
    // decoy keeps it on the same scrypt-cost path as a real hash, so timing
    // leaks neither "this email exists" nor "it has no password".
    const passwordOk = verifyPassword(password, found && rows[0].password_hash ? rows[0].password_hash : DECOY_HASH);
    if (!found || !passwordOk) {
      res.statusCode = 401;
      return res.json({ error: 'invalid email or password' });
    }

    res.setHeader('Set-Cookie', sessionCookie(rows[0].id, rows[0].is_developer === true));
    res.statusCode = 200;
    res.json({ ok: true });
  } catch (err) {
    console.error('login failed', err);
    res.statusCode = 500;
    res.json({ error: 'login failed, try again' });
  }
};
