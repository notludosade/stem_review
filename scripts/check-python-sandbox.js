'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { problems, topics } = require('../public/assets/python-problems.js');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(problems.length === 180, `Expected 180 Python problems, found ${problems.length}`);
assert(topics.length === 6, `Expected 6 topics, found ${topics.length}`);

const ids = new Set();
const functions = new Set();
const topicCounts = new Map();
const difficultyCounts = new Map();
problems.forEach((problem) => {
  assert(!ids.has(problem.id), `Duplicate problem ID: ${problem.id}`);
  assert(!functions.has(problem.functionName), `Duplicate function name: ${problem.functionName}`);
  ids.add(problem.id);
  functions.add(problem.functionName);
  assert(problem.title && problem.prompt && problem.hint, `${problem.id}: missing copy`);
  assert(['Easy', 'Medium', 'Hard'].includes(problem.difficulty), `${problem.id}: invalid difficulty`);
  assert(problem.tests.length >= 4, `${problem.id}: fewer than 4 tests`);
  assert(problem.starter.startsWith(`def ${problem.functionName}(`), `${problem.id}: invalid starter`);
  assert(!/^\s*(?:from|import)\s/m.test(problem.reference), `${problem.id}: reference uses an import`);
  topicCounts.set(problem.topic, (topicCounts.get(problem.topic) || 0) + 1);
  difficultyCounts.set(problem.difficulty, (difficultyCounts.get(problem.difficulty) || 0) + 1);
});
topicCounts.forEach((count, topic) => assert(count === 30, `${topic}: expected 30 problems, found ${count}`));
['Easy', 'Medium', 'Hard'].forEach((difficulty) => assert(difficultyCounts.get(difficulty) === 60, `${difficulty}: expected 60 problems, found ${difficultyCounts.get(difficulty) || 0}`));

const harness = String.raw`
import json, math, sys, traceback

def equivalent(actual, expected):
    if isinstance(actual, bool) or isinstance(expected, bool):
        return actual is expected
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(actual, list) and isinstance(expected, list):
        return len(actual) == len(expected) and all(equivalent(a, b) for a, b in zip(actual, expected))
    if isinstance(actual, dict) and isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(equivalent(actual[key], expected[key]) for key in actual)
    return actual == expected

failures = []
for problem in json.load(sys.stdin):
    try:
        namespace = {}
        exec(problem['reference'], namespace)
        solution = namespace[problem['functionName']]
        for index, case in enumerate(problem['tests'], 1):
            actual = solution(*case['args'])
            if not equivalent(actual, case['expected']):
                failures.append(f"{problem['id']} test {index}: expected {case['expected']!r}, got {actual!r}")
    except Exception:
        failures.append(f"{problem['id']}: {traceback.format_exc().strip()}")

if failures:
    print('\n'.join(failures))
    raise SystemExit(1)
print('reference solutions passed')
`;

const run = spawnSync('python3', ['-c', harness], {
  input: JSON.stringify(problems),
  encoding: 'utf8'
});
assert(run.status === 0, run.stdout || run.stderr || 'Python reference validation failed');

const root = path.resolve(__dirname, '..');
let localReferences = 0;
['index.html', 'sandbox.html', 'python-sandbox.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
    localReferences += 1;
  }
});
assert(fs.existsSync(path.join(root, 'public/assets/python-worker.js')), 'Missing Python worker');

console.log(`Python sandbox audit passed: ${problems.length} problems, ${problems.reduce((sum, problem) => sum + problem.tests.length, 0)} tests, ${localReferences} local references.`);
