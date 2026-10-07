'use strict';

const assert = require('assert');
const { VALID_STATUSES, isValidStatus } = require('../lib/content-review');

assert.deepStrictEqual(VALID_STATUSES, ['AI Generated', 'Review in Progress', 'Human Reviewed', 'Human Verified']);

VALID_STATUSES.forEach((status) => {
  assert.strictEqual(isValidStatus(status), true, `${status} should be valid`);
});

[
  'Verified', 'AI generated', 'ai generated', 'Draft', 'Needs review',
  'human reviewed', '', null, undefined, 123, {}, [],
].forEach((bad) => {
  assert.strictEqual(isValidStatus(bad), false, `${JSON.stringify(bad)} should be rejected`);
});

console.log('check-content-review: OK (4 valid statuses; old-taxonomy and malformed values correctly rejected)');
