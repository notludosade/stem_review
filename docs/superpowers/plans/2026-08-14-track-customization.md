# Track Customization (Skip + Target-Date Pace) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student self-declare a course as "already known" (skip) and set a target finish date on any Pathway or Goals-with-a-ladder page, with skip honored everywhere the site already checks course completion and pace compared against their actual historical rate.

**Architecture:** Pure additions to the existing `public/assets/tests.js` IIFE, following its established markup-contract pattern (`data-xxx` attribute + guarded `mountXxx(el)` function wired into `initTests()`). One existing function (`isCourseExamPassed`) gets a one-line change that every other gate/badge/mastery function already routes through, so skip propagates everywhere for free. 11 static content pages each get one new empty `<div data-track-plan></div>` — all rendering happens client-side in JS, no other markup changes.

**Tech Stack:** Vanilla ES6 (const/let, arrow functions — matches this file's most recent additions, `mountDashboard`/`mountLearningRecord`), `localStorage`, no build step, no test framework (verification via `scripts/verify-page.mjs`, the existing raw-CDP/headless-Chrome tool used for every prior feature in this codebase).

## Global Constraints

- Pace is computed in **courses remaining**, never units — a prior session segment documented that this codebase has no reliable way to know a course's true total unit count, only units with a recorded attempt. Do not introduce a units-based metric.
- Skip state is **global per-course** (`stemplus:skipped-courses:v1`, flat array). Pace target is **per-track** (`stemplus:track-pace:v1`, keyed by `location.pathname`).
- All gating must route through the single existing choke point, `isCourseExamPassed(course)`. Do not add a second, parallel skip check anywhere else.
- No new CSS. Reuse `.reflection-item`, `.reflection-actions`, `.reflection-status`/`.is-saved`, `.lock-badge`/`.is-unlocked`/`.is-locked`, `.widget-btn`, `.subtitle`, `.toc-empty` — all already defined in `public/assets/style.css`.
- Save writes to `localStorage` then calls `window.location.reload()` — matches this file's only other write-then-confirm pattern (`mountReflection`'s Save button just writes and updates its own status text; nothing in this codebase live-recomputes a different, already-mounted widget on the same page).
- Spec: `docs/superpowers/specs/2026-08-14-track-customization-design.md`.

---

### Task 1: Skip storage + gating fix in `tests.js`

**Files:**
- Modify: `public/assets/tests.js:116-117` (storage key constants), `public/assets/tests.js:429-432` (`isCourseExamPassed`), `public/assets/tests.js:519-528` (`mountCourseStatus`)

**Interfaces:**
- Produces: `SKIPPED_STORAGE_KEY` (const, string), `loadSkippedCourses()` → `string[]`, `saveSkippedCourses(courses: string[])` → `boolean`, `isSkippedCourse(course: string)` → `boolean`. `isCourseExamPassed(course)` now also returns `true` when `isSkippedCourse(course)` is true. `mountCourseStatus` badge text is `'Skipped — counts as done'` when skipped (checked before the generic passed/not-passed wording).

- [ ] **Step 1: Add the skip storage key and helpers**

In `public/assets/tests.js`, right after line 117 (`var PROJECTS_STORAGE_KEY = 'stemplus:projects:v1';`), add:

```js
  var SKIPPED_STORAGE_KEY = 'stemplus:skipped-courses:v1';
```

Then, immediately after the existing `isProjectComplete` function (currently ending at line 471, just before `function mountProjectGate(gate) {`), add:

```js
  function loadSkippedCourses() {
    try {
      const raw = window.localStorage.getItem(SKIPPED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Could not read skipped courses', err);
      return [];
    }
  }

  function saveSkippedCourses(courses) {
    try {
      window.localStorage.setItem(SKIPPED_STORAGE_KEY, JSON.stringify(courses));
      return true;
    } catch (err) {
      console.error('Could not save skipped courses', err);
      return false;
    }
  }

  function isSkippedCourse(course) {
    return loadSkippedCourses().indexOf(course) !== -1;
  }
```

