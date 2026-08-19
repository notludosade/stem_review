const assert = require('assert');
const { CATALOG, validatePlan } = require('../lib/plan-catalog');

assert.ok(CATALOG.courses.length >= 30, `expected at least 30 courses, got ${CATALOG.courses.length}`);
assert.ok(CATALOG.projects.length === 7, `expected exactly 7 recommendable projects (8 real capstones minus Mathematics), got ${CATALOG.projects.length}`);
assert.ok(!CATALOG.projects.some((p) => p.id === 'mathematics-capstone'), 'Mathematics Capstone must be excluded');
assert.ok(CATALOG.applications.length === 9, `expected 9 applications, got ${CATALOG.applications.length}`);
assert.ok(CATALOG.problemSets.length === 20, `expected 20 problem sets, got ${CATALOG.problemSets.length}`);

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

console.log('check-plan-catalog: OK');
