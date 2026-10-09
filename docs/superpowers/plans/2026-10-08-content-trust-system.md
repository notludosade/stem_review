# Content Trust & Verification Transparency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give STEM+ a real, visible content-review and assessment-verification pipeline — structured metadata, a compact trust panel, a review-details page, a public correction log, and a tightened Report-a-Problem flow — built on the existing `content_reviews`/`reports` tables, with AP Calculus BC as the first fully-wired pilot course.

**Architecture:** Additive Postgres schema (two new tables, a few new columns on two existing tables), a small shared validation library (`lib/content-trust.js`) enforcing the Human Reviewed/Human Verified gating rules, three Next.js API routes (one extended, two new) that read/write it, and a handful of vanilla `public/assets/*.js` scripts that mount into legacy `content/*.html` pages — the same pattern `developer-panel.js`/`reports.js`/`mastery.js` already use. No new frontend framework, no new dependency.

**Tech Stack:** Next.js 16 API routes (Node, `@neondatabase/serverless`), vanilla browser JS (no bundler) for legacy-page mounts, existing `public/assets/style.css` design tokens.

## Global Constraints

- Never set a course's `content_reviews.status` to `Human Reviewed` or `Human Verified` as part of this plan's execution — every task that touches real data (the migration, the seed script, manual verification) must leave every real course's status exactly as honest as it was before, per the spec's hard constraint ("do not falsely mark content as verified").
- `Human Reviewed` requires a non-empty reviewer name and a review date. `Human Verified` additionally requires at least one source and every one of that course's `assessment_verifications` rows to have `status = 'verified'` (a course with zero assessment rows can never be `Human Verified` — conservative by design, see `lib/content-trust.js`). Enforced in `pages/api/content-review.js`, tested as pure functions in `lib/content-trust.js`.
- Sources are stored as one `role|name` pair per line in the existing `content_reviews.sources` text column — `role` is one of `primary` / `reference` / `supporting`, defaulting to `reference` if omitted or unrecognized.
- All new tables/columns are additive (`create table if not exists`, `add column if not exists`) against the live production Neon DB — same as every prior migration in this project. `.env.local` must have `DATABASE_URL` set before running `scripts/migrate.js` or the new seed script.
- Reuse existing CSS primitives (`.widget`, `.widget-label`, `.toc-item`, `.toc-sub`, `.toc-empty`, `.fm-row`) wherever the new UI matches their shape; only add new classes for the content-trust-specific pieces (status badge, checklist, correction card) that have no existing equivalent.
- Avoid hand-duplicated enum lists in browser scripts wherever a fetch can serve the source of truth instead (e.g. `pages/api/reports.js`'s GET response carries `statuses`/`categories` rather than `public/assets/reports.js` hardcoding a second copy) — the one exception (`assessment-review-panel.js`'s 3-item `STATUSES`) gets an explicit drift-check instead, matching the existing `check-content-review.js` precedent.
- No changes to authentication, cloud sync, Neon connection setup, search, navigation menus, mastery, diagnostics, or accounts beyond the existing `is_developer` session gate already used by every other developer-only route in this codebase.
- `npm test` must pass after every task. Run `npm run build && npm run start -- -p 3200` (never `npm run dev`, which double-mounts under Strict Mode) for any live/manual verification step, against the raw-CDP headless-Chrome pattern already used throughout this project.

---

## File Structure

**Create:**
- `lib/content-trust.js` — shared enums + validation (assessment/report statuses, source parsing, Human Reviewed/Verified gating)
- `pages/api/assessment-verification.js` — GET (public, by course) / POST (developer-only upsert) for `assessment_verifications`
- `pages/api/corrections.js` — GET (public, by course) / POST (developer-only insert) for `corrections`
- `public/assets/trust-panel.js` — compact trust panel, mounts on course hub pages
- `public/assets/review-details.js` — full review-details page renderer (`content/review-details.html?course=`)
- `public/assets/corrections.js` — public correction log renderer (`content/corrections.html`)
- `public/assets/assessment-review-panel.js` — developer-only assessment-verification editor
- `content/review-details.html` — generic review-details page shell
- `content/corrections.html` — public correction log page shell
- `scripts/check-content-trust.js` — pure-function tests for `lib/content-trust.js`, added to `npm test`
- `scripts/seed-ap-calc-bc-review.js` — one-off, idempotent seed for the AP Calculus BC pilot

