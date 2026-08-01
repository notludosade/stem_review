'use strict';

const fs = require('node:fs');
const path = require('node:path');
const project = require('../assets/python-projects.js');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(project.tasks.length === 10, `Expected 10 project tasks, found ${project.tasks.length}`);
assert(new Set(project.tasks.map((task) => task.course)).size === 3, 'Project must span Computer Programming 1, 2, and 2+');
const entries = new Set();
project.tasks.forEach((task, index) => {
  assert(task.id === `python-project-task-${index + 1}`, `${task.id}: broken task sequence`);
  assert(!entries.has(task.entry), `${task.id}: duplicate entry ${task.entry}`);
  entries.add(task.entry);
  assert(task.tests.length >= 4, `${task.id}: expected at least four accuracy tests`);
  assert(task.concepts.length >= 2, `${task.id}: insufficient course-application checks`);
  task.concepts.forEach((concept) => concept.patterns.forEach((pattern) => new RegExp(pattern, 'm')));
  assert(task.runtimeBudgetMs > 0 && task.maxLines > 0, `${task.id}: invalid scoring budget`);
  assert(new RegExp(`(?:def|class) ${task.entry}\\b`).test(project.starter), `${task.id}: missing starter entry`);
  task.tests.forEach((test, testIndex) => {
    assert(Array.isArray(test.args), `${task.id} test ${testIndex + 1}: args must be an array`);
    assert(test.expected !== undefined, `${task.id} test ${testIndex + 1}: missing expected value`);
  });
});

const root = path.resolve(__dirname, '..');
['index.html', 'sandbox.html', 'python-project.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
  }
});

console.log(`Python guided-project audit passed: ${project.tasks.length} ordered tasks and ${project.tasks.reduce((total, task) => total + task.tests.length, 0)} accuracy tests.`);
