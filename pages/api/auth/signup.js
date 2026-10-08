const { getDb } = require('../../../lib/db');
const { hashPassword } = require('../../../lib/password');
const { sessionCookie } = require('../../../lib/session');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ error: 'method not allowed' });
  }

  const { email, password, name } = req.body || {};

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    res.statusCode = 400;
    return res.json({ error: 'enter a valid email' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.statusCode = 400;
    return res.json({ error: 'password must be at least 8 characters' });
  }

  try {
    const sql = getDb();
    const existing = await sql`select id from users where lower(email) = lower(${email})`;
    if (existing.length > 0) {
      res.statusCode = 409;
      return res.json({ error: 'an account with that email already exists' });
    }

    const passwordHash = hashPassword(password);
    const rows = await sql`
      insert into users (email, password_hash, name)
      values (${email.toLowerCase()}, ${passwordHash}, ${name || null})
      returning id
    `;
    const userId = rows[0].id;

    // New accounts are never developers — is_developer defaults to false in
    // the DB and is only ever flipped by hand (scripts/migrate.js's history).
    res.setHeader('Set-Cookie', sessionCookie(userId, false));
    res.statusCode = 200;
    res.json({ ok: true });
  } catch (err) {
    console.error('signup failed', err);
    res.statusCode = 500;
    res.json({ error: 'signup failed, try again' });
  }
};