**Modify:**
- `scripts/migrate.js` — new columns + two new tables
- `lib/reports.js` — `unit`/`lesson` fields on `validateReport`
- `pages/api/content-review.js` — framework/reviewerRole/sources fields, Human Reviewed/Verified gating
- `pages/api/reports.js` — `status` workflow replacing the binary `resolved` toggle, serves `statuses`/`categories`
- `pages/api/report.js` — persists `unit`/`lesson`
- `components/Layout.tsx` — `ReportProblem` auto-derives `unit`/`lesson` from the URL
- `public/assets/style.css` — trust panel / checklist / correction-card CSS
- `public/assets/developer-panel.js` + `content/developer-panel.html` — framework/reviewerRole/sources fields, assessment-verification panel mount
- `public/assets/reports.js` — status dropdown + "Log correction" flow
- `content/reports.html` — updated subtitle
- `content/about.html` — rewritten `#content-review` section (item 17's 6-step structure)
- `content/AP STEM+/AP_CALC/index.html` — trust panel mount point
- `scripts/check-reports.js` — `unit`/`lesson` assertions
- `package.json` — add `check-content-trust.js` to the `test` chain

---

### Task 1: Database migration

**Files:**
- Modify: `scripts/migrate.js:67-77` (the `content_reviews` block) and `:46-60` (the `reports` block); add two new `create table` blocks after the existing `content_reviews` block.

**Interfaces:**
- Produces: `content_reviews.framework` (text), `content_reviews.framework_version` (text), `content_reviews.reviewer_role` (text); the `assessment_verifications` table (PK `assessment_id` text); the `corrections` table (PK `id` serial); `reports.unit` (text), `reports.lesson` (text), `reports.status` (text, default `'RECEIVED'`).

- [ ] **Step 1: Add the new `content_reviews` columns and the two new tables**

In `scripts/migrate.js`, right after the existing `content_reviews` block (ends at line 77, `` ` `` ``;``), insert:

```js
  // Content-trust system (2026-10-08): framework/version/reviewer-role on
  // top of the existing status/reviewer/sources columns above.
  await sql`alter table content_reviews add column if not exists framework text`;
  await sql`alter table content_reviews add column if not exists framework_version text`;
  await sql`alter table content_reviews add column if not exists reviewer_role text`;

  // Per-assessment (unit test / course exam) verification tracking. Keyed by
  // a deterministic slug (course:unit:kind:version), not a DB-generated id,
  // so the seed script and the developer panel can both compute the same
  // key without a round trip. A course with no row here has never had any
  // of its assessments tracked — see lib/content-trust.js's
  // validateContentReviewUpdate for why that blocks Human Verified.
  await sql`
    create table if not exists assessment_verifications (
      assessment_id text primary key,
      course text not null,
      unit text,
      kind text not null,
      version text,
      status text not null default 'not-verified',
      questions_total integer not null default 0,
      questions_verified integer not null default 0,
      answer_checked boolean not null default false,
      explanation_checked boolean not null default false,
      wording_checked boolean not null default false,
      numeric_tolerance_checked boolean not null default false,
      symbolic_equivalence_checked boolean not null default false,
      diagram_checked boolean not null default false,
      curriculum_alignment_checked boolean not null default false,
      last_verified timestamptz,
      verified_by text,
      notes text,
      updated_at timestamptz not null default now()
    )
  `;

  // Public correction log (content/corrections.html). report_id is optional
  // — a correction can come from a review pass with no prior report.
  await sql`
    create table if not exists corrections (
      id serial primary key,
      created_at timestamptz not null default now(),
      course text not null,
      unit text,
      lesson text,
      question_ref text,
      category text not null,
      summary text not null,
      reason text,
      report_id integer references reports(id) on delete set null,
      corrected_by text
    )
  `;
```

- [ ] **Step 2: Add `unit`/`lesson`/`status` to `reports`**

Right after the existing `reports` block (ends at line 60), insert:

```js
  // Content-trust system (2026-10-08): richer linkage + a real status
  // workflow (RECEIVED/UNDER_REVIEW/CONFIRMED/CORRECTED/CLOSED) replacing
  // the old binary resolved_at toggle. resolved_at is kept and still set
  // automatically (see pages/api/reports.js) so nothing that reads it needs
  // to change.
  await sql`alter table reports add column if not exists unit text`;
  await sql`alter table reports add column if not exists lesson text`;
  await sql`alter table reports add column if not exists status text not null default 'RECEIVED'`;
```

- [ ] **Step 3: Update the closing log line**

Change line 92 from:
```js
  console.log('migrate: users, oauth_accounts, reports, content_reviews, and progress_sync tables ready');
```
to:
```js
  console.log('migrate: users, oauth_accounts, reports, content_reviews, progress_sync, assessment_verifications, and corrections tables ready');
```

- [ ] **Step 4: Run the migration**

Requires `.env.local` with `DATABASE_URL` set (same live production Neon DB every prior migration in this project has used — there is no separate dev/staging database).

Run: `node --env-file=.env.local scripts/migrate.js`
Expected: the new log line prints, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate.js
git commit -m "Add content-trust schema: assessment_verifications, corrections, and new columns"
```

---

### Task 2: `lib/content-trust.js` — shared enums and validation

**Files:**
- Create: `lib/content-trust.js`
- Create: `scripts/check-content-trust.js`
- Modify: `package.json:10` (the `test` script chain)

**Interfaces:**
- Consumes: nothing (pure module, no DB).
- Produces: `ASSESSMENT_STATUSES: string[]`, `REPORT_STATUSES: string[]`, `SOURCE_ROLES: string[]`, `isValidAssessmentStatus(status): boolean`, `isValidReportStatus(status): boolean`, `parseSources(text): {role, name}[]`, `formatSources(sources): string`, `validateContentReviewUpdate({status, reviewedBy, reviewedAt, sources, assessments}): {ok: true} | {ok: false, error: string}` — used by Task 4 (`pages/api/content-review.js`), Task 5 (`pages/api/assessment-verification.js`), Task 6 (`pages/api/reports.js`).

- [ ] **Step 1: Write `lib/content-trust.js`**

```js
'use strict';

const ASSESSMENT_STATUSES = ['not-verified', 'in-progress', 'verified'];
const REPORT_STATUSES = ['RECEIVED', 'UNDER_REVIEW', 'CONFIRMED', 'CORRECTED', 'CLOSED'];
const SOURCE_ROLES = ['primary', 'reference', 'supporting'];

function isValidAssessmentStatus(status) {
  return typeof status === 'string' && ASSESSMENT_STATUSES.includes(status);
}

function isValidReportStatus(status) {
  return typeof status === 'string' && REPORT_STATUSES.includes(status);
}

// Sources are stored as one "role|name" pair per line in content_reviews.sources,
// e.g. "primary|College Board AP Calculus BC Course and Exam Description". A
// line with no "|" is treated as a bare name with the default role.
function parseSources(sourcesText) {
  if (typeof sourcesText !== 'string' || !sourcesText.trim()) return [];
  return sourcesText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('|');
      if (i === -1) return { role: 'reference', name: line };
      const role = line.slice(0, i).trim().toLowerCase();
      const name = line.slice(i + 1).trim();
      return { role: SOURCE_ROLES.includes(role) ? role : 'reference', name };
    })
    .filter((source) => source.name);
}

function formatSources(sources) {
  return sources.map((s) => `${s.role}|${s.name}`).join('\n');
}

// Enforces the content-trust spec's hard rule: Human Reviewed/Human Verified
// can't be claimed without the work those statuses imply actually being on
// record. `assessments` is that course's assessment_verifications rows
// (status field only is enough) — may be [].
//
// A course with zero assessment rows can never reach Human Verified. This is
// a deliberate, conservative default: it's safer to require someone to seed
// assessment rows first than to let "no data yet" silently read as "nothing
// to verify."
function validateContentReviewUpdate({ status, reviewedBy, reviewedAt, sources, assessments }) {
  const hasReviewer = typeof reviewedBy === 'string' && reviewedBy.trim().length > 0;
  const hasDate = Boolean(reviewedAt);
  const hasSource = parseSources(sources || '').length > 0;

  if (status === 'Human Reviewed' && (!hasReviewer || !hasDate)) {
    return { ok: false, error: 'Human Reviewed requires a reviewer name and a review date.' };
  }
  if (status === 'Human Verified') {
    if (!hasReviewer || !hasDate || !hasSource) {
      return { ok: false, error: 'Human Verified requires a reviewer, a review date, and at least one source.' };
    }
    const list = Array.isArray(assessments) ? assessments : [];
    const allVerified = list.length > 0 && list.every((a) => a.status === 'verified');
    if (!allVerified) {
      return { ok: false, error: 'Human Verified requires every assessment for this course to be marked verified first.' };
    }
  }
  return { ok: true };
}

module.exports = {
  ASSESSMENT_STATUSES,
  REPORT_STATUSES,
  SOURCE_ROLES,
  isValidAssessmentStatus,
  isValidReportStatus,
  parseSources,
  formatSources,
  validateContentReviewUpdate,
};
```

- [ ] **Step 2: Write `scripts/check-content-trust.js`**

```js
'use strict';

const assert = require('assert');
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

console.log('check-content-trust: OK (assessment/report status enums, source parsing, and Human Reviewed/Verified gating all verified)');
```

- [ ] **Step 3: Add it to `npm test`**

In `package.json`, in the `test` script, insert `node scripts/check-content-trust.js && ` immediately after `node scripts/check-content-review.js && `.

- [ ] **Step 4: Run it**

Run: `node scripts/check-content-trust.js`
Expected: `check-content-trust: OK (...)`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/content-trust.js scripts/check-content-trust.js package.json
git commit -m "Add lib/content-trust.js: status enums, source parsing, Human Reviewed/Verified gating"
```

---

### Task 3: `lib/reports.js` — `unit`/`lesson` fields

**Files:**
- Modify: `lib/reports.js`
- Modify: `scripts/check-reports.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `validateReport(body).report` now includes `unit: string|null` and `lesson: string|null`, consumed by Task 7 (`pages/api/report.js`) and Task 8 (`components/Layout.tsx`).

- [ ] **Step 1: Update `lib/reports.js`**

Replace the whole file with:

```js
const crypto = require('crypto');
const CATEGORIES = require('./report-categories');

const LIMITS = { page: 300, pageTitle: 200, course: 100, unit: 100, lesson: 150, questionId: 100 };
const MIN_DESCRIPTION = 5;
const MAX_DESCRIPTION = 2000;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Anyone can send a report (no sign-in), so everything is bounded here
// before it reaches the reports table.
function validateReport(body) {
  const input = body && typeof body === 'object' ? body : {};
  const report = {
    page: text(input.page),
    pageTitle: text(input.pageTitle) || null,
    course: text(input.course) || null,
    unit: text(input.unit) || null,
    lesson: text(input.lesson) || null,
    questionId: text(input.questionId) || null,
    category: text(input.category),
    description: text(input.description),
  };
  if (!/^\/(?!\/)/.test(report.page)) return { ok: false, error: 'Missing page.' };
  for (const [field, max] of Object.entries(LIMITS)) {
    if (report[field] && report[field].length > max) return { ok: false, error: `That ${field} is too long.` };
  }
  if (!CATEGORIES.includes(report.category)) return { ok: false, error: 'Choose a category.' };
  if (report.description.length < MIN_DESCRIPTION) return { ok: false, error: 'Describe the problem in a few words.' };
  if (report.description.length > MAX_DESCRIPTION) return { ok: false, error: `Keep the description under ${MAX_DESCRIPTION} characters.` };
  return { ok: true, report };
}

// Rate limiting needs a stable per-visitor key, but the raw IP is never stored.
function hashIp(ip, secret) {
  return crypto.createHmac('sha256', secret).update(String(ip)).digest('hex');
}

module.exports = { CATEGORIES, validateReport, hashIp };
```

(Only the `LIMITS` line and the `report` object inside `validateReport` changed — two new fields each.)

- [ ] **Step 2: Update `scripts/check-reports.js`**

Change the `good` object (line 8) to:
```js
const good = { page: '/problem-set.html?course=precalculus', pageTitle: 'Precalculus Problem Set — STEM+', course: null, unit: 'Unit 3', lesson: '0005-chain-rule', questionId: 'precalc-function-1', category: 'Incorrect answer', description: 'Answer key says 3 but it should be 4.' };
```

After the existing `assert.strictEqual(ok.report.course, null);` line, add:
```js
assert.strictEqual(ok.report.unit, 'Unit 3');
assert.strictEqual(ok.report.lesson, '0005-chain-rule');
```

In the `rejects` object, add two entries:
```js
  'long unit': { ...good, unit: 'x'.repeat(101) },
  'long lesson': { ...good, lesson: 'x'.repeat(151) },
```

- [ ] **Step 3: Run it**

Run: `node scripts/check-reports.js`
Expected: `check-reports: OK (12 rejections)` (was 10, now 12).

- [ ] **Step 4: Commit**

```bash
git add lib/reports.js scripts/check-reports.js
git commit -m "Add unit/lesson fields to report validation"
```

---

### Task 4: `pages/api/content-review.js` — framework, reviewer role, sources, gating

**Files:**
- Modify: `pages/api/content-review.js`

**Interfaces:**
- Consumes: `lib/content-trust.js`'s `parseSources`, `validateContentReviewUpdate` (Task 2); `assessment_verifications` rows (Task 1's schema).
- Produces: GET response per course gains `sourcesList: {role,name}[]`, `framework`, `frameworkVersion`, `reviewerRole`. POST accepts `reviewedBy`, `reviewerRole`, `framework`, `frameworkVersion`, `sources`, `verifiedAgainst` and 400s with a specific message when the Human Reviewed/Verified gate fails. Consumed by Task 10 (`trust-panel.js`), Task 11 (`review-details.js`), Task 12 (developer panel).

- [ ] **Step 1: Replace the file**

```js
const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isValidStatus } = require('../../lib/content-review');
const { parseSources, validateContentReviewUpdate } = require('../../lib/content-trust');
const catalog = require('../../public/assets/skill-catalog.json');

const KNOWN_COURSES = new Set(catalog.skills.map((skill) => skill.course));

// Public read (every page footer shows a course's status), developer-only
// write (content/developer-panel.html).
module.exports = async (req, res) => {
  try {
    const sql = getDb();

    if (req.method === 'GET') {
      const rows = await sql`
        select course, status, reviewed_at as "reviewedAt", reviewed_by as "reviewedBy",
          verified_against as "verifiedAgainst", sources, framework, framework_version as "frameworkVersion",
          reviewer_role as "reviewerRole"
        from content_reviews
      `;
      const byCourse = {};
      rows.forEach((row) => {
        byCourse[row.course] = {
          status: row.status,
          reviewed: row.reviewedAt || undefined,
          reviewedBy: row.reviewedBy || undefined,
          verifiedAgainst: row.verifiedAgainst || undefined,
          sources: row.sources || undefined,
          sourcesList: parseSources(row.sources || ''),
          framework: row.framework || undefined,
          frameworkVersion: row.frameworkVersion || undefined,
          reviewerRole: row.reviewerRole || undefined,
        };
      });
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      res.statusCode = 200;
      return res.json(byCourse);
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.json({ error: 'GET or POST only' });
    }

    const session = verify(req.cookies?.session, process.env.SESSION_SECRET);
    if (!session || !session.isDeveloper) {
      res.statusCode = 403;
      return res.json({ error: 'developer accounts only' });
    }

    const course = typeof req.body?.course === 'string' ? req.body.course.trim() : '';
    const status = req.body?.status;
    if (!KNOWN_COURSES.has(course) || !isValidStatus(status)) {
      res.statusCode = 400;
      return res.json({ error: 'course and a valid status are required' });
    }

    const reviewedBy = typeof req.body?.reviewedBy === 'string' ? req.body.reviewedBy.trim() : '';
    const reviewerRole = typeof req.body?.reviewerRole === 'string' ? req.body.reviewerRole.trim() : '';
    const verifiedAgainst = typeof req.body?.verifiedAgainst === 'string' ? req.body.verifiedAgainst.trim() : '';
    const sources = typeof req.body?.sources === 'string' ? req.body.sources.trim() : '';
    const framework = typeof req.body?.framework === 'string' ? req.body.framework.trim() : '';
    const frameworkVersion = typeof req.body?.frameworkVersion === 'string' ? req.body.frameworkVersion.trim() : '';

    const assessments = await sql`select status from assessment_verifications where course = ${course}`;
    const check = validateContentReviewUpdate({ status, reviewedBy, reviewedAt: new Date(), sources, assessments });
    if (!check.ok) {
      res.statusCode = 400;
      return res.json({ error: check.error });
    }

    await sql`
      insert into content_reviews (
        course, status, reviewed_at, reviewed_by, verified_against, sources, framework, framework_version, reviewer_role, updated_at
      )
      values (
        ${course}, ${status}, now(), ${reviewedBy || null}, ${verifiedAgainst || null}, ${sources || null},
        ${framework || null}, ${frameworkVersion || null}, ${reviewerRole || null}, now()
      )
      on conflict (course) do update set
        status = excluded.status,
        reviewed_at = now(),
        reviewed_by = excluded.reviewed_by,
        verified_against = excluded.verified_against,
        sources = excluded.sources,
        framework = excluded.framework,
        framework_version = excluded.framework_version,
        reviewer_role = excluded.reviewer_role,
        updated_at = now()
    `;
    res.statusCode = 200;
    return res.json({ ok: true });
  } catch (err) {
    console.error('content-review endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load or save content review status.' });
  }
};
```

- [ ] **Step 2: Verify with `npm test`**

Run: `npm test`
Expected: all checks still pass (this file has no dedicated unit test of its own — `check-content-review.js` only checks the status enum/docs sync, unaffected by this change). Full live verification of this route happens in Task 15.

- [ ] **Step 3: Commit**

```bash
git add pages/api/content-review.js
git commit -m "Extend content-review API with framework, reviewer role, sources, and verification gating"
```

---

### Task 5: New APIs — `assessment-verification.js` and `corrections.js`

**Files:**
- Create: `pages/api/assessment-verification.js`
- Create: `pages/api/corrections.js`

**Interfaces:**
- Consumes: `lib/content-trust.js`'s `isValidAssessmentStatus` (Task 2); `lib/reports.js`'s `CATEGORIES` (existing); `assessment_verifications`/`corrections` tables (Task 1).
- Produces: `GET /api/assessment-verification[?course=]` → array of `{assessmentId, course, unit, kind, version, status, questionsTotal, questionsVerified, checklist: {7 booleans}, lastVerified, verifiedBy, notes}`. `POST /api/assessment-verification` (developer-only) upserts one row. `GET /api/corrections[?course=]` → array of `{id, createdAt, course, unit, lesson, questionRef, category, summary, reason, correctedBy}`. `POST /api/corrections` (developer-only) inserts one row. Consumed by Task 10, 11, 12, 15.

- [ ] **Step 1: Write `pages/api/assessment-verification.js`**

```js
const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isValidAssessmentStatus } = require('../../lib/content-trust');
const catalog = require('../../public/assets/skill-catalog.json');

const KNOWN_COURSES = new Set(catalog.skills.map((skill) => skill.course));
const CHECKLIST_FIELDS = [
  'answerChecked', 'explanationChecked', 'wordingChecked', 'numericToleranceChecked',
  'symbolicEquivalenceChecked', 'diagramChecked', 'curriculumAlignmentChecked',
];

function toAssessment(row) {
  return {
    assessmentId: row.assessment_id,
    course: row.course,
    unit: row.unit || undefined,
    kind: row.kind,
    version: row.version || undefined,
    status: row.status,
    questionsTotal: row.questions_total,
    questionsVerified: row.questions_verified,
    checklist: {
      answerChecked: row.answer_checked,
      explanationChecked: row.explanation_checked,
      wordingChecked: row.wording_checked,
      numericToleranceChecked: row.numeric_tolerance_checked,
      symbolicEquivalenceChecked: row.symbolic_equivalence_checked,
      diagramChecked: row.diagram_checked,
      curriculumAlignmentChecked: row.curriculum_alignment_checked,
    },
    lastVerified: row.last_verified || undefined,
    verifiedBy: row.verified_by || undefined,
    notes: row.notes || undefined,
  };
}

// Public read (course trust panel / review details), developer-only write
// (public/assets/assessment-review-panel.js on content/developer-panel.html).
module.exports = async (req, res) => {
  try {
    const sql = getDb();

    if (req.method === 'GET') {
      const course = typeof req.query?.course === 'string' ? req.query.course : null;
      const rows = course
        ? await sql`select * from assessment_verifications where course = ${course} order by unit, kind, version`
        : await sql`select * from assessment_verifications order by course, unit, kind, version`;
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      res.statusCode = 200;
      return res.json(rows.map(toAssessment));
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.json({ error: 'GET or POST only' });
    }

    const session = verify(req.cookies?.session, process.env.SESSION_SECRET);
    if (!session || !session.isDeveloper) {
      res.statusCode = 403;
      return res.json({ error: 'developer accounts only' });
    }

    const body = req.body || {};
    const assessmentId = typeof body.assessmentId === 'string' ? body.assessmentId.trim() : '';
    const course = typeof body.course === 'string' ? body.course.trim() : '';
    const unit = typeof body.unit === 'string' ? body.unit.trim() || null : null;
    const kind = body.kind === 'unit_test' || body.kind === 'course_exam' ? body.kind : null;
    const version = typeof body.version === 'string' ? body.version.trim() || null : null;
    const status = body.status;
    const questionsTotal = Number.isInteger(body.questionsTotal) ? body.questionsTotal : 0;
    const questionsVerified = Number.isInteger(body.questionsVerified) ? body.questionsVerified : 0;
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    const verifiedBy = typeof body.verifiedBy === 'string' ? body.verifiedBy.trim() || null : null;
    const checklist = body.checklist && typeof body.checklist === 'object' ? body.checklist : {};

    if (!assessmentId || !KNOWN_COURSES.has(course) || !kind || !isValidAssessmentStatus(status)) {
      res.statusCode = 400;
      return res.json({ error: 'assessmentId, a known course, kind, and a valid status are required' });
    }
    if (questionsTotal < 0 || questionsVerified < 0 || questionsVerified > questionsTotal) {
      res.statusCode = 400;
      return res.json({ error: 'questionsVerified cannot exceed questionsTotal' });
    }

    const flags = CHECKLIST_FIELDS.map((field) => Boolean(checklist[field]));
    const lastVerified = status === 'verified' ? new Date() : null;

    await sql`
      insert into assessment_verifications (
        assessment_id, course, unit, kind, version, status, questions_total, questions_verified,
        answer_checked, explanation_checked, wording_checked, numeric_tolerance_checked,
        symbolic_equivalence_checked, diagram_checked, curriculum_alignment_checked,
        last_verified, verified_by, notes, updated_at
      ) values (
        ${assessmentId}, ${course}, ${unit}, ${kind}, ${version}, ${status}, ${questionsTotal}, ${questionsVerified},
        ${flags[0]}, ${flags[1]}, ${flags[2]}, ${flags[3]}, ${flags[4]}, ${flags[5]}, ${flags[6]},
        ${lastVerified}, ${verifiedBy}, ${notes}, now()
      )
      on conflict (assessment_id) do update set
        course = excluded.course, unit = excluded.unit, kind = excluded.kind, version = excluded.version,
        status = excluded.status, questions_total = excluded.questions_total, questions_verified = excluded.questions_verified,
        answer_checked = excluded.answer_checked, explanation_checked = excluded.explanation_checked,
        wording_checked = excluded.wording_checked, numeric_tolerance_checked = excluded.numeric_tolerance_checked,
        symbolic_equivalence_checked = excluded.symbolic_equivalence_checked, diagram_checked = excluded.diagram_checked,
        curriculum_alignment_checked = excluded.curriculum_alignment_checked,
        last_verified = excluded.last_verified, verified_by = excluded.verified_by, notes = excluded.notes, updated_at = now()
    `;
    res.statusCode = 200;
    return res.json({ ok: true });
  } catch (err) {
    console.error('assessment-verification endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load or save assessment verification.' });
  }
};
```

- [ ] **Step 2: Write `pages/api/corrections.js`**

```js
const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { CATEGORIES } = require('../../lib/reports');

// Public read (course review details / correction log), developer-only
// write (logged from content/reports.html when closing a report as Corrected).
module.exports = async (req, res) => {
  try {
    const sql = getDb();

    if (req.method === 'GET') {
      const course = typeof req.query?.course === 'string' ? req.query.course : null;
      const rows = course
        ? await sql`select id, created_at as "createdAt", course, unit, lesson, question_ref as "questionRef", category, summary, reason, corrected_by as "correctedBy" from corrections where course = ${course} order by created_at desc`
        : await sql`select id, created_at as "createdAt", course, unit, lesson, question_ref as "questionRef", category, summary, reason, corrected_by as "correctedBy" from corrections order by created_at desc limit 200`;
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      res.statusCode = 200;
      return res.json(rows);
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.json({ error: 'GET or POST only' });
    }

    const session = verify(req.cookies?.session, process.env.SESSION_SECRET);
    if (!session || !session.isDeveloper) {
      res.statusCode = 403;
      return res.json({ error: 'developer accounts only' });
    }

    const body = req.body || {};
    const course = typeof body.course === 'string' ? body.course.trim() : '';
    const unit = typeof body.unit === 'string' ? body.unit.trim() || null : null;
    const lesson = typeof body.lesson === 'string' ? body.lesson.trim() || null : null;
    const questionRef = typeof body.questionRef === 'string' ? body.questionRef.trim() || null : null;
    const category = typeof body.category === 'string' ? body.category : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null;
    const reportId = Number.isInteger(body.reportId) ? body.reportId : null;
    const correctedBy = typeof body.correctedBy === 'string' ? body.correctedBy.trim() || null : null;

    if (!course || !CATEGORIES.includes(category) || !summary) {
      res.statusCode = 400;
      return res.json({ error: 'course, a known category, and a summary are required' });
    }

    await sql`
      insert into corrections (course, unit, lesson, question_ref, category, summary, reason, report_id, corrected_by)
      values (${course}, ${unit}, ${lesson}, ${questionRef}, ${category}, ${summary}, ${reason}, ${reportId}, ${correctedBy})
    `;
    res.statusCode = 201;
    return res.json({ ok: true });
  } catch (err) {
    console.error('corrections endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not save the correction.' });
  }
};
```

- [ ] **Step 3: Verify with `npm test`**

Run: `npm test`
Expected: all checks pass (no dedicated unit test for these two routes — they're exercised live in Task 15).

- [ ] **Step 4: Commit**

```bash
git add pages/api/assessment-verification.js pages/api/corrections.js
git commit -m "Add assessment-verification and corrections API routes"
```

---

### Task 6: Reports status workflow — API + admin UI

**Files:**
- Modify: `pages/api/reports.js`
- Modify: `public/assets/reports.js`
- Modify: `content/reports.html`

**Interfaces:**
- Consumes: `lib/content-trust.js`'s `isValidReportStatus`, `REPORT_STATUSES` (Task 2); `lib/reports.js`'s `CATEGORIES` (Task 3); `pages/api/corrections.js` (Task 5).
- Produces: `GET /api/reports` now also returns `statuses: string[]`, `categories: string[]`, and each report row gains `unit`, `lesson`, `status`. `POST /api/reports` body is now `{id, status}` (was `{id, resolved}`) — this is a breaking change to the route's contract, which is why the API and both consumers (`reports.js`, `reports.html`) are one task.

- [ ] **Step 1: Replace `pages/api/reports.js`**

```js
const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isValidReportStatus, REPORT_STATUSES } = require('../../lib/content-trust');
const { CATEGORIES } = require('../../lib/reports');

const CLOSED_STATUSES = new Set(['CORRECTED', 'CLOSED']);

// Developer-only review of Report a Problem submissions (content/reports.html).
module.exports = async (req, res) => {
  const session = verify(req.cookies?.session, process.env.SESSION_SECRET);
  if (!session || !session.isDeveloper) {
    res.statusCode = 403;
    return res.json({ error: 'developer accounts only' });
  }
  try {
    const sql = getDb();
    if (req.method === 'POST') {
      const id = Number(req.body?.id);
      const status = req.body?.status;
      if (!Number.isInteger(id) || !isValidReportStatus(status)) {
        res.statusCode = 400;
        return res.json({ error: 'id and a valid status are required' });
      }
      await sql`update reports set status = ${status}, resolved_at = ${CLOSED_STATUSES.has(status) ? new Date() : null} where id = ${id}`;
      res.statusCode = 200;
      return res.json({ ok: true });
    }
    if (req.method !== 'GET') {
      res.statusCode = 405;
      return res.json({ error: 'GET or POST only' });
    }
    const open = await sql`
      select r.id, r.created_at as "createdAt", r.page, r.page_title as "pageTitle", r.course, r.unit, r.lesson,
        r.question_id as "questionId", r.category, r.description, r.status, r.resolved_at as "resolvedAt", u.email as reporter
      from reports r left join users u on u.id = r.user_id
      where r.status not in ('CORRECTED', 'CLOSED') order by r.created_at desc`;
    const resolved = await sql`
      select r.id, r.created_at as "createdAt", r.page, r.page_title as "pageTitle", r.course, r.unit, r.lesson,
        r.question_id as "questionId", r.category, r.description, r.status, r.resolved_at as "resolvedAt", u.email as reporter
      from reports r left join users u on u.id = r.user_id
      where r.status in ('CORRECTED', 'CLOSED') order by r.resolved_at desc limit 50`;
    res.statusCode = 200;
    return res.json({ open, resolved, statuses: REPORT_STATUSES, categories: CATEGORIES });
  } catch (err) {
    console.error('reports endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load reports.' });
  }
};
```

- [ ] **Step 2: Replace `public/assets/reports.js`**

```js
// Developer review page for Report a Problem (content/reports.html). Every
// report field comes from anonymous visitors, so it is only ever written
// with textContent. Status and category lists come from /api/reports'
// response rather than being hardcoded here, so there's nothing to drift.
(function () {
  'use strict';
  const mount = document.querySelector('[data-reports]');
  if (!mount || window.__stemplusReportsLoaded) return;
  window.__stemplusReportsLoaded = true;

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  function correctionForm(report, categories, onDone) {
    const form = document.createElement('div');
    form.className = 'fm-row';
    form.style.flexDirection = 'column';
    form.style.alignItems = 'stretch';
    form.style.gap = '0.5rem';

    const category = document.createElement('select');
    categories.forEach((c) => {
      const option = document.createElement('option');
      option.value = c;
      option.textContent = c;
      if (c === report.category) option.selected = true;
      category.append(option);
    });
    const summary = document.createElement('textarea');
    summary.rows = 2;
    summary.placeholder = 'What changed (shown publicly)';
    const reason = document.createElement('textarea');
    reason.rows = 2;
    reason.placeholder = 'Why (shown publicly, optional)';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'widget-btn';
    submit.textContent = 'Save correction & mark Corrected';
    submit.addEventListener('click', async () => {
      if (!summary.value.trim()) return;
      submit.disabled = true;
      const res = await fetch('/api/corrections', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course: report.course, unit: report.unit, lesson: report.lesson, questionRef: report.questionId,
          category: category.value, summary: summary.value, reason: reason.value, reportId: report.id,
        }),
      }).catch(() => null);
      if (res && res.ok) {
        await fetch('/api/reports', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: report.id, status: 'CORRECTED' }),
        }).catch(() => null);
        onDone();
      } else {
        submit.disabled = false;
      }
    });
    form.append(category, summary, reason, submit);
    return form;
  }

  function reportCard(report, statuses, categories, reload) {
    const card = document.createElement('div');
    card.className = 'widget';
    const meta = [new Date(report.createdAt).toLocaleString(), report.category, report.course, report.unit, report.reporter || 'guest'];
    card.append(paragraph(meta.filter(Boolean).join(' · '), 'widget-label'));

    const where = document.createElement('p');
    const link = document.createElement('a');
    link.href = report.page;
    link.textContent = report.pageTitle || report.page;
    where.append(link);
    if (report.questionId) where.append(` · question ${report.questionId}`);
    card.append(where, paragraph(report.description));

    const statusRow = document.createElement('div');
    statusRow.className = 'fm-row';
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Status for report ${report.id}`);
    statuses.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (report.status === status) option.selected = true;
      select.append(option);
    });
    const saveStatus = document.createElement('button');
    saveStatus.type = 'button';
    saveStatus.className = 'widget-btn';
    saveStatus.textContent = 'Update status';
    saveStatus.addEventListener('click', async () => {
      saveStatus.disabled = true;
      const res = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, status: select.value }),
      }).catch(() => null);
      if (res && res.ok) reload();
      else saveStatus.disabled = false;
    });
    statusRow.append(select, saveStatus);
    card.append(statusRow);

    const correctionToggle = document.createElement('button');
    correctionToggle.type = 'button';
    correctionToggle.className = 'widget-btn';
    correctionToggle.textContent = 'Log correction';
    correctionToggle.addEventListener('click', () => {
      correctionToggle.replaceWith(correctionForm(report, categories, reload));
    });
    card.append(correctionToggle);

    return card;
  }

  const section = (title, reports, empty, statuses, categories, reload) => {
    const heading = document.createElement('h2');
    heading.textContent = `${title} (${reports.length})`;
    return [heading, ...(reports.length ? reports.map((r) => reportCard(r, statuses, categories, reload)) : [paragraph(empty, 'toc-empty')])];
  };

  async function load() {
    const res = await fetch('/api/reports', { credentials: 'same-origin' }).catch(() => null);
    if (!res || !res.ok) {
      mount.replaceChildren(paragraph(res && res.status === 403
        ? 'Reports are only visible to developer accounts.'
        : 'Could not load reports.', 'toc-empty'));
      return;
    }
    const { open, resolved, statuses, categories } = await res.json();
    mount.replaceChildren(
      ...section('Open issues', open, 'No open issues.', statuses, categories, load),
      ...section('Recently closed', resolved, 'No closed issues yet.', statuses, categories, load)
    );
  }

  load();
}());
```

- [ ] **Step 3: Update `content/reports.html`'s subtitle**

Change line 9 from:
```html
  <p class="subtitle">Problems sent from the Report a problem button on every page, newest first. Close an issue when the work is complete; closed issues can be reopened. Only developer accounts can see them.</p>
