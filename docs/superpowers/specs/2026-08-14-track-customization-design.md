# Track Customization: Self-Declared Skip + Target-Date Pace — Design

## Context

Every Pathway (`content/Pathways/*.html`, 8 pages) and every Goals page (`content/Goals/*.html`, 5 pages) shows a fixed course ladder — same order, every course required, no way to say "I already know this" or set a target finish date. The user wants to be able to customize a track (self-service, from the track's own page) so it fits how they actually want to use it: skip courses they already know, and set a pace target.

This builds directly on `tests.js`'s existing markup-contract pattern (`data-xxx` attribute + guarded `mountXxx(el)` function, wired into `initTests()`), used by every prior feature in this codebase (Dashboard, Learning Record, pathway progress, project status). No new architecture — one more section following the same shape.

## Goals

- A "Customize Your Plan" section on every track page that actually has its own course ladder — the 8 Pathways plus the 3 Goals pages with a real ladder (`get-ahead`, `challenge-myself`, `stronger-at-math`; `prepare-for-college` and `review-and-test` are pure router pages that just link out to Pathways/Problem Sets and have no `[data-course-status]` of their own, so there's nothing on them to customize) — where a student can:
  - Check off courses they already know ("skip").
  - Set a target finish date and see whether their actual pace is on track to hit it.
- Skipping a course must count as done everywhere the site already checks course completion (capstone unlock, progress badges, mastery lists) — not just visually hide it in one place.
- No new data source invented. Skip state, pace state, and the course list itself all come from data the page and `tests.js` already have.

## Non-goals

- No placement quiz / gating on skip — self-declared, honor system, consistent with the rest of this site's no-backend, no-account-linked-state model.
- No reordering or elective-swapping of courses — scope is skip + pace only (confirmed with user).
- No Dashboard integration in this pass — pace status shows on the track page only. Natural follow-up, not built now.
- No per-unit pace math. A prior session segment hit and documented that this codebase has no reliable way to know a course's *true* total unit count (only units with a recorded attempt exist in the data) — inventing a units/week number would repeat that exact mistake. Pace is computed in **courses**, the same granularity every existing gate already uses.

## Data model

Two new `localStorage` keys, kept separate because they answer different questions:

- **`stemplus:skipped-courses:v1`** — flat JSON array of course-name strings. Global, not per-track: "I already know Computer Programming 1" is a fact about the student, and should be honored on every track page that lists that course (e.g. it appears in Software Engineer, General Programmer, and Cloud & DevOps pathways).
- **`stemplus:track-pace:v1`** — `{ [trackPageUrl]: "YYYY-MM-DD" }`. Per-track, because a target date is a goal about *this specific plan* ("finish Software Engineer by June"), not a global fact. Keyed by `location.pathname` (e.g. `/Pathways/software-engineer.html`) — already unique per track, no new ID scheme needed.

## The gating fix (single choke point)

Every existing lock/status/progress function in `tests.js` (`mountProjectGate`, `mountCourseStatus`, `mountProjectStatus`, `mountPathwayProgress`, and course-mastery math) already routes through one function:

```js
function isCourseExamPassed(course) {
  if (isDevMode()) return true;
  return summarizeCourseExam(getResultsForCourse(course)).passed;
}
```

Fix once, here:

```js
function isCourseExamPassed(course) {
  if (isDevMode()) return true;
  if (isSkippedCourse(course)) return true;
  return summarizeCourseExam(getResultsForCourse(course)).passed;
}
```

This alone makes skip honored by the capstone unlock check, the course status badge, the pathway progress badge, and the "What You're Ready For" pathway math in Learning Record — zero changes needed to any of those functions individually, since they already call `isCourseExamPassed(course)`.

`mountDashboard` and `mountLearningRecord` needed real changes on top of the choke-point fix, discovered in a later review round: both build their `courseNames` list purely from `loadResults()` (real attempts), so a course skipped with zero real attempts never entered the list at all — invisible to both screens. And in four places, both functions read `report.courseExam.passed` (from `buildReport`, the real-exam-only summary) directly instead of calling `isCourseExamPassed(course)`, bypassing the choke point entirely. The actual fix: union `loadSkippedCourses()` into `courseNames` right after it's built in both functions, replace all four direct `report.courseExam.passed` reads with `isCourseExamPassed(course)`, and relax each function's "nothing yet" early-return so it doesn't fire when the student has only skipped courses and no real attempts.

`courseMastery(course)` (used by Dashboard/Learning Record) needs one small guard: a skipped course has no attempt data, so `buildReport(course).topics` is empty and the existing `if (topics.length === 0) return null` already makes it render as "no mastery data" rather than 0% — correct as-is, confirmed by reading the function, no change needed there. The course label next to that "no mastery data" state is set explicitly to "Skipped" (mirroring `mountCourseStatus`'s "Skipped — counts as done" wording) so a purely-skipped course reads sensibly instead of looking like an untouched course.

## UI: "Customize Your Plan" section

New markup on each of the 13 track pages, placed **above** the existing ladder (not inside it — the ladder's rows are `<a class="toc-item" href="...">` anchors, and a checkbox nested inside a whole-card link is broken UX/markup, so skip controls live in their own list instead):

```html
<div data-track-plan>
  <h2>Customize Your Plan</h2>
  <p class="subtitle">Already know something below? Skip it — it'll count as done. Set a target date and we'll tell you if your actual pace will get you there.</p>
  <div data-track-plan-courses></div>
  <p class="nav-links">
    <label>Target finish date <input type="date" data-track-plan-date></label>
    <button type="button" class="widget-btn" data-track-plan-save>Save My Plan</button>
  </p>
  <p data-track-plan-status></p>
</div>
```

`mountTrackPlan(el)`:
1. Reads the track's course list from `document.querySelectorAll('[data-course-status]')` (already present, one per ladder row, in ladder order) — no new course-list data needed anywhere.
2. Renders one checkbox row per course into `[data-track-plan-courses]`, pre-checked from `stemplus:skipped-courses:v1`, disabled+checked (can't un-skip a course you've already passed for real) if `isCourseExamPassed` is true for a non-skip reason.
3. Pre-fills the date input from `stemplus:track-pace:v1[location.pathname]`.
4. On Save click: merges this track's checked courses into the global skip array (union, not overwrite — a course skipped via one track page must stay skipped on others), saves the date under this page's key, then `location.reload()`.

**Reload, not live re-render, on save** — matches this codebase's existing save pattern (`mountReflection`'s explicit Save button just writes and updates its own status text; nothing here live-recomputes cross-widget). A skip toggle affects badges elsewhere on the same page (the capstone's `data-project-status`, this course's own `data-course-status`) that belong to independently-mounted, already-guarded (`dataset.mounted`) functions with no existing re-render hook. Reloading is the same mechanism a fresh page visit already uses to compute every badge correctly — cheaper and less error-prone than inventing a cross-widget event system for an action a student takes rarely.

## Pace calculation

Only computed when a target date is set for this track.

```
requiredCourses = course names from [data-course-status] on this page
remaining       = requiredCourses.length - (passed or skipped count)
today           = now
weeksLeft       = max(1, (targetDate - today) / 7 days)
neededPerWeek   = remaining / weeksLeft

firstAttempt    = earliest takenAt across getResultsForCourse(c) for c in requiredCourses
weeksElapsed    = firstAttempt ? max(1, (today - firstAttempt) / 7 days) : null
actualPerWeek   = weeksElapsed ? (passed or skipped count) / weeksElapsed : null
```

Status line in `[data-track-plan-status]`:
- No target set → nothing shown (today's behavior, unchanged).
- Target set, no attempts yet → `"Need ~{neededPerWeek} course(s)/week to finish by {date}."`
- Target set, has attempts → compares `actualPerWeek` to `neededPerWeek`: **On track** (actual ≥ needed), **Behind** (actual < needed, states the gap), or **Done early** (remaining is already 0).
- Target date already passed and remaining > 0 → `"Target date passed with {remaining} course(s) left."`

## Files touched

- `public/assets/tests.js` — `isSkippedCourse`, skip/pace load-save helpers, `isCourseExamPassed` one-line change, new `mountTrackPlan`, wire into `initTests()`.
- 11 content pages, each gets the `data-track-plan` block added once, above its ladder: `content/Pathways/{software-engineer,ai-data,mathematics,engineering-physics,competitive-programmer,cloud-devops,general-programmer,ai-developer-cbrwa}.html`, `content/Goals/{get-ahead,challenge-myself,stronger-at-math}.html`.

## Testing

Matches this codebase's established real-browser verification discipline (no test framework; `scripts/verify-page.mjs` CDP-driven checks against seeded `localStorage`):
- Seed a skip for one course in a track with unpassed exams; verify that track's capstone `data-project-status` badge now reads "Unlocked" (or shows the correct passed-count) without touching the real exam data.
- Verify the same skip, set via one track page, is honored on a second, different track page listing the same course (global-not-per-track check).
- Seed a target date + a synthetic attempt history; verify the On track / Behind wording matches the arithmetic above at both a passing and a failing pace.
- Verify a course already exam-passed for real shows its skip checkbox disabled+checked, not editable.
- Verify `npm test` (the 4 existing `check-*.js` scripts) still passes — none of them touch this new section, but content-file structure changes across 13 files are exactly what `check-content-links.js` exists to catch.
