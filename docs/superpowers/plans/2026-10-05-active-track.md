# Active Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students choose one active track (a Pathway or their AI plan) on its page or in the Dashboard, and the Dashboard's Continue Learning section leads with that track's progress and next step.

**Architecture:** All in `public/assets/tests.js`: a new localStorage key plus `resolveTrack` / `trackStatus` logic, a track card + picker rendered at the top of Continue Learning, and a `data-track-choice` mount for the 10 Pathway pages and `my-plan.html`. Pure logic is exported and covered by a Node check in `npm test`.

**Tech Stack:** Plain browser JS (IIFE `window.STEMPlusTests`), static HTML in `content/`, Node `assert` checks.

**Spec:** `docs/superpowers/specs/2026-10-05-active-track-design.md`

## Global Constraints

- Storage key `stemplus:active-track:v1`; values `{ type: 'pathway', name }` or `{ type: 'plan' }`; one active track.
- Progress via existing `isCourseExamPassed` (skips count; developer mode passes all) and `isProjectComplete`.
- Pathway page slug = `projectId` minus `-capstone` (true for all 10 PATHWAYS entries).
- Track/course names inserted into HTML go through `escapeHtml`.
- Commit every task; push at the end; verify on a production build, then production.

---

### Task 1: Track logic + Node check

**Files:** Modify `public/assets/tests.js`; Create `scripts/check-active-track.js`; Modify `package.json`.

- [ ] **Step 1: Failing check** — `scripts/check-active-track.js`:

```js
'use strict';

const assert = require('node:assert');

const store = new Map();
global.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};
global.document = { addEventListener: () => {} };
require('../public/assets/tests.js');
const T = global.window.STEMPlusTests;

const results = () => JSON.parse(store.get('stemplus:results:v1') || '[]');
const addResult = (row) => store.set('stemplus:results:v1', JSON.stringify([...results(), { version: null, score: 1, total: 1, topicBreakdown: [], takenAt: '2026-10-05T00:00:00Z', ...row }]));
const passExam = (course) => addResult({ course, unit: null, kind: 'course_exam', passed: true });

assert.strictEqual(T.loadActiveTrack(), null, 'no track saved yet');
assert.strictEqual(T.resolveTrack(null), null);
assert.strictEqual(T.resolveTrack({ type: 'pathway', name: 'Not A Pathway' }), null, 'unknown pathway resolves to null');
assert.strictEqual(T.resolveTrack({ type: 'plan' }), null, 'plan track with no saved plan resolves to null');

const quantum = { type: 'pathway', name: 'Quantum Science' };
T.saveActiveTrack(quantum);
assert.deepStrictEqual(T.loadActiveTrack(), quantum);
const resolved = T.resolveTrack(quantum);
assert.strictEqual(resolved.href, 'Pathways/quantum-science.html');
assert.strictEqual(resolved.projectId, 'quantum-science-capstone');

let status = T.trackStatus(resolved);
assert.deepStrictEqual([status.passed, status.total, status.next, status.complete], [0, 4, 'AP Physics 2', false]);

passExam('AP Physics 2');
status = T.trackStatus(resolved);
assert.deepStrictEqual([status.passed, status.next], [1, 'AP Physics C: Electricity and Magnetism']);

store.set('stemplus:skipped-courses:v1', JSON.stringify(['AP Physics C: Electricity and Magnetism']));
status = T.trackStatus(resolved);
assert.deepStrictEqual([status.passed, status.next], [2, 'Quantum Physics & Optics'], 'a skipped course counts as passed');

addResult({ course: 'Quantum Physics & Optics', unit: 'Unit 1', kind: 'unit_test', passed: true });
addResult({ course: 'Quantum Physics & Optics', unit: 'Unit 3', kind: 'unit_test', passed: false });
addResult({ course: 'Quantum Physics & Optics', unit: 'Unit 2', kind: 'unit_test', passed: false });
assert.strictEqual(T.nextUnitFor('Quantum Physics & Optics'), 'Unit 2', 'next unit is the lowest-numbered attempted, uncleared unit');
assert.strictEqual(T.trackStatus(resolved).nextUnit, 'Unit 2');

passExam('Quantum Physics & Optics');
passExam('Quantum Computing');
status = T.trackStatus(resolved);
assert.deepStrictEqual([status.passed, status.next, status.projectDone, status.complete], [4, null, false, false], 'courses done, capstone not yet');

store.set('stemplus:projects:v1', JSON.stringify({ 'quantum-science-capstone': { answers: {}, complete: true } }));
assert.strictEqual(T.trackStatus(resolved).complete, true, 'capstone complete finishes the track');

store.set('stemplus:custom-plan:v1', JSON.stringify({ summary: 's', courses: [{ name: 'Precalculus', reason: 'r' }, { name: 'AP Calculus BC', reason: 'r' }], project: null, problemSets: [], applications: [] }));
const plan = T.resolveTrack({ type: 'plan' });
assert.deepStrictEqual([plan.label, plan.href, plan.projectId], ['My AI plan', 'my-plan.html', null]);
assert.deepStrictEqual(plan.courses, ['Precalculus', 'AP Calculus BC']);
assert.strictEqual(T.trackStatus(plan).next, 'Precalculus');
passExam('Precalculus');
passExam('AP Calculus BC');
assert.strictEqual(T.trackStatus(plan).complete, true, 'a plan with no project completes when its courses do');

T.saveActiveTrack(null);
assert.strictEqual(T.loadActiveTrack(), null, 'saving null clears the track');

console.log('check-active-track: OK');
```