```
to:
```html
  <p class="subtitle">Problems sent from the Report a problem button on every page, newest first. Move a report through Received → Under Review → Confirmed, then Log correction to record the fix and mark it Corrected (or Close it with no correction needed). Only developer accounts can see them.</p>
```

- [ ] **Step 4: Verify with `npm test`**

Run: `npm test`
Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add pages/api/reports.js public/assets/reports.js content/reports.html
git commit -m "Add a real status workflow and correction-logging to the reports admin"
```

---

### Task 7: `pages/api/report.js` — persist `unit`/`lesson`

**Files:**
- Modify: `pages/api/report.js:31-35`

**Interfaces:**
- Consumes: `lib/reports.js`'s extended `validateReport` (Task 3).
- Produces: inserts now populate `reports.unit`/`reports.lesson`.

- [ ] **Step 1: Update the insert**

Change:
```js
    await sql`
      insert into reports (page, page_title, course, question_id, category, description, user_id, ip_hash)
      values (${report.page}, ${report.pageTitle}, ${report.course}, ${report.questionId}, ${report.category},
        ${report.description}, (select id from users where id = ${session ? session.userId : null}), ${ipHash})
    `;
```
to:
```js
    await sql`
      insert into reports (page, page_title, course, unit, lesson, question_id, category, description, user_id, ip_hash)
      values (${report.page}, ${report.pageTitle}, ${report.course}, ${report.unit}, ${report.lesson}, ${report.questionId}, ${report.category},
        ${report.description}, (select id from users where id = ${session ? session.userId : null}), ${ipHash})
    `;
```

