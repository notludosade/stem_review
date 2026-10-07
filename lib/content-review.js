'use strict';

// The complete, authoritative list of content-review statuses a course can
// have. pages/api/content-review.js rejects any POST whose status isn't
// exactly one of these, and content/developer-panel.html's dropdown offers
// only these four. Keep public/assets/developer-panel.js's own copy of this
// list in sync if this ever changes — it can't require() this file (it's a
// browser script, not a Node module).
const VALID_STATUSES = ['AI Generated', 'Review in Progress', 'Human Reviewed', 'Human Verified'];

function isValidStatus(status) {
  return typeof status === 'string' && VALID_STATUSES.includes(status);
}

module.exports = { VALID_STATUSES, isValidStatus };
