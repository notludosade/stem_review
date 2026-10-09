const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isValidStatus } = require('../../lib/content-review');
const { parseSources, validateContentReviewUpdate } = require('../../lib/content-trust');
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
          verified_against as "verifiedAgainst", sources, framework, framework_version as "frameworkVersion",
          reviewer_role as "reviewerRole"
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
          sourcesList: parseSources(row.sources || ''),
          framework: row.framework || undefined,
          frameworkVersion: row.frameworkVersion || undefined,
          reviewerRole: row.reviewerRole || undefined,
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

    const reviewedBy = typeof req.body?.reviewedBy === 'string' ? req.body.reviewedBy.trim() : '';
    const reviewerRole = typeof req.body?.reviewerRole === 'string' ? req.body.reviewerRole.trim() : '';
    const verifiedAgainst = typeof req.body?.verifiedAgainst === 'string' ? req.body.verifiedAgainst.trim() : '';
    const sources = typeof req.body?.sources === 'string' ? req.body.sources.trim() : '';
    const framework = typeof req.body?.framework === 'string' ? req.body.framework.trim() : '';
    const frameworkVersion = typeof req.body?.frameworkVersion === 'string' ? req.body.frameworkVersion.trim() : '';

    const assessments = await sql`select status from assessment_verifications where course = ${course}`;
    const check = validateContentReviewUpdate({ status, reviewedBy, reviewedAt: new Date(), sources, assessments });
    if (!check.ok) {
      res.statusCode = 400;
      return res.json({ error: check.error });
    }

    await sql`
      insert into content_reviews (
        course, status, reviewed_at, reviewed_by, verified_against, sources, framework, framework_version, reviewer_role, updated_at
      )
      values (
        ${course}, ${status}, now(), ${reviewedBy || null}, ${verifiedAgainst || null}, ${sources || null},
        ${framework || null}, ${frameworkVersion || null}, ${reviewerRole || null}, now()
      )
      on conflict (course) do update set
        status = excluded.status,
        reviewed_at = now(),
        reviewed_by = excluded.reviewed_by,
        verified_against = excluded.verified_against,
        sources = excluded.sources,
        framework = excluded.framework,
        framework_version = excluded.framework_version,
        reviewer_role = excluded.reviewer_role,
        updated_at = now()
    `;
    res.statusCode = 200;
    return res.json({ ok: true });
  } catch (err) {
    console.error('content-review endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load or save content review status.' });
  }
};
