# AI-Generated Custom Plan — Design

## Context

The Goals page (`content/new.html`) has 8 static cards, each routing to a curated, pre-written Pathway or Goals page. That covers the common cases well, but nothing lets a student describe something more specific — "I want to build robots that use computer vision" doesn't map cleanly onto any single existing card.

This adds a 9th path: a free-text prompt, graded by Claude against STEM+'s real catalog (courses, capstone projects, problem sets, applications), producing a custom sequence assembled just for that student — not tied to any of the 8 existing Pathways. Builds on two things already shipped this session: the AI-graded FRQ pattern (`lib/anthropic.js`, `pages/api/grade-frq.js` — system prompt + Claude call + validate) and the track-customization feature (skip/pace, `mountTrackPlan`, the `[data-course-status]` markup contract that makes a course's real progress show up on any page that lists it).

## Goals

- A new section on `new.html`, alongside the 8 existing goal cards (not replacing them): a textarea + "Generate My Plan" button.
- The generated plan can freely mix courses across pathways/subjects — a bespoke sequence, not a pointer to one of the 8 existing Pathways.
- The plan includes courses (with a one-line reason each), one recommended capstone Project if a good match exists, and relevant Problem Sets topics and Applications pages — the AI is meant to use as much of the real catalog as genuinely fits the prompt, not just courses.
- Every course/project/problem-set/application the AI references must be real — the server validates against an actual catalog and silently drops anything hallucinated. Never a broken link, never a hard failure over one bad reference.
- One reusable page, `content/my-plan.html`, renders the current plan from `localStorage` — matches this codebase's no-backend-for-content, client-rendered-from-data pattern (`mountDashboard`, `mountLearningRecord`, `mountTrackPlan`). Regenerating overwrites it (single slot, not a saved history).
- Because a generated course is a real course, `data-course-status` badges on `my-plan.html` show real, already-tracked global progress automatically — no new progress-tracking logic needed, only display/linking.
- Generation requires login (matches the FRQ-grading precedent: a paid API call needs a real cost-control boundary, and an anonymous, free-to-hit endpoint is an abuse surface).
- Generation is rate-limited to once per 24 hours per account, enforced server-side (DB-backed, not client-side — client-side is not a trust boundary once login is already required). The developer account bypasses this, matching the existing `isDeveloper` bypass pattern used elsewhere (answer reveals, dev-mode auto-unlock).

## Non-goals

- Not replacing or modifying any of the 8 existing goal cards or their pages.
- Not adding elective-swapping, reordering, or any interaction with the skip/pace feature — a generated plan is display-only beyond linking to real course/project pages; a student who wants to skip/pace-plan a course from it does so on that course's own real page, same as any other course.
- Not a saved-plans history. One overwritable slot. If a student wants to keep an old plan, that's a future ask, not this one.
- Not reconciling `lib/plan-catalog.js` (new, server-side) with `tests.js`'s existing client-side `COURSE_PATHS`/`PATHWAYS` constants into one shared source. They will duplicate some data. `tests.js` is a plain browser IIFE with no module system; a Node API route can't import from it. Unifying them is a separate, unrelated refactor.
- Not real-time/streaming generation UI. The button shows a loading state and waits for the full response — no partial-results streaming.

## Data model

- **`stemplus:custom-plan:v1`** (client, `localStorage`) — the validated plan JSON as returned by the server: `{ prompt, generatedAt, summary, courses: [{name, reason}], project: {id, reason} | null, problemSets: [{topic, reason}], applications: [{id, reason}] }`. Single slot, overwritten on each successful generation.
- **`users.last_plan_generated_at`** (server, Postgres) — new nullable `timestamptz` column, migrated the same way `is_developer` was (`scripts/migrate.js`, `alter table ... add column if not exists`). Updated only on a successful generation; a failed/errored attempt doesn't consume the day's attempt.

## New server-side catalog: `lib/plan-catalog.js`

