'use strict';

const assert = require('node:assert');
const {
  BASE_SCALES, PENALTY_SECONDS, MAX_REPS,
  benchmarkFactor, questionScore, effectiveSeconds, letterGrade, clampReps,
} = require('../public/assets/timed-mastery.js');
const { courses } = require('../public/assets/problem-banks.js');

assert.strictEqual(benchmarkFactor(null), 1, 'no course data → standard scale');
assert.strictEqual(benchmarkFactor(undefined), 1, 'missing mastery → standard scale');
assert.strictEqual(benchmarkFactor(0), 1.25, '0% mastery → 25% more lenient');
assert.strictEqual(benchmarkFactor(50), 1, '50% mastery → standard scale');
assert.strictEqual(benchmarkFactor(100), 0.75, '100% mastery → 25% stricter');

assert.strictEqual(questionScore(20, 20, 90), 100, 'exactly at the fast mark is full credit');
assert.strictEqual(questionScore(3, 20, 90), 100, 'faster than the fast mark is full credit');
assert.strictEqual(questionScore(90, 20, 90), 0, 'exactly at the slow mark is zero');
assert.strictEqual(questionScore(400, 20, 90), 0, 'slower than the slow mark is zero');
assert.strictEqual(questionScore(55, 20, 90), 50, 'midpoint is 50%');

assert.strictEqual(PENALTY_SECONDS, 5);
assert.strictEqual(effectiveSeconds(12, 0), 12, 'no wrong tries → raw time');
assert.strictEqual(effectiveSeconds(12, 2), 22, 'two wrong tries → +10s');

[[100, 'A'], [90, 'A'], [89, 'B'], [80, 'B'], [79, 'C'], [70, 'C'], [69, 'D'], [60, 'D'], [59, 'F'], [0, 'F']]
  .forEach(([pct, grade]) => assert.strictEqual(letterGrade(pct), grade, `${pct}% should be ${grade}`));

assert.strictEqual(MAX_REPS, 20);
assert.strictEqual(clampReps('7'), 7);
assert.strictEqual(clampReps('25'), 20, 'reps cap at 20');
assert.strictEqual(clampReps('0'), 1, 'reps floor at 1');
assert.strictEqual(clampReps('-3'), 1, 'negative reps floor at 1');
assert.strictEqual(clampReps(''), 10, 'empty reps → default 10');

courses.filter((course) => course.timedQuestions).forEach((course) => {
  const scale = BASE_SCALES[course.slug];
  assert.ok(scale && scale.fast > 0 && scale.fast < scale.slow, `${course.slug} has a timed pool but no valid BASE_SCALES entry`);
});

console.log('Timed Mastery grading checks passed.');