- [ ] **Step 2: Fix `isCourseExamPassed` at its single choke point**

Change (currently lines 429-432):

```js
  function isCourseExamPassed(course) {
    if (isDevMode()) return true;
    return summarizeCourseExam(getResultsForCourse(course)).passed;
  }
```

to:

```js
  function isCourseExamPassed(course) {
    if (isDevMode()) return true;
    if (isSkippedCourse(course)) return true;
    return summarizeCourseExam(getResultsForCourse(course)).passed;
  }
```

Every caller — `mountProjectGate`, `mountCourseStatus`, `mountProjectStatus`, `mountPathwayProgress`, `requiredCoursesStatus`, `mountDashboard`/`mountLearningRecord`'s mastery math — now honors skip automatically. Do not touch any of those callers for gating purposes.

- [ ] **Step 3: Show "Skipped" wording on the course badge itself**

Change `mountCourseStatus` (currently lines 519-528):

```js
  function mountCourseStatus(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';
    const course = el.getAttribute('data-course-status');
    const passed = isCourseExamPassed(course);
    el.classList.add('lock-badge');
    el.classList.remove('is-locked', 'is-unlocked');
    el.classList.add(passed ? 'is-unlocked' : 'is-locked');
    el.textContent = passed ? 'Course exam passed' : 'Course exam not yet passed';
  }
```

to:

```js
  function mountCourseStatus(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';
    const course = el.getAttribute('data-course-status');
    const skipped = !isDevMode() && isSkippedCourse(course);
    const passed = isCourseExamPassed(course);
    el.classList.add('lock-badge');
    el.classList.remove('is-locked', 'is-unlocked');
    el.classList.add(passed ? 'is-unlocked' : 'is-locked');
    el.textContent = skipped ? 'Skipped — counts as done' : (passed ? 'Course exam passed' : 'Course exam not yet passed');
  }
```

- [ ] **Step 4: Start the local dev server (leave running for later tasks)**

Run: `npm run dev &`
Expected: log line containing `Ready` and a `http://localhost:3000` URL within ~10s.

