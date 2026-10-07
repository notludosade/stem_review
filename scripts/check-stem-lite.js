'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { build, OUTPUT, COURSES, APPLICATIONS, PROJECTS } = require('./build-stem-lite');

build();

const files = [];
function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else files.push(file);
  });
}
walk(OUTPUT);

const htmlFiles = files.filter((file) => file.endsWith('.html'));
assert(htmlFiles.length > 100, `expected a substantial static curriculum, found ${htmlFiles.length} HTML files`);
['index.html', 'courses.html', 'practice.html', 'applications.html', 'projects.html', 'search.html', 'calculators.html', 'Calculators/scientific.html', 'Calculators/graphing.html'].forEach((rel) => {
  assert(fs.existsSync(path.join(OUTPUT, rel)), `missing ${rel}`);
});
COURSES.forEach((course) => assert(fs.existsSync(path.join(OUTPUT, course.path, 'index.html')), `missing course ${course.title}`));
APPLICATIONS.forEach((item) => assert(fs.existsSync(path.join(OUTPUT, 'Applications', `${item.slug}.html`)), `missing application ${item.title}`));
PROJECTS.forEach((item) => assert(fs.existsSync(path.join(OUTPUT, 'Projects', `${item.slug}.html`)), `missing project ${item.title}`));

const blocked = /(?:account|auth|frq|mastery|reports|tests)\.js/i;
htmlFiles.forEach((file) => {
  const html = fs.readFileSync(file, 'utf8');
  assert(!html.includes('STEM+ Lite'), `${path.relative(OUTPUT, file)} uses the forbidden product name`);
  assert(!blocked.test(html), `${path.relative(OUTPUT, file)} loads a full-platform-only script`);
  assert(!/(?:href|src)=["']\/(?!\/)/i.test(html), `${path.relative(OUTPUT, file)} contains a root-relative URL`);
  for (const match of html.matchAll(/(?:href|src)=["'](?!https?:|mailto:|tel:|#)([^"']+)["']/gi)) {
    const clean = match[1].split(/[?#]/)[0];
    if (!clean) continue;
    let decoded;
    try { decoded = decodeURIComponent(clean); } catch (_) { continue; }
    const target = path.resolve(path.dirname(file), decoded);
    assert(fs.existsSync(target), `${path.relative(OUTPUT, file)} links to missing ${match[1]}`);
  }
});

const search = JSON.parse(fs.readFileSync(path.join(OUTPUT, 'assets/search-index.json'), 'utf8'));
assert(search.some((entry) => entry.type === 'LESSON' && entry.title === 'The Chain Rule'), 'search lacks the Chain Rule lesson');
assert(search.some((entry) => entry.type === 'CALCULATOR' && entry.title === 'Graphing Calculator'), 'search lacks the graphing calculator');
assert(search.every((entry) => !entry.href.startsWith('/')), 'search contains a root-relative result');
const searchApi = require('../lib/global-search');
assert(searchApi.searchIndex(search, 'python').some((entry) => entry.title === 'Computer Programming 1'), 'python does not find Computer Programming 1');
assert(searchApi.searchIndex(search, 'derivitives').some((entry) => /Derivative/.test(entry.title)), 'misspelled derivatives query is not corrected');

console.log(`check-stem-lite: OK (${htmlFiles.length} HTML pages, ${search.length} search entries)`);
