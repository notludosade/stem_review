'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ASSESSMENT_STATUSES, REPORT_STATUSES, SOURCE_ROLES,
  isValidAssessmentStatus, isValidReportStatus,
  parseSources, formatSources, validateContentReviewUpdate,
} = require('../lib/content-trust');

assert.deepStrictEqual(ASSESSMENT_STATUSES, ['not-verified', 'in-progress', 'verified']);
assert.deepStrictEqual(REPORT_STATUSES, ['RECEIVED', 'UNDER_REVIEW', 'CONFIRMED', 'CORRECTED', 'CLOSED']);
assert.deepStrictEqual(SOURCE_ROLES, ['primary', 'reference', 'supporting']);

ASSESSMENT_STATUSES.forEach((s) => assert.strictEqual(isValidAssessmentStatus(s), true));
['verified ', 'Verified', '', null, undefined, 123].forEach((bad) =>
  assert.strictEqual(isValidAssessmentStatus(bad), false, `${JSON.stringify(bad)} should be rejected`));

REPORT_STATUSES.forEach((s) => assert.strictEqual(isValidReportStatus(s), true));
['received', 'OPEN', '', null, undefined].forEach((bad) =>
  assert.strictEqual(isValidReportStatus(bad), false, `${JSON.stringify(bad)} should be rejected`));

assert.deepStrictEqual(parseSources(''), []);
assert.deepStrictEqual(parseSources('   \n  \n'), []);
assert.deepStrictEqual(
  parseSources('primary|College Board AP Calculus BC CED\nreference|OpenStax Calculus'),
  [
    { role: 'primary', name: 'College Board AP Calculus BC CED' },
    { role: 'reference', name: 'OpenStax Calculus' },
  ]
);
assert.deepStrictEqual(parseSources('OpenStax Calculus'), [{ role: 'reference', name: 'OpenStax Calculus' }]);
assert.deepStrictEqual(parseSources('bogus-role|Some Source'), [{ role: 'reference', name: 'Some Source' }]);
assert.deepStrictEqual(parseSources('primary|  '), []);
assert.strictEqual(
  formatSources([{ role: 'primary', name: 'A' }, { role: 'supporting', name: 'B' }]),
  'primary|A\nsupporting|B'
);

const base = { status: 'AI Generated', reviewedBy: '', reviewedAt: null, sources: '', assessments: [] };
assert.strictEqual(validateContentReviewUpdate(base).ok, true);
assert.strictEqual(validateContentReviewUpdate({ ...base, status: 'Review in Progress' }).ok, true);

assert.strictEqual(validateContentReviewUpdate({ ...base, status: 'Human Reviewed' }).ok, false);
assert.strictEqual(
  validateContentReviewUpdate({ ...base, status: 'Human Reviewed', reviewedBy: 'Mathematics Reviewer', reviewedAt: new Date() }).ok,
  true
);

assert.strictEqual(
  validateContentReviewUpdate({ ...base, status: 'Human Verified', reviewedBy: 'X', reviewedAt: new Date(), sources: 'primary|Y' }).ok,
  false,
  'Human Verified should fail with no assessments at all'
);
assert.strictEqual(
  validateContentReviewUpdate({
    ...base, status: 'Human Verified', reviewedBy: 'X', reviewedAt: new Date(), sources: 'primary|Y',
    assessments: [{ status: 'verified' }, { status: 'not-verified' }],
  }).ok,
  false,
  'Human Verified should fail when any assessment is not verified'
);
assert.strictEqual(
  validateContentReviewUpdate({
    ...base, status: 'Human Verified', reviewedBy: 'X', reviewedAt: new Date(), sources: 'primary|Y',
    assessments: [{ status: 'verified' }, { status: 'verified' }],
  }).ok,
  true
);
assert.strictEqual(
  validateContentReviewUpdate({
    ...base, status: 'Human Verified', reviewedBy: 'X', reviewedAt: new Date(), sources: '',
    assessments: [{ status: 'verified' }],
  }).ok,
  false,
  'Human Verified should fail without at least one source'
);

// public/assets/assessment-review-panel.js can't require() lib/content-trust.js
// (it's a browser script), so its STATUSES list is a hand-maintained
// duplicate — this assertion catches the two drifting apart.
const panelJs = fs.readFileSync(path.join(__dirname, '../public/assets/assessment-review-panel.js'), 'utf8');
const panelStatusesMatch = panelJs.match(/const STATUSES = (\[[^\]]+\]);/);
assert.ok(panelStatusesMatch, 'could not find STATUSES in public/assets/assessment-review-panel.js');
const panelStatuses = JSON.parse(panelStatusesMatch[1].replace(/'/g, '"'));
assert.deepStrictEqual(panelStatuses, ASSESSMENT_STATUSES, 'assessment-review-panel.js STATUSES is out of sync with ASSESSMENT_STATUSES');

console.log('check-content-trust: OK (assessment/report status enums, source parsing, and Human Reviewed/Verified gating all verified)');
