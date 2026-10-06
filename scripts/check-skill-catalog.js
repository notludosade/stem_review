'use strict';

// The skill catalog is generated (scripts/build-skill-catalog.js) and
// committed; skill IDs will key student mastery, so the file must match the
// content and its prerequisite graph must be sound.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildCatalog, catalogText, CATALOG_FILE, expectedSkillCount, problemSetTopics, COURSE_PATHS } = require('./build-skill-catalog');

const fresh = buildCatalog();
assert.strictEqual(fs.readFileSync(CATALOG_FILE, 'utf8'), catalogText(fresh),
  'public/assets/skill-catalog.json is stale — run node scripts/build-skill-catalog.js and review the diff');

const skills = fresh.skills;
const byId = new Map(skills.map((skill) => [skill.id, skill]));
assert.strictEqual(byId.size, skills.length, 'duplicate skill IDs');
assert.strictEqual(skills.length, expectedSkillCount(), 'every unit (folder or course.js) needs exactly one skill');
Object.keys(COURSE_PATHS).forEach((course) => assert.ok(skills.some((skill) => skill.course === course), `${course} has no skills`));
skills.forEach((skill) => {
  assert.match(skill.id, /^[a-z0-9-]+\.u\d+$/, `bad skill ID ${skill.id}`);
  assert.ok(skill.lessons.length >= 1, `${skill.id} has no lessons`);
  const onDisk = (page) => fs.existsSync(path.join(__dirname, '../content', page.split('?')[0]));
  skill.lessons.forEach((lesson) => assert.ok(lesson.title && onDisk(lesson.page), `${skill.id}: missing lesson ${lesson.page}`));
  assert.ok(onDisk(skill.testPage), `${skill.id}: missing unit test ${skill.testPage}`);
  skill.prerequisites.forEach((id) => assert.ok(byId.has(id), `${skill.id} requires missing skill ${id}`));
  assert.ok('problemSet' in skill, `${skill.id} is missing problemSet`);
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
pin('programming-with-packages.u1', 'Package Foundations', ['computer-programming-1.u8']);
const packages = byId.get('programming-with-packages.u1');
assert.strictEqual(fresh.version, 2);
assert.deepStrictEqual(packages.lessons.map((lesson) => lesson.page.replace(/=.*/, '=')), Array(3).fill('/Programming with Packages/lesson.html?id='));
assert.strictEqual(packages.testPage, '/Programming with Packages/unit-test.html?unit=1');
assert.strictEqual(byId.get('precalculus.u3').testPage, '/Precalculus/Unit 3/unit-test-a.html');
assert.deepStrictEqual(byId.get('precalculus.u3').lessons[0], { page: '/Precalculus/Unit 3/0014-exponential-functions-and-their-graphs.html', title: 'Exponential Functions and Their Graphs' });
assert.strictEqual(byId.get('precalculus.u3').problemSet, 'precalculus');

// Applied needs each course's capstones; every ID must be a real project page.
const courses = new Set(skills.map((skill) => skill.course));
Object.entries(fresh.capstones).forEach(([course, ids]) => {
  assert.ok(courses.has(course), `capstones names unknown course ${course}`);
  ids.forEach((id) => assert.ok(fs.existsSync(path.join(__dirname, '../content/Projects', `${id}.html`)), `no project page for ${id}`));
});
assert.ok(fresh.capstones.Precalculus.includes('mathematics-capstone'));

// Diagnostics are built per Pathway; each slug must be a real Pathway page.
assert.strictEqual(fresh.pathways.length, 10);
fresh.pathways.forEach((pathway) => {
  assert.ok(fs.existsSync(path.join(__dirname, '../content/Pathways', `${pathway.slug}.html`)), `no Pathway page for ${pathway.slug}`);
  pathway.courses.forEach((course) => assert.ok(courses.has(course), `${pathway.name} lists unknown course ${course}`));
});
assert.deepStrictEqual(fresh.pathways.find((p) => p.slug === 'mathematics').courses, ['Precalculus', 'AP Calculus BC', 'Real Analysis A', 'Real Analysis B']);

console.log(`check-skill-catalog: OK (${skills.length} skills, ${assigned.length} Problem Set topics)`);
