const assert = require('assert');
const { CATALOG, PREREQUISITE_GRAPH, validatePlan } = require('../lib/plan-catalog');

assert.ok(CATALOG.courses.length >= 30, `expected at least 30 courses, got ${CATALOG.courses.length}`);
assert.ok(CATALOG.projects.length >= 7, `expected at least 7 recommendable projects (8 real capstones minus Mathematics), got ${CATALOG.projects.length}`);
assert.ok(!CATALOG.projects.some((p) => p.id === 'mathematics-capstone'), 'Mathematics Capstone must be excluded');
assert.ok(CATALOG.applications.length >= 9, `expected at least 9 applications, got ${CATALOG.applications.length}`);
assert.ok(CATALOG.problemSets.length >= 20, `expected at least 20 problem sets, got ${CATALOG.problemSets.length}`);

// Every parsed entry must have real, non-empty text — a parsing bug that
// silently produces empty strings should fail loudly here, not ship.
CATALOG.courses.forEach((c) => {
  assert.ok(c.name.length > 0, 'course with empty name');
  assert.ok(c.blurb.length > 10, `course "${c.name}" has a suspiciously short blurb: "${c.blurb}"`);
});
CATALOG.projects.forEach((p) => {
  assert.ok(p.title.length > 0 && p.blurb.length > 10, `project "${p.id}" missing title/blurb`);
});
CATALOG.problemSets.forEach((p) => {
  assert.ok(/^[a-z0-9-]+$/.test(p.slug), `problem set "${p.course}" has a malformed slug: "${p.slug}"`);
});

// A known real course/project/application/problem-set must actually be found.
assert.ok(CATALOG.courses.some((c) => c.name === 'Computer Programming 1'), 'Computer Programming 1 missing from catalog');
assert.ok(CATALOG.projects.some((p) => p.id === 'software-engineer-capstone'), 'software-engineer-capstone missing from catalog');
assert.ok(CATALOG.applications.some((a) => a.id === 'designing-a-roller-coaster-safely'), 'roller coaster application missing from catalog');
assert.ok(CATALOG.problemSets.some((p) => p.slug === 'precalculus'), 'precalculus problem set missing from catalog');

// validatePlan: real references survive, hallucinated ones are dropped and
// enriched with real display data.
const rawPlan = {
  summary: 'A plan.',
  courses: [
    { name: 'Computer Programming 1', reason: 'real, keep' },
    { name: 'Course That Does Not Exist', reason: 'hallucinated, drop' },
  ],
  project: { id: 'software-engineer-capstone', reason: 'real, keep' },
  problemSets: [
    { course: 'Precalculus', reason: 'real, keep' },
    { course: 'Fake Course', reason: 'hallucinated, drop' },
  ],
  applications: [
    { id: 'designing-a-roller-coaster-safely', reason: 'real, keep' },
    { id: 'not-a-real-application', reason: 'hallucinated, drop' },
  ],
};
const validated = validatePlan(rawPlan, CATALOG);
assert.deepStrictEqual(validated.courses, [{ name: 'Computer Programming 1', reason: 'real, keep' }]);
assert.deepStrictEqual(validated.project, { id: 'software-engineer-capstone', title: 'Software Engineer Capstone', reason: 'real, keep' });
assert.deepStrictEqual(validated.problemSets, [{ course: 'Precalculus', slug: 'precalculus', reason: 'real, keep' }]);
assert.deepStrictEqual(validated.applications, [{ id: 'designing-a-roller-coaster-safely', title: 'Designing a Roller Coaster Safely', reason: 'real, keep' }]);

// A hallucinated project id must be dropped to null, not passed through.
const rawPlanBadProject = { summary: '', courses: [], project: { id: 'not-a-real-project', reason: 'x' }, problemSets: [], applications: [] };
assert.strictEqual(validatePlan(rawPlanBadProject, CATALOG).project, null);

// project.id === '' (the model's "no strong match" sentinel) must also resolve to null.
const rawPlanNoProject = { summary: '', courses: [], project: { id: '', reason: '' }, problemSets: [], applications: [] };
assert.strictEqual(validatePlan(rawPlanNoProject, CATALOG).project, null);

// Every catalog course must have a COURSE_PATHS entry in tests.js — the two
// lists are independently maintained and must describe the same courses, or
// my-plan.html links nowhere and isCourseExamPassed is permanently false for
// that course (see the "Data Handling: CB" / "Programming with Packages" bugs).
const testsSrc = require('fs').readFileSync(require('path').join(__dirname, '../public/assets/tests.js'), 'utf8');
const block = testsSrc.slice(testsSrc.indexOf('var COURSE_PATHS = {'), testsSrc.indexOf('function coursePath'));
const known = new Set([...block.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]));
CATALOG.courses.forEach((c) => assert.ok(known.has(c.name),
  `catalog course "${c.name}" has no COURSE_PATHS entry — my-plan.html would link nowhere and never mark it passed`));

