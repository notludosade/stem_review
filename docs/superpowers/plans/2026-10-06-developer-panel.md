# Developer Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace STEM+'s build-time-hardcoded content-review status with a database-backed system editable through a new gated page, `content/developer-panel.html`.

**Architecture:** A new `content_reviews` Postgres table (course name → status + metadata), read publicly via `GET /api/content-review` (every page footer needs it) and written only by developer accounts via `POST /api/content-review`. `components/Layout.tsx`'s `SiteFooter` switches from a static object to a client-side fetch of the GET endpoint. The new panel page fetches the course list from the existing `skill-catalog.json` (not a new hardcoded list) and the current statuses from the same GET endpoint, and lets a developer account change any course's status via the POST endpoint.

**Tech Stack:** Next.js (Pages Router, existing), Neon Postgres via `@neondatabase/serverless` (existing), plain browser JS for the new content page's script (existing `public/assets/*.js` convention, no framework), Node `assert` for tests (existing `scripts/check-*.js` convention).

## Global Constraints

- **Status taxonomy, exactly 4 values, in this exact casing, nothing else accepted:** `AI Generated`, `Review in Progress`, `Human Reviewed`, `Human Verified`. This fully replaces the site's old 5-tier taxonomy (Draft, AI generated, Human reviewed, Verified, Needs review) — `about.html`'s docs are rewritten, not extended.
- **`GET /api/content-review` is public, no auth check** — every one of ~1,863 content pages' footer needs it. Only `POST /api/content-review` is developer-gated (`verify(req.cookies?.session, process.env.SESSION_SECRET)` + `session.isDeveloper`, identical check to the existing `pages/api/reports.js`).
- **The Developer Panel page itself is not auth-gated at the page/route level** (it's a static file like every other `content/*.html` page) — access control is: the public GET returning data to anyone, but `public/assets/developer-panel.js` only renders the editable course list after confirming `window.STEMPlusAccount.ready` resolves to a signed-in account with `isDeveloper: true` (same object `/api/me`/`account.js` already expose — no backend change needed for this check), and the POST endpoint enforces the real access control server-side regardless of what the client shows.
- **Status-only editing in this plan.** `reviewed_by`, `verified_against`, `sources` columns exist in the schema (so the footer's existing conditional rendering for them stays meaningful if ever populated by hand later) but nothing in this plan's UI writes them — `POST /api/content-review`'s `on conflict` clause never touches those three columns, only `status`/`reviewed_at`/`updated_at`.
- **Migrations run against the live production database** — there is no separate dev/staging DB. `node --env-file=.env.local scripts/migrate.js` (a bare `node` run does not load `.env.local`).
- **`npm test` must keep passing in full** (24 existing chained `check-*.js` scripts at the start of this plan) — any new check gets added to the chain in `package.json`, not run standalone.
- **No visual/DB-backed test runner exists for API routes** — use the project's established `scripts/verify-page.mjs` (raw CDP against a real `npm run build && npm run start`) for anything that needs a live server + DB. Read it before using it: it navigates to a URL, evaluates a JS expression in that page's context, and treats a truthy `ok` field (or plain truthy result) as PASS. An optional 3rd argument sets a `name=value` session cookie before navigation.

---

### Task 1: `content_reviews` table + status-validation library

**Files:**
- Modify: `scripts/migrate.js`
- Create: `lib/content-review.js`
- Create: `scripts/check-content-review.js`
- Modify: `package.json` (wire the new check into `"test"`)

**Interfaces:**
- Produces: `lib/content-review.js` exports `{ VALID_STATUSES, isValidStatus }` — `VALID_STATUSES` is `['AI Generated', 'Review in Progress', 'Human Reviewed', 'Human Verified']` (array, this exact order); `isValidStatus(status)` returns `true` only for a string exactly matching one of those four, `false` for anything else (including `null`/`undefined`/non-strings/old-taxonomy values). Task 2 imports both.
- Produces (DB): a `content_reviews` table with columns `course text primary key`, `status text not null default 'AI Generated'`, `reviewed_at timestamptz`, `reviewed_by text`, `verified_against text`, `sources text`, `updated_at timestamptz not null default now()`. Task 2 reads/writes this table.

- [ ] **Step 1: Add the migration**

In `scripts/migrate.js`, find:

```js
  // Report a Problem (pages/api/report.js). Anyone can report, so rows keep
  // an HMAC of the IP for rate limiting, never the IP itself.
  await sql`
    create table if not exists reports (
      id serial primary key,
      created_at timestamptz not null default now(),
      page text not null,
      page_title text,
      course text,
      question_id text,
      category text not null,
      description text not null,
      user_id integer references users(id) on delete set null,
      ip_hash text not null,
      resolved_at timestamptz
    )
  `;
  console.log('migrate: users and reports tables ready');
```

Replace it with (adds the new table right after `reports`, and updates the final log line):

```js
  // Report a Problem (pages/api/report.js). Anyone can report, so rows keep
  // an HMAC of the IP for rate limiting, never the IP itself.
  await sql`
    create table if not exists reports (
      id serial primary key,
      created_at timestamptz not null default now(),
      page text not null,
      page_title text,
      course text,
      question_id text,
      category text not null,
      description text not null,
      user_id integer references users(id) on delete set null,
      ip_hash text not null,
      resolved_at timestamptz
    )
  `;
  // Developer-editable per-course review status (content/developer-panel.html,
  // pages/api/content-review.js). A course with no row defaults to
  // "AI Generated" — see lib/content-review.js for the full list of allowed
  // status values. reviewed_by/verified_against/sources are not written by
  // the panel yet (status-only for now) but exist so they can be set by hand
  // later without another migration.
  await sql`
    create table if not exists content_reviews (
      course text primary key,
      status text not null default 'AI Generated',
      reviewed_at timestamptz,
      reviewed_by text,
      verified_against text,
      sources text,
      updated_at timestamptz not null default now()
    )
  `;
  console.log('migrate: users, reports, and content_reviews tables ready');
```

- [ ] **Step 2: Run the migration against the real database**

Run: `node --env-file=.env.local scripts/migrate.js`
Expected: prints `migrate: users, reports, and content_reviews tables ready` with no errors. This hits the live production Neon database — that's expected and matches how every prior migration on this project has run (confirmed in `stemplus-backend-and-verification` project notes).

- [ ] **Step 3: Write the validation library**

Create `lib/content-review.js`:

```js
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
```

- [ ] **Step 4: Write the failing test**

Create `scripts/check-content-review.js`:

```js
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
```

- [ ] **Step 5: Run it**

Run: `node scripts/check-content-review.js`
Expected: `check-content-review: OK (4 valid statuses; old-taxonomy and malformed values correctly rejected)`

- [ ] **Step 6: Wire it into `npm test`**

In `package.json`, find:

```
node scripts/check-content-links.js && node scripts/check-answer-keys.js && node scripts/check-plan-catalog.js
```

Change to:

```
node scripts/check-content-links.js && node scripts/check-answer-keys.js && node scripts/check-content-review.js && node scripts/check-plan-catalog.js
```

Run: `npm test`
Expected: all checks pass, including the new `check-content-review: OK` line in the output, in position right after `check-answer-keys`.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate.js lib/content-review.js scripts/check-content-review.js package.json
git commit -m "Add content_reviews table and status-validation library"
```

---

### Task 2: `GET`/`POST /api/content-review`

**Files:**
- Create: `pages/api/content-review.js`

**Interfaces:**
- Consumes: `lib/content-review.js`'s `isValidStatus` (Task 1), `lib/db.js`'s `getDb()` (existing), `lib/session.js`'s `verify()` (existing).
- Produces: `GET /api/content-review` → 200, JSON object keyed by course name: `{ [course]: { status: string, reviewed?: string, reviewedBy?: string, verifiedAgainst?: string, sources?: string } }` (a course with no DB row is simply absent from this object — Task 3's and Task 4's consumers both treat "absent" as "AI Generated", not an empty-string or null entry). `POST /api/content-review` with JSON body `{ course: string, status: string }` → 200 `{ ok: true }` on success, 400 if `course` is empty or `status` isn't one of the 4 valid values, 403 if not signed in as a developer account, 405 for any method other than GET/POST.

- [ ] **Step 1: Write the route**

Create `pages/api/content-review.js`:

```js
const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isValidStatus } = require('../../lib/content-review');

// Public read (every page footer shows a course's status), developer-only
// write (content/developer-panel.html).
module.exports = async (req, res) => {
  try {
    const sql = getDb();

    if (req.method === 'GET') {
      const rows = await sql`
        select course, status, reviewed_at as "reviewedAt", reviewed_by as "reviewedBy",
          verified_against as "verifiedAgainst", sources
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
        };
      });
      res.setHeader('Cache-Control', 'public, max-age=300');
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
    if (!course || !isValidStatus(status)) {
      res.statusCode = 400;
      return res.json({ error: 'course and a valid status are required' });
    }

    await sql`
      insert into content_reviews (course, status, reviewed_at, updated_at)
      values (${course}, ${status}, now(), now())
      on conflict (course) do update set status = excluded.status, reviewed_at = now(), updated_at = now()
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

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: still all passing (this route has no Node-level test — it needs a live DB and session cookie, verified manually in the next steps — so this step just confirms the new file doesn't break anything that IS covered, e.g. a syntax error would surface nowhere in `npm test` for this specific file, but confirm it at least doesn't break the build in Step 4 below).

- [ ] **Step 3: Reset the test developer account's password for manual verification**

The project's existing developer-flagged test account is `sdd-verify-task1@example.com` (id 27, `is_developer=true`) — per `stemplus-backend-and-verification` project notes, its current password isn't available in this session. Reset it to a known value (this account exists specifically for exactly this kind of verification — resetting its password is expected, not a problem):

```bash
node --env-file=.env.local -e "
const { getDb } = require('./lib/db');
const { hashPassword } = require('./lib/password');
(async () => {
  const sql = getDb();
  const hash = hashPassword('verify-test-password-2026');
  await sql\`update users set password_hash = \${hash} where email = 'sdd-verify-task1@example.com'\`;
  console.log('password reset for sdd-verify-task1@example.com');
})();
"
```

Expected: prints `password reset for sdd-verify-task1@example.com` with no errors.

- [ ] **Step 4: Build and serve the site**

```bash
npm run build && (npm run start &)
```

Wait for `- Local: http://localhost:3000` in the output before continuing.

- [ ] **Step 5: Log in and capture a session cookie**

```bash
curl -s -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sdd-verify-task1@example.com","password":"verify-test-password-2026"}' \
  | grep -i "^set-cookie:"
```

Expected: a `set-cookie: session=<long token>; ...` line. Copy everything between `session=` and the first `;` — that's the cookie value you'll pass to `verify-page.mjs` as `session=<value>` in the steps below.

- [ ] **Step 6: Verify GET is public and starts empty**

```bash
node scripts/verify-page.mjs http://localhost:3000/about.html \
  "fetch('/api/content-review').then(r => r.json()).then(data => ({ok: Object.keys(data).length === 0, data}))"
```

Expected: `PASS` (the table is freshly migrated with no rows yet, so every course is absent — this assertion would fail if a prior manual test left data behind; if so, that's fine, just confirm `data` in the output looks like a sensible course→status map, not an error).

- [ ] **Step 7: Verify POST is rejected for a signed-out visitor**

```bash
node scripts/verify-page.mjs http://localhost:3000/about.html \
  "fetch('/api/content-review', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({course:'Precalculus', status:'Human Reviewed'})}).then(r => ({ok: r.status === 403}))"
```

Expected: `PASS` (no session cookie passed to `verify-page.mjs`, so this request carries no session).

- [ ] **Step 8: Verify POST succeeds for the developer account, and GET reflects it**

Replace `<COOKIE>` with the value captured in Step 5.

```bash
node scripts/verify-page.mjs http://localhost:3000/about.html \
  "fetch('/api/content-review', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({course:'Precalculus', status:'Human Reviewed'})}).then(r => r.json()).then(data => ({ok: data.ok === true}))" \
  "session=<COOKIE>"

node scripts/verify-page.mjs http://localhost:3000/about.html \
  "fetch('/api/content-review').then(r => r.json()).then(data => ({ok: data['Precalculus']?.status === 'Human Reviewed', data}))"
```

Expected: both `PASS`. The second command's logged `data` should show `Precalculus` with `status: "Human Reviewed"` and a real `reviewed` timestamp.

- [ ] **Step 9: Verify an invalid status is rejected**

```bash
node scripts/verify-page.mjs http://localhost:3000/about.html \
  "fetch('/api/content-review', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({course:'Precalculus', status:'Verified'})}).then(r => ({ok: r.status === 400}))" \
  "session=<COOKIE>"
```

Expected: `PASS` (`'Verified'` is the old taxonomy's value, not one of the 4 current ones).

- [ ] **Step 10: Clean up the manual test server**

```bash
pkill -f "next start" 2>/dev/null
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
```

- [ ] **Step 11: Commit**

```bash
git add pages/api/content-review.js
git commit -m "Add GET/POST /api/content-review"
```

---

### Task 3: Switch `SiteFooter` to live data, rewrite the 4-tier docs

**Files:**
- Modify: `components/Layout.tsx`
- Modify: `content/about.html`

**Interfaces:**
- Consumes: `GET /api/content-review` (Task 2) — the exact response shape documented in Task 2's Interfaces block.
- Produces: no new exports — `SiteFooter` is already a private function in `Layout.tsx`, used the same way it already is.

- [ ] **Step 1: Delete the static `CONTENT_REVIEWS` constant**

In `components/Layout.tsx`, find (currently lines 106-130, but match by content since line numbers shift):

```ts
// Course pages show their review status in the footer. Every course starts
// as AI generated; promote one by adding it here, e.g.
// 'AP Calculus BC': {
//   status: 'Verified',
//   reviewed: 'November 2026',
//   reviewedBy: 'Jane Doe, math curriculum lead',
//   verifiedAgainst: 'College Board AP Calculus BC Course and Exam Description',
//   sources: ['College Board', 'OpenStax Calculus Volume 2'],
// }.
// Statuses: Draft, AI generated, Human reviewed, Verified, Needs review.
// reviewedBy/verifiedAgainst/sources only make sense once a human has
// actually done that work — leave them unset for AI generated/Draft/Needs
// review entries (or omit the entry entirely, which defaults to AI generated).
const CONTENT_REVIEWS: Readonly<
  Record<
    string,
    {
      status: string;
      reviewed?: string;
      reviewedBy?: string;
      verifiedAgainst?: string;
      sources?: readonly string[];
    }
  >
> = {};
```

Delete it entirely (the whole comment block and the constant).

- [ ] **Step 2: Rewrite `SiteFooter`**

Find the current function:

```tsx
function SiteFooter() {
  const course = courseFor(useRouter().asPath);
  const review = course ? CONTENT_REVIEWS[course] : undefined;
  return (
    <footer
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-[var(--site-border)]',
        'px-4 py-4 text-center text-xs text-[var(--site-muted)]'
      )}
    >
      {course && (
        <>
          <span data-content-status>
            {course} · Content status: {review ? review.status : 'AI generated · review in progress'}
            {review?.reviewed && ` · Last reviewed ${review.reviewed}`}
            {review?.verifiedAgainst && ` · Verified against: ${review.verifiedAgainst}`}
            {review?.reviewedBy && ` · Reviewed by: ${review.reviewedBy}`}
            {review?.sources && review.sources.length > 0 && ` · Sources: ${review.sources.join(', ')}`}
          </span>
          <a href="/about.html#content-review" className="text-[var(--site-accent)] hover:underline">
            How we review →
          </a>
        </>
      )}
      <ReportProblem course={course} />
    </footer>
  );
}
```

Replace it with:

```tsx
interface CourseReview {
  status: string;
  reviewed?: string;
  reviewedBy?: string;
  verifiedAgainst?: string;
  sources?: string;
}

function SiteFooter() {
  const course = courseFor(useRouter().asPath);
  const [reviews, setReviews] = useState<Record<string, CourseReview> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/content-review')
      .then((res) => (res.ok ? res.json() : {}))
      .then(setReviews)
      .catch(() => setReviews({}));
  }, []);

  const review = course && reviews ? reviews[course] : undefined;
  const reviewedLabel = review?.reviewed
    ? new Date(review.reviewed).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : null;

  return (
    <footer
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-[var(--site-border)]',
        'px-4 py-4 text-center text-xs text-[var(--site-muted)]'
      )}
    >
      {course && (
        <>
          <span data-content-status>
            {course}
            {reviews && ` · Content status: ${review ? review.status : 'AI Generated'}`}
            {reviewedLabel && ` · Last reviewed ${reviewedLabel}`}
            {review?.verifiedAgainst && ` · Verified against: ${review.verifiedAgainst}`}
            {review?.reviewedBy && ` · Reviewed by: ${review.reviewedBy}`}
            {review?.sources && ` · Sources: ${review.sources}`}
          </span>
          <a href="/about.html#content-review" className="text-[var(--site-accent)] hover:underline">
            How we review →
          </a>
        </>
      )}
      <ReportProblem course={course} />
    </footer>
  );
}
```

(`useState`/`useEffect` are already imported at the top of this file for `AuthStatus`'s identical pattern — no new import needed. While `reviews` is still `undefined`, the course name renders immediately but the "· Content status: ..." fragment is simply absent rather than showing a stale/wrong default, matching how `AuthStatus` returns `null` while its own fetch is pending.)

- [ ] **Step 3: Rewrite `about.html`'s content-review section**

In `content/about.html`, find:

```html
  <section class="about-section" id="content-review">
    <h2>How STEM+ content is reviewed</h2>
    <p class="subtitle">STEM+ lessons, tests, and practice questions are written with AI assistance. Automated checks run on every update: answer keys, question formats, links, and every sandbox and project test. Those checks catch broken content, but they can't prove every explanation is right, so each course shows its review status at the bottom of its pages:</p>
    <ul class="subtitle">
      <li><strong>AI generated</strong> — written with AI, passes the automated checks, human review in progress. Every course starts here.</li>
      <li><strong>Human reviewed</strong> — a person has read the course and corrected what they found, with the date shown.</li>
      <li><strong>Verified</strong> — reviewed and checked against the course's official curriculum.</li>
      <li><strong>Needs review</strong> — a reported problem is being fixed. <strong>Draft</strong> — still being written.</li>
    </ul>
    <p class="subtitle">Human reviewed and Verified courses also show who reviewed them, what they were verified against (the official curriculum or framework a course is checked line-by-line against — for example, the College Board Course and Exam Description for an AP course), and what sources were used, right alongside the status.</p>
    <p class="subtitle">Found something wrong — an answer, an explanation, a typo, a broken link, a diagram, or code? Use <strong>Report a problem</strong> at the bottom of any page. Reports go straight to the people maintaining STEM+, with the page and question attached, and you don't need an account to send one.</p>
  </section>
```

Replace it with:

```html
  <section class="about-section" id="content-review">
    <h2>How STEM+ content is reviewed</h2>
    <p class="subtitle">STEM+ lessons, tests, and practice questions are written with AI assistance. Automated checks run on every update: answer keys, question formats, links, and every sandbox and project test. Those checks catch broken content, but they can't prove every explanation is right, so each course shows its review status at the bottom of its pages:</p>
    <ul class="subtitle">
      <li><strong>AI Generated</strong> — written with AI, passes the automated checks. Every course starts here.</li>
      <li><strong>Review in Progress</strong> — a person is actively reading through the course now.</li>
      <li><strong>Human Reviewed</strong> — a person has read the course and corrected what they found, with the date shown.</li>
      <li><strong>Human Verified</strong> — reviewed and checked line-by-line against the course's official curriculum.</li>
    </ul>
    <p class="subtitle">Human Reviewed and Human Verified courses also show who reviewed them, what they were verified against (the official curriculum or framework a course is checked against — for example, the College Board Course and Exam Description for an AP course), and what sources were used, right alongside the status.</p>
    <p class="subtitle">Found something wrong — an answer, an explanation, a typo, a broken link, a diagram, or code? Use <strong>Report a problem</strong> at the bottom of any page. Reports go straight to the people maintaining STEM+, with the page and question attached, and you don't need an account to send one.</p>
  </section>
```

- [ ] **Step 4: Build and verify in a real browser**

```bash
npm run build && (npm run start &)
```

Wait for the server to be ready, then:

```bash
node scripts/verify-page.mjs http://localhost:3000/Precalculus/index.html \
  "new Promise(r => setTimeout(r, 500)).then(() => ({ok: document.querySelector('[data-content-status]').textContent.includes('Human Reviewed')}))"
```

Expected: `PASS` — this confirms the real footer on a real course page now shows the status Task 2's manual verification set for Precalculus, fetched live rather than from a hardcoded constant. (The 500ms pre-delay gives the footer's fetch a moment to resolve on top of `verify-page.mjs`'s own 1500ms post-navigation settle delay — belt and suspenders, since this is the one check in this plan whose correctness depends on a client-side fetch actually completing.)

Then clean up:

```bash
pkill -f "next start" 2>/dev/null
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all passing (this task has no new Node-level test — `check-content.js`/`check-content-links.js` already cover `about.html`'s structural validity).

- [ ] **Step 6: Commit**

```bash
git add components/Layout.tsx content/about.html
git commit -m "Switch content-review status from a hardcoded constant to live /api/content-review data"
```

---

### Task 4: Developer Panel page

**Files:**
- Create: `content/developer-panel.html`
- Create: `public/assets/developer-panel.js`
- Modify: `content/developer.html`

**Interfaces:**
- Consumes: `GET`/`POST /api/content-review` (Task 2), `GET /assets/skill-catalog.json` (existing — same file `public/assets/mastery.js` already fetches, shape `{ skills: [{ course: string, ... }, ...], ... }`), `window.STEMPlusAccount.ready` (existing, from `public/assets/account.js` — a `Promise` resolving to the `/api/me` response object, which includes `isDeveloper: boolean`, or `null` if signed out).
- Produces: no new exports — this is a leaf page, nothing in this plan depends on it.

- [ ] **Step 1: Create the page**

Create `content/developer-panel.html`:

```html
<meta charset="UTF-8">
<link rel="icon" href="favicon.ico?v=1" type="image/x-icon">
<title>Developer Panel — STEM+</title>
<link rel="stylesheet" href="assets/style.css">
<script src="assets/developer-panel.js" defer></script>
<div class="page">
  <span class="kicker">STEM+ · Developer</span>
  <h1>Developer Panel</h1>
  <p class="subtitle">Set each course's content-review status. Only developer accounts can make changes here.</p>
  <p class="nav-links"><a href="developer.html" class="nav-toc">← Developer</a> <a href="reports.html" class="nav-toc">Reports →</a></p>

  <div class="toc-list">
    <a class="toc-item" href="developer.html">
      <span class="toc-num">Developer mode</span>
      <p class="toc-title">Unlock gated content in this browser</p>
      <p class="toc-sub">Enter the developer code to bypass exam gates, route locks, and project gates for testing.</p>
    </a>
    <a class="toc-item" href="reports.html">
      <span class="toc-num">Reports</span>
      <p class="toc-title">Reported problems</p>
      <p class="toc-sub">Review and close issues sent through Report a problem.</p>
    </a>
  </div>

  <h2>Content Review Status</h2>
  <div data-content-review-panel><p class="toc-empty">Loading…</p></div>

  <footer class="lesson-footer">STEM+ · developer tools</footer>
</div>
```

- [ ] **Step 2: Write the client script**

Create `public/assets/developer-panel.js`:

```js
// Developer panel: set each course's content-review status
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

  function courseRow(course, current) {
    const row = document.createElement('div');
    row.className = 'widget';

    const label = document.createElement('p');
    label.className = 'widget-label';
    label.textContent = course;
    row.append(label);

    const statusText = (status, reviewedAt) =>
      reviewedAt ? `${status} · last reviewed ${new Date(reviewedAt).toLocaleDateString()}` : status;
    const statusLine = paragraph(statusText(current ? current.status : 'AI Generated', current && current.reviewed), 'toc-sub');
    row.append(statusLine);

    const controls = document.createElement('div');
    controls.className = 'fm-row';
    controls.style.gap = '0.6rem';

    const select = document.createElement('select');
    select.setAttribute('aria-label', `Status for ${course}`);
    STATUSES.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (current ? current.status === status : status === 'AI Generated') option.selected = true;
      select.append(option);
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'widget-btn';
    button.textContent = 'Save';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Saving…';
      const res = await fetch('/api/content-review', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course, status: select.value }),
      }).catch(() => null);
      if (res && res.ok) {
        statusLine.textContent = statusText(select.value, new Date().toISOString());
        button.textContent = 'Saved';
        setTimeout(() => {
          button.textContent = 'Save';
          button.disabled = false;
        }, 1500);
      } else {
        button.textContent = 'Try again';
        button.disabled = false;
      }
    });

    controls.append(select, button);
    row.append(controls);
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

- [ ] **Step 3: Cross-link from `developer.html`**

In `content/developer.html`, find:

```html
<p class="subtitle">For site maintainers testing gated content. The correct code unlocks every course exam gate, pathway exam gate, route lock, and project gate in this browser, and lets you reveal quiz answers — it doesn't grant edit access, and it doesn't affect anyone else's browser. Developer mode lives only in this browser, so it is a convenience toggle for testing, not real access control. Signed-in developer accounts can also review <a href="reports.html">reported problems</a>.</p>
<p class="nav-links"><a href="index.html" class="nav-toc">← STEM+ Home</a> <a href="reports.html" class="nav-toc">Reports →</a></p>
```

Replace with:

```html
<p class="subtitle">For site maintainers testing gated content. The correct code unlocks every course exam gate, pathway exam gate, route lock, and project gate in this browser, and lets you reveal quiz answers — it doesn't grant edit access, and it doesn't affect anyone else's browser. Developer mode lives only in this browser, so it is a convenience toggle for testing, not real access control. Signed-in developer accounts can also review <a href="reports.html">reported problems</a> and set each course's content-review status from the <a href="developer-panel.html">Developer Panel</a>.</p>
<p class="nav-links"><a href="index.html" class="nav-toc">← STEM+ Home</a> <a href="developer-panel.html" class="nav-toc">Developer Panel →</a> <a href="reports.html" class="nav-toc">Reports →</a></p>
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all passing, including `check-content-links: OK` picking up the new page and its links without broken-reference errors (it validates every local `href` in `content/**/*.html` resolves to a real file).

- [ ] **Step 5: Build and verify in a real browser**

```bash
npm run build && (npm run start &)
```

Wait for the server to be ready. Reuse the `<COOKIE>` value from Task 2 Step 5 if you still have it; otherwise repeat Task 2 Steps 3 and 5 to get a fresh one (the password was already reset, so only the login step needs repeating).

```bash
node scripts/verify-page.mjs http://localhost:3000/developer-panel.html \
  "new Promise(r => setTimeout(r, 1000)).then(() => ({ok: document.querySelectorAll('[data-content-review-panel] .widget').length > 30}))" \
  "session=<COOKIE>"
```

Expected: `PASS` — confirms the panel actually rendered a full course list (the skill catalog has 40 distinct courses as of this plan being written; `> 30` tolerates it growing or shrinking slightly without this check becoming brittle) for a signed-in developer account.

```bash
node scripts/verify-page.mjs http://localhost:3000/developer-panel.html \
  "new Promise(r => setTimeout(r, 1000)).then(() => document.querySelector('[data-content-review-panel]').textContent).then(text => ({ok: text.includes('only visible to developer accounts')}))"
```

Expected: `PASS` (no cookie this time — confirms a signed-out visitor sees the access-denied message, not the editable list).

Then clean up:

```bash
pkill -f "next start" 2>/dev/null
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add content/developer-panel.html public/assets/developer-panel.js content/developer.html
git commit -m "Add the Developer Panel page for live content-review status editing"
```

---
