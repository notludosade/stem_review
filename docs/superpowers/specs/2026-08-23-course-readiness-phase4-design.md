# Course-Level Readiness (Phase 4) — Design

## Context

Phase 4 of the product-vision document reads: "Introduce Skills, prerequisites, readiness, and the student's Frontier." Investigation found this is genuinely new territory — no existing "prerequisite," "readiness," "frontier," or "skill" concept exists anywhere in the code beyond course-level pathway gating.

Two possible scopes surfaced. The full vision (topic-level Skills + a Knowledge Graph + the Frontier view) would need real curation first: unit tests and course exams already tag every question with `data-topic="…"` (5,885 tags, 2,534 distinct strings site-wide), and `buildReport()` already aggregates per-topic accuracy — but cross-test topic-name consistency within a single course ranges from 27% to 100%, and only ~2.6% of topic strings are reused across different courses. Treating this directly as a clean skill taxonomy would be unreliable without curation work well beyond one phase.

The narrower scope — confirmed with the user — builds Readiness (vision doc Section 7) at course granularity instead, directly on `content/advanced.html`'s existing hand-written prerequisite prose ("Requires AP Calculus BC," "Requires Real Analysis A," etc.), which already describes exactly this relationship with zero enforcement today. This matches the vision doc's own explicit "Do NOT introduce a graph database unless technically justified. Use the existing architecture where practical" instruction.

## Goals

- New `PREREQUISITES` lookup table in `public/assets/tests.js` (mirrors the existing `PROBLEM_SET_SLUGS`/`APPLICATION_BY_COURSE` pattern), one entry per Advanced+ course that's actually shipped (has real content, not a "Coming Soon" placeholder), listing its required course(s) — values transcribed from `advanced.html`'s existing prose.
- Extend `mountCourseContext` (the "Where this fits" box, already mounted on every course's own `index.html`, already extended once in Phase 3 for Practice/Applications) with a "Prerequisites" line and a one-line readiness verdict, computed from the existing `isCourseExamPassed` per prerequisite — no new data source, no fabricated numbers.
- Widen `mountCourseContext`'s self-removal condition once more to also check for prerequisites — 3 of the 5 target courses (`Real Analysis B`, `Linear Algebra B`, `Topology: Fundamentals`) have no pathway membership, no problem set, and no Application entry, so their box currently self-removes entirely before this phase even starts.

## Non-goals

- Not building topic-level Skills, a Knowledge Graph, or the Frontier view (vision doc Sections 8-9) — confirmed with the user as a separate, later, much bigger decision given the topic-data-quality findings above.
- Not touching the 4 "Coming Soon" courses on `advanced.html` (Quantum Computing, Differential Geometry, Complex Analysis A/B, Complex Analysis B/C) — they have no real `index.html` to attach a context box to.
- Not adding lock/gate enforcement, "Prepare First"/"Start Anyway" buttons, or estimated-preparation time. The course is already freely clickable with zero enforcement — that half of "guidance, not gatekeeping" is already true structurally. Time estimates would require a data source that doesn't exist; adding one is out of scope.
- Not changing any other consumer of `mountCourseContext`'s box (`mountProjectMeta`, `mountRecommendedPractice`, `mountDashboard`, `mountPathwayProgress`, `mountGeneratedPlan`, `mountPathwayRoadmap` all stay untouched).

## Design

**New lookup table**, placed alongside `APPLICATION_BY_COURSE` in `public/assets/tests.js`, transcribed from `content/advanced.html`'s existing prerequisite prose:

```js
var PREREQUISITES = {
  'Real Analysis A': ['AP Calculus BC'],
  'Real Analysis B': ['Real Analysis A'],
  'Advanced Algorithms': ['Computer Programming 1', 'Computer Programming 2'],
  'Linear Algebra B': ['Linear Algebra A'],
  'Topology: Fundamentals': ['Real Analysis A'],
};
```

All 5 keys and all referenced prerequisite course names already exist in `COURSE_PATHS`, verified against the file directly — no drift risk introduced by this table.

**`mountCourseContext` changes**: after the existing pathway/Practice/Applications lines, if `PREREQUISITES[course]` has entries, append:
- A "Prerequisites: X, Y" line, each course name linked via the existing `coursePath()` helper (same pattern as every other link in this box).
- A one-line verdict: if every prerequisite's `isCourseExamPassed` is true, "You can start now — every prerequisite exam is passed." Otherwise, "Review recommended — X isn't passed yet" (or "X and Y aren't passed yet" for multiple), naming the specific missing prerequisite(s).

Self-removal condition widens from checking pathway/practice/application to also checking prerequisites — the box only disappears when a course has genuinely nothing to show across all four sources.

## Testing

Same discipline as prior phases: `scripts/verify-page.mjs` against `npm run build && npm run start`.

- `Real Analysis A` (single prerequisite, `AP Calculus BC`): confirm both the "Ready" and "Review recommended" wordings render correctly depending on whether the test account has passed `AP Calculus BC`.
- `Advanced Algorithms` (two prerequisites, and already has pathway + practice content from before this phase): confirm the new Prerequisites line coexists correctly with the pre-existing pathway/Practice lines, and the multi-name "aren't passed yet" wording is correct when only one of two is missing.
- `Topology: Fundamentals` (zero pathway, zero practice, zero application — currently self-removes entirely): confirm the box now renders with only the Prerequisites lines, proving the widened self-removal condition works, same regression-check pattern as Phase 3's `Linear Algebra A` check.
- `npm test` passes.
