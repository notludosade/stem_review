'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const projects = [
  { project: require('../public/assets/python-projects.js'), idPrefix: 'python-project-task-' },
  { project: require('../public/assets/python-sensor-project.js'), idPrefix: 'python-sensor-task-' }
];

projects.forEach(({ project, idPrefix }) => {
  assert(project.tasks.length === 10, `${project.title}: expected 10 tasks, found ${project.tasks.length}`);
  assert(new Set(project.tasks.map((task) => task.course)).size === 3, `${project.title}: must span all three programming courses`);
  const entries = new Set();
  project.tasks.forEach((task, index) => {
    assert(task.id === `${idPrefix}${index + 1}`, `${task.id}: broken task sequence`);
    assert(!entries.has(task.entry), `${task.id}: duplicate entry ${task.entry}`);
    entries.add(task.entry);
    assert(task.tests.length >= 4, `${task.id}: expected at least four accuracy tests`);
    assert(task.concepts.length >= 2, `${task.id}: insufficient course-application checks`);
    task.concepts.forEach((concept) => concept.patterns.forEach((pattern) => new RegExp(pattern, 'm')));
    assert(task.runtimeBudgetMs > 0 && task.maxLines > 0, `${task.id}: invalid scoring budget`);
    assert(new RegExp(`(?:def|class) ${task.entry}\\b`).test(project.starter), `${task.id}: missing starter entry`);
    assert(new RegExp(`(?:def|class) ${task.entry}\\b`).test(task.answer), `${task.id}: missing reference answer`);
    if (task.entryType === 'class') {
      assert(task.classCheck?.addMethod, `${task.id}: class task lacks an add method`);
      assert(Object.keys(task.classCheck?.outputs || {}).length > 0, `${task.id}: class task lacks checked outputs`);
    }
    task.tests.forEach((test, testIndex) => {
      assert(Array.isArray(test.args), `${task.id} test ${testIndex + 1}: args must be an array`);
      assert(test.expected !== undefined, `${task.id} test ${testIndex + 1}: missing expected value`);
    });
  });
});

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'stem-python-projects-'));
const runner = `import copy, json, sys

namespace = {}
exec(open(sys.argv[1], encoding='utf-8').read(), namespace)

def same(actual, expected):
    if isinstance(actual, (int, float)) and not isinstance(actual, bool) and isinstance(expected, (int, float)) and not isinstance(expected, bool):
        return abs(actual - expected) <= 1e-9
    if isinstance(actual, dict) and isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(same(actual[key], expected[key]) for key in actual)
    if isinstance(actual, (list, tuple)) and isinstance(expected, list):
        return len(actual) == len(expected) and all(same(a, e) for a, e in zip(actual, expected))
    return actual == expected

for task in json.load(sys.stdin):
    target = namespace[task['entry']]
    for index, case in enumerate(task['tests'], 1):
        if task['entryType'] == 'class':
            instance = target()
            for record in case['args'][0]:
                getattr(instance, task['classCheck']['addMethod'])(copy.deepcopy(record))
            actual = {key: getattr(instance, method)() for key, method in task['classCheck']['outputs'].items()}
        else:
            actual = target(*copy.deepcopy(case['args']))
        if not same(actual, case['expected']):
            raise AssertionError(f"{task['entry']} test {index}: {actual!r} != {case['expected']!r}")
`;
try {
  const runnerPath = path.join(temporary, 'check.py');
  fs.writeFileSync(runnerPath, runner);
  projects.forEach(({ project }, index) => {
    const answerPath = path.join(temporary, `answers-${index}.py`);
    const imports = project.starter.split(/\n(?=def |class )/)[0].trim();
    fs.writeFileSync(answerPath, `${imports}\n\n${project.tasks.map((task) => task.answer).join('\n\n')}\n`);
    const result = spawnSync('python3', [runnerPath, answerPath], { input: JSON.stringify(project.tasks), encoding: 'utf8' });
    assert(result.status === 0, `${project.title}: reference answers failed:\n${result.stderr}`);
  });
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }

const root = path.resolve(__dirname, '../public');
['sandbox.html', 'python-projects.html', 'python-project.html', 'python-sensor-project.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || target === 'index.html' || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
  }
});
['python-project.html', 'python-sensor-project.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert(html.includes('data-project-answer-button'), `${page}: missing Show Answer button`);
  assert(html.includes('data-project-answer-code'), `${page}: missing reference-answer panel`);
});

const taskCount = projects.reduce((total, item) => total + item.project.tasks.length, 0);
const testCount = projects.reduce((total, item) => total + item.project.tasks.reduce((sum, task) => sum + task.tests.length, 0), 0);
console.log(`Python guided-project audit passed: ${projects.length} projects, ${taskCount} ordered tasks, and ${testCount} accuracy tests.`);
