'use strict';

// Pins the mastery rules (public/assets/mastery.js) against the real skill
// catalog: each state's threshold, and which evidence reaches which skill.
const assert = require('node:assert');
const { computeMastery, readiness, nextStep, reviewList, STATES } = require('../public/assets/mastery.js');
const catalog = require('../public/assets/skill-catalog.json');

assert.deepStrictEqual(STATES, ['unseen', 'learning', 'practiced', 'proficient', 'mastered', 'applied']);

const empty = { lessons: {}, results: [], problems: {}, completedProjects: [], diagnostics: {}, completedApplications: [] };
const stateOf = (evidence, id) => computeMastery(catalog, { ...empty, ...evidence })[id].state;
const unitTest = (unit, score, passed, course = 'Precalculus') => ({ course, unit, kind: 'unit_test', score, total: 10, passed });
const seen = '2026-10-05T00:00:00.000Z';

const blank = computeMastery(catalog, empty);
assert.strictEqual(Object.keys(blank).length, catalog.skills.length);
assert.ok(Object.values(blank).every((skill) => skill.state === 'unseen'));

// Learning: a lesson in the unit's folder; course.js lessons match exactly.
const skill = (id) => catalog.skills.find((s) => s.id === id);
const precalcLesson = skill('precalculus.u3').lessons[0].page;
assert.strictEqual(stateOf({ lessons: { [precalcLesson]: seen } }, 'precalculus.u3'), 'learning');
assert.strictEqual(stateOf({ lessons: { [precalcLesson]: seen } }, 'precalculus.u2'), 'unseen');
assert.strictEqual(stateOf({ lessons: { '/Precalculus/Unit 3/unit-test-a.html': seen } }, 'precalculus.u3'), 'unseen');
const packageLesson = skill('programming-with-packages.u1').lessons[0].page;
assert.strictEqual(stateOf({ lessons: { [packageLesson]: seen } }, 'programming-with-packages.u1'), 'learning');
assert.strictEqual(stateOf({ lessons: { [`${packageLesson}-extra`]: seen } }, 'programming-with-packages.u1'), 'unseen');

// Practiced: 5 attempts in the unit's topics, or any unit-test attempt.
assert.strictEqual(stateOf({ problems: { 'precalculus.u3': { attempted: 4, correct: 4 } } }, 'precalculus.u3'), 'unseen');
assert.strictEqual(stateOf({ problems: { 'precalculus.u3': { attempted: 5, correct: 0 } } }, 'precalculus.u3'), 'practiced');
assert.strictEqual(stateOf({ results: [unitTest('Unit 3', 2, false)] }, 'precalculus.u3'), 'practiced');

// Proficient: 80% first-try on 10+, or a best unit-test score of 70%.
assert.strictEqual(stateOf({ problems: { 'precalculus.u3': { attempted: 10, correct: 8 } } }, 'precalculus.u3'), 'proficient');
assert.strictEqual(stateOf({ problems: { 'precalculus.u3': { attempted: 10, correct: 7 } } }, 'precalculus.u3'), 'practiced');
assert.strictEqual(stateOf({ problems: { 'precalculus.u3': { attempted: 9, correct: 9 } } }, 'precalculus.u3'), 'practiced');
assert.strictEqual(stateOf({ results: [unitTest('Unit 3', 7, false)] }, 'precalculus.u3'), 'proficient');

// Mastered: the unit test's saved pass, or the course exam.
assert.strictEqual(stateOf({ results: [unitTest('Unit 3', 4, false), unitTest('Unit 3', 8, true)] }, 'precalculus.u3'), 'mastered');
const exam = { results: [{ course: 'Precalculus', unit: 'Course Exam', kind: 'course_exam', score: 18, total: 20, passed: true }] };
assert.ok(catalog.skills.filter((skill) => skill.course === 'Precalculus').every((skill) => stateOf(exam, skill.id) === 'mastered'));
assert.strictEqual(stateOf(exam, 'ap-calculus-bc.u1'), 'unseen');
assert.strictEqual(stateOf({ results: [{ ...exam.results[0], passed: false }] }, 'precalculus.u3'), 'unseen');

// Applied: mastered and a completed capstone covering the course.
assert.strictEqual(stateOf({ completedProjects: ['mathematics-capstone'] }, 'precalculus.u3'), 'unseen');
assert.strictEqual(stateOf({ ...exam, completedProjects: ['mathematics-capstone'] }, 'precalculus.u3'), 'applied');
assert.strictEqual(stateOf({ ...exam, completedProjects: ['cloud-devops-capstone'] }, 'precalculus.u3'), 'mastered');

// Applications: a completed one makes its listed Mastered skills Applied.
const satellite = { completedApplications: ['keeping-a-satellite-in-orbit'] };
const physicsPassed = { results: [unitTest('Unit 2', 9, true, 'AP Physics 1'), unitTest('Unit 3', 9, true, 'AP Physics 1')] };
assert.strictEqual(stateOf({ ...physicsPassed, ...satellite }, 'ap-physics-1.u2'), 'applied');
assert.strictEqual(stateOf({ ...physicsPassed, ...satellite }, 'ap-physics-1.u3'), 'mastered');
assert.strictEqual(stateOf(satellite, 'ap-physics-c-mechanics.u7'), 'unseen');
assert.strictEqual(stateOf(physicsPassed, 'ap-physics-1.u2'), 'mastered');