- [ ] **Step 2: Verify with `npm test`**

Run: `npm test`
Expected: all checks pass.

- [ ] **Step 3: Commit**

```bash
git add pages/api/report.js
git commit -m "Persist unit/lesson on new Report a Problem submissions"
```

---

### Task 8: `components/Layout.tsx` — auto-derive `unit`/`lesson`

**Files:**
- Modify: `components/Layout.tsx` (add a helper near `courseFor()` at line 112; use it inside `ReportProblem`'s `submit`, around line 439)

**Interfaces:**
- Consumes: nothing new.
- Produces: `unitLessonFor(pathname): {unit: string|null, lesson: string|null}`. The `ReportProblem` POST body gains `unit`/`lesson`, consumed by Task 7's updated `/api/report`.

- [ ] **Step 1: Add `unitLessonFor` after `courseFor`**

Right after the `courseFor` function (ends at line 115), add:

```ts
// Best-effort: most courses follow content/<Course>/Unit N/000X-slug.html.
// Not every course does, and that's fine — this only enriches a report,
// it never blocks submission when it doesn't match.
function unitLessonFor(pathname: string): { unit: string | null; lesson: string | null } {
  const decoded = decodeURIComponent(pathname.split(/[?#]/)[0]);
  const match = decoded.match(/\/(Unit \d+)\/([^/]+)\.html$/);
  if (!match) return { unit: null, lesson: null };
  return { unit: match[1], lesson: match[2] };
}
```

- [ ] **Step 2: Use it in `ReportProblem`'s `submit`**

Change (around line 430-447):
```ts
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setSending(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: location.pathname + location.search,
          pageTitle: document.title,
          course,
          questionId,
          category: fields.get('category'),
          description: fields.get('description'),
        }),
      });
```
to:
```ts
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setSending(true);
    try {
      const { unit, lesson } = unitLessonFor(location.pathname);
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: location.pathname + location.search,
          pageTitle: document.title,
          course,
          unit,
          lesson,
          questionId,
          category: fields.get('category'),
          description: fields.get('description'),
        }),
      });
```

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: builds cleanly, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add components/Layout.tsx
git commit -m "Auto-derive unit/lesson for Report a Problem from the page URL"
```

---

### Task 9: Trust panel, checklist, and correction-card CSS

**Files:**
- Modify: `public/assets/style.css` (insert after the `.lock-badge.is-locked` rule, before the `/* Reflection component */` comment — currently around line 896)

**Interfaces:**
- Produces: `.trust-panel`, `.trust-panel-label`, `.trust-status-badge` (+ 4 status modifiers), `.trust-panel-grid`, `.trust-panel-row`, `.trust-panel-actions`, `.verify-checklist` (+ `.is-done`), `.correction-card`, `.correction-date`, `.correction-title` — consumed by Tasks 10-12.

- [ ] **Step 1: Insert the new CSS block**

Right after:
```css
.lock-badge.is-unlocked { color: var(--correct); background: var(--correct-soft); }
.lock-badge.is-locked { color: var(--muted); background: var(--code-bg); }
```
insert:
```css

/* Content trust panel (course hub pages) — reuses .widget's card shape and
   .lock-badge's pill shape rather than inventing new primitives. */
.trust-panel {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.1rem 1.3rem 1.3rem;
  margin: 1.4rem 0;
  background: var(--code-bg);
}
.trust-panel-label {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.7rem;
}
.trust-status-badge {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  font-weight: 700;
  padding: 0.2rem 0.65rem;
  border-radius: 20px;
  display: inline-block;
}
.trust-status-badge.is-ai-generated { color: var(--muted); background: var(--bg); border: 1px solid var(--border); }
.trust-status-badge.is-review-in-progress { color: var(--accent); background: var(--accent-soft); }
.trust-status-badge.is-human-reviewed { color: var(--accent); background: var(--accent-soft); }
.trust-status-badge.is-human-verified { color: var(--correct); background: var(--correct-soft); }

.trust-panel-grid { display: grid; gap: 0.55rem; margin: 0.9rem 0 0; padding: 0; font-size: 0.88rem; }
.trust-panel-row { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin: 0; }
.trust-panel-row dt { color: var(--muted); }
.trust-panel-row dd { margin: 0; text-align: right; }

.trust-panel-actions { display: flex; gap: 1.2rem; margin-top: 0.9rem; font-size: 0.85rem; }
.trust-panel-actions a, .trust-panel-actions button {
  color: var(--accent);
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  text-decoration: none;
}
.trust-panel-actions a:hover, .trust-panel-actions button:hover { text-decoration: underline; }

/* Assessment verification checklist (developer panel + review details) */
.verify-checklist { list-style: none; margin: 0.6rem 0 0; padding: 0; display: grid; gap: 0.3rem; font-size: 0.85rem; }
.verify-checklist li { color: var(--muted); }
.verify-checklist li.is-done { color: var(--correct); }

/* Correction log entries (corrections.html, review-details.html) */
.correction-card {
  border-left: 3px solid var(--accent);
  background: var(--code-bg);
  border-radius: 0 6px 6px 0;
  padding: 0.9rem 1.1rem;
  margin: 0.9rem 0;
}
.correction-date {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0;
}
.correction-title { font-weight: 600; margin: 0.3rem 0 0.4rem; }

/* Compact lesson-level "Sources & alignment" block (near the bottom of a
   lesson, not a large citation block) — see the AI-assisted review pass
   after Task 15 for which lessons get one. */
.lesson-sources {
  margin-top: 2.2rem;
  padding-top: 1.2rem;
  border-top: 1px dashed var(--border);
  font-size: 0.85rem;
  color: var(--muted);
}
.lesson-sources-kicker {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--accent);
  display: block;
  margin-bottom: 0.4rem;
}
```

- [ ] **Step 2: Verify with `npm test`**

Run: `npm test`
Expected: all checks pass (no CSS-parsing test in this suite; a visual check happens in Task 15).

- [ ] **Step 3: Commit**

```bash
git add public/assets/style.css
git commit -m "Add trust panel, checklist, correction-card, and lesson-sources CSS"
```

---

### Task 10: `trust-panel.js` — compact panel on the AP Calculus BC hub

**Files:**
- Create: `public/assets/trust-panel.js`
- Modify: `content/AP STEM+/AP_CALC/index.html`

**Interfaces:**
- Consumes: `GET /api/content-review` (Task 4), `GET /api/assessment-verification?course=` (Task 5).
- Produces: a `.trust-panel` DOM node mounted into any `[data-trust-panel]` element whose value is a real course name. Reusable by any other course's hub page later (not done in this plan — see Task 14's About rewrite for how to extend it).

- [ ] **Step 1: Write `public/assets/trust-panel.js`**

```js
// Compact content-trust panel for course hub pages. Mount with
// <div data-trust-panel="Course Name"></div> and load this script — same
// idempotent-mount pattern as developer-panel.js and reports.js.
(function () {
  'use strict';
  const mount = document.querySelector('[data-trust-panel]');
  if (!mount || window.__stemplusTrustPanelLoaded) return;
  window.__stemplusTrustPanelLoaded = true;

  const course = mount.getAttribute('data-trust-panel');
  if (!course) return;

  const STATUS_CLASS = {
    'AI Generated': 'is-ai-generated',
    'Review in Progress': 'is-review-in-progress',
    'Human Reviewed': 'is-human-reviewed',
    'Human Verified': 'is-human-verified',
  };

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function addRow(grid, label, value) {
    const r = document.createElement('div');
    r.className = 'trust-panel-row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    r.append(dt, dd);
    grid.append(r);
  }

  async function load() {
    const [reviewsRes, assessmentsRes] = await Promise.all([
      fetch('/api/content-review').catch(() => null),
      fetch(`/api/assessment-verification?course=${encodeURIComponent(course)}`).catch(() => null),
    ]);
    const reviews = reviewsRes && reviewsRes.ok ? await reviewsRes.json() : {};
    const assessments = assessmentsRes && assessmentsRes.ok ? await assessmentsRes.json() : [];
    const review = reviews[course];
    const status = review ? review.status : 'AI Generated';

    const panel = document.createElement('div');
    panel.className = 'trust-panel';

    // Automated checks are site-wide invariants enforced by npm test on
    // every commit (check-content-links.js, check-answer-keys.js,
    // check-inline-script-syntax.js, check-content.js) — true for every
    // course equally, never a stand-in for the human-review status below.
    // Spec requirement: these two must never be visually merged.
    const autoLabel = document.createElement('p');
    autoLabel.className = 'trust-panel-label';
    autoLabel.textContent = 'Automated checks';
    panel.append(autoLabel);
    const autoList = document.createElement('ul');
    autoList.className = 'verify-checklist';
    ['Links checked', 'Answer key structure checked', 'Script syntax checked', 'Content structure checked'].forEach((text) => {
      const li = document.createElement('li');
      li.className = 'is-done';
      li.textContent = text;
      autoList.append(li);
    });
    panel.append(autoList);

    const label = document.createElement('p');
    label.className = 'trust-panel-label';
    label.style.marginTop = '1rem';
    label.textContent = 'Human review';
    panel.append(label);

    const badge = document.createElement('span');
    badge.className = `trust-status-badge ${STATUS_CLASS[status] || 'is-ai-generated'}`;
    badge.textContent = status;
    panel.append(badge);

    const grid = document.createElement('dl');
    grid.className = 'trust-panel-grid';
    if (review && review.reviewed) addRow(grid, 'Last reviewed', formatDate(review.reviewed));
    if (review && review.framework) {
      addRow(grid, 'Framework', review.frameworkVersion ? `${review.framework} (${review.frameworkVersion})` : review.framework);
    }
    if (assessments.length) {
      const total = assessments.reduce((sum, a) => sum + a.questionsTotal, 0);
      const verified = assessments.reduce((sum, a) => sum + a.questionsVerified, 0);
      addRow(grid, 'Assessment verification', `${verified} / ${total} practice questions checked`);
    }
    if (review && review.sourcesList && review.sourcesList.length) {
      addRow(grid, 'Sources', review.sourcesList.map((s) => s.name).join(', '));
    }
    panel.append(grid);

    const actions = document.createElement('div');
    actions.className = 'trust-panel-actions';
    const detailsLink = document.createElement('a');
    detailsLink.href = `/review-details.html?course=${encodeURIComponent(course)}`;
    detailsLink.textContent = 'View review details';
    const reportBtn = document.createElement('button');
    reportBtn.type = 'button';
    reportBtn.textContent = 'Report an issue';
    reportBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('stemplus:report')));
    actions.append(detailsLink, reportBtn);
    panel.append(actions);

    mount.replaceChildren(panel);
  }

  load();
}());
```

- [ ] **Step 2: Mount it on the AP Calculus BC hub**

In `content/AP STEM+/AP_CALC/index.html`, change:
```html
<script src="../../assets/tests.js" defer></script>
<script src="../../assets/mastery.js" defer></script>
<div class="page">
  <span class="kicker">STEM+ · AP Calculus BC</span>
  <h1>AP Calculus BC — Table of Contents</h1>
  <p class="subtitle">Every lesson, in course order. Jump straight to whichever one you need.</p>
  <p class="nav-links"><a href="../../index.html" class="nav-toc">← STEM+ Home</a> <a href="reference/glossary.html" class="nav-glossary">Glossary →</a></p>
  <div data-course-context="AP Calculus BC" data-root="../../"></div>

  <section class="concept-skills" data-concept-skills data-course="AP Calculus BC" aria-live="polite"></section>