- [ ] **Step 5: Verify the fix with a real seeded page (two separate invocations — see `scripts/verify-page.mjs`'s own comment on why localStorage writes need a separate later invocation to reliably read back)**

Seed:
```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { localStorage.setItem('stemplus:skipped-courses:v1', JSON.stringify(['Computer Programming 1'])); return { ok: true }; })()"
```
Expected: `PASS`

Read (fresh navigation, so `mountCourseStatus` mounts against the now-persisted skip):
```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { const badges = Array.from(document.querySelectorAll('[data-course-status]')); const cp1 = badges.find(b => b.getAttribute('data-course-status') === 'Computer Programming 1'); const cp2 = badges.find(b => b.getAttribute('data-course-status') === 'Computer Programming 2'); return { ok: cp1.textContent === 'Skipped — counts as done' && cp2.textContent === 'Course exam not yet passed', cp1: cp1.textContent, cp2: cp2.textContent }; })()"
```
Expected: `PASS`

Cross-track check — the same skip, read from a *different* page listing the same course (proves skip is global, not per-track):
```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/general-programmer.html" "(() => { const el = Array.from(document.querySelectorAll('[data-course-status]')).find(b => b.getAttribute('data-course-status') === 'Computer Programming 1'); return { ok: el.textContent === 'Skipped — counts as done', text: el.textContent }; })()"
```
Expected: `PASS`

Cleanup (leave localStorage clean for the next task):
```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { localStorage.clear(); return { ok: true }; })()"
```
Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add public/assets/tests.js
git commit -m "$(cat <<'EOF'
Add self-declared course skip, honored at the single gating choke point

isCourseExamPassed() is the one function every lock/status/progress
check already routes through, so one line makes skip honored
everywhere (capstone unlock, course badges, pathway progress, mastery
math) with no changes to any of those callers.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Pace storage + `mountTrackPlan` UI, piloted on Software Engineer

**Files:**
- Modify: `public/assets/tests.js` (new storage key + helpers near `SKIPPED_STORAGE_KEY`; new `mountTrackPlan` placed after `mountPathwayProgress`, currently ending at `public/assets/tests.js:574`; wire into `initTests()` at `public/assets/tests.js:1371`)
- Modify: `content/Pathways/software-engineer.html` (pilot page — add the one-line `<div data-track-plan></div>`)

**Interfaces:**
- Consumes: `isCourseExamPassed`, `isSkippedCourse`, `isDevMode`, `loadResults` (Task 1 and pre-existing)
- Produces: `TRACK_PACE_STORAGE_KEY` (const), `loadTrackPace()` → `{[pathname: string]: string}`, `saveTrackPace(pace)` → `boolean`, `mountTrackPlan(el)` (wired into `initTests()` via `document.querySelectorAll('[data-track-plan]').forEach(mountTrackPlan)`)

- [ ] **Step 1: Add the pace storage key and helpers**

Right after the `SKIPPED_STORAGE_KEY` line added in Task 1, add:

```js
  var TRACK_PACE_STORAGE_KEY = 'stemplus:track-pace:v1';
```

Then, right after `isSkippedCourse` (added in Task 1), add:

```js
  function loadTrackPace() {
    try {
      const raw = window.localStorage.getItem(TRACK_PACE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.error('Could not read track pace', err);
      return {};
    }
  }

  function saveTrackPace(pace) {
    try {
      window.localStorage.setItem(TRACK_PACE_STORAGE_KEY, JSON.stringify(pace));
      return true;
    } catch (err) {
      console.error('Could not save track pace', err);
      return false;
    }
  }
```

- [ ] **Step 2: Add `mountTrackPlan`**

Immediately after `mountPathwayProgress` (currently ends at `public/assets/tests.js:574`, right before the `mountCourseContext` comment block), add:

```js
  // Self-declared "already know this" skip + target-date pace, for any page
  // with its own course ladder: <div data-track-plan></div>, placed above
  // the ladder. Reads the course list straight from that ladder's own
  // [data-course-status] spans — no separate course-list data needed.
  function paceLine(courses, targetDate) {
    if (!targetDate) return '';
    const passed = courses.filter((c) => isCourseExamPassed(c)).length;
    const remaining = courses.length - passed;
    if (remaining === 0) return 'Every course here is done.';

    const today = new Date();
    const target = new Date(targetDate + 'T23:59:59');
    const msLeft = target - today;
    const dateStr = target.toLocaleDateString();
    if (msLeft <= 0) return 'Target date passed with ' + remaining + ' course' + (remaining === 1 ? '' : 's') + ' left.';

    const weeksLeft = Math.max(1, msLeft / (7 * 24 * 60 * 60 * 1000));
    const neededPerWeek = remaining / weeksLeft;

    const takenAts = [];
    const results = loadResults();
    courses.forEach((c) => { results.forEach((r) => { if (r.course === c) takenAts.push(r.takenAt); }); });
    takenAts.sort();

    if (takenAts.length === 0) {
      return 'Need ~' + neededPerWeek.toFixed(1) + ' course(s)/week to finish by ' + dateStr + '.';
    }

    const weeksElapsed = Math.max(1, (today - new Date(takenAts[0])) / (7 * 24 * 60 * 60 * 1000));
    const actualPerWeek = passed / weeksElapsed;
    const label = actualPerWeek >= neededPerWeek ? 'On track' : 'Behind';
    return label + ' — averaging ' + actualPerWeek.toFixed(1) + '/week, need ' + neededPerWeek.toFixed(1) + '/week to finish by ' + dateStr + '.';
  }

  function mountTrackPlan(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';

    const courses = Array.from(document.querySelectorAll('[data-course-status]')).map((e) => e.getAttribute('data-course-status'));
    if (courses.length === 0) { el.remove(); return; }

    const skipped = loadSkippedCourses();
    const pace = loadTrackPace();
    const savedDate = pace[window.location.pathname] || '';

    const rows = courses.map((course) => {
      const reallyPassed = !isDevMode() && !isSkippedCourse(course) && isCourseExamPassed(course);
      const checked = reallyPassed || skipped.indexOf(course) !== -1;
      const disabledAttr = reallyPassed ? ' disabled' : '';
      return '<div class="reflection-item"><label><input type="checkbox" data-track-plan-course="' + course + '"'
        + (checked ? ' checked' : '') + disabledAttr + '> ' + course
        + (reallyPassed ? ' (already passed)' : '') + '</label></div>';
    }).join('');

    el.innerHTML = '<h2>Customize Your Plan</h2>'
      + '<p class="subtitle">Already know something below? Skip it — it’ll count as done. Set a target date and we’ll tell you if your actual pace will get you there.</p>'
      + rows
      + '<div class="reflection-actions">'
      + '<label>Target finish date <input type="date" data-track-plan-date value="' + savedDate + '"></label>'
      + '<button type="button" class="widget-btn" data-track-plan-save>Save My Plan</button>'
      + '<span data-track-plan-status class="reflection-status"></span>'
      + '</div>';

    const statusEl = el.querySelector('[data-track-plan-status]');
    const line = paceLine(courses, savedDate);
    if (line) { statusEl.textContent = line; statusEl.classList.add('is-saved'); }

    el.querySelector('[data-track-plan-save]').addEventListener('click', () => {
      const current = loadSkippedCourses();
      Array.from(el.querySelectorAll('[data-track-plan-course]:not(:disabled)')).forEach((box) => {
        const course = box.getAttribute('data-track-plan-course');
        const idx = current.indexOf(course);
        if (box.checked && idx === -1) current.push(course);
        if (!box.checked && idx !== -1) current.splice(idx, 1);
      });
      saveSkippedCourses(current);

      const dateVal = el.querySelector('[data-track-plan-date]').value;
      const allPace = loadTrackPace();
      if (dateVal) allPace[window.location.pathname] = dateVal;
      else delete allPace[window.location.pathname];
      saveTrackPace(allPace);

      window.location.reload();
    });
  }
```

- [ ] **Step 3: Wire into `initTests()`**

In `public/assets/tests.js:1371`, right after `document.querySelectorAll('[data-learning-record]').forEach(mountLearningRecord);`, add:

```js
    document.querySelectorAll('[data-track-plan]').forEach(mountTrackPlan);
```

- [ ] **Step 4: Add the pilot markup to Software Engineer**

In `content/Pathways/software-engineer.html`, change:

```html
  <p class="nav-links"><a href="../pathways.html" class="nav-toc">← Pathways</a> <a href="../index.html" class="nav-toc">STEM+ Home →</a></p>

  <h2>The Route</h2>
```

to:

```html
  <p class="nav-links"><a href="../pathways.html" class="nav-toc">← Pathways</a> <a href="../index.html" class="nav-toc">STEM+ Home →</a></p>

  <div data-track-plan></div>

  <h2>The Route</h2>
```

- [ ] **Step 5: Verify initial render (fresh, no skip/pace set)**

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { localStorage.clear(); return { ok: true }; })()"
```
Expected: `PASS`

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { const boxes = document.querySelectorAll('[data-track-plan-course]'); const anyChecked = Array.from(boxes).some(b => b.checked); return { ok: boxes.length === 4 && !anyChecked, count: boxes.length }; })()"
```
Expected: `PASS`

