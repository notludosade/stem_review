# Revision Phase 3 Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct pass-mark text everywhere, then give signed-in students a lesson-level Next Step with readiness, skill-based Review, and Prove Mastery links.

**Architecture:** Catalog v2 lists each unit's lessons and test page; `mastery.js` gains pure `nextStep` / `reviewList` plus two Dashboard mounts and course-page links; `tests.js` loses two superseded sections.

**Tech Stack:** Node checks, plain browser JS, static HTML.

**Spec:** `docs/superpowers/specs/2026-10-05-revision-phase3-personalization-design.md`

## Global Constraints

- Unit tests 80%, course exams 85% (code is the source of truth; text follows).
- Skill IDs unchanged; lesson-view keys unchanged (exact decoded path + search).
- Don't touch `content/about.html` or `content/updates/` (user's uncommitted work); stage only own files.

---

### Task 1: Pass-mark text + check
- [ ] Write `scripts/check-pass-marks.js` (spec §1 rules); run → FAIL listing pages.
- [ ] One-off Python fix over unit tests, course exams, course index cards, and Programming with Packages `course.js`; check passes; add to `npm test`; commit "State the real pass marks: 80% for unit tests, 85% for course exams".

### Task 2: Catalog v2 + exact lesson matching
- [ ] Catalog check: `version` 2, lessons/testPage exist on disk, PwP pinned → FAIL.
- [ ] Generator: lessons `[{ page, title }]`, `testPage`, drop `pagePrefixes`; regenerate (IDs unchanged).
- [ ] `mastery.js`: exact lesson matching, `courseHref` from `testPage` (exported); `diagnostic.js` uses it; update `check-mastery.js` fixtures; `npm test`; commit.

### Task 3: `nextStep` + `reviewList`
- [ ] `check-mastery.js` cases from the spec → FAIL; implement; pass; commit.

### Task 4: Dashboard + course pages
- [ ] Mounts `data-next-step`, `data-skill-review` in `content/index.html`; render in `mastery.js`; Prove mastery links in `mountCourseChips`; `problem-sets.js` `?topic=`; remove Review + Next Milestone from `tests.js`; CSS; `npm test`; build; commit.

### Task 5: Verify, push, verify live
- [ ] Spec Testing browser checks on port 3100; push; live checks; restore storage.
