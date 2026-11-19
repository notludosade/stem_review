'use strict';
// Assessments: engine behavior + every question pool's structure and answer keys.
const assert = require('node:assert');
const A = require('../public/assets/assessments.js');

// Seeded RNG so draws are reproducible.
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const q = (unit, k, type, extra) => Object.assign({ id: `demo.u${unit}.q${k}`, unit, type, prompt: 'p', explanation: 'e' }, extra);
const demo = {
  course: 'Demo', slug: 'demo',
  questions: [
    q(1, 1, 'single', { choices: ['a', 'b', 'c'], answer: 'b' }),
    q(1, 2, 'truefalse', { answer: true }),
    q(1, 3, 'number', { answer: 0.75 }),
    q(2, 1, 'multi', { choices: ['a', 'b', 'c', 'd'], answers: ['a', 'c'] }),
    q(2, 2, 'order', { items: ['x', 'y', 'z'] }),
    q(2, 3, 'match', { pairs: [['1', 'one'], ['2', 'two'], ['3', 'three']] }),
  ],
};

// drawCourse: 2 per unit, distinct types, unit order.
for (let seed = 1; seed < 30; seed += 1) {
  const drawn = A.drawCourse(demo, seeded(seed));
  assert.strictEqual(drawn.length, 4, 'two per unit');
  assert.deepStrictEqual(drawn.map((x) => x.unit), [1, 1, 2, 2], 'unit order');
  assert.notStrictEqual(drawn[0].type, drawn[1].type, 'unit 1 types differ');
  assert.notStrictEqual(drawn[2].type, drawn[3].type, 'unit 2 types differ');
}
// drawSections: 1 per unit per pool, sections keep pool order.
const sections = A.drawSections([demo, Object.assign({}, demo, { course: 'Demo 2', slug: 'demo2' })], seeded(7));
assert.deepStrictEqual(sections.map((s) => s.slug), ['demo', 'demo2']);
sections.forEach((s) => assert.deepStrictEqual(s.questions.map((x) => x.unit), [1, 2], '1 per unit'));

// scramble never returns the original order.
for (let seed = 1; seed < 50; seed += 1) {
  assert.notDeepStrictEqual(A.scramble(['x', 'y', 'z'], seeded(seed)), ['x', 'y', 'z']);
}
assert.notDeepStrictEqual(A.scramble(['x', 'y'], () => 0.999), ['x', 'y'], 'constant rng still scrambles');

// grade: every type.
const [single, tf, num, multi, order, match] = demo.questions;
assert.strictEqual(A.grade(single, 'b'), 1);
assert.strictEqual(A.grade(single, 'a'), 0);
assert.strictEqual(A.grade(tf, true), 1);
assert.strictEqual(A.grade(tf, false), 0);
assert.strictEqual(A.grade(num, '3/4'), 1, 'fraction accepted');
assert.strictEqual(A.grade(num, '75%'), 1, 'percent accepted');
assert.strictEqual(A.grade(num, '0.8'), 0);
assert.strictEqual(A.grade(num, ''), 0);
assert.strictEqual(A.grade(multi, ['c', 'a']), 1, 'order of picks irrelevant');
assert.strictEqual(A.grade(multi, ['a']), 0, 'missing one');
assert.strictEqual(A.grade(multi, ['a', 'b', 'c']), 0, 'extra wrong pick');
assert.strictEqual(A.grade(order, ['x', 'y', 'z']), 1);
assert.strictEqual(A.grade(order, ['y', 'x', 'z']), 0);
assert.strictEqual(A.grade(match, { 1: 'one', 2: 'two', 3: 'one' }), 2 / 3, 'partial pairs');
const text = { type: 'text', answers: ['Big O', 'O notation'] };
assert.strictEqual(A.grade(text, '  big   o '), 1, 'case and spaces ignored');
assert.strictEqual(A.grade(text, 'theta'), 0);
const written = { type: 'written', rubric: ['a', 'b', 'c', 'd'], model: 'm' };
assert.strictEqual(A.grade(written, { text: 'x', rubric: [true, false, true, false] }), 0.5);
assert.strictEqual(A.grade(written, { text: 'x' }), 0, 'not self-scored yet');
const code = { type: 'code', tests: [1, 2, 3, 4], starter: 'def f(x):\n    pass' };
assert.strictEqual(A.grade(code, { code: 'x', passed: 3, total: 4 }), 0.75);
assert.strictEqual(A.grade(single, undefined), 0, 'unanswered');

// isAnswered.
assert.strictEqual(A.isAnswered(num, '  '), false);
assert.strictEqual(A.isAnswered(multi, []), false);
assert.strictEqual(A.isAnswered(order, ['x', 'y', 'z']), true);
assert.strictEqual(A.isAnswered(code, { code: 'def f(x):\n    pass' }), false, 'untouched starter');
assert.strictEqual(A.isAnswered(code, { code: 'def f(x):\n    return x' }), true);
assert.strictEqual(A.isAnswered(tf, false), true, 'false is an answer');

// scoreAttempt + label.
const score = A.scoreAttempt([
  { question: single, slug: 'demo', response: 'b' },
  { question: tf, slug: 'demo', response: false },
  { question: match, slug: 'demo', response: { 1: 'one', 2: 'two', 3: 'one' } },
]);
assert.strictEqual(score.total, 3);
assert.ok(Math.abs(score.points - (1 + 0 + 2 / 3)) < 1e-9);
assert.deepStrictEqual(score.units['demo.u1'], { points: 1, total: 2 });
assert.strictEqual(score.courses.demo.total, 3);
assert.strictEqual(A.label(0.85), 'Strong');
assert.strictEqual(A.label(0.6), 'Developing');
assert.strictEqual(A.label(0.59), 'Review');

console.log('check-assessments: engine OK');