```
to:
```html
<script src="../../assets/tests.js" defer></script>
<script src="../../assets/mastery.js" defer></script>
<script src="../../assets/trust-panel.js" defer></script>
<div class="page">
  <span class="kicker">STEM+ · AP Calculus BC</span>
  <h1>AP Calculus BC — Table of Contents</h1>
  <p class="subtitle">Every lesson, in course order. Jump straight to whichever one you need.</p>
  <p class="nav-links"><a href="../../index.html" class="nav-toc">← STEM+ Home</a> <a href="reference/glossary.html" class="nav-glossary">Glossary →</a></p>
  <div data-course-context="AP Calculus BC" data-root="../../"></div>
  <div data-trust-panel="AP Calculus BC"></div>

  <section class="concept-skills" data-concept-skills data-course="AP Calculus BC" aria-live="polite"></section>
```

- [ ] **Step 3: Verify with `npm test`**

Run: `npm test`
Expected: all checks pass, including `check-content-links.js` and `check-inline-script-syntax.js` (the new `<script>` tag and mount div don't break either).

- [ ] **Step 4: Commit**

```bash
git add public/assets/trust-panel.js "content/AP STEM+/AP_CALC/index.html"
git commit -m "Add the compact trust panel to the AP Calculus BC hub"
```

---

### Task 11: Public review pages — `review-details.html` and `corrections.html`

**Files:**
- Create: `content/review-details.html`
- Create: `public/assets/review-details.js`
- Create: `content/corrections.html`
- Create: `public/assets/corrections.js`

**Interfaces:**
- Consumes: `GET /api/content-review`, `GET /api/assessment-verification?course=`, `GET /api/corrections[?course=]` (Tasks 4, 5).
- Produces: two public pages, both linked from Task 10's trust panel (`review-details.html?course=`) and from Task 13's About rewrite (`corrections.html`).

- [ ] **Step 1: Write `content/review-details.html`**

```html
<meta charset="UTF-8">
<link rel="icon" href="favicon.ico?v=1" type="image/x-icon">
<title>Review Details — STEM+</title>
<link rel="stylesheet" href="assets/style.css">
<script src="assets/review-details.js" defer></script>
<div class="page">
  <span class="kicker">STEM+ · Content Review</span>
  <h1 data-review-title>Review Details</h1>
  <p class="nav-links"><a href="about.html#content-review" class="nav-toc">← How we review</a></p>
  <div data-review-details><p class="toc-empty">Loading…</p></div>
  <footer class="lesson-footer">STEM+ · content trust</footer>
