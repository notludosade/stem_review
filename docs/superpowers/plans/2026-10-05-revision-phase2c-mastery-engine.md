# Revision Phase 2c Mastery Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every course unit shows a mastery state (Unseen → Applied) for signed-in students, computed from saved work plus new lesson-view tracking.

**Architecture:** The catalog generator adds lesson-page prefixes, Problem Set slugs, Programming with Packages' units, and capstone coverage. A new `public/assets/mastery.js` holds a pure `computeMastery` (Node-tested) plus browser mounts for course pages and the Dashboard. The shell records lesson views.

**Tech Stack:** Node checks, plain browser JS, React (shell), CSS tokens.

**Spec:** `docs/superpowers/specs/2026-10-05-revision-phase2c-mastery-engine-design.md`

## Global Constraints

- State thresholds exactly as the spec table (5 / 10 / 80% / 70%).
- Skill IDs never change meaning; new catalog fields are additive (`version` stays 1).
- Lesson views are written only when `STEMPlusAccount.canSave()`.
- No mastery state is stored.

---

### Task 1: Catalog additions

**Files:** Modify `scripts/build-skill-catalog.js`, `scripts/check-skill-catalog.js`; regenerate `public/assets/skill-catalog.json`.

- [ ] Check first — replace the unit-folder count assertion with `skills.length === expectedSkillCount()`; assert every `COURSE_PATHS` course has a skill, every skill has non-empty `pagePrefixes` and a `problemSet` key, every `capstones` course is a catalog course and every ID has `content/Projects/<id>.html`; pin `programming-with-packages.u1` ("Package Foundations", requires `computer-programming-1.u8`, 3 lessons, 3 exact `lesson.html?id=` prefixes) and `capstones['Precalculus']` containing `mathematics-capstone`. Run: FAIL.
- [ ] Generator — `courseUnits` uses `public/<dir>/course.js` (`units[i].title`, `lessons.length`, prefixes `/<dir>/lesson.html?id=<slug>`) when it exists, else folders (prefix `/<dir>/Unit N/`); skills gain `pagePrefixes` and `problemSet`; `capstones` from `PATHWAYS` (`courses: [...]`, `projectId`); export `expectedSkillCount`, `COURSE_PATHS`.
- [ ] Regenerate (291 skills); check passes; `npm test`; commit "Add lesson pages, Problem Set slugs, Programming with Packages, and capstones to the skill catalog".

### Task 2: Mastery engine + check

**Files:** Create `public/assets/mastery.js`, `scripts/check-mastery.js`; Modify `package.json`.

- [ ] `scripts/check-mastery.js` covering every spec testing rule against the real catalog (fixture evidence). Run: FAIL (module missing).
- [ ] `mastery.js` pure part: `STATES`, `LABELS`, `computeMastery(catalog, evidence)` per the spec table; `module.exports` for Node, then return before browser code.
- [ ] Check passes; add to `npm test` after `check-skill-catalog`; commit "Add the mastery engine".

### Task 3: Lesson tracking, mounts, styles, pages

**Files:** Modify `components/Layout.tsx`, `public/assets/mastery.js`, `public/assets/style.css`, `content/index.html`, the 40 course `index.html` pages, `content/about.html`.

- [ ] Shell: `useLessonViews()` effect in `Layout` (spec "Data").
- [ ] `mastery.js` browser part: catalog fetch, lazy `problem-banks.js`, evidence gathering, `mountCourseChips`, `mountSummary`; signed-in only; idempotent.
- [ ] CSS tokens `--m-learning`, `--m-practiced`, `--m-applied` (+ dark values in both dark blocks); `.mastery-chip`, `.mastery-legend`, `.mastery-row`, `.mastery-strip`, `.mastery-cell`, `[data-state]` colours.
- [ ] `<script src="/assets/mastery.js" defer></script>` after the `tests.js` script on 39 course pages, after `course.js` on Programming with Packages, and on `content/index.html`; `<div data-mastery-summary></div>` after `data-dashboard`.
- [ ] About patch note; `npm test`; `npm run build`; commit "Show unit mastery on course pages and the Dashboard".

### Task 4: Verify, push, verify live

- [ ] Production build: member lesson visit recorded, guest not; seeded member progress → expected chips on Precalculus and Programming with Packages and the Dashboard strip; guest sees neither; phone screenshot of the Dashboard section.
- [ ] Push; repeat chip + Dashboard checks on production (seed via the page's localStorage, then restore).
