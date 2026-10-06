# Revision Phase 1 — Release 4: Report a Problem + Content Status — Design

## Context

From the "STEM+ Product Review & Revision Specification" §17 (Trust and Content Accuracy) and §18 (Content Correction System). Releases 1–3 are live. User decisions (2026-10-05): reports go to a **database table with a developer review page**; **anyone can report, with limits**; every course starts as **AI generated · review in progress**.

## 1. Report a Problem (every page)

- `components/Layout.tsx` gets a site footer under `<main>` on every page with a **Report a problem** button that opens a native `<dialog>` form:
  - **Category** (required): Incorrect answer, Broken explanation, Typo, Broken link, Misleading diagram, Code error, Other.
  - **What's wrong** (required): 5–2000 characters.
  - **Which question** (optional): prefilled when the page knows it.
  - Captured automatically: page path + query, page title, course (see §3), time (server).
- Legacy page scripts open the form with a question prefilled by dispatching `window.dispatchEvent(new CustomEvent('stemplus:report', { detail: { questionId } }))`.
  - `problem-sets.js`: a **Report this question** link under each explanation dispatches it with the current question's ID.
  - `timed-mastery.js`: keeps `window.STEMPlusReportQuestion` set to the question on screen; the footer form uses it as the default when no ID was passed.
- After a successful send the dialog says "Thanks — report sent." Errors (rate limit, validation, network) show inline; the form keeps its contents.

## 2. Storage, API, review page

- `scripts/migrate.js` adds:

```sql
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
```

  Run once with `node --env-file=.env.local scripts/migrate.js` (`.env.local` points at the production Neon branch).
- `lib/reports.js`: `CATEGORIES`, `validateReport(body)` → `{ ok: true, report }` or `{ ok: false, error }` (trims; page ≤ 300, page title ≤ 200, course ≤ 100, question ID ≤ 100, description 5–2000), `hashIp(ip, secret)` (SHA-256 HMAC).
- `pages/api/report.js` (`POST` only): validate; `ip_hash` from the first `x-forwarded-for` entry (falls back to the socket address); reject with 429 when that hash already has 10 reports in the last hour; `user_id` from a valid session cookie, else null; insert; 201 `{ ok: true }`.
- `pages/api/reports.js` (developer only — session `isDeveloper`, else 403):
  - `GET` → `{ open: [...], resolved: [...] }`: all open reports newest first, and the 50 most recently resolved.
  - `POST { id, resolved: boolean }` → sets or clears `resolved_at`.
- `content/reports.html` + `public/assets/reports.js`: developer review page listing each report (time, category, course, linked page, question ID, description, signed-in or guest) with a Resolve / Reopen button. Every user-supplied field is rendered with `textContent`. Non-developers see "Reports are only visible to developer accounts." Linked from `content/developer.html`.

## 3. Content status (course pages)

- The course for a page is the Learn-menu course whose folder (its `index.html` href minus `index.html`) prefixes the page path; no separate course list.
- `CONTENT_REVIEWS` in `Layout.tsx` holds promotions only, e.g. `'AP Calculus BC': { status: 'Human reviewed', reviewed: 'November 2026' }`; it starts empty. Courses not listed show **AI generated · review in progress**.
- On course pages the footer shows: `<Course> · Content status: <status>` (+ ` · Last reviewed <date>` when set) · **How we review →** (`/about.html#content-review`) · **Report a problem**. Other pages show only **Report a problem**.
- Statuses: Draft, AI generated, Human reviewed, Verified, Needs review.
- Not included: "Sources" and "Curriculum" — no real sources to cite yet.
- `content/about.html`: the "not 100% accurate" footer disclaimer is replaced by a **How STEM+ content is reviewed** section (`id="content-review"`): content is AI-generated, automated answer-key and content checks run on every update, what each status means, and how to report a problem. Patch-note entry.

## Testing

- `scripts/check-reports.js` (in `npm test`): `validateReport` accepts a good report and rejects bad category, short/long description, missing page, over-long fields; `hashIp` is stable and doesn't contain the IP.
- Production build: guest report → 201 and a row with `user_id` null; signed-in report → row with user ID; 11th report within an hour → 429; `GET /api/reports` → 403 for guest, lists reports for the developer; Resolve moves a report to resolved; footer status shows on a lesson and a course index, not on the homepage; Problem Set "Report this question" prefills the ID.
- Test reports are deleted from the database afterwards. Push; repeat the guest report, review page, and footer checks on production; delete those rows too.