// COURSE_PATHS *values* must also resolve to real directories — the roadmap
// visuals (my-plan.html, and the 7 Pathway pages) build hrefs from these at
// runtime with no static <a href> for check-content-links.js to see, so a
// renamed course directory would otherwise go undetected here.
const fs = require('fs');
const path = require('path');
const contentDir = path.join(__dirname, '../content');
[...block.matchAll(/^\s*'([^']+)':\s*'([^']+)'/gm)].forEach(([, name, dir]) => {
  const indexPath = path.join(contentDir, dir, 'index.html');
  assert.ok(fs.existsSync(indexPath), `COURSE_PATHS["${name}"] → content/${dir}/index.html does not exist`);
});

// Every PREREQUISITE_GRAPH key and prerequisite value must be a real
// catalog course name — a typo here would silently produce a dead
// relationship (the AI prompt just wouldn't mention it, and
// reorderByPrerequisites would just skip it — no error, just wrong data).
const catalogCourseNames = new Set(CATALOG.courses.map((c) => c.name));
Object.keys(PREREQUISITE_GRAPH).forEach((course) => {
  assert.ok(catalogCourseNames.has(course), `PREREQUISITE_GRAPH key "${course}" is not a real catalog course`);
  PREREQUISITE_GRAPH[course].forEach((prereq) => {
    assert.ok(catalogCourseNames.has(prereq), `PREREQUISITE_GRAPH["${course}"] lists "${prereq}", which is not a real catalog course`);
  });
});

// PREREQUISITE_GRAPH must be acyclic, or reorderByPrerequisites silently
// falls back to unsorted order for any plan touching the cycle. Running
// every graph node through validatePlan and asserting no prerequisite
// lands after its dependent is a permanent, mechanical proof — much
// cheaper than eyeballing ~35 hand-written entries after every edit.
const allGraphNames = Object.keys(PREREQUISITE_GRAPH);
const allNodesReordered = validatePlan(
  { summary: '', courses: allGraphNames.map((name) => ({ name, reason: '' })), project: null, problemSets: [], applications: [] },
  CATALOG
).courses.map((c) => c.name);
assert.strictEqual(allNodesReordered.length, allGraphNames.length, 'PREREQUISITE_GRAPH may contain a cycle — reorderByPrerequisites silently dropped to unsorted order');
allGraphNames.forEach((course) => {
  const courseIndex = allNodesReordered.indexOf(course);
  (PREREQUISITE_GRAPH[course] || []).forEach((prereq) => {
    const prereqIndex = allNodesReordered.indexOf(prereq);
    if (prereqIndex === -1) return; // prereq isn't itself a PREREQUISITE_GRAPH key (e.g. Precalculus) — nothing to order against
    assert.ok(prereqIndex < courseIndex, `"${prereq}" must sort before "${course}" but doesn't — check for a cycle in PREREQUISITE_GRAPH`);
  });
});

// The 5 Advanced+ rows PREREQUISITE_GRAPH shares with tests.js's own
// PREREQUISITES table (Phase 4's course-context Readiness UI) must stay
// identical, or a student sees one prerequisite story on the course page
// and a different one in their AI-generated plan.
const prereqBlock = testsSrc.slice(testsSrc.indexOf('var PREREQUISITES = {'), testsSrc.indexOf('function courseMastery'));
const testsPrerequisites = {};
[...prereqBlock.matchAll(/^\s*'([^']+)':\s*\[([^\]]*)\]/gm)].forEach(([, name, rawArray]) => {
  testsPrerequisites[name] = [...rawArray.matchAll(/'([^']+)'/g)].map((m) => m[1]);
});
Object.keys(testsPrerequisites).forEach((course) => {
  assert.ok(PREREQUISITE_GRAPH[course], `tests.js PREREQUISITES has "${course}" but lib/plan-catalog.js's PREREQUISITE_GRAPH doesn't — the two tables have drifted`);
  assert.deepStrictEqual(PREREQUISITE_GRAPH[course], testsPrerequisites[course],
    `"${course}"'s prerequisites differ between tests.js PREREQUISITES and lib/plan-catalog.js PREREQUISITE_GRAPH`);
});

// reorderByPrerequisites (exercised through validatePlan): a deliberately
// scrambled course order must come back sorted so every prerequisite
// precedes its dependent, with no course added or removed.
const rawPlanScrambled = {
  summary: '',
  courses: [
    { name: 'Linear Algebra A', reason: 'c' },
    { name: 'Precalculus', reason: 'a' },
    { name: 'AP Calculus BC', reason: 'b' },
  ],
  project: null,
  problemSets: [],
  applications: [],
};
const reordered = validatePlan(rawPlanScrambled, CATALOG).courses.map((c) => c.name);
assert.deepStrictEqual(reordered, ['Precalculus', 'AP Calculus BC', 'Linear Algebra A']);

console.log('check-plan-catalog: OK');
