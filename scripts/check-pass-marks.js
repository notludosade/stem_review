'use strict';

// Pages must state the pass marks tests.js actually applies
// (PASS_THRESHOLDS): unit tests 80%, course exams 85%. Pathway exams state
// their own marks and aren't checked here.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'public/assets/tests.js'), 'utf8');
assert.match(src, /unit_test: 0\.80,/);
assert.match(src, /course_exam: 0\.85,/);
const dirs = [...src.match(/var COURSE_PATHS = \{([\s\S]*?)\};/)[1].matchAll(/'[^']+':\s*'([^']+)'/g)].map((m) => m[1]);

const MARK = /[Ss]core (\d+)% or higher/g;
const problems = [];
const expect = (where, text, mark) => {
  for (const m of text.matchAll(MARK)) if (Number(m[1]) !== mark) problems.push(`${where}: says ${m[1]}%, should be ${mark}%`);
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
));
dirs.forEach((dir) => {
  const course = path.join(root, 'content', dir);
  walk(course).filter((file) => file.endsWith('.html')).forEach((file) => {
    const rel = path.relative(root, file);
    const html = fs.readFileSync(file, 'utf8');
    if (/unit-test(-[ab])?\.html$/.test(file)) expect(rel, html, 80);
    else if (file.endsWith('course-exam.html')) expect(rel, html, 85);
    else if (file === path.join(course, 'index.html')) {
      for (const card of html.matchAll(/<a class="toc-item"[^>]*href="([^"]+)"[\s\S]*?<\/a>/g)) {
        if (/unit-test/.test(card[1])) expect(`${rel} (${card[1]})`, card[0], 80);
        if (/course-exam/.test(card[1])) expect(`${rel} (${card[1]})`, card[0], 85);
      }
    }
  });
});

// Programming with Packages builds its test pages from course.js.
const packages = fs.readFileSync(path.join(root, 'public/Programming with Packages/course.js'), 'utf8');
for (const m of packages.matchAll(/[^.]*[Ss]core (\d+)% or higher[^.]*/g)) {
  const mark = /clear (this|the) unit/.test(m[0]) ? 80 : 85;
  if (Number(m[1]) !== mark) problems.push(`Programming with Packages course.js: "${m[0].trim().slice(0, 60)}…" should be ${mark}%`);
}

assert.strictEqual(problems.length, 0, `${problems.length} wrong pass marks:\n${problems.slice(0, 10).join('\n')}`);
console.log('check-pass-marks: OK');
