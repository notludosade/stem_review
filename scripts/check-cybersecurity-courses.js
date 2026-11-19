'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const courses = [
  { dir: 'Cybersecurity+', name: 'Cybersecurity+', topics: ['cryptography', 'forensics', 'web exploitation', 'reverse engineering', 'binary exploitation', 'general skills'] },
  { dir: 'Bash for Cybersecurity', name: 'Bash for Cybersecurity', topics: ['quoting', 'redirection', 'pipe', 'grep', 'find', 'permissions', 'ssh', 'script'] },
];

courses.forEach(({ dir, name, topics }) => {
  const data = require(path.join(root, 'public', dir, 'course.js'));
  assert.strictEqual(data.course, name);
  assert.strictEqual(data.units.length, 8, `${name}: expected 8 units`);
  assert.strictEqual(data.lessons.length, 24, `${name}: expected 24 lessons`);
  assert.strictEqual(data.labs.length, 12, `${name}: expected 12 lab tasks`);
  assert.strictEqual(new Set(data.lessons.map((lesson) => lesson.slug)).size, 24, `${name}: duplicate lesson slug`);
  data.units.forEach((unit, unitIndex) => {
    assert.strictEqual(unit.lessons.length, 3, `${name} Unit ${unitIndex + 1}: expected 3 lessons`);
    assert(unit.synthesis?.prompt && unit.synthesis?.correct, `${name} Unit ${unitIndex + 1}: missing synthesis question`);
    assert.strictEqual(unit.lessons.flatMap((lesson) => lesson.checks).length + 1, 10, `${name} Unit ${unitIndex + 1}: test bank must contain 10 questions`);
  });
  data.lessons.forEach((lesson, index) => {
    assert.strictEqual(lesson.number, index + 1, `${name}: broken lesson numbering`);
    ['title', 'subtitle', 'good', 'study', 'apply', 'source', 'practice'].forEach((field) => assert(lesson[field], `${name}/${lesson.slug}: missing ${field}`));
    assert(lesson.key.length >= 2 && lesson.key.every(([term, definition]) => term && definition), `${name}/${lesson.slug}: incomplete key concepts`);
    assert.strictEqual(lesson.checks.length, 3, `${name}/${lesson.slug}: expected 3 recall checks`);
    lesson.checks.forEach((question) => assert(question.prompt && question.correct && question.explain && question.wrong.length === 2 && new Set([question.correct, ...question.wrong]).size === 3, `${name}/${lesson.slug}: invalid recall question`));
    assert(/^https:\/\/(?:picoctf\.org|primer\.picoctf\.org|www\.cylab\.cmu\.edu|csrc\.nist\.gov|owasp\.org|www\.gnu\.org)\//.test(lesson.source), `${name}/${lesson.slug}: source is not an approved primary reference`);
  });
  data.labs.forEach((task, index) => assert(task.title && task.brief && task.prompt && task.answers?.length && task.hint && task.explain, `${name} lab ${index + 1}: incomplete task`));
  const coverage = `${data.units.map((unit) => unit.title).join(' ')} ${data.lessons.map((lesson) => `${lesson.title} ${lesson.key.flat().join(' ')}`).join(' ')}`.toLowerCase();
  topics.forEach((topic) => assert(coverage.includes(topic), `${name}: missing curriculum topic ${topic}`));
  ['index.html', 'lesson.html', 'unit-test.html', 'course-exam.html', 'progress-report.html', 'reference/glossary.html', 'lab.html'].forEach((file) => assert(fs.existsSync(path.join(root, 'content', dir, file)), `${name}: missing ${file}`));
});

const runtime = fs.readFileSync(path.join(root, 'public/assets/course-runtime.js'), 'utf8');
['data-course-lesson', 'data-course-unit-test', 'data-course-exam', 'data-course-glossary', 'data-course-lab'].forEach((hook) => assert(runtime.includes(hook), `course runtime missing ${hook}`));
assert(runtime.includes('score 80% or higher') && runtime.includes('score 85% or higher'), 'course runtime pass marks are missing');
const technology = fs.readFileSync(path.join(root, 'content/technology.html'), 'utf8');
assert(technology.includes('Cybersecurity%2B/index.html') && technology.includes('Bash%20for%20Cybersecurity/index.html'), 'Technology hub is missing cybersecurity courses');

console.log('Cybersecurity course audit passed: 2 courses, 16 units, 48 lessons, 144 recall checks, and 24 embedded lab tasks.');
