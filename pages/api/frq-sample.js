const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { getFrqQuestion } = require('../../lib/frq-questions');

// Sample answers are for developer QA only, so this checks is_developer
// fresh from the DB rather than trusting the session token's embedded
// claim — revocable immediately instead of waiting out a 30-day token.
module.exports = async (req, res) => {
  const payload = verify(req.cookies?.session, process.env.SESSION_SECRET);
  if (!payload) {
    res.statusCode = 401;
    return res.json({ error: 'sign in required' });
  }

  try {
    const sql = getDb();
    const rows = await sql`select is_developer from users where id = ${payload.userId}`;
    if (rows.length === 0 || rows[0].is_developer !== true) {
      res.statusCode = 403;
      return res.json({ error: 'developer access required' });
    }

    const questionId = req.query?.questionId;
    const question = typeof questionId === 'string' ? getFrqQuestion(questionId) : null;
    if (!question) {
      res.statusCode = 400;
      return res.json({ error: 'unknown question' });
    }

    res.statusCode = 200;
    res.json({ sampleAnswer: question.sampleAnswer || null });
  } catch (err) {
    console.error('frq-sample failed', err);
    res.statusCode = 500;
    res.json({ error: 'lookup failed' });
  }
};