// Diagnostics: all right → Proficient, some right → Practiced, none → no
// change; never Mastered; the newest diagnostic that tested a skill wins.
const diagnostic = (takenAt, answers) => ({ takenAt, answers: answers.map(([skillId, correct], i) => ({ skillId, questionId: `q${i}`, correct })) });
const diag = (answers) => ({ diagnostics: { mathematics: diagnostic('2026-10-05T10:00:00.000Z', answers) } });
assert.strictEqual(stateOf(diag([['precalculus.u3', true], ['precalculus.u3', true]]), 'precalculus.u3'), 'proficient');
assert.strictEqual(stateOf(diag([['precalculus.u3', true], ['precalculus.u3', false]]), 'precalculus.u3'), 'practiced');
assert.strictEqual(stateOf(diag([['precalculus.u3', false], ['precalculus.u3', false]]), 'precalculus.u3'), 'unseen');
assert.strictEqual(stateOf(diag([['precalculus.u3', true], ['precalculus.u3', true]]), 'precalculus.u2'), 'unseen');
assert.strictEqual(stateOf({ ...diag([['precalculus.u3', true], ['precalculus.u3', true]]), results: [unitTest('Unit 3', 9, true)] }, 'precalculus.u3'), 'mastered');
const both = { diagnostics: {
  mathematics: diagnostic('2026-10-05T10:00:00.000Z', [['precalculus.u3', true], ['precalculus.u3', true]]),
  'engineering-physics': diagnostic('2026-10-05T11:00:00.000Z', [['precalculus.u3', false]]),
} };
assert.strictEqual(stateOf(both, 'precalculus.u3'), 'unseen');
both.diagnostics['engineering-physics'].takenAt = '2026-10-05T09:00:00.000Z';
assert.strictEqual(stateOf(both, 'precalculus.u3'), 'proficient');

// Readiness: Pathway skills at Proficient or above, over all its skills.
const mathematics = catalog.pathways.find((pathway) => pathway.slug === 'mathematics');
const mathSkills = catalog.skills.filter((skill) => mathematics.courses.includes(skill.course)).length;
assert.deepStrictEqual(readiness(catalog, computeMastery(catalog, empty), mathematics), { ready: 0, total: mathSkills, percent: 0 });
const examReady = readiness(catalog, computeMastery(catalog, { ...empty, ...exam }), mathematics);
assert.deepStrictEqual(examReady, { ready: 6, total: mathSkills, percent: Math.round(600 / mathSkills) });

// nextStep: first unit below Mastered in track course order; unopened
// lesson while Unseen/Learning, otherwise its unit test.
const step = (evidence) => {
  const full = { ...empty, ...evidence };
  return nextStep(catalog, computeMastery(catalog, full), full, mathematics.courses);
};
const firstUnit = skill('precalculus.u1');
let s1 = step({});
assert.deepStrictEqual([s1.kind, s1.skill.id, s1.lesson.page], ['lesson', 'precalculus.u1', firstUnit.lessons[0].page]);
s1 = step({ lessons: { [firstUnit.lessons[0].page]: seen } });
assert.deepStrictEqual([s1.kind, s1.lesson.page], ['lesson', firstUnit.lessons[1].page]);
s1 = step({ lessons: Object.fromEntries(firstUnit.lessons.map((lesson) => [lesson.page, seen])) });
assert.deepStrictEqual([s1.kind, s1.skill.id], ['test', 'precalculus.u1']);
s1 = step({ problems: { 'precalculus.u1': { attempted: 5, correct: 1 } } });
assert.deepStrictEqual([s1.kind, s1.skill.id], ['test', 'precalculus.u1']);
s1 = step({ results: [unitTest('Unit 1', 9, true)] });
assert.deepStrictEqual([s1.kind, s1.skill.id], ['lesson', 'precalculus.u2']);
s1 = step(exam);
assert.deepStrictEqual([s1.kind, s1.skill.id], ['lesson', 'ap-calculus-bc.u1']);
const allExams = { results: mathematics.courses.map((course) => ({ course, unit: 'Course Exam', kind: 'course_exam', score: 20, total: 20, passed: true })) };
assert.strictEqual(step(allExams).kind, 'done');

// reviewList: started-but-not-mastered units, weakest first, at most 5.
const review = (evidence) => reviewList(catalog, computeMastery(catalog, { ...empty, ...evidence }));
const ethics = { course: 'Computer Programming Ethics', unit: 'Unit 1', kind: 'unit_test', score: 7, total: 10, passed: false };
const list = review({
  problems: { 'precalculus.u3': { attempted: 10, correct: 8 }, 'precalculus.u2': { attempted: 5, correct: 1 } },
  results: [unitTest('Unit 1', 9, true), ethics],
});
assert.deepStrictEqual(list.map((item) => item.skill.id), ['precalculus.u2', 'computer-programming-ethics.u1', 'precalculus.u3']);
assert.deepStrictEqual(list[0].action, { kind: 'practice', slug: 'precalculus', topic: 'Polynomial functions' });
assert.deepStrictEqual(list[1].action, { kind: 'test' });
const many = review({ problems: Object.fromEntries(['u1', 'u2', 'u3', 'u4', 'u6'].map((u) => [`precalculus.${u}`, { attempted: 5, correct: 0 }]).concat([['ap-calculus-bc.u1', { attempted: 5, correct: 0 }], ['ap-calculus-bc.u2', { attempted: 5, correct: 0 }]])) });
assert.strictEqual(many.length, 5);
assert.deepStrictEqual(review({}), []);

console.log(`check-mastery: OK (${catalog.skills.length} skills)`);
