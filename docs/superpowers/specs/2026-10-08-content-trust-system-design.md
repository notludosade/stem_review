# Content Trust & Verification Transparency — Design

**Goal:** Move STEM+ from "we have a review process" to visible, dated, source-backed evidence of review — without redesigning the product. Extend the existing `content_reviews` system rather than replace it.

**Non-goal / hard constraint:** This system must never claim human review or verification that didn't happen. Claude is not a human reviewer and will not assign `Human Reviewed`/`Human Verified` to any course. See "AP Calculus BC pilot" below for exactly what the pilot does and doesn't claim.

## 1. What already exists (audit summary)

- `content_reviews` table (course text PK, status, reviewed_at, reviewed_by, verified_against, sources, updated_at) — already live, already has `VALID_STATUSES` = `AI Generated / Review in Progress / Human Reviewed / Human Verified` enforced in `lib/content-review.js`, mirrored in `public/assets/developer-panel.js` and `content/about.html#content-review`, all drift-checked by `scripts/check-content-review.js`. Currently every course defaults to `AI Generated` — no course has a real DB row yet.
- `reports` table + `/api/report` (public submit) + `/api/reports` (developer list/resolve) + `content/reports.html` — works today, but only captures `course` + free-text `question_id`, has no unit/lesson columns and no status enum beyond `resolved_at` being null/set.
- Developer gating: `is_developer` DB column → signed session → checked server-side on every sensitive route (`content-review.js`, `reports.js`, `frq-sample.js`). This is the real access-control boundary; the separate `developer.html` code-toggle is explicitly a client-only convenience, never used for anything that touches the DB. New admin surfaces reuse the `is_developer` gate, nothing else.
- No `assessment_verifications` table, no stable per-question ID anywhere in the codebase. Unit tests/course exams are identified by `(course, unit, kind, version)` via `data-test` wrapper attributes; individual questions have no ID, only a free-text `data-topic`.
- `.lock-badge`, `.topic-badge`, `.widget`/`.widget-label` CSS already provide pill/card primitives — reuse, don't invent new ones.
- Course/unit/lesson are all derivable from the URL path alone (`content/<Course>/Unit N/000X-slug.html`) — confirmed the `Unit N` folder convention is used broadly across courses, not just AP Calculus BC. No new per-lesson markup is needed to auto-populate a report's course/unit/lesson fields.

## 2. Schema changes (`scripts/migrate.js`, additive only)

```sql
alter table content_reviews add column if not exists framework text;
alter table content_reviews add column if not exists framework_version text;
alter table content_reviews add column if not exists reviewer_role text;

create table if not exists assessment_verifications (
  assessment_id text primary key,      -- e.g. 'ap-calculus-bc:unit-3:unit_test:a'
  course text not null,
  unit text,
  kind text not null,                  -- 'unit_test' | 'course_exam'
  version text,                        -- 'A' | 'B' | null
  status text not null default 'not-verified',  -- 'not-verified' | 'in-progress' | 'verified'
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
);

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
);

alter table reports add column if not exists unit text;
alter table reports add column if not exists lesson text;
alter table reports add column if not exists status text not null default 'RECEIVED';
```

**Why this shape, not per-question IDs:** adding a stable ID to every quiz/FRQ question across the catalog is a large content-authoring project on its own and isn't needed for v1 — `assessment_verifications` tracks verification at the same granularity the codebase already has (one row per unit test / course exam), with `questions_total`/`questions_verified` as plain counts and a 7-field checklist mirroring item 6 of the request. This can be re-keyed to per-question later without a breaking change (new table, additive).