- [ ] **Step 6: Verify the save flow writes both keys correctly (stub `location.reload` so the CDP session survives the click)**

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { window.location.reload = () => {}; const box = document.querySelector('[data-track-plan-course=\"Computer Programming 1\"]'); box.checked = true; document.querySelector('[data-track-plan-date]').value = '2026-12-01'; document.querySelector('[data-track-plan-save]').click(); const skipped = JSON.parse(localStorage.getItem('stemplus:skipped-courses:v1') || '[]'); const pace = JSON.parse(localStorage.getItem('stemplus:track-pace:v1') || '{}'); return { ok: skipped.indexOf('Computer Programming 1') !== -1 && pace['/Pathways/software-engineer.html'] === '2026-12-01', skipped, pace }; })()"
```
Expected: `PASS`

- [ ] **Step 7: Verify the saved plan renders correctly on a fresh navigation**

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { const box = document.querySelector('[data-track-plan-course=\"Computer Programming 1\"]'); const dateInput = document.querySelector('[data-track-plan-date]'); const status = document.querySelector('[data-track-plan-status]'); return { ok: box.checked && dateInput.value === '2026-12-01' && status.textContent.length > 0, boxChecked: box.checked, dateValue: dateInput.value, statusText: status.textContent }; })()"
```
Expected: `PASS`

