'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { problems, topics } = require('../assets/pandas-problems.js');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(problems.length === 190, `Expected 190 Pandas problems, found ${problems.length}`);
assert(topics.length === 19, `Expected 19 Pandas topics, found ${topics.length}`);
const expectedDifficulties = { Easy: 60, Medium: 60, Hard: 60, Expert: 10 };
const ids = new Set();
const functions = new Set();
Object.entries(expectedDifficulties).forEach(([difficulty, count]) => {
  assert(problems.filter((problem) => problem.difficulty === difficulty).length === count, `${difficulty}: expected ${count}`);
});
problems.forEach((problem, index) => {
  assert(problem.id === `pd-${String(index + 1).padStart(3, '0')}`, `${problem.id}: broken ID sequence`);
  assert(!ids.has(problem.id), `${problem.id}: duplicate ID`);
  assert(!functions.has(problem.functionName), `${problem.id}: duplicate function name`);
  ids.add(problem.id);
  functions.add(problem.functionName);
  assert(problem.tests.length === 4, `${problem.id}: expected four tests`);
  assert(problem.parameters.length === problem.argKinds.length, `${problem.id}: argument metadata mismatch`);
  assert(problem.starter.includes(`def ${problem.functionName}(`), `${problem.id}: invalid starter`);
  problem.tests.forEach((test, testIndex) => {
    assert(test.args.length === problem.parameters.length, `${problem.id} test ${testIndex + 1}: argument count mismatch`);
    assert(test.expected !== undefined, `${problem.id} test ${testIndex + 1}: missing expected answer`);
  });
});
topics.forEach((topic) => assert(problems.filter((problem) => problem.topic === topic).length === 10, `${topic}: expected ten problems`));

const answer = (number) => problems[number - 1].tests[0].expected;
assert(JSON.stringify(answer(1)) === '[2,3,4,5]', 'Scalar addition reference failed');
assert(JSON.stringify(answer(61)) === '{"sum":30,"mean":10,"min":5,"max":15}', 'Aggregation reference failed');
assert(JSON.stringify(answer(121)) === '[1,3,5,7]', 'Rolling reference failed');
assert(answer(180).score_total === 160, 'Pipeline reference failed');
assert(answer(181)[0].retained_rate === 1, 'Expert cohort reference failed');
assert(answer(190)[0].difference === 20, 'Expert reconciliation reference failed');

const root = path.resolve(__dirname, '..');
['index.html', 'sandbox.html', 'pandas-sandbox.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
  }
});

console.log(`Pandas sandbox audit passed: ${problems.length} problems, ${problems.reduce((total, problem) => total + problem.tests.length, 0)} tests, ${topics.length} topics.`);