</div>
```

- [ ] **Step 2: Write `public/assets/review-details.js`**

```js
// Generic review-details page, driven entirely by ?course= and the
// content-review / assessment-verification / corrections APIs — one page
// serves every course rather than a static page per course.
(function () {
  'use strict';
  const mount = document.querySelector('[data-review-details]');
  if (!mount || window.__stemplusReviewDetailsLoaded) return;
  window.__stemplusReviewDetailsLoaded = true;

  const course = new URLSearchParams(location.search).get('course');
  const titleEl = document.querySelector('[data-review-title]');

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  const CHECKLIST_LABELS = {
    answerChecked: 'Correct answer checked',
    explanationChecked: 'Explanation checked',
    wordingChecked: 'Question wording checked',
    numericToleranceChecked: 'Numeric tolerance checked',
    symbolicEquivalenceChecked: 'Symbolic equivalence checked',
    diagramChecked: 'Diagram checked',
    curriculumAlignmentChecked: 'Curriculum alignment checked',
  };

  function assessmentRow(a) {
    const row = document.createElement('div');
    row.className = 'widget';
    const name = [a.unit, a.kind === 'course_exam' ? 'Course exam' : 'Unit test', a.version ? `Version ${a.version}` : null]
      .filter(Boolean).join(' · ');
    row.append(paragraph(name, 'widget-label'));
    row.append(paragraph(`${a.status} — ${a.questionsVerified} / ${a.questionsTotal} questions checked`));
    const list = document.createElement('ul');
    list.className = 'verify-checklist';
    Object.entries(CHECKLIST_LABELS).forEach(([key, text]) => {
      const li = document.createElement('li');
      li.textContent = text;
      if (a.checklist[key]) li.classList.add('is-done');
      list.append(li);
    });
    row.append(list);
    return row;
  }

  function correctionRow(c) {
    const card = document.createElement('div');
    card.className = 'correction-card';
    const date = document.createElement('p');
    date.className = 'correction-date';
    date.textContent = new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    card.append(date);
    const titleLine = [c.unit, c.lesson, c.questionRef].filter(Boolean).join(' — ');
    if (titleLine) card.append(paragraph(titleLine, 'correction-title'));
    card.append(paragraph(`Changed: ${c.summary}`));
    if (c.reason) card.append(paragraph(`Reason: ${c.reason}`));
    return card;
  }

  async function load() {
    if (!course) {
      mount.replaceChildren(paragraph('No course specified.', 'toc-empty'));
      return;
    }
    if (titleEl) titleEl.textContent = `${course} — Review Details`;
    document.title = `${course} — Review Details — STEM+`;

    const [reviewsRes, assessmentsRes, correctionsRes] = await Promise.all([
      fetch('/api/content-review').catch(() => null),
      fetch(`/api/assessment-verification?course=${encodeURIComponent(course)}`).catch(() => null),
      fetch(`/api/corrections?course=${encodeURIComponent(course)}`).catch(() => null),
    ]);
    const reviews = reviewsRes && reviewsRes.ok ? await reviewsRes.json() : {};
    const assessments = assessmentsRes && assessmentsRes.ok ? await assessmentsRes.json() : [];
    const corrections = correctionsRes && correctionsRes.ok ? await correctionsRes.json() : [];
    const review = reviews[course];

    const sections = [];
    const autoHeading = document.createElement('h2');
    autoHeading.textContent = 'Automated checks';
    sections.push(autoHeading);
    const autoList = document.createElement('ul');
    autoList.className = 'verify-checklist';
    ['Links checked', 'Answer key structure checked', 'Script syntax checked', 'Content structure checked'].forEach((text) => {
      const li = document.createElement('li');
      li.className = 'is-done';
      li.textContent = text;
      autoList.append(li);
    });
    sections.push(autoList);

    const humanHeading = document.createElement('h2');
    humanHeading.textContent = 'Human review';
    sections.push(humanHeading);
    sections.push(paragraph(`Status: ${review ? review.status : 'AI Generated'}`, 'widget-label'));
    if (review && review.reviewed) sections.push(paragraph(`Last reviewed: ${new Date(review.reviewed).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`));
    if (review && review.reviewedBy) sections.push(paragraph(`Reviewer: ${review.reviewedBy}${review.reviewerRole ? ` (${review.reviewerRole})` : ''}`));
    if (review && review.framework) sections.push(paragraph(`Framework: ${review.framework}${review.frameworkVersion ? ` (${review.frameworkVersion})` : ''}`));
    if (review && review.sourcesList && review.sourcesList.length) {
      sections.push(paragraph(`Sources: ${review.sourcesList.map((s) => s.name).join(', ')}`));
    }

    const heading1 = document.createElement('h2');
    heading1.textContent = 'Assessment verification';
    sections.push(heading1);
    sections.push(...(assessments.length ? assessments.map(assessmentRow) : [paragraph('No assessments tracked for this course yet.', 'toc-empty')]));

    const heading2 = document.createElement('h2');
    heading2.textContent = 'Recent corrections';
    sections.push(heading2);
    sections.push(...(corrections.length ? corrections.map(correctionRow) : [paragraph('No corrections recorded for this course yet.', 'toc-empty')]));

    mount.replaceChildren(...sections);
  }

  load();
}());
```

- [ ] **Step 3: Write `content/corrections.html`**

```html
<meta charset="UTF-8">
<link rel="icon" href="favicon.ico?v=1" type="image/x-icon">
<title>Corrections — STEM+</title>
<link rel="stylesheet" href="assets/style.css">
<script src="assets/corrections.js" defer></script>
<div class="page">
  <span class="kicker">STEM+ · Content Review</span>
  <h1>Recent Corrections</h1>
  <p class="subtitle">Every correction made to STEM+ content after a report or a review, newest first. Nothing is hidden.</p>
  <p class="nav-links"><a href="about.html#content-review" class="nav-toc">← How we review</a></p>
  <div data-corrections-log><p class="toc-empty">Loading…</p></div>
  <footer class="lesson-footer">STEM+ · content trust</footer>
</div>
```

- [ ] **Step 4: Write `public/assets/corrections.js`**

```js
// Public correction log (content/corrections.html) — every course, newest first.
(function () {
  'use strict';
  const mount = document.querySelector('[data-corrections-log]');
  if (!mount || window.__stemplusCorrectionsLoaded) return;
  window.__stemplusCorrectionsLoaded = true;

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  function correctionCard(c) {
    const card = document.createElement('div');
    card.className = 'correction-card';
    const date = document.createElement('p');
    date.className = 'correction-date';
    date.textContent = `${new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · ${c.course}`;
    card.append(date);
    const titleLine = [c.unit, c.lesson, c.questionRef].filter(Boolean).join(' — ');
    if (titleLine) card.append(paragraph(titleLine, 'correction-title'));
    card.append(paragraph(`Changed: ${c.summary}`));
    if (c.reason) card.append(paragraph(`Reason: ${c.reason}`));
    return card;
  }

  async function load() {
    const res = await fetch('/api/corrections').catch(() => null);
    if (!res || !res.ok) {
      mount.replaceChildren(paragraph('Could not load the correction log.', 'toc-empty'));
      return;
    }
    const corrections = await res.json();
    mount.replaceChildren(...(corrections.length ? corrections.map(correctionCard) : [paragraph('No corrections recorded yet.', 'toc-empty')]));
  }

  load();
}());
```

- [ ] **Step 5: Verify with `npm test`**

Run: `npm test`
Expected: all checks pass, including `check-content-links.js`, `check-inline-script-syntax.js`, `check-nav-links.js` (these two new pages aren't added to any nav menu, so `check-nav-links.js` has nothing new to check against them).

- [ ] **Step 6: Commit**

```bash
git add content/review-details.html public/assets/review-details.js content/corrections.html public/assets/corrections.js
git commit -m "Add public review-details and corrections pages"
```

---

### Task 12: Developer panel extension — framework/sources + assessment-verification editor

**Files:**
- Modify: `public/assets/developer-panel.js`
- Modify: `content/developer-panel.html`
- Create: `public/assets/assessment-review-panel.js`
- Modify: `scripts/check-content-trust.js` (append a drift assertion)

**Interfaces:**
- Consumes: `POST /api/content-review` (Task 4, now accepting `reviewedBy`/`reviewerRole`/`framework`/`frameworkVersion`/`sources`), `GET`/`POST /api/assessment-verification` (Task 5).
- Produces: nothing new consumed elsewhere — this is the admin UI leaf.

- [ ] **Step 1: Replace `public/assets/developer-panel.js`**

```js
// Developer panel: set each course's content-review status and metadata
// (pages/api/content-review.js). Course names come from the skill catalog
// — the same file assets/mastery.js already fetches — not a separate
// hardcoded list, so a newly-cataloged course shows up here automatically.
(function () {
  'use strict';
  const mount = document.querySelector('[data-content-review-panel]');
  if (!mount || window.__stemplusContentReviewPanelLoaded) return;
  window.__stemplusContentReviewPanelLoaded = true;

  // Keep in sync with lib/content-review.js's VALID_STATUSES.
  const STATUSES = ['AI Generated', 'Review in Progress', 'Human Reviewed', 'Human Verified'];

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  const field = (labelText, inputEl) => {
    const label = document.createElement('label');
    label.className = 'fm-row';
    const span = document.createElement('span');
    span.textContent = labelText;
    span.style.minWidth = '9rem';
    label.append(span, inputEl);
    return label;
  };

  function courseRow(course, current) {
    const row = document.createElement('div');
    row.className = 'widget';

    const label = document.createElement('p');
    label.className = 'widget-label';
    label.textContent = course;
    row.append(label);

    const statusText = (status, reviewedAt) =>
      reviewedAt ? `${status} · last reviewed ${new Date(reviewedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}` : status;
    const statusLine = paragraph(statusText(current ? current.status : 'AI Generated', current && current.reviewed), 'toc-sub');
    row.append(statusLine);

    const select = document.createElement('select');
    select.setAttribute('aria-label', `Status for ${course}`);
    STATUSES.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (current ? current.status === status : status === 'AI Generated') option.selected = true;
      select.append(option);
    });

    const reviewedByInput = document.createElement('input');
    reviewedByInput.type = 'text';
    reviewedByInput.value = (current && current.reviewedBy) || '';
    reviewedByInput.placeholder = 'e.g. Mathematics Reviewer';

    const reviewerRoleInput = document.createElement('input');
    reviewerRoleInput.type = 'text';
    reviewerRoleInput.value = (current && current.reviewerRole) || '';
    reviewerRoleInput.placeholder = 'e.g. Calculus Reviewer';

    const frameworkInput = document.createElement('input');
    frameworkInput.type = 'text';
    frameworkInput.value = (current && current.framework) || '';
    frameworkInput.placeholder = 'e.g. College Board AP Calculus BC Course and Exam Description';

    const frameworkVersionInput = document.createElement('input');
    frameworkVersionInput.type = 'text';
    frameworkVersionInput.value = (current && current.frameworkVersion) || '';
    frameworkVersionInput.placeholder = 'e.g. 2026';

    const sourcesInput = document.createElement('textarea');
    sourcesInput.rows = 3;
    sourcesInput.value = (current && current.sources) || '';
    sourcesInput.placeholder = 'primary|College Board AP Calculus BC CED\nreference|OpenStax Calculus';

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Reviewer, framework & sources';
    details.append(summary);
    const detailGrid = document.createElement('div');
    detailGrid.style.display = 'grid';
    detailGrid.style.gap = '0.6rem';
    detailGrid.style.marginTop = '0.6rem';
    detailGrid.append(
      field('Reviewed by', reviewedByInput),
      field('Reviewer role', reviewerRoleInput),
      field('Framework', frameworkInput),
      field('Framework version', frameworkVersionInput),
      field('Sources (one per line)', sourcesInput)
    );
    details.append(detailGrid);
    row.append(details);

    const controls = document.createElement('div');
    controls.className = 'fm-row';
    controls.style.gap = '0.6rem';
    controls.style.marginTop = '0.8rem';

    const errorLine = paragraph('', 'toc-empty');
    errorLine.hidden = true;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'widget-btn';
    button.textContent = 'Save';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Saving…';
      errorLine.hidden = true;
      const res = await fetch('/api/content-review', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course,
          status: select.value,
          reviewedBy: reviewedByInput.value,
          reviewerRole: reviewerRoleInput.value,
          framework: frameworkInput.value,
          frameworkVersion: frameworkVersionInput.value,
          sources: sourcesInput.value,
        }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res && res.ok) {
        statusLine.textContent = statusText(select.value, new Date().toISOString());
        button.textContent = 'Saved';
        setTimeout(() => {
          button.textContent = 'Save';
          button.disabled = false;
        }, 1500);
      } else {
        errorLine.textContent = data.error || 'Could not save.';
        errorLine.hidden = false;
        button.textContent = 'Try again';
        button.disabled = false;
      }
    });

    controls.append(select, button);
    row.append(controls, errorLine);
    return row;
  }

  async function load() {
    const account = window.STEMPlusAccount;
    const me = account ? await account.ready : null;
    if (!me || !me.isDeveloper) {
      mount.replaceChildren(paragraph('The Developer Panel is only visible to developer accounts.', 'toc-empty'));
      return;
    }

    const catalogRes = await fetch('/assets/skill-catalog.json').catch(() => null);
    if (!catalogRes || !catalogRes.ok) {
      mount.replaceChildren(paragraph('Could not load the course list.', 'toc-empty'));
      return;
    }
    const catalog = await catalogRes.json();
    const courses = [...new Set(catalog.skills.map((skill) => skill.course))].sort();

    const reviewsRes = await fetch('/api/content-review', { credentials: 'same-origin' }).catch(() => null);
    if (!reviewsRes || !reviewsRes.ok) {
      mount.replaceChildren(paragraph('Could not load content review status.', 'toc-empty'));
      return;
    }
    const reviews = await reviewsRes.json();
    mount.replaceChildren(...courses.map((course) => courseRow(course, reviews[course])));
  }

  load();
}());
```

(Note: the `STATUSES` line is untouched — `scripts/check-content-review.js`'s existing drift check keeps passing unchanged.)

- [ ] **Step 2: Write `public/assets/assessment-review-panel.js`**

```js
// Developer-only assessment-verification editor (content/developer-panel.html).
// Keep STATUSES in sync with lib/content-trust.js's ASSESSMENT_STATUSES —
// checked by scripts/check-content-trust.js.
(function () {
  'use strict';
  const mount = document.querySelector('[data-assessment-review-panel]');
  if (!mount || window.__stemplusAssessmentReviewPanelLoaded) return;
  window.__stemplusAssessmentReviewPanelLoaded = true;

  const STATUSES = ['not-verified', 'in-progress', 'verified'];
  const CHECKLIST = [
    ['answerChecked', 'Correct answer checked'],
    ['explanationChecked', 'Explanation checked'],
    ['wordingChecked', 'Question wording checked'],
    ['numericToleranceChecked', 'Numeric tolerance checked'],
    ['symbolicEquivalenceChecked', 'Symbolic equivalence checked'],
    ['diagramChecked', 'Diagram checked'],
    ['curriculumAlignmentChecked', 'Curriculum alignment checked'],
  ];

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  function assessmentRow(a) {
    const row = document.createElement('div');
    row.className = 'widget';
    const name = [a.unit, a.kind === 'course_exam' ? 'Course exam' : 'Unit test', a.version ? `Version ${a.version}` : null]
      .filter(Boolean).join(' · ');
    row.append(paragraph(name, 'widget-label'));

    const select = document.createElement('select');
    STATUSES.forEach((s) => {
      const option = document.createElement('option');
      option.value = s;
      option.textContent = s;
      if (a.status === s) option.selected = true;
      select.append(option);
    });

    const totalInput = document.createElement('input');
    totalInput.type = 'number';
    totalInput.min = '0';
    totalInput.value = a.questionsTotal;
    totalInput.style.width = '5rem';

    const verifiedInput = document.createElement('input');
    verifiedInput.type = 'number';
    verifiedInput.min = '0';
    verifiedInput.value = a.questionsVerified;
    verifiedInput.style.width = '5rem';

    const countsRow = document.createElement('div');
    countsRow.className = 'fm-row';
    const totalLabel = document.createElement('label');
    totalLabel.append('Total ', totalInput);
    const verifiedLabel = document.createElement('label');
    verifiedLabel.append('Verified ', verifiedInput);
    countsRow.append(select, totalLabel, verifiedLabel);
    row.append(countsRow);

    const checklistWrap = document.createElement('div');
    checklistWrap.style.display = 'grid';
    checklistWrap.style.gap = '0.3rem';
    checklistWrap.style.margin = '0.6rem 0';
    const checkboxes = {};
    CHECKLIST.forEach(([key, text]) => {
      const checkboxLabel = document.createElement('label');
      checkboxLabel.className = 'fm-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(a.checklist[key]);
      checkboxes[key] = checkbox;
      checkboxLabel.append(checkbox, ` ${text}`);
      checklistWrap.append(checkboxLabel);
    });
    row.append(checklistWrap);

    const notesInput = document.createElement('textarea');
    notesInput.rows = 2;
    notesInput.placeholder = 'Notes (optional)';
    notesInput.value = a.notes || '';
    row.append(notesInput);

    const verifiedByInput = document.createElement('input');
    verifiedByInput.type = 'text';
    verifiedByInput.placeholder = 'Verified by (if marking verified)';
    verifiedByInput.value = a.verifiedBy || '';
    row.append(verifiedByInput);

    const errorLine = paragraph('', 'toc-empty');
    errorLine.hidden = true;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'widget-btn';
    button.textContent = 'Save';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Saving…';
      errorLine.hidden = true;
      const checklist = {};
      CHECKLIST.forEach(([key]) => { checklist[key] = checkboxes[key].checked; });
      const res = await fetch('/api/assessment-verification', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId: a.assessmentId,
          course: a.course,
          unit: a.unit,
          kind: a.kind,
          version: a.version,
          status: select.value,
          questionsTotal: Number(totalInput.value) || 0,
          questionsVerified: Number(verifiedInput.value) || 0,
          checklist,
          notes: notesInput.value,
          verifiedBy: verifiedByInput.value,
        }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res && res.ok) {
        button.textContent = 'Saved';
        setTimeout(() => { button.textContent = 'Save'; button.disabled = false; }, 1500);
      } else {
        errorLine.textContent = data.error || 'Could not save.';
        errorLine.hidden = false;
        button.textContent = 'Try again';
        button.disabled = false;
      }
    });
    row.append(button, errorLine);
    return row;
  }

  async function loadCourse(course) {
    mount.replaceChildren(paragraph('Loading…', 'toc-empty'));
    const res = await fetch(`/api/assessment-verification?course=${encodeURIComponent(course)}`).catch(() => null);
    if (!res || !res.ok) {
      mount.replaceChildren(paragraph('Could not load assessments.', 'toc-empty'));
      return;
    }
    const assessments = await res.json();
    mount.replaceChildren(...(assessments.length
      ? assessments.map(assessmentRow)
      : [paragraph('No assessments tracked for this course yet.', 'toc-empty')]));
  }

  async function init() {
    const account = window.STEMPlusAccount;
    const me = account ? await account.ready : null;
    if (!me || !me.isDeveloper) return;

    const catalogRes = await fetch('/assets/skill-catalog.json').catch(() => null);
    if (!catalogRes || !catalogRes.ok) return;
    const catalog = await catalogRes.json();
    const courses = [...new Set(catalog.skills.map((skill) => skill.course))].sort();

    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Course');
    courses.forEach((course) => {
      const option = document.createElement('option');
      option.value = course;
      option.textContent = course;
      select.append(option);
    });
    select.addEventListener('change', () => loadCourse(select.value));
    mount.before(select);
    loadCourse(select.value);
  }

  init();
}());
```

- [ ] **Step 3: Wire it into `content/developer-panel.html`**

Change:
```html
<script src="assets/developer-panel.js" defer></script>
```
to:
```html
<script src="assets/developer-panel.js" defer></script>
<script src="assets/assessment-review-panel.js" defer></script>
```

Then change:
```html
  <h2>Content Review Status</h2>
  <div data-content-review-panel><p class="toc-empty">Loading…</p></div>

  <footer class="lesson-footer">STEM+ · developer tools</footer>