- [ ] **Step 8: Verify skipping already counts toward capstone unlock on this same page**

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { const el = document.querySelector('[data-project-status]'); return { ok: el.textContent.indexOf('1/4') !== -1, text: el.textContent }; })()"
```
Expected: `PASS`

- [ ] **Step 9: Clean up test state**

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { localStorage.clear(); return { ok: true }; })()"
```
Expected: `PASS`

- [ ] **Step 10: Commit**

```bash
git add public/assets/tests.js content/Pathways/software-engineer.html
git commit -m "$(cat <<'EOF'
Add target-date pace + Customize Your Plan UI, piloted on Software Engineer

Pace is computed in courses remaining, not units — this codebase has
no reliable total-unit-count per course (a prior segment already hit
that exact trap). Save writes localStorage then reloads, matching the
only other write-then-confirm pattern in this file (mountReflection);
nothing here needs to live-recompute a different already-mounted badge.

Piloted on one page before the 10-page rollout, matching this
codebase's established piloted-then-rolled-out pattern (Phase B
canary, the FRQ grading feature).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Roll out to the remaining 10 track pages

**Files:**
- Modify: `content/Pathways/{ai-data,ai-developer-cbrwa,cloud-devops,competitive-programmer,engineering-physics,general-programmer,mathematics}.html` (7 files)
- Modify: `content/Goals/{get-ahead,challenge-myself,stronger-at-math}.html` (3 files)

**Interfaces:**
- Consumes: `mountTrackPlan` via `[data-track-plan]` (Task 2) — no code changes in this task, markup only.

- [ ] **Step 1: Add `<div data-track-plan></div>` to the 7 remaining Pathways pages**

Every one of these 7 files has the exact same nav-links line (confirmed unique per file via `grep -c`). In each of `content/Pathways/ai-data.html`, `content/Pathways/ai-developer-cbrwa.html`, `content/Pathways/cloud-devops.html`, `content/Pathways/competitive-programmer.html`, `content/Pathways/engineering-physics.html`, `content/Pathways/general-programmer.html`, `content/Pathways/mathematics.html`, change:

```html
  <p class="nav-links"><a href="../pathways.html" class="nav-toc">← Pathways</a> <a href="../index.html" class="nav-toc">STEM+ Home →</a></p>
```

to:

```html
  <p class="nav-links"><a href="../pathways.html" class="nav-toc">← Pathways</a> <a href="../index.html" class="nav-toc">STEM+ Home →</a></p>

  <div data-track-plan></div>
```

(`mathematics.html`'s ladder is split into "The Route — Part 1" / mid-pathway exam / "The Route — Part 2" — the single `data-track-plan` div still works unchanged, since `mountTrackPlan` gathers courses from every `[data-course-status]` on the page regardless of which part it's in.)

- [ ] **Step 2: Add `<div data-track-plan></div>` to the 3 Goals pages**

These 3 share a different, but likewise-unique-per-file, nav-links line. In each of `content/Goals/get-ahead.html`, `content/Goals/challenge-myself.html`, `content/Goals/stronger-at-math.html`, change:

```html
  <p class="nav-links"><a href="../new.html" class="nav-toc">← Choose a Different Goal</a> <a href="../dashboard.html" class="nav-toc">Dashboard →</a></p>
