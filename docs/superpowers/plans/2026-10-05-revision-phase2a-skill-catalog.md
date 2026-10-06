# Revision Phase 2a Skill Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generated, checked `public/assets/skill-catalog.json` with one skill per course unit, prerequisites, and Problem Set topics.

**Architecture:** `scripts/build-skill-catalog.js` derives everything from existing sources (tests.js tables, plan-catalog prerequisite graph, course index headings, unit folders, problem banks) plus one hand-written topic → unit table; `scripts/check-skill-catalog.js` fails `npm test` when the committed file is stale or the graph is invalid.

**Tech Stack:** Node built-ins only.

**Spec:** `docs/superpowers/specs/2026-10-05-revision-phase2a-skill-catalog-design.md`

## Global Constraints

- Skill ID `<course-slug>.u<N>`; IDs are permanent.
- Slug: lowercase, `+` → `-plus`, other non-alphanumeric runs → `-`, trimmed.
- No existing file's behavior changes; `lib/plan-catalog.js` only gains an export.

---

### Task 1: Catalog generator, check, generated file

**Files:** Create `scripts/build-skill-catalog.js`, `scripts/check-skill-catalog.js`, `public/assets/skill-catalog.json`; Modify `lib/plan-catalog.js` (export `decodeEntities`), `package.json`.

- [ ] **Failing check `scripts/check-skill-catalog.js`:**

```js
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
```

Run `node scripts/check-skill-catalog.js`: FAIL `Cannot find module './build-skill-catalog'`.

- [ ] **`lib/plan-catalog.js`:** add `decodeEntities` to `module.exports`.
- [ ] **`scripts/build-skill-catalog.js`:**

```js
'use strict';

// Generates public/assets/skill-catalog.json: one skill per course unit,
// derived from the site's own tables and pages. Run it after adding,
// removing, or renaming a unit, then review the diff — skill IDs key student
// mastery, so an existing ID must never change meaning.
const fs = require('node:fs');
const path = require('node:path');
const { PREREQUISITE_GRAPH, decodeEntities } = require('../lib/plan-catalog');
const banks = require('../public/assets/problem-banks.js');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const CATALOG_FILE = path.join(ROOT, 'public/assets/skill-catalog.json');

// Problem Set slug → topic → unit number. The only hand-written data here;
// assigned by comparing each topic's questions with the unit's lessons.
const PROBLEM_TOPIC_UNITS = {
  'algebra-geometry': { 'Linear equations': 1, Systems: 1, Quadratics: 2, Exponents: 3, Area: 5, 'Right triangles': 6 },
  precalculus: { Functions: 1, 'Composition and inverses': 1, 'Polynomial functions': 2, 'Exponential and logarithmic functions': 3, Trigonometry: 4, Sequences: 6 },
  'ap-calculus-bc': { Limits: 1, Derivatives: 2, 'Derivative applications': 2, Integrals: 6, 'Fundamental Theorem': 6, 'Infinite series': 10 },
  'multivariable-calculus': { 'Vectors and dot products': 1, 'Cross products': 1, 'Partial derivatives': 2, Gradients: 2, 'Multiple integrals': 4, 'Vector fields': 6 },
  'linear-algebra-a': { 'Vectors and dot products': 1, 'Vector magnitude': 1, 'Matrix determinants': 5, 'Matrix traces': 2, 'Matrix multiplication': 2, Eigenvalues: 6 },
  'differential-equations': { 'Differential equations': 1, 'Growth and decay': 2, 'Characteristic equations': 3, 'Euler’s method': 7, Oscillations: 4, 'Laplace transforms': 5 },
  'mathematical-proofs': { 'Statements and logic': 1, 'Parity and divisibility': 2, 'Direct proofs': 2, 'Proofs about sets': 2, 'Mathematical induction': 4, 'Quantifiers and witnesses': 1 },
  'discrete-math': { Logic: 1, Sets: 2, Combinatorics: 3, Probability: 4, 'Graph theory': 5, 'Number theory': 6 },
  'computer-programming-1': { 'Language fundamentals': 1, 'Variables and operators': 2, 'Control flow': 3, Loops: 3, Functions: 4, Collections: 6 },
  'computer-programming-2': { 'Object-oriented programming': 1, Exceptions: 2, 'Data structures': 3, Recursion: 4, 'Algorithms and complexity': 5, 'Memory and concurrency': 6 },
  'data-handling-cb': { Spreadsheets: 2, 'SQL and databases': 3, 'Descriptive statistics': 4, 'Data quality and cleaning': 5, 'Correlation and regression': 4, 'Visualization and storytelling': 6 },
  'computer-networking-fundamentals': { 'Bandwidth and transmission': 1, 'Latency and propagation': 1, 'IPv4 addressing': 3, 'CIDR notation': 3, 'Bandwidth-delay product': 1, 'Ports and multiplexing': 5 },
  'systems-programming-architecture': { 'Binary representation': 4, Hexadecimal: 4, 'Two’s complement': 4, 'Memory addressing': 3, 'Cache performance': 7, 'CPU scheduling': 5 },
  'ap-physics-1': { Kinematics: 1, Forces: 2, Energy: 3, Momentum: 4, Rotation: 5, 'Circular motion': 2 },
  'ap-physics-2': { Thermodynamics: 1, Electrostatics: 2, 'Electric circuits': 3, Magnetism: 4, 'Geometric optics': 5, 'Modern physics': 7 },
  'ap-physics-c-mechanics': { 'Calculus-based kinematics': 1, 'Force and acceleration': 2, 'Work by variable forces': 3, 'Impulse and momentum': 4, 'Rotational dynamics': 5, 'Gravitation and orbits': 7 },
  'quantum-physics-optics': { 'Wave optics': 1, Diffraction: 2, Photons: 3, 'Photoelectric effect': 3, 'Matter waves': 4, 'Particle in a box': 6 },
  'engineering-1': { 'Units and measurement': 2, 'Vectors and resultants': 3, 'Statics and moments': 3, 'Stress and strain': 3, 'Work and power': 5, 'Electric circuits': 6 },
  'real-analysis-a': { 'Absolute value and bounds': 1, 'Supremum and infimum': 1, 'Sequences and limits': 2, 'Epsilon-N arguments': 2, 'Topology of the real line': 3, 'Riemann integration': 6 },
  'advanced-algorithms': { 'Asymptotic analysis': 1, 'Divide and conquer': 2, 'Minimum spanning trees': 3, 'Shortest paths': 4, 'Dynamic programming': 5, 'Bitmask algorithms': 5 },
};

// tests.js is a browser script, so its tables are read from source (the same
// approach check-plan-catalog.js uses).
const testsSrc = fs.readFileSync(path.join(ROOT, 'public/assets/tests.js'), 'utf8');
const readTable = (name) => {
  const match = testsSrc.match(new RegExp(`var ${name} = \\{([\\s\\S]*?)\\};`));
  return Object.fromEntries([...match[1].matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
};
const COURSE_PATHS = readTable('COURSE_PATHS');
const PROBLEM_SET_SLUGS = readTable('PROBLEM_SET_SLUGS');

const courseSlug = (name) => name.toLowerCase().replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const unitFolders = (dir) => fs.readdirSync(path.join(CONTENT, dir)).filter((name) => /^Unit \d+$/.test(name));
const unitFolderCount = () => Object.values(COURSE_PATHS).reduce((sum, dir) => sum + unitFolders(dir).length, 0);

const problemSetTopics = () => Object.entries(PROBLEM_SET_SLUGS).flatMap(([course, slug]) =>
  [...new Set(banks.getCourse(slug).questions.map((question) => question.topic))].map((topic) => ({ course, slug, topic })));

function courseUnits(course, dir) {
  const html = fs.readFileSync(path.join(CONTENT, dir, 'index.html'), 'utf8');
  const units = [...html.matchAll(/<summary>\s*Unit (\d+)\s*[:—-]\s*([^<]+)<\/summary>/g)]
    .map((m) => ({ number: Number(m[1]), name: decodeEntities(m[2].trim()) }));
  const folders = unitFolders(dir).map((name) => Number(name.slice(5))).sort((a, b) => a - b);
  if (units.map((u) => u.number).join() !== folders.join()) {
    throw new Error(`${course}: unit headings (${units.map((u) => u.number)}) don't match unit folders (${folders})`);
  }
  return units.map((unit) => ({
    ...unit,
    lessons: fs.readdirSync(path.join(CONTENT, dir, `Unit ${unit.number}`)).filter((name) => /^\d{4}-.*\.html$/.test(name)).length,
  }));
}