```
to:
```html
  <h2>Content Review Status</h2>
  <div data-content-review-panel><p class="toc-empty">Loading…</p></div>

  <h2>Assessment Verification</h2>
  <div data-assessment-review-panel><p class="toc-empty">Loading…</p></div>

  <footer class="lesson-footer">STEM+ · developer tools</footer>
```

- [ ] **Step 4: Append the `STATUSES` drift check to `scripts/check-content-trust.js`**

At the top of the file, add `const fs = require('fs'); const path = require('path');` next to the existing `const assert = require('assert');` line. At the end of the file, right before the final `console.log(...)` line, add:

```js
// public/assets/assessment-review-panel.js can't require() lib/content-trust.js
// (it's a browser script), so its STATUSES list is a hand-maintained
// duplicate — this assertion catches the two drifting apart.
const panelJs = fs.readFileSync(path.join(__dirname, '../public/assets/assessment-review-panel.js'), 'utf8');
const panelStatusesMatch = panelJs.match(/const STATUSES = (\[[^\]]+\]);/);
assert.ok(panelStatusesMatch, 'could not find STATUSES in public/assets/assessment-review-panel.js');
const panelStatuses = JSON.parse(panelStatusesMatch[1].replace(/'/g, '"'));
assert.deepStrictEqual(panelStatuses, ASSESSMENT_STATUSES, 'assessment-review-panel.js STATUSES is out of sync with ASSESSMENT_STATUSES');
```

- [ ] **Step 5: Run it and the full suite**

Run: `node scripts/check-content-trust.js`
Expected: `check-content-trust: OK (...)`, exit code 0.

Run: `npm test`
Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add public/assets/developer-panel.js content/developer-panel.html public/assets/assessment-review-panel.js scripts/check-content-trust.js
git commit -m "Extend developer panel with framework/sources fields and an assessment-verification editor"
```

---

### Task 13: Rewrite `content/about.html`'s content-review section

**Files:**
- Modify: `content/about.html:39-50`

**Interfaces:**
- Consumes: nothing.
- Produces: the public-facing explanation referenced by `scripts/check-content-review.js`'s drift check (the `<ul><li><strong>` status list must stay byte-identical in order to that check's expectations — only surrounding prose changes).

- [ ] **Step 1: Replace the section**

Replace the whole `<section class="about-section" id="content-review">...</section>` block (lines 39-50) with:

```html
  <section class="about-section" id="content-review">
    <h2>How STEM+ content is reviewed</h2>
    <p class="subtitle">STEM+ content goes through six steps, in order:</p>
    <ol class="subtitle">
      <li>Content is created or generated, often with AI assistance.</li>
      <li>Automated checks validate structure: answer keys, question formats, links, and every sandbox and project test. These checks catch broken content, but they can't prove an explanation is right.</li>
      <li>A human reviewer inspects the instructional content for correctness and clarity.</li>
      <li>Assessments — unit tests, course exams, and practice questions — are checked separately, with their own verification status.</li>
      <li>Once reviewed, a course shows its status, review date, reviewer, framework, and sources right alongside the content.</li>
      <li>Reported issues are tracked and, when something is corrected, the correction is logged publicly.</li>
    </ol>
    <p class="subtitle">Each course shows its review status at the bottom of its pages:</p>
    <ul class="subtitle">
      <li><strong>AI Generated</strong> — written with AI, passes the automated checks. Every course starts here.</li>
      <li><strong>Review in Progress</strong> — a person is actively reading through the course now.</li>
      <li><strong>Human Reviewed</strong> — a person has read the course and corrected what they found, with the date shown.</li>
      <li><strong>Human Verified</strong> — reviewed and checked line-by-line against the course's official curriculum, with every one of its assessments separately verified.</li>
    </ul>
    <p class="subtitle">Human Reviewed and Human Verified courses also show who reviewed them, what role they reviewed in, what framework or curriculum they were checked against — for example, the College Board Course and Exam Description for an AP course — and what sources were used. Flagship courses additionally track assessment verification: how many unit tests, the course exam, and practice questions have actually been checked question-by-question. A course's full review details, including its assessment breakdown and correction history, are one click away from its <strong>View review details</strong> link.</p>
    <p class="subtitle">Found something wrong — an answer, an explanation, a typo, a broken link, a diagram, or code? Use <strong>Report a problem</strong> at the bottom of any page. Reports go straight to the people maintaining STEM+, with the page, unit, and question attached automatically where possible, and you don't need an account to send one. Every correction that results from a report — or from a review — is logged publicly in the <a href="corrections.html">correction history</a>, never hidden.</p>
    <p class="subtitle">A status like <strong>Human Verified</strong> means real review happened. It is never a guarantee of perfection, and it is never claimed without a named reviewer, a date, and at least one source on record.</p>
  </section>
```

- [ ] **Step 2: Verify with `npm test`**

Run: `node scripts/check-content-review.js`
Expected: `check-content-review: OK (...)` — the four `<li><strong>` status entries are unchanged in content and order, so this passes without modification to the check script itself.

Run: `npm test`
Expected: all checks pass.

- [ ] **Step 3: Commit**

```bash
git add content/about.html
git commit -m "Rewrite the content-review explanation on the About page"
```

---

### Task 14: AP Calculus BC pilot — seed real assessment counts and framework metadata

**Files:**
- Create: `scripts/seed-ap-calc-bc-review.js`

**Interfaces:**
- Consumes: `lib/db.js`'s `getDb()`.
- Produces: one `content_reviews` row for `'AP Calculus BC'` (framework fields only — status untouched/defaults to `'AI Generated'`), 21 `assessment_verifications` rows (`status: 'not-verified'`, real `questions_total` counts, `questions_verified: 0`).

- [ ] **Step 1: Write `scripts/seed-ap-calc-bc-review.js`**

```js
// One-off seed for the AP Calculus BC pilot (content-trust system,
// 2026-10-08 spec). Inserts real, mechanically-counted assessment rows
// (10 units x versions A/B x 10 questions, course exam x 20 questions —
// counted directly from content/AP STEM+/AP_CALC/**/*.html's
// data-test-item attributes) and the course's target framework.
//
// It does NOT set status to Human Reviewed or Human Verified — only a real
// human reviewer does that, through the developer panel, after actually
// reviewing. Safe to re-run: the on-conflict clauses never touch status,
// reviewed_by, or reviewed_at, so a later human edit is never clobbered by
// re-running this script.
const { getDb } = require('../lib/db');

const COURSE = 'AP Calculus BC';
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6', 'Unit 7', 'Unit 8', 'Unit 9', 'Unit 10'];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  const sql = getDb();

  await sql`
    insert into content_reviews (course, status, reviewed_at, framework, framework_version, updated_at)
    values (${COURSE}, 'AI Generated', now(), 'College Board AP Calculus BC Course and Exam Description', '2026', now())
    on conflict (course) do update set
      framework = excluded.framework,
      framework_version = excluded.framework_version,
      updated_at = now()
  `;

  const assessments = [];
  UNITS.forEach((unit) => {
    ['A', 'B'].forEach((version) => {
      assessments.push({
        assessmentId: `${slug(COURSE)}:${slug(unit)}:unit_test:${version.toLowerCase()}`,
        unit, kind: 'unit_test', version, questionsTotal: 10,
      });
    });
  });
  assessments.push({ assessmentId: `${slug(COURSE)}:course_exam`, unit: null, kind: 'course_exam', version: null, questionsTotal: 20 });

  for (const a of assessments) {
    await sql`
      insert into assessment_verifications (assessment_id, course, unit, kind, version, status, questions_total, questions_verified, updated_at)
      values (${a.assessmentId}, ${COURSE}, ${a.unit}, ${a.kind}, ${a.version}, 'not-verified', ${a.questionsTotal}, 0, now())
      on conflict (assessment_id) do update set
        questions_total = excluded.questions_total,
        updated_at = now()
    `;
  }

  console.log(`seed-ap-calc-bc-review: content_reviews framework set, ${assessments.length} assessment rows upserted (0 verified — honest default)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

Requires `.env.local` with `DATABASE_URL` set (same live DB as Task 1's migration).

Run: `node --env-file=.env.local scripts/seed-ap-calc-bc-review.js`
Expected: `seed-ap-calc-bc-review: content_reviews framework set, 21 assessment rows upserted (0 verified — honest default)`, exit code 0.

- [ ] **Step 3: Spot-check against the live API**

Run: `curl -s http://localhost:3200/api/content-review | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d['AP Calculus BC'])"` (with `npm run build && npm run start -- -p 3200` running).
Expected: `{ status: 'AI Generated', framework: 'College Board AP Calculus BC Course and Exam Description', frameworkVersion: '2026', sourcesList: [], ... }` — confirms status was left untouched.

Run: `curl -s "http://localhost:3200/api/assessment-verification?course=AP%20Calculus%20BC" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.length, d.reduce((s,a)=>s+a.questionsTotal,0))"`
Expected: `21 220` (21 rows, 220 total questions).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-ap-calc-bc-review.js
git commit -m "Seed AP Calculus BC's real assessment counts and framework metadata"
```

---

### Task 15: Manual/live verification

**Files:** none (verification only).

This task exercises every state listed in the spec's testing section (AI Generated / Review in Progress / Human Reviewed / Human Verified / missing metadata / with and without assessment verification / correction log empty and populated / Report a Problem / mobile / accessibility) without ever leaving a real course falsely marked, by stubbing `fetch` in the headless browser rather than mutating production data for the rendering checks, and by using a disposable course with an explicit revert for the one real round-trip check.

- [ ] **Step 1: Build and start the server**

Run: `npm run build && npm run start -- -p 3200` (kill anything already on port 3200 first, per this project's established convention).

- [ ] **Step 2: Rendering checks via fetch-stubbing (raw CDP, no npm packages)**

Write a script (e.g. `/private/tmp/.../scratchpad/verify-trust-panel.mjs`) that, for each of the four statuses plus a "missing metadata" case, uses `Page.addScriptToEvaluateOnNewDocument` to install a `window.fetch` stub returning synthetic JSON for `/api/content-review`, `/api/assessment-verification*`, and `/api/corrections*` **before** navigating to `http://localhost:3200/AP%20STEM%2B/AP_CALC/index.html`, then screenshots the mounted `.trust-panel` and asserts (via `Runtime.evaluate`) the badge text and grid contents match the stub. Repeat against `http://localhost:3200/review-details.html?course=AP%20Calculus%20BC` with the same stub for the full details view, and against `http://localhost:3200/corrections.html` with an empty-array stub and then a populated-array stub.

Expected for each: correct badge class/text, correct grid rows, zero `Runtime.exceptionThrown` events, no literal claim of Human Verified unless the stub says so (this never touches the real DB, so there's no risk of a real course appearing falsely verified).

- [ ] **Step 3: Mobile viewport**

Using `Emulation.setDeviceMetricsOverride({width: 390, height: 844, deviceScaleFactor: 2, mobile: true})`, screenshot the AP Calculus BC hub (trust panel), `review-details.html?course=AP%20Calculus%20BC`, and `corrections.html`. Confirm no horizontal overflow and the trust panel's `.trust-panel-row` wraps instead of clipping (the CSS already uses `flex-wrap: wrap`).

- [ ] **Step 4: Accessibility spot-check**

Via `Runtime.evaluate`, confirm: every status badge is a `<span>` with visible text (not color-only), the developer panel's new `<details>` disclosure is keyboard-operable (native `<details>`/`<summary>`, no custom JS needed), and all new `<select>`/`<input>`/`<textarea>` elements in the developer panel and reports admin have an associated `<label>` or `aria-label` (true by construction in the code written above — confirm by grepping the rendered DOM for unlabeled form controls).

- [ ] **Step 5: Real POST round-trip, then clean up**

Sign in as the developer test account (`sdd-verify-task1@example.com`, id 27, `is_developer=true` — get a fresh session cookie per this project's established method, POSTing credentials to `/api/auth/login` and reading `Set-Cookie`). Using a disposable, low-traffic real course — **"Topology: Fundamentals"**, not AP Calculus BC (whose honest pilot data from Task 14 must not be overwritten) — exercise the full validation surface over HTTP with that cookie:

1. `POST /api/content-review` with `{course: 'Topology: Fundamentals', status: 'Human Verified', reviewedBy: 'X', sources: 'primary|Y'}` and no assessment rows for that course → expect `400` with the "every assessment...verified" message.
2. `POST /api/content-review` with `{course: 'Topology: Fundamentals', status: 'Human Reviewed', reviewedBy: 'Test Reviewer'}` → expect `200`.
3. `GET /api/content-review` → confirm `reviews['Topology: Fundamentals'].status === 'Human Reviewed'` and `reviewedBy === 'Test Reviewer'`.
4. `POST /api/assessment-verification` with a throwaway `assessmentId` for that course, `status: 'verified'` → expect `200`.
5. `POST /api/corrections` with `{course: 'Topology: Fundamentals', category: 'Typo', summary: 'TEST correction — verifying the pipeline'}` → expect `201`.
6. `GET /api/corrections?course=Topology%3A%20Fundamentals` → confirm the row appears.

Then **revert**, matching this project's established "TEST "-prefix-and-delete convention for throwaway data:
```sql
delete from content_reviews where course = 'Topology: Fundamentals';
delete from assessment_verifications where course = 'Topology: Fundamentals';
delete from corrections where course = 'Topology: Fundamentals' and summary like 'TEST %';
```
Run these three deletes via a short one-off Node script using `getDb()` (same pattern as the seed script), against `.env.local`'s live `DATABASE_URL`. Confirm afterward with `GET /api/content-review` that `'Topology: Fundamentals'` is absent again (back to its honest default).

- [ ] **Step 6: Report a Problem end-to-end**

From a lesson page matching the `Unit N/000X-slug.html` pattern (e.g. an AP Calculus BC lesson), open the Report a Problem dialog, submit a report with description starting `TEST `, and confirm via `GET /api/reports` (developer session) that the new row has non-null `unit`/`lesson` matching the page's path. Delete it afterward (`delete from reports where description like 'TEST %'`), per the existing convention already documented in project memory.

- [ ] **Step 7: Full regression**

Run: `npm run build && npm test`
Expected: clean build, all checks pass.

- [ ] **Step 8: Kill background processes**

Stop the `npm run start -- -p 3200` process and any headless Chrome instance started for this task.

(No commit for this task — verification only, no file changes.)

---

## After the plan: AP Calculus BC content accuracy pass

Not an SDD task — performed by the controller directly (not dispatched to an implementer subagent), because it requires live `WebFetch` and subject-matter judgment rather than mechanical coding, per spec §4 point 5:

Fetch the real College Board AP Calculus BC Course and Exam Description and a reputable OpenStax Calculus source; cross-reference a sample of AP Calculus BC's existing answer keys and explanations (starting with the units most likely to have subtle errors — related rates, implicit differentiation, series convergence tests). File any genuine discrepancy found as a `corrections` entry via `POST /api/corrections` with `correctedBy: 'AI-assisted review (Claude)'` — never formatted to resemble a named human reviewer. If nothing is found wrong in the sample, file nothing — the correction log must never be padded to look populated. This pass does not change `content_reviews.status` for AP Calculus BC under any outcome.

While cross-referencing, add a compact "Sources & alignment" block (using Task 9's `.lesson-sources`/`.lesson-sources-kicker` CSS) near the bottom of the handful of lessons actually checked against the CED — not all 69, only the ones genuinely cross-referenced, so the block is never present without real work behind it:

```html
<section class="lesson-sources">
  <span class="lesson-sources-kicker">Sources &amp; alignment</span>
  <p>Aligned to: College Board CED Topic 3.1 — The Chain Rule</p>
  <p>Sources: College Board, OpenStax Calculus</p>
</section>
```

Insert it right before the lesson's closing `<footer class="lesson-footer">`, matching every other lesson's existing structure.

**Applying this system to a second course** (e.g. AP Physics 1, next per the spec's priority order): add `<div data-trust-panel="Course Name"></div>` plus a `trust-panel.js` `<script>` tag to that course's `index.html` (Task 10's pattern), write a course-specific version of `scripts/seed-ap-calc-bc-review.js` that counts real `data-test-item` occurrences per assessment file for that course, and set `framework`/`sources` for it through the already-built developer panel (Task 12) — no new engineering required, the whole pipeline from Tasks 1-13 is course-agnostic.
