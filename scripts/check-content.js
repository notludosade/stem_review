'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { splitHtmlFragment } = require('../lib/content');
const { extractScripts, stripScripts } = require('../lib/scripts');
const lessonAnswers = require('../public/assets/quiz.js');

const { title, body } = splitHtmlFragment(
  '<meta charset="UTF-8">\n<title>Example — STEM+</title>\n<div class="page">\n  <h1>Example</h1>\n</div>\n'
);
assert.strictEqual(title, 'Example — STEM+', 'should extract the title text');
assert.ok(body.startsWith('<div class="page">'), 'body should start at the first <div');
assert.ok(!body.includes('<meta'), 'body should not include head tags');

const { title: fallbackTitle } = splitHtmlFragment('<div class="page"><h1>No title tag</h1></div>');
assert.strictEqual(fallbackTitle, 'STEM+', 'should fall back to STEM+ when no <title> tag is present');

const scripts = extractScripts(
  '<div class="page"><script src="assets/foo.js" defer></script><script>console.log("inline");</script></div>'
);
assert.strictEqual(scripts.length, 2, 'should find both script tags');
assert.strictEqual(scripts[0].src, 'assets/foo.js', 'first script should have the src attribute');
assert.strictEqual(scripts[0].content, null, 'external script should have no inline content');
assert.strictEqual(scripts[1].src, null, 'inline script should have no src');
assert.strictEqual(scripts[1].content, 'console.log("inline");', 'inline script content should be captured');

const headScriptExample = '<script src="a.js"></script>\n<title>T</title>\n<div class="page">x</div>';
assert.strictEqual(extractScripts(headScriptExample).length, 1, 'extractScripts must find scripts before the first <div>, not just inside it');
assert.strictEqual(extractScripts(splitHtmlFragment(headScriptExample).body).length, 0, 'sanity check: confirms body alone would miss the head script — this is why getStaticProps calls extractScripts(html), never extractScripts(body)');

const withScripts = '<div class="page"><script src="assets/foo.js" defer></script><h1>Hi</h1><script>console.log(1);</script></div>';
const stripped = stripScripts(withScripts);
assert.ok(!stripped.includes('<script'), 'stripScripts must remove every <script> tag from the markup');
assert.ok(stripped.includes('<h1>Hi</h1>'), 'stripScripts must leave non-script markup untouched');
assert.strictEqual(
  extractScripts(withScripts).length,
  2,
  'sanity check: the same input still yields 2 scripts via extractScripts before stripping — confirms getStaticProps extracts scripts from `html` first, then strips them from `body` separately, rather than losing them'
);

const sentenceCases = [
  ['The complement is an open set.', ['open'], true],
  ['It is not open.', ['open'], false],
  ['It could be open or closed.', ['open'], false],
  ['the smallest possible upper bound', ['least upper bound'], true],
  ['bounded and closed', ['closed and bounded'], true],
  ['the sequence is convergent', ['converges'], true],
  ['it is not rational', ['irrational'], true],
  ['theta', ['θ'], true],
  ['2a + 5', ['2a-5'], false],
  ['1', ['−1'], false],
];
global.window = { localStorage: { getItem: () => null, setItem: () => {} } };
global.document = { addEventListener: () => {} };
require('../public/assets/tests.js');
const examAnswers = global.window.STEMPlusTests;
sentenceCases.forEach(([value, answers, expected]) => {
  assert.strictEqual(lessonAnswers.answerMatches(value, answers), expected, `lesson answer mismatch: ${value}`);
  assert.strictEqual(examAnswers.answerMatches(value, answers), expected, `exam answer mismatch: ${value}`);
});
const htmlFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? htmlFiles(target) : entry.name.endsWith('.html') ? [target] : [];
});
htmlFiles(path.resolve(__dirname, '../public')).forEach((file) => {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/data-answers="([^"]*)"/g)) {
    match[1].split('|').map((answer) => answer.trim()).filter(Boolean).forEach((answer) => {
      assert.ok(lessonAnswers.answerMatches(answer, [answer]), `${file}: lesson key no longer matches itself: ${answer}`);
      assert.ok(examAnswers.answerMatches(answer, [answer]), `${file}: exam key no longer matches itself: ${answer}`);
    });
  }
});
delete global.window;
delete global.document;

console.log('check-content: OK');
