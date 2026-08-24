const assert = require('assert');
const { CATALOG, PREREQUISITE_GRAPH } = require('../lib/plan-catalog');
const { buildSystemPrompt } = require('../pages/api/generate-plan');

const prompt = buildSystemPrompt(CATALOG);

// Every PREREQUISITE_GRAPH relationship must actually appear in the text
// sent to Claude, or the model has no way to know about it.
Object.keys(PREREQUISITE_GRAPH).forEach((course) => {
  assert.ok(prompt.includes(`${course} requires: ${PREREQUISITE_GRAPH[course].join(', ')}`),
    `prompt is missing the prerequisite line for "${course}"`);
});

assert.ok(prompt.includes('also include its listed prerequisites'), 'prompt is missing the prerequisite-inclusion instruction');
assert.ok(prompt.toLowerCase().includes('favor thoroughness'), 'prompt is missing the thoroughness instruction');

console.log('check-generate-plan-prompt: OK');
