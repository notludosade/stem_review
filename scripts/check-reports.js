'use strict';

// Report validation is the only gate between anonymous visitors and the
// reports table, so pin its rules here.
const assert = require('node:assert');
const { CATEGORIES, validateReport, hashIp } = require('../lib/reports');

const good = { page: '/problem-set.html?course=precalculus', pageTitle: 'Precalculus Problem Set — STEM+', course: null, unit: 'Unit 3', lesson: '0005-chain-rule', questionId: 'precalc-function-1', category: 'Incorrect answer', description: 'Answer key says 3 but it should be 4.' };
const ok = validateReport(good);
assert.ok(ok.ok, ok.error);
assert.strictEqual(ok.report.course, null);
assert.strictEqual(ok.report.unit, 'Unit 3');
assert.strictEqual(ok.report.lesson, '0005-chain-rule');
assert.strictEqual(validateReport({ ...good, description: '  Typo here  ' }).report.description, 'Typo here');
assert.deepStrictEqual(CATEGORIES, ['Incorrect answer', 'Broken explanation', 'Typo', 'Broken link', 'Misleading diagram', 'Code error', 'Other']);

const rejects = {
  'unknown category': { ...good, category: 'Spam' },
  'short description': { ...good, description: 'bad' },
  'long description': { ...good, description: 'x'.repeat(2001) },
  'missing page': { ...good, page: '' },
  'protocol-relative page': { ...good, page: '//evil.example/' },
  'long page': { ...good, page: `/${'x'.repeat(300)}` },
  'long title': { ...good, pageTitle: 'x'.repeat(201) },
  'long question id': { ...good, questionId: 'x'.repeat(101) },
  'long unit': { ...good, unit: 'x'.repeat(101) },
  'long lesson': { ...good, lesson: 'x'.repeat(151) },
  'non-string description': { ...good, description: 12345 },
  'empty body': undefined,
};
for (const [name, body] of Object.entries(rejects)) {
  assert.strictEqual(validateReport(body).ok, false, `${name} should be rejected`);
}

const hash = hashIp('203.0.113.7', 'secret');
assert.strictEqual(hash, hashIp('203.0.113.7', 'secret'));
assert.notStrictEqual(hash, hashIp('203.0.113.8', 'secret'));
assert.ok(!hash.includes('203.0.113.7'));

console.log(`check-reports: OK (${Object.keys(rejects).length} rejections)`);
