'use strict';

// The skill catalog is generated (scripts/build-skill-catalog.js) and
// committed; skill IDs will key student mastery, so the file must match the
// content and its prerequisite graph must be sound.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildCatalog, catalogText, CATALOG_FILE, unitFolderCount, problemSetTopics } = require('./build-skill-catalog');

const fresh = buildCatalog();
assert.strictEqual(fs.readFileSync(CATALOG_FILE, 'utf8'), catalogText(fresh),
  'public/assets/skill-catalog.json is stale — run node scripts/build-skill-catalog.js and review the diff');

const skills = fresh.skills;
const byId = new Map(skills.map((skill) => [skill.id, skill]));
assert.strictEqual(byId.size, skills.length, 'duplicate skill IDs');
assert.strictEqual(skills.length, unitFolderCount(), 'every unit folder needs exactly one skill');
skills.forEach((skill) => {
  assert.match(skill.id, /^[a-z0-9-]+\.u\d+$/, `bad skill ID ${skill.id}`);
  assert.ok(skill.lessons >= 1, `${skill.id} has no lessons`);
  skill.prerequisites.forEach((id) => assert.ok(byId.has(id), `${skill.id} requires missing skill ${id}`));
});

// Acyclic: depth-first search with an on-stack marker.
const state = new Map();
const visit = (id, trail) => {
  if (state.get(id) === 'done') return;
  assert.notStrictEqual(state.get(id), 'active', `prerequisite cycle: ${[...trail, id].join(' → ')}`);
  state.set(id, 'active');
  byId.get(id).prerequisites.forEach((next) => visit(next, [...trail, id]));
  state.set(id, 'done');
};
skills.forEach((skill) => visit(skill.id, []));

// Every Problem Set topic sits on exactly one skill of its own course.
const assigned = skills.flatMap((skill) => skill.problemTopics.map((topic) => `${skill.course}|${topic}`));
assert.strictEqual(new Set(assigned).size, assigned.length, 'a Problem Set topic is on two skills');
assert.deepStrictEqual(new Set(assigned), new Set(problemSetTopics().map(({ course, topic }) => `${course}|${topic}`)));

const pin = (id, name, prerequisites) => {
  assert.ok(byId.has(id), `missing ${id}`);
  if (name) assert.strictEqual(byId.get(id).name, name);
  assert.deepStrictEqual(byId.get(id).prerequisites, prerequisites);
};
const lastUnit = (slug) => skills.filter((skill) => skill.id.startsWith(`${slug}.`)).pop().id;
pin('precalculus.u3', 'Exponential and Logarithmic Functions', ['precalculus.u2']);
pin('ap-calculus-bc.u1', 'Limits and Continuity', ['precalculus.u6']);
pin('quantum-computing.u1', null, ['linear-algebra-a.u7', lastUnit('linear-algebra-b')]);
assert.ok(byId.has('computer-programming-2-plus.u1') && byId.has('computer-programming-2.u1'));

console.log(`check-skill-catalog: OK (${skills.length} skills, ${assigned.length} Problem Set topics)`);
