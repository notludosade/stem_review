# Revision Phase 1 (Release 4) Report a Problem + Content Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anyone can report a content problem from any page; a developer reviews and resolves reports; course pages show an honest content status.

**Architecture:** A `reports` table in the existing Neon DB, a public `POST /api/report` (validated, 10/hour per hashed IP) and a developer-only `/api/reports`. The shell (`Layout.tsx`) renders a footer with a `<dialog>` report form and the course's content status, derived from the Learn menu's course links. Legacy scripts prefill the question via a `stemplus:report` event or `window.STEMPlusReportQuestion`.

**Tech Stack:** Next.js 16 Pages Router API routes, `@neondatabase/serverless`, React 19, Tailwind 4, plain browser JS.

**Spec:** `docs/superpowers/specs/2026-10-05-revision-phase1-report-and-status-design.md`

## Global Constraints

- Categories (exact, in order): Incorrect answer, Broken explanation, Typo, Broken link, Misleading diagram, Code error, Other.
- Description 5–2000 characters; page ≤ 300 and must start with a single `/`; page title ≤ 200; course ≤ 100; question ID ≤ 100.
- 10 reports per hashed IP per hour; raw IPs never stored.
- Default status text: `AI generated · review in progress`.
- User-supplied report text is only ever rendered with `textContent` / React text.
- Commit each task; push at the end; verify on a production build, then production; delete test reports.

---

### Task 1: Report storage and API

**Files:** Create `lib/report-categories.js`, `lib/reports.js`, `pages/api/report.js`, `pages/api/reports.js`, `scripts/check-reports.js`; Modify `scripts/migrate.js`, `package.json`.

- [ ] **Failing check `scripts/check-reports.js`:**

```js
'use strict';

// Report validation is the only gate between anonymous visitors and the
// reports table, so pin its rules here.
const assert = require('node:assert');
const { CATEGORIES, validateReport, hashIp } = require('../lib/reports');

const good = { page: '/problem-set.html?course=precalculus', pageTitle: 'Precalculus Problem Set — STEM+', course: null, questionId: 'precalc-function-1', category: 'Incorrect answer', description: 'Answer key says 3 but it should be 4.' };
const ok = validateReport(good);
assert.ok(ok.ok, ok.error);
assert.strictEqual(ok.report.course, null);
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
```

Run `node scripts/check-reports.js`: FAIL `Cannot find module '../lib/reports'`.

- [ ] **`lib/report-categories.js`** (shared with the client form, so no `crypto` import):

```js
// Report a Problem categories, shared by the shell's form and the API.
module.exports = ['Incorrect answer', 'Broken explanation', 'Typo', 'Broken link', 'Misleading diagram', 'Code error', 'Other'];
```

- [ ] **`lib/reports.js`:**

```js
const crypto = require('crypto');
const CATEGORIES = require('./report-categories');

const LIMITS = { page: 300, pageTitle: 200, course: 100, questionId: 100 };
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

- [ ] `node scripts/check-reports.js` passes; add `node scripts/check-reports.js` to the `npm test` chain after `check-active-track`.
- [ ] **`scripts/migrate.js`** — before the final `console.log`:

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
```

  and change the log to `'migrate: users and reports tables ready'`. Run `node --env-file=.env.local scripts/migrate.js` (production Neon branch; additive only).

- [ ] **`pages/api/report.js`:**

```js
const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { validateReport, hashIp } = require('../../lib/reports');

const MAX_PER_HOUR = 10;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ error: 'POST only' });
  }
  const result = validateReport(req.body);
  if (!result.ok) {
    res.statusCode = 400;
    return res.json({ error: result.error });
  }
  try {
    const { report } = result;
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ipHash = hashIp(forwarded || req.socket.remoteAddress || 'unknown', process.env.SESSION_SECRET);
    const session = verify(req.cookies?.session, process.env.SESSION_SECRET);
    const sql = getDb();
    // ponytail: count-then-insert isn't atomic, so a burst can slip a report
    // or two past the limit; fine for spam control.
    const [{ count }] = await sql`select count(*)::int as count from reports where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'`;
    if (count >= MAX_PER_HOUR) {
      res.statusCode = 429;
      return res.json({ error: 'Too many reports from this connection. Try again in an hour.' });
    }
    // The subselect leaves user_id null if the session's account was deleted.
    await sql`
      insert into reports (page, page_title, course, question_id, category, description, user_id, ip_hash)
      values (${report.page}, ${report.pageTitle}, ${report.course}, ${report.questionId}, ${report.category},
        ${report.description}, (select id from users where id = ${session ? session.userId : null}), ${ipHash})
    `;
    res.statusCode = 201;
    return res.json({ ok: true });
  } catch (err) {
    console.error('report endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not send the report. Try again later.' });
  }
};
```

- [ ] **`pages/api/reports.js`:**

```js
const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');

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
      const resolved = req.body?.resolved;
      if (!Number.isInteger(id) || typeof resolved !== 'boolean') {
        res.statusCode = 400;
        return res.json({ error: 'id and resolved are required' });
      }
      await sql`update reports set resolved_at = ${resolved ? new Date() : null} where id = ${id}`;
      res.statusCode = 200;
      return res.json({ ok: true });
    }
    if (req.method !== 'GET') {
      res.statusCode = 405;
      return res.json({ error: 'GET or POST only' });
    }
    const open = await sql`
      select r.id, r.created_at as "createdAt", r.page, r.page_title as "pageTitle", r.course, r.question_id as "questionId",
        r.category, r.description, r.resolved_at as "resolvedAt", u.email as reporter
      from reports r left join users u on u.id = r.user_id
      where r.resolved_at is null order by r.created_at desc`;
    const resolved = await sql`
      select r.id, r.created_at as "createdAt", r.page, r.page_title as "pageTitle", r.course, r.question_id as "questionId",
        r.category, r.description, r.resolved_at as "resolvedAt", u.email as reporter
      from reports r left join users u on u.id = r.user_id
      where r.resolved_at is not null order by r.resolved_at desc limit 50`;
    res.statusCode = 200;
    return res.json({ open, resolved });
  } catch (err) {
    console.error('reports endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load reports.' });
  }
};
```

- [ ] `npm test`; commit "Add the reports table and Report a Problem API".

### Task 2: Report form, content status, review page

**Files:** Modify `components/Layout.tsx`, `content/problem-set.html`, `public/assets/problem-sets.js`, `public/assets/timed-mastery.js`, `content/developer.html`, `content/about.html`; Create `content/reports.html`, `public/assets/reports.js`.

- [ ] **`Layout.tsx`** — imports `useCallback`, `useRef` from react, `useRouter` from `next/router`, and `REPORT_CATEGORIES` from `../lib/report-categories`. After `LEARN_CATEGORIES`:

```tsx
// Course pages show their review status in the footer. Every course starts
// as AI generated; promote one by adding it here, e.g.
// 'AP Calculus BC': { status: 'Human reviewed', reviewed: 'November 2026' }.
// Statuses: Draft, AI generated, Human reviewed, Verified, Needs review.
const CONTENT_REVIEWS: Readonly<Record<string, { status: string; reviewed?: string }>> = {};