Run → FAIL (`T.loadActiveTrack is not a function`).

- [ ] **Step 2: Implement** in `tests.js`:
  - After `var CUSTOM_PLAN_STORAGE_KEY = …;` add `var ACTIVE_TRACK_STORAGE_KEY = 'stemplus:active-track:v1';`.
  - After `isPlanFinished`, add `loadActiveTrack`, `saveActiveTrack(track | null)`, `sameTrack(a, b)`, `resolveTrack(track)`, `nextUnitFor(course)`, `trackStatus(resolved)` exactly as specified in the spec (code in the implementation commit).
  - Export `loadActiveTrack, saveActiveTrack, resolveTrack, trackStatus, nextUnitFor` from the final `return { … }`.
- [ ] **Step 3:** Add ` && node scripts/check-active-track.js` to `package.json` `test`; `npm test` passes. Commit.

### Task 2: Dashboard track card, track choice block, pages, copy

**Files:** Modify `public/assets/tests.js`, `public/assets/style.css`, the 10 `content/Pathways/*.html`, `content/my-plan.html`, `content/about.html`.

- [ ] **Step 1:** `tests.js` — `trackPickerHtml(active)`, `trackCardHtml()`, `wireTrackCard(el)` before `renderDashboard`; in `renderDashboard`: empty state renders Continue Learning (track card) + the existing hint, `nextUnitName` uses `nextUnitFor`, Continue Learning = track card + in-progress card unless its course is the track's `next`, and `wireTrackCard(el)` after `el.innerHTML = html;`.
- [ ] **Step 2:** `tests.js` — `mountTrackChoice(el)` + `document.querySelectorAll('[data-track-choice]').forEach(mountTrackChoice);` in `initTests`.
- [ ] **Step 3:** `style.css` — `.link-button`, `.track-picker`, `.track-card-actions`, `.track-choice`.
- [ ] **Step 4:** Insert `<div data-track-choice="<name>" data-root="../"></div>` after the nav-links line of each Pathway page (names: Software Engineer, AI &amp; Data, Mathematics, Engineering &amp; Physics, Competitive Programmer, Cloud &amp; DevOps, General Programmer, AI Developer: CB/RWA, Quantum Science, Robotics &amp; Mechatronics) and `<div data-track-choice="plan"></div>` after `my-plan.html`'s nav-links; extend the Oct 5 patch note in `about.html`.
- [ ] **Step 5:** `npm test`, `npm run build`; commit.

### Task 3: Verify, push, verify live

- [ ] Production build + fresh cookie: new user (no progress) sees "Pick your track" picker; confirming Quantum Science renders "0 of 4 courses passed · Up next: AP Physics 2"; seeding a passed AP Physics 2 exam → "1 of 4 … AP Physics C: Electricity and Magnetism"; Change track → picker → Software Engineer; Pathway page button "Make this my track" → active state, Dashboard shows it; Stop following → picker; AI plan page button with a seeded plan → "My AI plan" card; in-progress card hidden when same as track next. Screenshots desktop + phone.
- [ ] Push, poll deploy, repeat on production.
