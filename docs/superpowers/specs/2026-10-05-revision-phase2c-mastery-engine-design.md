# Revision Phase 2c — Mastery Engine — Design

## Context

Spec §8 (Mastery System). Built on the 2a skill catalog (one skill per course unit). User decisions (2026-10-05): build 2c before the diagnostic; **practice earns Proficient, the unit test earns Mastered**. Progress stays in the browser.

## States (one per skill; the highest earned)

| State | Earned when (for that unit) |
|---|---|
| Unseen | nothing below |
| Learning | ≥ 1 of the unit's lessons opened |
| Practiced | ≥ 5 Problem Set questions attempted in the unit's topics, or any unit-test attempt |
| Proficient | ≥ 80% first-try correct on ≥ 10 of those questions, or best unit-test score ≥ 70% |
| Mastered | the unit test passed (its saved `passed` flag), or the course exam passed |
| Applied | Mastered, and a completed capstone whose Pathway includes the course |

States are computed on each page load and never stored.

## Data

- **New:** `stemplus:lessons:v1` = `{ "<decoded pathname + search>": firstViewedISO }`. The shell (`components/Layout.tsx`) records it on lesson pages (`/Unit N/NNNN-*.html`, or `lesson.html?id=…` for Programming with Packages) after `STEMPlusAccount.ready`, only when `canSave()`.
- **Existing, read-only:** `stemplus:results:v1` (unit tests, course exams), `stemplus:problem-sets:v1:<slug>` (attempted / first-try correct by question ID), `stemplus:projects:v1` (`complete`).

## Catalog additions (`scripts/build-skill-catalog.js`)

- Courses whose pages are built by `public/<dir>/course.js` (Programming with Packages) read their units from it: 8 units → 291 skills.
- Each skill gains `pagePrefixes` (folder courses: `["/<dir>/Unit N/"]`; course.js courses: each `"/<dir>/lesson.html?id=<slug>"`, matched exactly) and `problemSet` (slug or null).
- Top-level `capstones`: course → capstone project IDs, parsed from `PATHWAYS` in `tests.js`.
- `check-skill-catalog.js`: every `COURSE_PATHS` course has ≥ 1 skill; skill count equals unit folders plus course.js units; every capstone ID has a `content/Projects/<id>.html`; Programming with Packages pinned.

## Engine (`public/assets/mastery.js`)

- `computeMastery(catalog, { lessons, results, problems, completedProjects })` → `{ [skillId]: { state, lessonsViewed, practice: { attempted, correct }, bestUnitTest } }`; pure, exported for Node.
- Browser: loads the catalog; loads `problem-banks.js` only when a Problem Set with saved progress exists (to map question IDs to topics); mounts only for signed-in visitors.
- Loaded with `<script src="/assets/mastery.js" defer>` on the 40 course index pages (after `course.js` on Programming with Packages) and the homepage.

## UI

- **Course pages:** a state chip at the end of each `details.unit-toc > summary`.
- **Dashboard:** a **Skill Mastery** section (`<div data-mastery-summary>` after `data-dashboard`): a legend, then one row per course with any non-Unseen unit — course link, counts ("2 mastered · 1 practiced · 3 unseen"), and a strip of unit cells coloured by state with a unit-name tooltip. Empty state: "Open a lesson, practice, or take a unit test and your skills show up here."
- Colours: six tokens in `style.css` with dark-mode values. Guests see nothing new.
- About page patch note.

## Testing

- `scripts/check-mastery.js` (npm test): every rule with fixture evidence — lesson → Learning (and exact match for course.js lessons), 4 vs 5 attempts, failed unit test without lessons → Practiced, 8/10 vs 7/10 → Proficient vs Practiced, 7/10 unit test → Proficient, passed unit test → Mastered, course exam → every unit of that course Mastered and no other course, capstone without mastery → not Applied, capstone + mastery → Applied.
- Production build: opening a lesson as a member records it (and not as a guest); with seeded member progress the course page chips and Dashboard strip show the expected states; guests see no chips or card. Push; repeat the chips and Dashboard checks live.
