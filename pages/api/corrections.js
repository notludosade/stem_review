const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { CATEGORIES } = require('../../lib/reports');

// Public read (course review details / correction log), developer-only
// write (logged from content/reports.html when closing a report as Corrected).
module.exports = async (req, res) => {
  try {
    const sql = getDb();

    if (req.method === 'GET') {
      const course = typeof req.query?.course === 'string' ? req.query.course : null;
      const rows = course
        ? await sql`select id, created_at as "createdAt", course, unit, lesson, question_ref as "questionRef", category, summary, reason, corrected_by as "correctedBy" from corrections where course = ${course} order by created_at desc`
        : await sql`select id, created_at as "createdAt", course, unit, lesson, question_ref as "questionRef", category, summary, reason, corrected_by as "correctedBy" from corrections order by created_at desc limit 200`;
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      res.statusCode = 200;
      return res.json(rows);
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.json({ error: 'GET or POST only' });
    }

    const session = verify(req.cookies?.session, process.env.SESSION_SECRET);
    if (!session || !session.isDeveloper) {
      res.statusCode = 403;
      return res.json({ error: 'developer accounts only' });
    }

    const body = req.body || {};
    const course = typeof body.course === 'string' ? body.course.trim() : '';
    const unit = typeof body.unit === 'string' ? body.unit.trim() || null : null;
    const lesson = typeof body.lesson === 'string' ? body.lesson.trim() || null : null;
    const questionRef = typeof body.questionRef === 'string' ? body.questionRef.trim() || null : null;
    const category = typeof body.category === 'string' ? body.category : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null;
    const reportId = Number.isInteger(body.reportId) ? body.reportId : null;
    const correctedBy = typeof body.correctedBy === 'string' ? body.correctedBy.trim() || null : null;

    if (!course || !CATEGORIES.includes(category) || !summary) {
      res.statusCode = 400;
      return res.json({ error: 'course, a known category, and a summary are required' });
    }

    await sql`
      insert into corrections (course, unit, lesson, question_ref, category, summary, reason, report_id, corrected_by)
      values (${course}, ${unit}, ${lesson}, ${questionRef}, ${category}, ${summary}, ${reason}, ${reportId}, ${correctedBy})
    `;
    res.statusCode = 201;
    return res.json({ ok: true });
  } catch (err) {
    console.error('corrections endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not save the correction.' });
  }
};
