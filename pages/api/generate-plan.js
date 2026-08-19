const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { generatePlanWithClaude } = require('../../lib/anthropic');
const { CATALOG, validatePlan } = require('../../lib/plan-catalog');

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 500;
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

function buildSystemPrompt(catalog) {
  const courseLines = catalog.courses.map((c) => `- ${c.name}: ${c.blurb}`).join('\n');
  const projectLines = catalog.projects.map((p) => `- ${p.id}: ${p.title} — ${p.blurb}`).join('\n');
  const problemSetLines = catalog.problemSets.map((p) => `- ${p.course}: ${p.blurb}`).join('\n');
  const applicationLines = catalog.applications.map((a) => `- ${a.id}: ${a.title}`).join('\n');

  return 'You are building a custom STEM+ learning plan for a highly motivated high schooler, from their own description of what they want to pursue. ' +
    'STEM+ is a free site with courses, capstone projects, practice problem sets, and short real-world "Applications" pages.\n\n' +
    'Build the plan using ONLY the real courses, projects, problem sets, and applications listed below — never invent one, never rename one. ' +
    "A course sequence can freely mix across subjects; it is not limited to any single existing pathway.\n\n" +
    `Available courses:\n${courseLines}\n\n` +
    `Available capstone projects (pick at most one, only if it genuinely fits the courses you chose):\n${projectLines}\n\n` +
    `Available problem sets (extra practice once a course is underway):\n${problemSetLines}\n\n` +
    `Available Applications pages (short real-world application reads):\n${applicationLines}\n\n` +
    'Call submit_plan with: a 2-3 sentence summary of the plan and why it fits the student\'s goal; an ordered array of 2-6 courses, each with a ' +
    'one-sentence reason tied to the student\'s stated goal; a project (set id to the empty string "" if none of the listed projects is a strong ' +
    'match for the chosen courses — never force one); 0-3 problemSets; 0-3 applications.';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ error: 'method not allowed' });
  }

  const { prompt } = req.body || {};
  if (typeof prompt !== 'string' || prompt.trim().length < MIN_PROMPT_LENGTH) {
    res.statusCode = 400;
    return res.json({ error: 'describe your goal in a bit more detail' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.statusCode = 400;
    return res.json({ error: `keep it under ${MAX_PROMPT_LENGTH} characters` });
  }

  const payload = verify(req.cookies?.session, process.env.SESSION_SECRET);
  if (!payload) {
    res.statusCode = 401;
    return res.json({ error: 'sign in required' });
  }

  let sql = null;
  let user = null;
  let slotClaimed = false;

  try {
    sql = getDb();
    const rows = await sql`select is_developer, last_plan_generated_at from users where id = ${payload.userId}`;
    if (rows.length === 0) {
      res.statusCode = 401;
      return res.json({ error: 'sign in required' });
    }
    user = rows[0];

    // Atomically claim today's generation slot before calling the AI, so N
    // concurrent requests can't all read "not rate limited" and all proceed.
    const claimed = await sql`
      update users set last_plan_generated_at = now()
      where id = ${payload.userId}
        and (is_developer or last_plan_generated_at is null or last_plan_generated_at < now() - interval '24 hours')
      returning last_plan_generated_at
    `;
    if (claimed.length === 0) {
      res.statusCode = 429;
      const elapsed = Date.now() - new Date(user.last_plan_generated_at).getTime();
      return res.json({ error: 'you can generate one plan every 24 hours', retryAfterMs: RATE_LIMIT_MS - elapsed });
    }
    slotClaimed = true;

    const { plan: rawPlan, refused } = await generatePlanWithClaude({
      system: buildSystemPrompt(CATALOG),
      userMessage: prompt,
    });

    if (refused || !rawPlan) {
      console.error('generate-plan: no usable plan', { refused, hasPlan: !!rawPlan });
      await sql`update users set last_plan_generated_at = ${user.last_plan_generated_at} where id = ${payload.userId}`;
      res.statusCode = 502;
      return res.json({ error: 'plan generation is temporarily unavailable, try again shortly' });
    }

    const plan = validatePlan(rawPlan, CATALOG);

    res.statusCode = 200;
    res.json(plan);
  } catch (err) {
    console.error('generate-plan failed', err);
    if (slotClaimed && user) {
      try {
        await sql`update users set last_plan_generated_at = ${user.last_plan_generated_at} where id = ${payload.userId}`;
      } catch (restoreErr) {
        console.error('generate-plan: failed to restore rate-limit slot after error', restoreErr);
      }
    }
    res.statusCode = 502;
    res.json({ error: 'plan generation is temporarily unavailable, try again shortly' });
  }
};
