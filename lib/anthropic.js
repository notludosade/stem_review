// Thin wrapper around the Messages API for server-side FRQ grading. Uses
// plain fetch instead of @anthropic-ai/sdk — one endpoint, one call shape,
// not worth a new dependency for.
const MODEL = 'claude-sonnet-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Grading claims about real, current things (a specific coaster's specs, a
// specific incident, etc.) is exactly what web search is for — capped at 3
// searches per grade so one submission can't run away on cost.
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 3 };

async function gradeWithClaude({ system, userMessage }) {
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
      max_tokens: 1536,
      system,
      messages: [{ role: 'user', content: userMessage }],
      tools: [WEB_SEARCH_TOOL],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
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

  return { text, sources };
}

module.exports = { gradeWithClaude };