A plain data module (mirrors `lib/frq-questions.js`'s role) exporting the real, current lists the model is allowed to reference and the server validates against:
- All course names (the same 36 covered by `tests.js`'s `COURSE_PATHS`, kept here as an independent, hand-maintained list — see Non-goals) with a one-line description each, for the system prompt.
- The 8 Project capstone ids + titles + descriptions (`content/Projects/*.html`).
- Problem Sets topics (whatever topic taxonomy `problem-sets.html`/`problem-banks.js` already uses).
- The 9 Applications page ids + titles (`content/Applications/*.html`).

`generate-plan.js` builds the system prompt from this module, and validates the model's structured output against it: any course name, project id, or application id not present in the catalog is dropped from the response before it's returned to the client (never surfaced, never causes a request-level failure).

## API: `pages/api/generate-plan.js`

Follows `grade-frq.js`'s shape:

1. `POST` only; parse `{ prompt }` from the body. Reject empty/too-short prompts (mirrors `grade-frq.js`'s `MAX_RESPONSE_LENGTH`-style validation, minimum instead of maximum) before touching the DB or the API.
2. Verify the session cookie (`lib/session.js`'s `verify`). No session → 401, no DB call, no API call.
3. Look up the user fresh from the DB (`select is_developer, last_plan_generated_at from users where id = ...` — fresh, not from the token's embedded claim, same reasoning `frq-sample.js` already established: a signed token could be stale, this gate is worth a real query). If `is_developer` is false and `last_plan_generated_at` is within 24 hours, return 429 with `{ error, retryAfterMs }` so the client can show "try again in Xh Ym" — no API call made.
4. Call Claude via `lib/anthropic.js`, extended with a structured tool-use call (new capability — today's `gradeWithClaude` only supports the `web_search` tool and fenced-JSON text extraction; this call forces a schema-shaped tool result instead, since the plan's output is bigger/more nested than a grade and the fenced-JSON approach already truncated once in production for a simpler payload). No `web_search` tool here — the model only needs to reason over the catalog already in its system prompt, not verify real-world facts.
5. Validate the tool-call result against `lib/plan-catalog.js`; drop unrecognized references.
6. On success: update `last_plan_generated_at = now()`, return the validated plan.
7. On any failure (network, malformed tool result, etc.): same tone as `grade-frq.js` — `502`, `"plan generation is temporarily unavailable, try again shortly"`, logged server-side with enough detail to debug, `last_plan_generated_at` untouched.

## `lib/anthropic.js`: new structured-output capability

Add a second exported function (e.g. `generatePlanWithClaude`) alongside the existing `gradeWithClaude`, using Anthropic's tool-use to force a schema-shaped response instead of parsing a fenced JSON block from free text — the concrete fix for the truncation failure mode `grade-frq.js` already hit once, applied here where the payload is larger. `gradeWithClaude` (and its `web_search`/fenced-JSON approach) is untouched; this is an addition, not a rewrite of the existing FRQ-grading call.

## UI: `new.html`

New section below the 8 goal cards:

```html
<h2>Describe Your Own Goal</h2>
<p class="subtitle">Not seeing what you want above? Describe it, and we'll build a plan from the real courses, projects, and problem sets in STEM+.</p>
<div data-generate-plan>
  <textarea data-generate-plan-input placeholder="e.g. I want to build robots that use computer vision"></textarea>
  <button type="button" class="widget-btn" data-generate-plan-submit>Generate My Plan</button>
  <p data-generate-plan-status></p>
</div>
```

`mountGeneratePlan(el)` (new, in `tests.js`): checks `/api/me` (existing endpoint, same call `auth.js`/the developer-mode work already use). Signed out → replace the button with a "Sign in to generate a custom plan" link to `login.html`, no textarea shown. Signed in → wire the button: on click, disable it, show a loading state in the status line, `POST /api/generate-plan`. On success: save the response to `stemplus:custom-plan:v1`, navigate to `my-plan.html`. On 429: show the "try again in Xh Ym" message from the response. On other failure: show the generic retry message.

## New page: `content/my-plan.html`

Standard page skeleton (matches `dashboard.html`/`learning-record.html`), `<script src="assets/tests.js" defer></script>`, `<div data-generated-plan><p class="toc-empty">Loading…</p></div>`. Not added to `proxy.ts`'s `FREE_PATHS` — gated by the existing default-deny, same as every other page not explicitly listed there.

`mountGeneratedPlan(el)` (new, in `tests.js`): reads `stemplus:custom-plan:v1`. Empty → `toc-empty` state linking back to `new.html`'s new section. Present → renders the summary text, a course ladder (one `.toc-item` per course linking to its real `index.html` via `coursePath()` — already exists, built for the Dashboard — with a real `data-course-status` badge, so already-tracked progress shows up with zero new tracking code), the project card if one was picked (using the same `data-project-status` markup `Projects/*.html` pages already use, since it's a real project id), and problem-set/application links.

## Testing

Matches this session's established discipline (`scripts/verify-page.mjs` against a production build, the real session cookie for gated pages):
- Signed-out on `new.html` sees the sign-in link, not a working generate button; no network call fires.
- Catalog validation is unit-testable without any real API call: feed `scripts/check-content.js` a fake tool-result object containing one real course name and one invented one, confirm only the real one survives — this is the one piece of new logic worth a real regression check, since it's pure data validation with no external dependency.
- The rate-limit check itself (real DB round trip, `last_plan_generated_at` within/outside 24h) gets a couple of direct real checks the same way the developer-mode DB check was verified (a throwaway or the existing test account, flipped in the DB, confirmed via the real endpoint).
- The actual generation call end-to-end gets a small number of real, live verification calls against the real Anthropic API (mirrors how FRQ grading was verified) — mocking Claude's output would only test the mock, not the real integration.
