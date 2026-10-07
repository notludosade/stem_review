'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

// developer-panel.js can't require() this Node module (it's a browser
// script), so its STATUSES list is a hand-maintained duplicate — this
// assertion is what catches the two drifting apart.
const panelJs = fs.readFileSync(path.join(__dirname, '../public/assets/developer-panel.js'), 'utf8');
const panelStatusesMatch = panelJs.match(/const STATUSES = (\[[^\]]+\]);/);
assert.ok(panelStatusesMatch, 'could not find STATUSES in public/assets/developer-panel.js');
const panelStatuses = JSON.parse(panelStatusesMatch[1].replace(/'/g, '"'));
assert.deepStrictEqual(panelStatuses, VALID_STATUSES, 'public/assets/developer-panel.js STATUSES is out of sync with VALID_STATUSES');

// Same drift risk for the public docs' prose list.
const aboutHtml = fs.readFileSync(path.join(__dirname, '../content/about.html'), 'utf8');
const reviewSectionMatch = aboutHtml.match(/<section class="about-section" id="content-review">[\s\S]*?<\/section>/);
assert.ok(reviewSectionMatch, 'could not find the #content-review section in content/about.html');
const aboutStatuses = [...reviewSectionMatch[0].matchAll(/<li><strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
assert.deepStrictEqual(aboutStatuses, VALID_STATUSES, 'content/about.html status list is out of sync with VALID_STATUSES');

// Every real course must be reachable as a content-review key — either its
// skill-catalog.json name matches a Layout.tsx nav label directly, or
// Layout.tsx's REVIEW_KEYS maps that nav label to the catalog name. Catches
// the class of bug where a course's nav label and catalog name diverge and
// its content-review status silently never reaches the public page.
const layoutTsx = fs.readFileSync(path.join(__dirname, '../components/Layout.tsx'), 'utf8');
const learnBlockMatch = layoutTsx.match(/const LEARN_CATEGORIES[\s\S]*?(?=\nconst PRACTICE_CATEGORIES)/);
assert.ok(learnBlockMatch, 'could not find LEARN_CATEGORIES in components/Layout.tsx');
const navLabels = [...learnBlockMatch[0].matchAll(/\[\s*'([^']+)',\s*'\//g)].map((m) => m[1]);
assert.ok(navLabels.length > 30, `expected 30+ course nav labels, found ${navLabels.length}`);
const reviewKeysBlockMatch = layoutTsx.match(/const REVIEW_KEYS[\s\S]*?\n};/);
assert.ok(reviewKeysBlockMatch, 'could not find REVIEW_KEYS in components/Layout.tsx');
const reviewKeyValues = new Set([...reviewKeysBlockMatch[0].matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]));
const catalog = require('../public/assets/skill-catalog.json');
const catalogCourses = [...new Set(catalog.skills.map((skill) => skill.course))];
catalogCourses.forEach((course) => {
  const reachable = navLabels.includes(course) || reviewKeyValues.has(course);
  assert.ok(reachable, `catalog course "${course}" is not reachable as a content-review key via any Layout.tsx nav label or REVIEW_KEYS mapping`);
});

console.log('check-content-review: OK (4 valid statuses; old-taxonomy and malformed values correctly rejected; dropdown and docs in sync; all catalog courses reachable as review keys)');
