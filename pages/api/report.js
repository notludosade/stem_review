const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { validateReport, hashIp } = require('../../lib/reports');

const MAX_PER_HOUR = 10;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ error: 'POST only' });
  }
  const result = validateReport(req.body);
  if (!result.ok) {
    res.statusCode = 400;
    return res.json({ error: result.error });
  }
  try {
    const { report } = result;
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ipHash = hashIp(forwarded || req.socket.remoteAddress || 'unknown', process.env.SESSION_SECRET);
    const session = verify(req.cookies?.session, process.env.SESSION_SECRET);
    const sql = getDb();
    // ponytail: count-then-insert isn't atomic, so a burst can slip a report
    // or two past the limit; fine for spam control.
    const [{ count }] = await sql`select count(*)::int as count from reports where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'`;
    if (count >= MAX_PER_HOUR) {
      res.statusCode = 429;
      return res.json({ error: 'Too many reports from this connection. Try again in an hour.' });
    }
    // The subselect leaves user_id null if the session's account was deleted.
    await sql`
      insert into reports (page, page_title, course, question_id, category, description, user_id, ip_hash)
      values (${report.page}, ${report.pageTitle}, ${report.course}, ${report.questionId}, ${report.category},
        ${report.description}, (select id from users where id = ${session ? session.userId : null}), ${ipHash})
    `;
    res.statusCode = 201;
    return res.json({ ok: true });
  } catch (err) {
    console.error('report endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not send the report. Try again later.' });
  }
};
