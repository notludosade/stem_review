// Thin wrapper around the Messages API for server-side FRQ grading. Uses
// plain fetch instead of @anthropic-ai/sdk — one endpoint, one call shape,
// not worth a new dependency for.
const MODEL = 'claude-sonnet-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_CONTINUATIONS = 2;

// Grading claims about real, current things (a specific coaster's specs, a
// specific incident, etc.) is exactly what web search is for — capped at 3
// searches per grade so one submission can't run away on cost.
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 3 };

// Forces a schema-valid response instead of parsing a fenced JSON block from
// free text — the concrete fix for the truncation failure mode grade-frq.js
// already hit once in production, applied here where the payload (a course
// array plus project/problem-sets/applications) is bigger and more nested
// than a grade. `strict: true` guarantees tool_use.input matches this shape
// exactly — nothing to JSON.parse, nothing that can truncate mid-object.
const PLAN_TOOL = {
  name: 'submit_plan',
  description: 'Submit the generated STEM+ plan for this student, built only from the courses/projects/problem sets/applications listed in the system prompt.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      courses: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, reason: { type: 'string' } },
          required: ['name', 'reason'],
          additionalProperties: false,
        },
      },
      project: {
        type: 'object',
        properties: { id: { type: 'string' }, reason: { type: 'string' } },
        required: ['id', 'reason'],
        additionalProperties: false,
      },
      problemSets: {
        type: 'array',
        items: {
          type: 'object',
          properties: { course: { type: 'string' }, reason: { type: 'string' } },
          required: ['course', 'reason'],
          additionalProperties: false,
        },
      },
      applications: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, reason: { type: 'string' } },
          required: ['id', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['summary', 'courses', 'project', 'problemSets', 'applications'],
    additionalProperties: false,
  },
  strict: true,
};

async function callMessages(messages, system) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      // Generous relative to a short grading response: each search round
      // adds its own "I'll search for X" text block before the results
      // come back, and 3 rounds of that plus a final JSON verdict can add
      // up fast enough to truncate a tighter budget mid-response.
      max_tokens: 4096,
      system,
      messages,
      tools: [WEB_SEARCH_TOOL],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
  }

  return res.json();
}

async function gradeWithClaude({ system, userMessage }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const messages = [{ role: 'user', content: userMessage }];
  let data = await callMessages(messages, system);

  // A long search turn can pause mid-response (stop_reason: "pause_turn")
  // rather than finish — the docs say to resend the paused assistant
  // message unchanged to continue it. Bounded so a pathological case can't
  // loop forever running up search costs.
  let continuations = 0;
  while (data.stop_reason === 'pause_turn' && continuations < MAX_CONTINUATIONS) {
    messages.push({ role: 'assistant', content: data.content });
    data = await callMessages(messages, system);
    continuations += 1;
  }

  const blocks = data.content || [];

  // Claude interleaves text/search-decision blocks with the search results
  // themselves; the actual answer is the concatenation of every text block,
  // in order — same as how the API's own streaming clients reassemble it.
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');

  const sources = [];
  const seen = new Set();
  blocks.forEach((b) => {
    if (b.type !== 'text' || !b.citations) return;
    b.citations.forEach((c) => {
      if (c.type === 'web_search_result_location' && !seen.has(c.url)) {
        seen.add(c.url);
        sources.push({ url: c.url, title: c.title });
      }
    });
  });

  return { text, sources, stopReason: data.stop_reason };
}

async function generatePlanWithClaude({ system, userMessage }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: userMessage }],
      tools: [PLAN_TOOL],
      tool_choice: { type: 'tool', name: 'submit_plan' },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();

  if (data.stop_reason === 'refusal') {
    return { plan: null, refused: true };
  }

  const block = (data.content || []).find((b) => b.type === 'tool_use' && b.name === 'submit_plan');
  return { plan: block ? block.input : null, refused: false };
}

module.exports = { gradeWithClaude, generatePlanWithClaude };
