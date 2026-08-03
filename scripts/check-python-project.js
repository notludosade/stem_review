'use strict';

const fs = require('node:fs');
const path = require('node:path');
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

const root = path.resolve(__dirname, '..');
['index.html', 'sandbox.html', 'python-projects.html', 'python-project.html', 'python-sensor-project.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
  }
});

const taskCount = projects.reduce((total, item) => total + item.project.tasks.length, 0);
const testCount = projects.reduce((total, item) => total + item.project.tasks.reduce((sum, task) => sum + task.tests.length, 0), 0);
console.log(`Python guided-project audit passed: ${projects.length} projects, ${taskCount} ordered tasks, and ${testCount} accuracy tests.`);
