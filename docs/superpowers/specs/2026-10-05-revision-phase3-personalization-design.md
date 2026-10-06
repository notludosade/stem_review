# Revision Phase 3 — Personalization — Design

## Context

Spec §9 (Skip-by-Mastery), §10 (Dashboard as recommender). Built on the skill catalog (2a), mastery engine (2c), and diagnostics (2b). User decisions (2026-10-05): **fix page text to the real pass marks** (unit tests 80%, course exams 85%); **skill-based Review replaces the old topic list**.

## 1. Pass-mark text

- One-off fix: on unit-test pages every "score NN% or higher" → 80%; on `course-exam.html` pages → 85%; on course `index.html` pages, inside `toc-item` cards linking to a unit test → 80% and to `course-exam.html` → 85%; in `public/Programming with Packages/course.js`, the unit-test subtitle → 80% and the course-exam line → 85%. Pathway exam pages are unchanged (already correct at 75% / 80%).
- `scripts/check-pass-marks.js` (npm test) enforces those rules.

## 2. Catalog v2

- `version: 2`. Each skill's `lessons` becomes `[{ page, title }]` (folder lessons: decoded path, title from the lesson's `<h1>`; course.js lessons: `lesson.html?id=<slug>` and its title). `pagePrefixes` is removed. New `testPage`: `/<dir>/Unit N/unit-test-a.html`, or `/<dir>/unit-test.html?unit=N`.
- Check: every lesson page and every folder `testPage` exists on disk; Programming with Packages pinned.
- `mastery.js` matches lesson views exactly against `lessons[].page`; `courseHref(skill)` derives the course page from `testPage` and is exported for `diagnostic.js`.

## 3. Pure helpers in `mastery.js`

- `nextStep(catalog, mastery, evidence, courses)` → for the first skill in `courses` order (then unit order) below Mastered:
  - state Unseen/Learning and an unopened lesson → `{ kind: 'lesson', skill, lesson, number }` (first unopened lesson, 1-based position in the unit);
  - otherwise → `{ kind: 'test', skill }`;
  - no such skill → `{ kind: 'done' }`.
- `reviewList(catalog, mastery)` → up to 5 skills in state Practiced or Proficient, weakest first by their best evidence ratio (max of Problem Set first-try accuracy, best unit-test score, diagnostic share; missing evidence = 0), ties in catalog order; each `{ skill, action }` with action `{ kind: 'practice', slug, topic }` (first `problemTopics` entry) when the skill has a Problem Set, else `{ kind: 'test' }`.

## 4. Dashboard (signed in)

- `<div data-next-step>` before `data-dashboard`: **Your Next Step**.
  - Track from `STEMPlusTests.resolveTrack(STEMPlusTests.loadActiveTrack())` (Pathway or AI plan).
  - Line: "<Track> · NN% ready (R of T skills)" via `readiness`.
  - Card: lesson → "Lesson N: Title" (links the lesson), sub "Course · Unit N: Name — State"; test → "Take the Unit N test" (links `testPage`), sub "Pass at 80% to master Course · Unit N: Name"; plus "Already know this? Prove mastery →" (testPage) on lesson steps; done → capstone link (Pathway) or "Every course on this plan is mastered".
  - No track: "Pick a track in Continue Learning below, or take a diagnostic" (links `diagnostic.html`).
- `<div data-skill-review>` after `data-dashboard`: **Review**, `reviewList` rows: practice → "Practise <topic>" linking `problem-set.html?course=<slug>&topic=<topic>`; test → "Retake the Unit N test". Empty: "Nothing to review — units you've started but not mastered show up here."
- `tests.js` `renderDashboard`: remove the old Review and Next Milestone sections.
- `problem-sets.js`: `?topic=` preselects that topic when it exists.

## 5. Prove Mastery on course pages

- After each unit chip below Mastered, a "Prove mastery →" link to the skill's `testPage` (signed in only).

## Not included

No patch note: `content/about.html` has the user's uncommitted rewrite of the Oct 5 notes; they'll fold this in.

## Testing

- `check-pass-marks.js`; catalog check updates; `check-mastery.js` for `nextStep` (unopened lesson → that lesson; all lessons opened → test; Practiced → test; Mastered units skipped in course order; all mastered → done) and `reviewList` (weakest first, ≤ 5, practice vs test actions, Unseen/Mastered excluded).
- Production build (port 3100): member with seeded progress sees the expected Next Step and Review; Prove mastery links only on non-mastered units; Review link opens the Problem Set filtered; guests see none of it. Push; repeat live; restore storage.
