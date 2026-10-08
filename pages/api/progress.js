const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isSyncedKey } = require('../../public/assets/progress-sync.js');

module.exports = async (req, res) => {
  try {
    // Inside the try (like pages/api/me.js): a missing SESSION_SECRET must 500
    // as JSON, not reject unhandled and return an HTML error page.
    const payload = verify(req.cookies?.session, process.env.SESSION_SECRET);
    if (!payload) {
      res.statusCode = 401;
      return res.json({ error: 'sign in required' });
    }

    const sql = getDb();

    if (req.method === 'GET') {
      const rows = await sql`select key, value from progress_sync where user_id = ${payload.userId}`;
      const byKey = {};
      rows.forEach((row) => {
        byKey[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      });
      res.statusCode = 200;
      return res.json(byKey);
    }

    if (req.method !== 'PUT') {
      res.statusCode = 405;
      return res.json({ error: 'GET or PUT only' });
    }

    const entries = req.body && req.body.entries;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      res.statusCode = 400;
      return res.json({ error: 'entries object is required' });
    }
    const keys = Object.keys(entries);
    if (!keys.length || !keys.every(isSyncedKey)) {
      res.statusCode = 400;
      return res.json({ error: 'entries contains an unrecognized key' });
    }

    for (const key of keys) {
      await sql`
        insert into progress_sync (user_id, key, value, updated_at)
        values (${payload.userId}, ${key}, ${JSON.stringify(entries[key])}::jsonb, now())
        on conflict (user_id, key) do update set value = excluded.value, updated_at = now()
      `;
    }
    res.statusCode = 200;
    return res.json({ ok: true });
  } catch (err) {
    console.error('progress endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load or save progress.' });
  }
};
