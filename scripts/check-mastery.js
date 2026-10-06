'use strict';

// Pins the mastery rules (public/assets/mastery.js) against the real skill
// catalog: each state's threshold, and which evidence reaches which skill.
const assert = require('node:assert');
const { computeMastery, readiness, STATES } = require('../public/assets/mastery.js');
const catalog = require('../public/assets/skill-catalog.json');

assert.deepStrictEqual(STATES, ['unseen', 'learning', 'practiced', 'proficient', 'mastered', 'applied']);

const empty = { lessons: {}, results: [], problems: {}, completedProjects: [], diagnostics: {} };
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

console.log(`check-mastery: OK (${catalog.skills.length} skills)`);
