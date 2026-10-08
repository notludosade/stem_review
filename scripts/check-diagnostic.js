'use strict';

// Pins how each Pathway's diagnostic is assembled (public/assets/diagnostic.js)
// from the skill catalog and the Problem Set banks.
const assert = require('node:assert');
const catalog = require('../public/assets/skill-catalog.json');
const banks = require('../public/assets/problem-banks.js');
const { buildDiagnostic, testableSkills } = require('../public/assets/diagnostic.js');

// Deterministic stand-in for Math.random so failures reproduce.
let seed = 42;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const counts = {};
catalog.pathways.forEach((pathway) => {
  const testable = testableSkills(catalog, pathway);
  const items = buildDiagnostic(catalog, pathway, banks, random);
  const expected = testable.length > 30 ? 30 : testable.length <= 15 ? testable.length * 2 : testable.length;
  assert.strictEqual(items.length, expected, `${pathway.name}: ${items.length} questions, expected ${expected}`);
  assert.ok(items.length <= 30);

  const position = new Map(testable.map((skill, index) => [skill.id, index]));
  const skillById = new Map(catalog.skills.map((skill) => [skill.id, skill]));
  items.forEach((item, index) => {
    assert.ok(position.has(item.skillId), `${pathway.name}: ${item.skillId} isn't a testable Pathway skill`);
    assert.ok(skillById.get(item.skillId).problemTopics.includes(item.question.topic), `${item.question.id} isn't in ${item.skillId}'s topics`);
    if (index) assert.ok(position.get(items[index - 1].skillId) <= position.get(item.skillId), `${pathway.name}: questions out of Pathway order`);
  });
  const ids = items.map((item) => item.question.id);
  assert.strictEqual(new Set(ids).size, ids.length, `${pathway.name}: duplicate question`);
  counts[pathway.slug] = items.length;
});

assert.strictEqual(counts.mathematics, 28);
assert.strictEqual(counts['engineering-physics'], 20);
assert.strictEqual(counts['general-programmer'], 28);
assert.strictEqual(counts['cloud-devops'], 10);
// Pathway course order, not catalog order: Mathematics starts with Precalculus.
assert.strictEqual(testableSkills(catalog, catalog.pathways.find((p) => p.slug === 'mathematics'))[0].id, 'precalculus.u1');

console.log(`check-diagnostic: OK (${Object.entries(counts).map(([slug, n]) => `${slug} ${n}`).join(', ')})`);
