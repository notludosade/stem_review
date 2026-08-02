const { getDb } = require('../lib/db');
const { verify } = require('../lib/session');

module.exports = async (req, res) => {
  try {
    const payload = verify(req.cookies?.session, process.env.SESSION_SECRET);
    if (!payload) {
      res.statusCode = 401;
      return res.json({ error: 'not signed in' });
    }

    const sql = getDb();
    const rows = await sql`select id, email, name from users where id = ${payload.userId}`;
    if (rows.length === 0) {
      res.statusCode = 401;
      return res.json({ error: 'not signed in' });
    }

    res.statusCode = 200;
    res.json(rows[0]);
  } catch (err) {
    console.error('me endpoint failed', err);
    res.statusCode = 401;
    res.json({ error: 'not signed in' });
  }
};
