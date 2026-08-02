'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { course, units, lessons } = require('../Programming with Packages/course.js');
const root = path.resolve(__dirname, '..');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(course === 'Programming with Packages', 'Wrong course name');
assert(units.length === 8, `Expected 8 units, found ${units.length}`);
assert(lessons.length === 24, `Expected 24 lessons, found ${lessons.length}`);
assert(new Set(lessons.map((lesson) => lesson.slug)).size === lessons.length, 'Duplicate lesson slug');
lessons.forEach((lesson, index) => {
  assert(lesson.number === index + 1, `${lesson.slug}: broken lesson sequence`);
  ['title', 'subtitle', 'concept', 'pattern', 'warning', 'code', 'source'].forEach((field) => assert(lesson[field], `${lesson.slug}: missing ${field}`));
  assert(lesson.checks.length === 3, `${lesson.slug}: expected 3 recall checks`);
  lesson.checks.forEach((question, questionIndex) => {
    assert(question.prompt && question.correct && question.explain, `${lesson.slug} check ${questionIndex + 1}: incomplete question`);
    assert(question.wrong.length === 2 && new Set([question.correct, ...question.wrong]).size === 3, `${lesson.slug} check ${questionIndex + 1}: invalid choices`);
  });
  assert(/^https:\/\/(?:pandas\.pydata\.org|packaging\.python\.org|maven\.apache\.org|docs\.npmjs\.com)\//.test(lesson.source), `${lesson.slug}: source must be official documentation`);
});
units.forEach((unit, index) => {
  assert(unit.lessons.length === 3, `Unit ${index + 1}: expected 3 lessons`);
  assert(unit.synthesis?.prompt && unit.synthesis?.correct, `Unit ${index + 1}: synthesis question missing`);
  assert(unit.lessons.reduce((sum, lesson) => sum + lesson.checks.length, 0) + 1 === 10, `Unit ${index + 1}: test bank must have 10 questions`);
});

const coverage = `${units.map((unit) => unit.title).join(' ')} ${lessons.map((lesson) => `${lesson.title} ${lesson.concept}`).join(' ')}`.toLowerCase();
['series', 'dataframe', 'select', 'missing', 'sorting', 'aggregation', 'groupby', 'merge', 'relational', 'reshape', 'text', 'date', 'rolling', 'time series', 'pipeline', 'package', 'dependency', 'java', 'javascript', 'c++'].forEach((topic) => assert(coverage.includes(topic), `Course coverage missing ${topic}`));

const pages = [
  'Programming with Packages/index.html', 'Programming with Packages/lesson.html', 'Programming with Packages/unit-test.html',
  'Programming with Packages/course-exam.html', 'Programming with Packages/progress-report.html', 'Programming with Packages/reference/glossary.html',
  'technology.html', 'index.html'
];
let references = 0;
pages.forEach((page) => {
  const file = path.join(root, page), html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(path.dirname(file), decodeURIComponent(target))), `${page}: broken local reference ${match[1]}`);
    references += 1;
  }
});
const technology = fs.readFileSync(path.join(root, 'technology.html'), 'utf8');
assert(technology.includes('Programming%20with%20Packages/index.html'), 'Technology subject lacks course link');
assert(technology.includes('24 lessons across 8 units'), 'Technology subject has stale course count');
const progress = fs.readFileSync(path.join(root, 'Programming with Packages/progress-report.html'), 'utf8');
assert(progress.includes('Unit 1|Unit 2|Unit 3|Unit 4|Unit 5|Unit 6|Unit 7|Unit 8'), 'Progress report gate is incomplete');

console.log(`Programming with Packages audit passed: ${units.length} units, ${lessons.length} lessons, ${lessons.length * 3} recall checks, 80 unit-test questions, and ${references} local references.`);
