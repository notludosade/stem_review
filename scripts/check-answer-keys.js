'use strict';

// Site-wide mechanical answer-key audit — structural/reachability checks
// only, no semantic/factual judgment (that needs a human or a content-review
// pass reading each question). Two real bug classes found in a prior audit
// (2026-07-27, 25 bugs across 7 courses):
//   1. data-answers in assets/quiz.js/tests.js splits ONLY on `|`. A value
//      with a comma but no pipe is silently treated as one unmatchable
//      string — the question becomes unanswerable with no error anywhere.
//   2. A fill-in whose intended correct answer literally is or contains `|`
//      collides with the delimiter the same way.
// Also checks a third, independent failure mode: a multiple-choice question
// block with zero `data-correct="true"` choices is unanswerable no matter
// what's clicked.
//
// This is a mechanical pass, not a content-accuracy review — a clean run
// means every answer key is *reachable*, not that it's *right*.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
}

const files = [];
walk(CONTENT_DIR, files);

// Commas that are plainly numeric formatting (e.g. "1,000" or "12,345.5"),
// not a delimiter between alternate answers — excluded from the comma flag.
const isNumericComma = (value) => /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(value.trim());

const commaNoPipe = [];
const literalPipeAnswer = [];
const noCorrectChoice = [];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(CONTENT_DIR, file);

  const answerRe = /data-answers="([^"]*)"/g;
  let m;
  while ((m = answerRe.exec(html))) {
    const value = m[1];
    if (value === '' ) continue;
    if (value === '|' || value.includes('||')) {
      literalPipeAnswer.push({ file: rel, value });
      continue;
    }
    if (value.includes('|')) continue; // already pipe-delimited, fine
    if (value.includes(',') && !isNumericComma(value)) {
      commaNoPipe.push({ file: rel, value });
    }
  }

  const blockRe = /<div class="quiz-choices">([\s\S]*?)<\/div>/g;
  let b;
  while ((b = blockRe.exec(html))) {
    const block = b[1];
    // The quiz-choices class is also reused for layout by non-graded custom
    // widgets (a "Try It" tab explorer, a data-exun/data-choice classifier)
    // that never use data-correct at all — only flag blocks that actually
    // use the graded-MC convention but define zero correct choices.
    if (!/data-correct=/.test(block)) continue;
    if (!/data-correct="true"/.test(block)) {
      noCorrectChoice.push({ file: rel, snippet: block.replace(/\s+/g, ' ').trim().slice(0, 140) });
    }
  }
}

console.log(`check-answer-keys: scanned ${files.length} content files`);

if (commaNoPipe.length) {
  console.log(`\nComma-without-pipe data-answers (${commaNoPipe.length}):`);
  commaNoPipe.forEach((x) => console.log(`  ${x.file}: data-answers="${x.value}"`));
}
if (literalPipeAnswer.length) {
  console.log(`\nLiteral "|" as an intended answer (${literalPipeAnswer.length}):`);
  literalPipeAnswer.forEach((x) => console.log(`  ${x.file}: data-answers="${x.value}"`));
}
if (noCorrectChoice.length) {
  console.log(`\nMultiple-choice blocks with zero data-correct="true" (${noCorrectChoice.length}):`);
  noCorrectChoice.forEach((x) => console.log(`  ${x.file}: ${x.snippet}...`));
}

const totalBugs = commaNoPipe.length + literalPipeAnswer.length + noCorrectChoice.length;
assert.strictEqual(totalBugs, 0, `${totalBugs} unreachable-answer bug(s) found — see above`);

console.log('check-answer-keys: OK (0 unreachable-answer bugs)');
