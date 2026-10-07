const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isValidStatus } = require('../../lib/content-review');
const catalog = require('../../public/assets/skill-catalog.json');

const KNOWN_COURSES = new Set(catalog.skills.map((skill) => skill.course));

// Public read (every page footer shows a course's status), developer-only
// write (content/developer-panel.html).
module.exports = async (req, res) => {
  try {
    const sql = getDb();

    if (req.method === 'GET') {
      const rows = await sql`
        select course, status, reviewed_at as "reviewedAt", reviewed_by as "reviewedBy",
          verified_against as "verifiedAgainst", sources
        from content_reviews
      `;
      const byCourse = {};
      rows.forEach((row) => {
        byCourse[row.course] = {
          status: row.status,
          reviewed: row.reviewedAt || undefined,
          reviewedBy: row.reviewedBy || undefined,
          verifiedAgainst: row.verifiedAgainst || undefined,
          sources: row.sources || undefined,
        };
      });
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      res.statusCode = 200;
      return res.json(byCourse);
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

    const course = typeof req.body?.course === 'string' ? req.body.course.trim() : '';
    const status = req.body?.status;
    if (!KNOWN_COURSES.has(course) || !isValidStatus(status)) {
      res.statusCode = 400;
      return res.json({ error: 'course and a valid status are required' });
    }

    await sql`
      insert into content_reviews (course, status, reviewed_at, updated_at)
      values (${course}, ${status}, now(), now())
      on conflict (course) do update set status = excluded.status, reviewed_at = now(), updated_at = now()
    `;
    res.statusCode = 200;
    return res.json({ ok: true });
  } catch (err) {
    console.error('content-review endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load or save content review status.' });
  }
};