**`sources` format:** kept as the existing `text` column (no new JSON column) to match the existing `verified_against` convention, but with a line format `role|name` (one per line), e.g. `primary|College Board AP Calculus BC Course and Exam Description` / `reference|OpenStax Calculus`. `role` is `primary`, `reference`, or `supporting` (item 16's hierarchy). Parsed client-side with a one-line split, same pipe-delimiter convention already used by `data-answers`.

**Reports `status` enum:** `RECEIVED / UNDER_REVIEW / CONFIRMED / CORRECTED / CLOSED`, validated in `lib/reports.js` the same way `VALID_STATUSES` is validated today. `resolved_at` is kept and still set automatically when status moves to `CORRECTED` or `CLOSED`, so the existing open/resolved query in `/api/reports` keeps working unchanged. Public users never see `status` — only developers, in `reports.html`.

**Validation (item 20):** `pages/api/content-review.js`'s POST handler rejects `Human Verified` unless the row already has (or the request supplies) a non-empty `reviewed_by`, `reviewed_at`, at least one `sources` line, and an associated `assessment_verifications` row for every assessment of that course with `status = 'verified'`. Same idea, one tier down, for `Human Reviewed` (reviewer + date required, assessments not required). Returns 400 with a specific message on failure — this is the one place "do not falsely mark content as verified" gets enforced mechanically, not just by convention.

## 3. New/changed surfaces

**APIs** (`pages/api/`): extend `content-review.js` (GET already exists; POST gains the new fields + validation above). New `assessment-verification.js` (GET by course; POST developer-only, upserts one assessment row). New `corrections.js` (GET public, optional `?course=`; POST developer-only, optionally created from a report via `reports.js`'s existing resolve action gaining a "log correction" branch).

**Public pages:**
- Compact trust panel: new `public/assets/trust-panel.js`, mounted into a new `<div data-trust-panel data-course="...">` slot placed right after the existing `data-course-context` block on each course hub `index.html` (same insertion point pattern already used for `.concept-skills`). Renders status, last-reviewed date, framework, assessment verification summary, sources, and `[View review details]` / `[Report an issue]` links. Nothing renders if the course has no `content_reviews` row beyond the default "AI Generated" line already shown in the footer today — this panel is additive, the existing footer line is untouched.
- `content/review-details.html` — one generic page, `?course=` query param, client-rendered from the same APIs (content-review + assessment-verification + corrections filtered by course). Avoids generating 40 static per-course pages.
- `content/corrections.html` — public correction log, all courses by default, `?course=` filter, renders the `corrections` table newest-first.
- `content/about.html#content-review` — rewritten per item 17's 6-step structure, kept inside the existing drift-checked section (will need `scripts/check-content-review.js` touched if the list structure changes — plan task covers this explicitly).

**Report a Problem (`components/Layout.tsx`'s `ReportProblem`):** add auto-derived `unit`/`lesson` (parsed from `location.pathname`, falling back to blank for pages where the `Unit N` convention doesn't apply — courses are a long tail, not every one will match, and that's fine, it's best-effort enrichment not a hard requirement) and send them alongside the existing fields. No new UI fields shown to the user beyond what's already there (page/course/question are already auto-attached; unit/lesson join that same auto-attached group, not surfaced as new user-facing inputs).

**Developer panel (`content/developer-panel.html` + `.js`):** extend the existing per-course status editor with framework/framework_version/reviewer_role/sources fields, and add a new assessment-verification editor (list this course's `assessment_verifications` rows — seeded at migration time from the actual `data-test` HTML, see pilot section — with checklist toggles and verified-count inputs).

**Reports admin (`content/reports.html` + `.js`):** show the new `status` value and unit/lesson columns; "Log correction" button on a report creates a `corrections` row referencing it and advances the report to `CORRECTED`.

## 4. AP Calculus BC pilot — what it proves and what it does not claim

AP Calculus BC has 10 units × 2 test versions + 1 course exam = 21 assessments. The pilot:

1. Runs the full schema + UI against this course so every surface in this spec has real data to render (not empty states).
2. Seeds all 21 `assessment_verifications` rows with real, mechanically-counted `questions_total` (objective fact, countable from the HTML) and `status = 'not-verified'`, checklist booleans `false`. This is honest: it says "not yet verified," which is true.
3. Sets `content_reviews.framework` / `framework_version` to `College Board AP Calculus BC Course and Exam Description` / `2026` — stating what the course targets, not a verification claim.
4. Does **not** change `status` away from its current default. Claude does not set `Human Reviewed` or `Human Verified` on any course, ever — only a real human reviewer does that, through the developer panel, after actually reviewing.
5. As a genuinely useful (but clearly labeled) extra: runs an AI-assisted spot-check — fetches the real College Board AP Calculus BC CED and a reputable OpenStax source, cross-references a sample of AP Calculus BC's answer keys/explanations, and files any real discrepancy found as a `corrections` entry tagged `corrected_by: 'AI-assisted review (Claude)'`, never `corrected_by` formatted to look like a named human reviewer. If nothing is found wrong in the sample, nothing is filed — no manufactured corrections to make the log look populated.

This matches the project's own prior decision (recorded 2026-10-06): real curriculum-accuracy verification is a human task the user previously deferred on purpose. This spec builds the system that makes that human's eventual work visible and trustworthy; it doesn't pretend the work already happened.

## 5. Testing

New `scripts/check-content-trust.js` (added to the `npm test` chain): validates the new `VALID_STATUSES`-style enums (`assessment_verifications.status`, `reports.status`), checks the Human Verified/Human Reviewed gating logic as pure functions, checks every `sources` line parses as `role|name` with `role` in the allowed set, and checks `content/about.html`'s rewritten section still round-trips against the status list (extending, not replacing, `check-content-review.js`'s existing drift checks). Manual/live checks (raw-CDP, matching project convention): trust panel renders for a course with and without a `content_reviews` row, review-details page renders all three states (verified/in-progress/none), correction log empty-state and populated-state, developer panel can write all new fields and the validation rejects an invalid Human Verified attempt, mobile layout, Report a Problem still submits with the new auto-derived fields.

## 6. Explicitly out of scope (per the request)

No redesign of auth, cloud sync, Neon connection setup, search, navigation, mastery, diagnostics, or accounts beyond the `is_developer` gate already used everywhere else. No per-question ID scheme (future work, not blocking this). No mass status migration of existing courses — every course not explicitly touched keeps its honest current label.