// A page belongs to the Learn-menu course whose folder prefixes its path.
const COURSE_FOLDERS = LEARN_CATEGORIES.flatMap((category) => category.items).map(
  ([label, href]) => [label, decodeURIComponent(href.replace(/index\.html$/, ''))] as const
);

function courseFor(asPath: string): string | null {
  const pathname = decodeURIComponent(asPath.split(/[?#]/)[0]);
  return COURSE_FOLDERS.find(([, folder]) => pathname.startsWith(folder))?.[0] ?? null;
}
```

  `ReportProblem` component (button + `<dialog>`): `open(questionId?)` sets the question field to the passed ID, else `window.STEMPlusReportQuestion`, else empty, clears status, calls `showModal()`; a `stemplus:report` window listener calls `open(event.detail?.questionId)`; submit POSTs `{ page: location.pathname + location.search, pageTitle: document.title, course, questionId, category, description }` to `/api/report`, shows `Thanks — report sent.` and resets the form on 201, else the server's `error` (or `Could not send the report. Try again later.`) and keeps the input. Fields: `<select name="category" required>` (placeholder `Choose one` + `REPORT_CATEGORIES`), `<textarea name="description" required minLength={5} maxLength={2000}>`, `<input name="questionId" maxLength={100}>` labelled `Which question (optional)`; Close + `Send report` buttons.

  `SiteFooter`: `course = courseFor(useRouter().asPath)`; on course pages, `{course} · Content status: {status}` (+ ` · Last reviewed {date}`) and a `How we review →` link to `/about.html#content-review`; always `<ReportProblem course={course} />`. Rendered after `<main>` in `Layout`.

- [ ] **`problem-set.html`**: after `data-problem-explanation`, `<button type="button" class="problem-report" data-problem-report hidden>Report this question</button>`. **`problem-sets.js`**: `renderQuestion` sets `window.STEMPlusReportQuestion = current.id` and hides the button; `finishAnswer` shows it; the button dispatches `new CustomEvent('stemplus:report', { detail: { questionId: current.id } })`. **`style.css`**: `.problem-report` as a small muted text button.
- [ ] **`timed-mastery.js`**: `renderQuestion` sets `window.STEMPlusReportQuestion = current.id`; `renderStart` and `renderResults` set it to `undefined`.
- [ ] **`content/reports.html`** + **`public/assets/reports.js`**: page per spec §2; the script fetches `/api/reports`, renders Open and Recently resolved lists with `textContent` only (page link `href` set as a property; validated server-side to start with a single `/`), Resolve/Reopen POSTs `{ id, resolved }` then reloads the list; 403 shows `Reports are only visible to developer accounts.` Runs immediately (`defer`, DOM ready) and is idempotent via `window.__stemplusReportsLoaded`.
- [ ] **`developer.html`**: link `Reports →` to `reports.html` in its nav-links.
- [ ] **`about.html`**: replace the disclaimer footer text with `STEM+ · <a href="developer.html">Developer</a>`; add `<section class="about-section" id="content-review">` "How STEM+ content is reviewed" before "Progress & accounts"; new top patch-note entry.
- [ ] `npm test`, `npm run build`; commit "Add Report a Problem and course content status".

### Task 3: Verify, push, verify live

- [ ] Production build with `.env.local`: guest POST → 201, row `user_id` null; member POST → row with user 27; 11th POST in an hour from the same IP → 429; invalid body → 400; `GET /api/reports` → 403 guest, 200 developer; Resolve moves a report; footer status on `/Precalculus/index.html` and a lesson, not on `/`; dialog opens from the footer and from Problem Set "Report this question" with the ID prefilled; dialog fits a 390px screen.
- [ ] Delete test rows (`delete from reports where description like 'TEST %'` — every test report's description starts with `TEST `).
- [ ] Push; on production: guest report via the dialog → 201, review page lists it for the developer, footer status on a course page; delete the test row.
