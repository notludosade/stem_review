const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');

// Developer-only review of Report a Problem submissions (content/reports.html).
module.exports = async (req, res) => {
  const session = verify(req.cookies?.session, process.env.SESSION_SECRET);
  if (!session || !session.isDeveloper) {
    res.statusCode = 403;
    return res.json({ error: 'developer accounts only' });
  }
  try {
    const sql = getDb();
    if (req.method === 'POST') {
      const id = Number(req.body?.id);
      const resolved = req.body?.resolved;
      if (!Number.isInteger(id) || typeof resolved !== 'boolean') {
        res.statusCode = 400;
        return res.json({ error: 'id and resolved are required' });
      }
      await sql`update reports set resolved_at = ${resolved ? new Date() : null} where id = ${id}`;
      res.statusCode = 200;
      return res.json({ ok: true });
    }
    if (req.method !== 'GET') {
      res.statusCode = 405;
      return res.json({ error: 'GET or POST only' });
    }
    const open = await sql`
      select r.id, r.created_at as "createdAt", r.page, r.page_title as "pageTitle", r.course, r.question_id as "questionId",
        r.category, r.description, r.resolved_at as "resolvedAt", u.email as reporter
      from reports r left join users u on u.id = r.user_id
      where r.resolved_at is null order by r.created_at desc`;
    const resolved = await sql`
      select r.id, r.created_at as "createdAt", r.page, r.page_title as "pageTitle", r.course, r.question_id as "questionId",
        r.category, r.description, r.resolved_at as "resolvedAt", u.email as reporter
      from reports r left join users u on u.id = r.user_id
      where r.resolved_at is not null order by r.resolved_at desc limit 50`;
    res.statusCode = 200;
    return res.json({ open, resolved });
  } catch (err) {
    console.error('reports endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load reports.' });
  }
};