function buildCatalog() {
  const units = Object.fromEntries(Object.entries(COURSE_PATHS).map(([course, dir]) => [course, courseUnits(course, dir)]));
  const idFor = (course, number) => `${courseSlug(course)}.u${number}`;

  const topicsByUnit = new Map();
  problemSetTopics().forEach(({ course, slug, topic }) => {
    const number = PROBLEM_TOPIC_UNITS[slug]?.[topic];
    if (!number) throw new Error(`Problem Set ${slug} topic "${topic}" has no unit in PROBLEM_TOPIC_UNITS`);
    if (!units[course].some((unit) => unit.number === number)) throw new Error(`${slug} "${topic}" → Unit ${number}, which ${course} doesn't have`);
    const id = idFor(course, number);
    topicsByUnit.set(id, [...(topicsByUnit.get(id) || []), topic]);
  });
  const mapped = Object.values(PROBLEM_TOPIC_UNITS).reduce((sum, topics) => sum + Object.keys(topics).length, 0);
  if (mapped !== problemSetTopics().length) throw new Error('PROBLEM_TOPIC_UNITS names a topic no Problem Set has');

  const skills = Object.entries(units).flatMap(([course, courseUnitList]) => courseUnitList.map((unit, index) => ({
    id: idFor(course, unit.number),
    name: unit.name,
    course,
    unit: `Unit ${unit.number}`,
    lessons: unit.lessons,
    prerequisites: index > 0
      ? [idFor(course, courseUnitList[index - 1].number)]
      : (PREREQUISITE_GRAPH[course] || []).map((before) => idFor(before, units[before][units[before].length - 1].number)),
    problemTopics: topicsByUnit.get(idFor(course, unit.number)) || [],
  })));
  return { version: 1, skills };
}

const catalogText = (catalog) => `${JSON.stringify(catalog, null, 2)}\n`;

if (require.main === module) {
  const catalog = buildCatalog();
  fs.writeFileSync(CATALOG_FILE, catalogText(catalog));
  console.log(`wrote ${path.relative(ROOT, CATALOG_FILE)}: ${catalog.skills.length} skills`);
}

module.exports = { buildCatalog, catalogText, CATALOG_FILE, unitFolderCount, problemSetTopics };
```

- [ ] Run `node scripts/build-skill-catalog.js` (expect "283 skills"), then `node scripts/check-skill-catalog.js` passes. Spot-read the JSON for a few courses.
- [ ] Add `node scripts/check-skill-catalog.js` to `npm test` after `check-reports`; `npm test`; commit "Add the generated skill catalog (one skill per course unit)".

### Task 2: Push and confirm

- [ ] Push; `curl https://stem-review.vercel.app/assets/skill-catalog.json` returns the same 283 skills.
