const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isValidReportStatus, REPORT_STATUSES } = require('../../lib/content-trust');
const { CATEGORIES } = require('../../lib/reports');

const CLOSED_STATUSES = new Set(['CORRECTED', 'CLOSED']);

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
      const status = req.body?.status;
      if (!Number.isInteger(id) || !isValidReportStatus(status)) {
        res.statusCode = 400;
        return res.json({ error: 'id and a valid status are required' });
      }
      await sql`update reports set status = ${status}, resolved_at = ${CLOSED_STATUSES.has(status) ? new Date() : null} where id = ${id}`;
      res.statusCode = 200;
      return res.json({ ok: true });
    }
    if (req.method !== 'GET') {
      res.statusCode = 405;
      return res.json({ error: 'GET or POST only' });
    }
    const open = await sql`
      select r.id, r.created_at as "createdAt", r.page, r.page_title as "pageTitle", r.course, r.unit, r.lesson,
        r.question_id as "questionId", r.category, r.description, r.status, r.resolved_at as "resolvedAt", u.email as reporter
      from reports r left join users u on u.id = r.user_id
      where r.status not in ('CORRECTED', 'CLOSED') order by r.created_at desc`;
    const resolved = await sql`
      select r.id, r.created_at as "createdAt", r.page, r.page_title as "pageTitle", r.course, r.unit, r.lesson,
        r.question_id as "questionId", r.category, r.description, r.status, r.resolved_at as "resolvedAt", u.email as reporter
      from reports r left join users u on u.id = r.user_id
      where r.status in ('CORRECTED', 'CLOSED') order by r.resolved_at desc limit 50`;
    res.statusCode = 200;
    return res.json({ open, resolved, statuses: REPORT_STATUSES, categories: CATEGORIES });
  } catch (err) {
    console.error('reports endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load reports.' });
  }
};
