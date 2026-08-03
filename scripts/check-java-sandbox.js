'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { problems, topics } = require('../public/assets/java-problems.js');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const supportedTypes = new Set(['int', 'long', 'double', 'boolean', 'String', 'int[]', 'double[]', 'boolean[]', 'String[]', 'int[][]']);
const matchesType = (type, value) => {
  if (type.endsWith('[]')) return Array.isArray(value) && value.every((item) => matchesType(type.slice(0, -2), item));
  if (type === 'String') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'double') return typeof value === 'number' && Number.isFinite(value);
  return Number.isInteger(value);
};

assert(problems.length === 180, `Expected 180 Java problems, found ${problems.length}`);
assert(topics.length === 6, `Expected 6 Java topics, found ${topics.length}`);
const ids = new Set();
const methods = new Set();
const difficultyCounts = new Map();
const topicCounts = new Map();
const cells = new Map();

problems.forEach((problem, index) => {
  assert(problem.id === `java-${String(index + 1).padStart(3, '0')}`, `${problem.id}: unexpected sequence`);
  assert(!ids.has(problem.id), `Duplicate ID: ${problem.id}`);
  assert(!methods.has(problem.methodName), `Duplicate method: ${problem.methodName}`);
  ids.add(problem.id);
  methods.add(problem.methodName);
  assert(['Easy', 'Medium', 'Hard'].includes(problem.difficulty), `${problem.id}: invalid difficulty`);
  assert(problem.title && problem.prompt && problem.hint, `${problem.id}: missing copy`);
  assert(supportedTypes.has(problem.returnType), `${problem.id}: unsupported return type ${problem.returnType}`);
  assert(problem.parameters.every(([type, name]) => supportedTypes.has(type) && /^\w+$/.test(name)), `${problem.id}: invalid parameter`);
  assert(problem.tests.length >= 4, `${problem.id}: fewer than four tests`);
  assert(problem.starter.includes(`public static ${problem.returnType} ${problem.methodName}(`), `${problem.id}: invalid starter`);
  problem.tests.forEach((test, testIndex) => {
    assert(test.args.length === problem.parameters.length, `${problem.id} test ${testIndex + 1}: wrong argument count`);
    test.args.forEach((value, argIndex) => assert(matchesType(problem.parameters[argIndex][0], value), `${problem.id} test ${testIndex + 1}: invalid argument ${argIndex + 1}`));
    assert(matchesType(problem.returnType, test.expected), `${problem.id} test ${testIndex + 1}: invalid expected value`);
  });
  difficultyCounts.set(problem.difficulty, (difficultyCounts.get(problem.difficulty) || 0) + 1);
  topicCounts.set(problem.topic, (topicCounts.get(problem.topic) || 0) + 1);
  const cell = `${problem.topic}:${problem.difficulty}`;
  cells.set(cell, (cells.get(cell) || 0) + 1);
});

['Easy', 'Medium', 'Hard'].forEach((difficulty) => assert(difficultyCounts.get(difficulty) === 60, `${difficulty}: expected 60`));
topics.forEach((topic) => {
  assert(topicCounts.get(topic) === 30, `${topic}: expected 30`);
  ['Easy', 'Medium', 'Hard'].forEach((difficulty) => assert(cells.get(`${topic}:${difficulty}`) === 10, `${topic}/${difficulty}: expected 10`));
});

const expected = (id, test) => problems.find((problem) => problem.id === id).tests[test].expected;
assert(expected('java-001', 0) === 5, 'Addition reference check failed');
assert(JSON.stringify(expected('java-082', 2)) === '[2,3,5,7]', 'Prime-list reference check failed');
assert(expected('java-121', 3) === 97, 'Nth-prime reference check failed');
assert(expected('java-153', 3) === 3, 'Edit-distance reference check failed');
assert(JSON.stringify(expected('java-170', 0)) === '[[3,4],[10,12]]', 'Matrix reference check failed');
assert(expected('java-180', 1) === 4, 'CSV reference check failed');

const root = path.resolve(__dirname, '..');
let localReferences = 0;
['index.html', 'sandbox.html', 'java-sandbox.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
    localReferences += 1;
  }
});

console.log(`Java sandbox audit passed: ${problems.length} problems, ${problems.reduce((sum, problem) => sum + problem.tests.length, 0)} tests, ${localReferences} local references.`);
