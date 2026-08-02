'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const projects = require('../assets/guided-language-projects.js');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const supportedTypes = new Set(['int', 'double', 'boolean', 'String', 'int[]', 'double[]', 'String[]']);
const matchesType = (type, value) => {
  if (type.endsWith('[]')) return Array.isArray(value) && value.every((item) => matchesType(type.slice(0, -2), item));
  if (type === 'String') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'double') return typeof value === 'number' && Number.isFinite(value);
  return Number.isInteger(value);
};
const round = (value) => Number(value.toFixed(2));
const reference = {
  normalizeTopic: (topic) => topic.trim().replace(/\s+/g, ' ').toUpperCase(),
  totalMinutes: (minutes) => minutes.reduce((sum, value) => sum + value, 0),
  averageScore: (scores) => scores.length ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
  masteryBand: (average) => average >= 90 ? 'Mastery' : average >= 80 ? 'Proficient' : average >= 70 ? 'Developing' : average >= 60 ? 'Emerging' : 'Beginning',
  countPassed: (scores) => scores.filter((score) => score >= 60).length,
  longestStudyStreak(days) {
    const ordered = [...new Set(days)].sort((a, b) => a - b);
    let best = 0, run = 0, previous = null;
    ordered.forEach((day) => { run = previous !== null && day === previous + 1 ? run + 1 : 1; best = Math.max(best, run); previous = day; });
    return best;
  }
};
reference.isValidSession = (topic, minutes, score) => reference.normalizeTopic(topic) !== '' && Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 && Number.isFinite(score) && score >= 0 && score <= 100;
reference.uniqueTopics = (topics) => [...new Set(topics.map(reference.normalizeTopic).filter(Boolean))].sort();
reference.productivityScore = (minutes, scores) => minutes.length && minutes.length === scores.length ? round(reference.totalMinutes(minutes) * reference.averageScore(scores) / 100) : 0;
reference.buildStudyReport = (topics, minutes, scores, days) => {
  const keptTopics = [], keptMinutes = [], keptScores = [];
  for (let index = 0; index < Math.min(topics.length, minutes.length, scores.length); index += 1) {
    if (reference.isValidSession(topics[index], minutes[index], scores[index])) { keptTopics.push(topics[index]); keptMinutes.push(minutes[index]); keptScores.push(scores[index]); }
  }
  const average = reference.averageScore(keptScores);
  return `topics=${reference.uniqueTopics(keptTopics).join('|')};sessions=${keptTopics.length};minutes=${reference.totalMinutes(keptMinutes)};average=${average.toFixed(2)};band=${reference.masteryBand(average)};passed=${reference.countPassed(keptScores)};streak=${reference.longestStudyStreak(days)};productivity=${reference.productivityScore(keptMinutes, keptScores).toFixed(2)}`;
};
const equivalent = (actual, expected) => typeof actual === 'number' && typeof expected === 'number'
  ? Math.abs(actual - expected) <= 1e-9 : JSON.stringify(actual) === JSON.stringify(expected);

assert(JSON.stringify(Object.keys(projects).sort()) === JSON.stringify(['cpp', 'java', 'javascript']), 'Expected Java, JavaScript, and C++ projects');
Object.values(projects).forEach((project) => {
  assert(project.tasks.length === 10, `${project.language}: expected 10 tasks`);
  assert(new Set(project.tasks.map((task) => task.course)).size === 3, `${project.language}: expected all three course levels`);
  project.tasks.forEach((task, index) => {
    assert(task.id === `${project.key}-study-project-task-${index + 1}`, `${task.id}: broken task sequence`);
    assert(task.tests.length >= 4, `${task.id}: fewer than four tests`);
    assert(supportedTypes.has(task.returnType), `${task.id}: unsupported return type`);
    assert(task.parameters.every(([type, name]) => supportedTypes.has(type) && /^\w+$/.test(name)), `${task.id}: invalid parameter`);
    assert(project.starter.includes(task.entry), `${task.id}: starter entry missing`);
    assert(task.concepts.length >= 2, `${task.id}: insufficient course-application checks`);
    task.concepts.forEach((concept) => concept.patterns.forEach((pattern) => new RegExp(pattern, 'm')));
    task.tests.forEach((test, testIndex) => {
      assert(test.args.length === task.parameters.length, `${task.id} test ${testIndex + 1}: wrong argument count`);
      test.args.forEach((value, argIndex) => assert(matchesType(task.parameters[argIndex][0], value), `${task.id} test ${testIndex + 1}: invalid argument`));
      assert(matchesType(task.returnType, test.expected), `${task.id} test ${testIndex + 1}: invalid expected value`);
      assert(equivalent(reference[task.entry](...JSON.parse(JSON.stringify(test.args))), test.expected), `${task.id} test ${testIndex + 1}: incorrect answer`);
    });
  });
});

new Function(`${projects.javascript.starter}\nreturn true;`)();
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'stem-guided-projects-'));
try {
  const javaSource = path.join(temporary, 'Main.java');
  fs.writeFileSync(javaSource, projects.java.starter);
  const javaCompile = spawnSync('javac', [javaSource], { encoding: 'utf8' });
  assert(javaCompile.status === 0 || /Unable to locate a Java Runtime/.test(javaCompile.stderr), `Java starter does not compile:\n${javaCompile.stderr}`);
  const cppSource = path.join(temporary, 'project.cpp');
  const cppBinary = path.join(temporary, 'project');
  fs.writeFileSync(cppSource, `${projects.cpp.starter}\nint main() { return 0; }\n`);
  const cppCompile = spawnSync('c++', ['-std=c++20', cppSource, '-o', cppBinary], { encoding: 'utf8' });
  assert(cppCompile.status === 0, `C++ starter does not compile:\n${cppCompile.stderr}`);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }

const root = path.resolve(__dirname, '..');
['index.html', 'sandbox.html', 'python-projects.html', 'guided-language-project.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
  }
});
const picker = fs.readFileSync(path.join(root, 'python-projects.html'), 'utf8');
Object.keys(projects).forEach((key) => assert(picker.includes(`guided-language-project.html?project=${key}`), `Project picker lacks ${key}`));

const tests = Object.values(projects).reduce((sum, project) => sum + project.tasks.reduce((count, task) => count + task.tests.length, 0), 0);
console.log(`Guided language-project audit passed: 3 projects, 30 tasks, and ${tests} independently recomputed answers.`);