```

to:

```html
  <p class="nav-links"><a href="../new.html" class="nav-toc">← Choose a Different Goal</a> <a href="../dashboard.html" class="nav-toc">Dashboard →</a></p>

  <div data-track-plan></div>
```

Do **not** add this to `content/Goals/prepare-for-college.html` or `content/Goals/review-and-test.html` — both are pure router pages with zero `[data-course-status]` of their own (confirmed via `grep -c data-course-status`); `mountTrackPlan` would find no courses and remove its own container, so there is nothing to add there.

- [ ] **Step 3: Smoke-check the structurally different page (`mathematics.html`, two-part ladder + mid-pathway exam)**

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/mathematics.html" "(() => { const plan = document.querySelector('[data-track-plan]'); const boxes = plan ? plan.querySelectorAll('[data-track-plan-course]') : []; return { ok: !!plan && boxes.length > 0, count: boxes.length }; })()"
```
Expected: `PASS`

- [ ] **Step 4: Smoke-check one Goals page**

```bash
node scripts/verify-page.mjs "http://localhost:3000/Goals/challenge-myself.html" "(() => { const plan = document.querySelector('[data-track-plan]'); const boxes = plan ? plan.querySelectorAll('[data-track-plan-course]') : []; return { ok: !!plan && boxes.length > 0, count: boxes.length }; })()"
```
Expected: `PASS`

- [ ] **Step 5: Confirm the two router pages were correctly left alone**

```bash
node scripts/verify-page.mjs "http://localhost:3000/Goals/prepare-for-college.html" "(() => { return { ok: document.querySelector('[data-track-plan]') === null }; })()"
```
Expected: `PASS`

- [ ] **Step 6: Run the full existing regression suite**

Run: `npm test`
Expected: all 4 checks (`check-auth-session.js`, `check-password.js`, `check-content.js`, `check-content-links.js`) exit 0 — `check-content-links.js` specifically exists to catch exactly the class of mistake this task could introduce (a broken content-file reference), so this is the most load-bearing check for this task.

- [ ] **Step 7: Stop the local dev server**

Run: `kill %1` (or the job started in Task 1 Step 4)

- [ ] **Step 8: Commit**

```bash
git add content/Pathways/ai-data.html content/Pathways/ai-developer-cbrwa.html content/Pathways/cloud-devops.html content/Pathways/competitive-programmer.html content/Pathways/engineering-physics.html content/Pathways/general-programmer.html content/Pathways/mathematics.html content/Goals/get-ahead.html content/Goals/challenge-myself.html content/Goals/stronger-at-math.html
git commit -m "$(cat <<'EOF'
Roll out Customize Your Plan to the remaining 10 track pages

Same one-line <div data-track-plan></div> proven on the Software
Engineer pilot in the previous commit; mountTrackPlan reads each
page's own ladder, so no per-page JS is needed. Left the two Goals
router pages (prepare-for-college, review-and-test) untouched — they
have no course ladder of their own, so there's nothing to customize.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** skip storage/global scope (Task 1), gating fix at the single choke point (Task 1), "Skipped" badge wording (Task 1), pace storage/per-track scope (Task 2), courses-not-units pace math (Task 2), UI placement above the ladder using existing `.reflection-*` classes (Task 2), reload-not-live-rerender save (Task 2), 11-page rollout with the 2-page router exclusion explained (Task 3), `npm test` regression check (Task 3). All spec sections have a task.
- **Placeholder scan:** none — every step has real, complete code or a real, runnable command with a stated expected result.
- **Type consistency:** `loadSkippedCourses()`/`saveSkippedCourses()`/`isSkippedCourse()` and `loadTrackPace()`/`saveTrackPace()` signatures are identical everywhere they're used across Tasks 1–2; `mountTrackPlan` is the exact name registered in `initTests()` in Task 2 Step 3.
