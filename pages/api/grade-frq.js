const { verify } = require('../../lib/session');
const { gradeWithClaude } = require('../../lib/anthropic');
const { getFrqQuestion } = require('../../lib/frq-questions');

const MAX_RESPONSE_LENGTH = 4000;

function buildSystemPrompt(question) {
  return `You are grading a free-response answer for a STEM+ "Applications" page — a short piece that takes ` +
    `one concept from a course and applies it to a real scenario. The student is a motivated high schooler, ` +
    `not a professional; grade for genuine understanding and real research, not jargon or length.\n\n` +
    `Concept the student already has, from the page:\n${question.concept}\n\n` +
    `Question asked:\n${question.question}\n\n` +
    `Rubric — a strong answer does ALL of the following:\n${question.rubric.map((r) => `- ${r}`).join('\n')}\n\n` +
    `Use the web_search tool to verify any specific real-world claim the student makes (a named coaster's ` +
    `real dimensions, a named safety practice, etc.) rather than trusting it at face value — the whole point ` +
    `of this question is that the student had to actually look something up, so check that they did and got ` +
    `it right, not just that they wrote something plausible-sounding.\n\n` +
    `End your response with exactly one fenced json block and nothing after it, in this exact shape:\n` +
    '```json\n' +
    `{"score": <integer 0-100>, "verdict": "<one short sentence>", "feedback": "<2-4 sentences, specific to what they wrote>", "strengths": ["..."], "gaps": ["..."]}\n` +
    '```';
}

function extractGrade(text) {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (typeof parsed.score !== 'number') return null;
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      verdict: String(parsed.verdict || ''),
      feedback: String(parsed.feedback || ''),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
    };
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ error: 'method not allowed' });
  }

  const payload = verify(req.cookies?.session, process.env.SESSION_SECRET);
  if (!payload) {
    res.statusCode = 401;
    return res.json({ error: 'sign in required' });
  }

  const { questionId, response } = req.body || {};
  const question = typeof questionId === 'string' ? getFrqQuestion(questionId) : null;
  if (!question) {
    res.statusCode = 400;
    return res.json({ error: 'unknown question' });
  }
  if (typeof response !== 'string' || response.trim().length < 20) {
    res.statusCode = 400;
    return res.json({ error: 'write a bit more before submitting' });
  }
  if (response.length > MAX_RESPONSE_LENGTH) {
    res.statusCode = 400;
    return res.json({ error: `keep it under ${MAX_RESPONSE_LENGTH} characters` });
  }

  try {
    const { text, sources } = await gradeWithClaude({
      system: buildSystemPrompt(question),
      userMessage: response,
    });
    const grade = extractGrade(text);
    if (!grade) {
      res.statusCode = 502;
      return res.json({ error: 'grading came back in an unexpected format, try again' });
    }
    res.statusCode = 200;
    res.json({ ...grade, sources });
  } catch (err) {
    console.error('grade-frq failed', err);
    res.statusCode = 502;
    res.json({ error: 'grading is temporarily unavailable, try again shortly' });
  }
};
