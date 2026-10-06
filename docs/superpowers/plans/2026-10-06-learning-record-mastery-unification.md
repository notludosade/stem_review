# Learning Record / Mastery Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Learning Record's "Mastery by Course" figure agree with the skill-state mastery engine (`public/assets/mastery.js`) that already drives diagnostics, Applications, and the dashboard — it currently computes its own, different number — plus three small, unrelated technical-cleanup items bundled into this plan since they were found during the same repo audit and are each trivial.

**Architecture:** Add one small, Node-testable function to `mastery.js` (`courseReadiness`) that rolls a course's skills up to a ready/total/percent figure, exactly like the existing `readiness()` does for a Pathway's courses. Wire `public/assets/tests.js`'s `mountLearningRecord` to call it (via `window.STEMPlusMastery`, loaded with a new `<script>` tag on the page) instead of its own topic-accuracy average, falling back to "—" for any course the skill catalog doesn't recognize rather than ever showing a number from the old, inconsistent computation. The other three tasks (dead file, stale manifest fields, missing error handling) are unrelated one-file cleanups folded in as one bundled task.

**Tech Stack:** Plain browser JS (`public/assets/*.js`, dual Node/browser `module.exports` pattern already established in `mastery.js`), Node's built-in `assert` for tests (`scripts/check-*.js`, run via `npm test`), Next.js/TypeScript for the `pages/[[...slug]].tsx` cleanup.

## Global Constraints

- `mastery.js` skill IDs and the overall module shape (`STATES`, `LABELS`, `computeMastery`, `readiness`, `nextStep`, `reviewList`) must not change — only add to `window.STEMPlusMastery`'s and `module.exports`'s export lists, never remove or rename existing entries (other pages depend on the exact current set).
- Do not touch `courseMastery()`/`buildReport()`/`masteryForProblemSet()` in `tests.js` — `masteryForProblemSet` (the Problem Sets "Recommended Practice" ranking) is a separate, self-consistent use of topic accuracy and is explicitly out of scope; only `mountLearningRecord`'s own per-course percent changes.
- Course name strings must match exactly between `public/assets/tests.js`'s `COURSE_PATHS` keys (what `results`/`skippedCourses` use) and `public/assets/skill-catalog.json`'s `skill.course` field (e.g. `"AP Physics C: Electricity and Magnetism"`, colon, not the folder name `AP Physics C Electricity and Magnetism`) — confirmed identical today; do not normalize or rewrite either side.
- Learning Record must keep working with no account (per its own footer: "progress lives in this browser only, no account required") — do not gate the new mastery lookup behind `window.STEMPlusAccount`/`account.ready` the way the dashboard's mastery summary does.
- `npm test` must keep passing in full (it currently chains 24 `node scripts/check-*.js` scripts — run the whole `npm test`, not just the one script you added to, before calling any task done).
- No visual/browser test runner exists in this repo; manual verification of `mountLearningRecord` (Task 2) requires driving a real browser against a built/served page — use the documented raw-CDP-against-headless-Chrome approach (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --remote-debugging-port=<port> --user-data-dir=<scratch dir>`, then drive it over the DevTools Protocol with Node's built-in `fetch`/`WebSocket` — no npm install, none is available in this environment). Serve the real page via `npm run build && npm run start` (this site runs through Next.js, not a plain static server) before connecting.
- `content/updates/update-beta-v2.0.1.html` was flagged during this plan's scoping audit as a possible dead file. It was checked and is genuinely linked from `content/about.html` (a changelog entry) — not dead. No task in this plan touches it; this line exists so that absence doesn't read as an oversight.

---

### Task 1: Add `courseReadiness` to mastery.js

**Files:**
- Modify: `public/assets/mastery.js:87-92` (insert new function right after `readiness`)
- Modify: `public/assets/mastery.js:131-134` (Node `module.exports`)
- Modify: `public/assets/mastery.js:197` (`window.STEMPlusMastery`)
- Modify: `scripts/check-mastery.js` (append new assertions)

**Interfaces:**
- Consumes: `catalog` (the parsed `skill-catalog.json` object, `{skills: [{id, course, unit, ...}], ...}`), `mastery` (the object `computeMastery(catalog, evidence)` returns: `{[skillId]: {state, ...}}`), `course` (a plain string, exactly matching a `skill.course` value, e.g. `"Precalculus"`).
- Produces: `courseReadiness(catalog, mastery, course)` → `{ready: number, total: number, percent: number}` — `total` is the count of skills in the catalog whose `course` field equals the given string (0 if the course isn't in the catalog at all); `ready` is how many of those are at `proficient` or above; `percent` is `0` when `total` is `0` (never divide by zero). Task 2 relies on exactly this shape and on `total === 0` meaning "unknown course."

- [ ] **Step 1: Write the failing test**

Open `scripts/check-mastery.js`. Find the line near the top that destructures the module:

```js
const { computeMastery, readiness, nextStep, reviewList, STATES } = require('../public/assets/mastery.js');
```

Change it to also pull in the function you're about to add:

```js
const { computeMastery, readiness, courseReadiness, nextStep, reviewList, STATES } = require('../public/assets/mastery.js');
```

Then append this block at the very end of the file (after the existing `console.log('check-mastery: OK (${catalog.skills.length} skills)');` line — put the new assertions *before* that line, since it must stay the last line so the script's pass/fail signal stays visible):

```js
// courseReadiness: same rule as readiness(), scoped to one course by name
// instead of a pathway's course list.
const blankPrecalc = courseReadiness(catalog, blank, 'Precalculus');
assert.deepStrictEqual(blankPrecalc, { ready: 0, total: 6, percent: 0 });

const onePassed = computeMastery(catalog, { ...empty, results: [unitTest('Unit 1', 9, true)] });
const onePassedPrecalc = courseReadiness(catalog, onePassed, 'Precalculus');
assert.deepStrictEqual(onePassedPrecalc, { ready: 1, total: 6, percent: 17 });

// Unknown course name: total 0, never a divide-by-zero NaN.
const unknown = courseReadiness(catalog, blank, 'Not A Real Course');
assert.deepStrictEqual(unknown, { ready: 0, total: 0, percent: 0 });

// Matches readiness() exactly when given a one-course "pathway."
const viaReadiness = readiness(catalog, onePassed, { courses: ['Precalculus'] });
assert.deepStrictEqual(courseReadiness(catalog, onePassed, 'Precalculus'), viaReadiness);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-mastery.js`
Expected: `TypeError: courseReadiness is not a function` (it's `undefined` from the destructure, since it doesn't exist yet).

- [ ] **Step 3: Write the implementation**

In `public/assets/mastery.js`, find:

```js
  // A Pathway's readiness: its skills at Proficient or above, over all of them.
  function readiness(catalog, mastery, pathway) {
    const skills = catalog.skills.filter((skill) => pathway.courses.includes(skill.course));
    const ready = skills.filter((skill) => STATES.indexOf(mastery[skill.id].state) >= STATES.indexOf('proficient')).length;
    return { ready, total: skills.length, percent: skills.length ? Math.round(ready * 100 / skills.length) : 0 };
  }
```

Immediately after it, add:

```js
  // A single course's readiness, by name — same rule as readiness() above,
  // scoped to one course instead of a pathway's course list. Used by the
  // Learning Record so its per-course figure agrees with the mastery states
  // every other mastery-aware page already shows (diagnostics, Applications,
  // the dashboard), instead of computing its own separate number.
  function courseReadiness(catalog, mastery, course) {
    return readiness(catalog, mastery, { courses: [course] });
  }
```

Then find the Node export block:

```js
  if (typeof module === 'object' && module.exports) {
    module.exports = { STATES, LABELS, computeMastery, readiness, nextStep, reviewList };
    return;
  }
```

Change it to:

```js
  if (typeof module === 'object' && module.exports) {
    module.exports = { STATES, LABELS, computeMastery, readiness, courseReadiness, nextStep, reviewList };
    return;
  }
```

Then find the browser export:

```js
  // For the diagnostic page (assets/diagnostic.js).
  window.STEMPlusMastery = { STATES, LABELS, computeMastery, readiness, studentEvidence, loadCatalog, courseHref };
```

Change it to:

```js
  // For the diagnostic page (assets/diagnostic.js) and the Learning Record
  // (assets/tests.js's mountLearningRecord).
  window.STEMPlusMastery = { STATES, LABELS, computeMastery, readiness, courseReadiness, studentEvidence, loadCatalog, courseHref };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-mastery.js`
Expected: `check-mastery: OK (291 skills)` (the skill count printed will match whatever `catalog.skills.length` actually is — 291 as of this plan being written; if the catalog has grown since, a different but still-nonzero number is fine, don't treat that as a failure).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all 24 chained checks pass, ending in the final script's own OK line.

- [ ] **Step 6: Commit**

```bash
git add public/assets/mastery.js scripts/check-mastery.js
git commit -m "Add courseReadiness to mastery.js for per-course mastery rollups"
```

---

### Task 2: Wire the Learning Record to courseReadiness

**Files:**
- Modify: `content/learning-record.html:5` (add a script tag)
- Modify: `public/assets/tests.js:1927-2009` (`mountLearningRecord`)

**Interfaces:**
- Consumes: `window.STEMPlusMastery.{loadCatalog, studentEvidence, computeMastery, courseReadiness}` (Task 1's new export; the other three already existed). `courseReadiness(catalog, mastery, course).total === 0` is how this task tells "course not in the catalog" from "in the catalog but at 0%."
- Produces: no new exports — `mountLearningRecord` stays a private function in `tests.js`'s closure, called the same way it already is (`document.querySelectorAll('[data-learning-record]').forEach(mountLearningRecord)`, unchanged).

- [ ] **Step 1: Add the script tag**

In `content/learning-record.html`, find:

```html
<script src="assets/tests.js" defer></script>
```

Change it to (matching the order already used on `content/index.html`, the only other page that loads both):

```html
<script src="assets/tests.js" defer></script>
<script src="assets/mastery.js" defer></script>
```

- [ ] **Step 2: Replace mountLearningRecord's mastery lookup**

In `public/assets/tests.js`, find the full current function:

```js
  function mountLearningRecord(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';

    const results = loadResults();
    const projectData = loadProjectData();
    const skippedCourses = loadSkippedCourses();

    if (results.length === 0 && Object.keys(projectData).length === 0 && skippedCourses.length === 0) {
      el.innerHTML = '<p class="toc-empty">Nothing recorded in this browser yet. <a href="new.html">Choose a goal</a> to get started.</p>';
      return;
    }

    const courseNames = [];
    results.forEach((r) => { if (courseNames.indexOf(r.course) === -1) courseNames.push(r.course); });
    skippedCourses.forEach((c) => { if (courseNames.indexOf(c) === -1) courseNames.push(c); });
    const reports = courseNames.map((course) => ({ course, report: buildReport(course), mastery: courseMastery(course) }));
```

Replace just that last line (`const reports = ...`) and everything from `mountLearningRecord`'s opening through it with:

```js
  // Per-course mastery %, sourced from the same skill-state engine
  // (mastery.js) that drives diagnostics, Applications, and the dashboard —
  // not this file's own topic-accuracy average (courseMastery), so the
  // Learning Record agrees with the rest of the site about how a student is
  // doing. A course mastery.js doesn't recognize (courseReadiness's `total`
  // is 0) renders as "—", same as courseMastery's own null case — never
  // falls back to the old, differently-computed number. Works with no
  // account: mastery.js's data comes straight from localStorage, the same
  // place courseMastery already reads from.
  function getCourseMasteryPercents(courseNames) {
    const unknown = () => Object.fromEntries(courseNames.map((course) => [course, null]));
    if (!window.STEMPlusMastery) return Promise.resolve(unknown());
    const m = window.STEMPlusMastery;
    return m.loadCatalog()
      .then((catalog) => m.studentEvidence(catalog).then((evidence) => {
        const mastery = m.computeMastery(catalog, evidence);
        return Object.fromEntries(courseNames.map((course) => {
          const r = m.courseReadiness(catalog, mastery, course);
          return [course, r.total > 0 ? r.percent : null];
        }));
      }))
      .catch(() => unknown());
  }

  function mountLearningRecord(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';

    const results = loadResults();
    const projectData = loadProjectData();
    const skippedCourses = loadSkippedCourses();

    if (results.length === 0 && Object.keys(projectData).length === 0 && skippedCourses.length === 0) {
      el.innerHTML = '<p class="toc-empty">Nothing recorded in this browser yet. <a href="new.html">Choose a goal</a> to get started.</p>';
      return;
    }

    const courseNames = [];
    results.forEach((r) => { if (courseNames.indexOf(r.course) === -1) courseNames.push(r.course); });
    skippedCourses.forEach((c) => { if (courseNames.indexOf(c) === -1) courseNames.push(c); });

    getCourseMasteryPercents(courseNames).then((masteryPercents) => {
      const reports = courseNames.map((course) => ({ course, report: buildReport(course), mastery: masteryPercents[course] }));
```

The rest of the function's body (everything from `const coursesCompleted = ...` onward) is unchanged logic, now living one level deeper inside the `.then((masteryPercents) => { ... })` callback you just opened, with matching indentation and one added closing `});`. The complete function, end to end, after this step:

```js
  function mountLearningRecord(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';

    const results = loadResults();
    const projectData = loadProjectData();
    const skippedCourses = loadSkippedCourses();

    if (results.length === 0 && Object.keys(projectData).length === 0 && skippedCourses.length === 0) {
      el.innerHTML = '<p class="toc-empty">Nothing recorded in this browser yet. <a href="new.html">Choose a goal</a> to get started.</p>';
      return;
    }

    const courseNames = [];
    results.forEach((r) => { if (courseNames.indexOf(r.course) === -1) courseNames.push(r.course); });
    skippedCourses.forEach((c) => { if (courseNames.indexOf(c) === -1) courseNames.push(c); });

    getCourseMasteryPercents(courseNames).then((masteryPercents) => {
      const reports = courseNames.map((course) => ({ course, report: buildReport(course), mastery: masteryPercents[course] }));

      const coursesCompleted = reports.filter((r) => isCourseExamPassed(r.course)).length;
      const unitTestsPassed = reports.reduce((sum, r) => sum + Object.keys(r.report.units).filter((u) => r.report.units[u].cleared).length, 0);
      const questionsAnswered = results.reduce((sum, r) => sum + (r.topicBreakdown || []).length, 0);
      const projectsCompleted = Object.keys(projectData).filter((id) => projectData[id].complete).length;

      let html = '';

      html += '<div class="toc-list">';
      [
        ['Courses Completed', coursesCompleted],
        ['Unit Tests Passed', unitTestsPassed],
        ['Questions Answered', questionsAnswered],
        ['Projects Completed', projectsCompleted],
      ].forEach((stat) => {
        html += '<div class="toc-item"><span class="toc-num">' + stat[1] + '</span><p class="toc-title">' + stat[0] + '</p></div>';
      });
      html += '</div>';

      html += '<h2>Mastery by Course</h2>';
      if (reports.length > 0) {
        html += '<div class="toc-list">';
        reports.forEach((r) => {
          const dir = coursePath(r.course);
          const href = dir ? dir + '/progress-report.html' : 'pathways.html';
          const skipped = !isDevMode() && isSkippedCourse(r.course);
          const label = skipped ? 'Skipped' : (isCourseExamPassed(r.course) ? 'Completed' : 'In progress');
          html += '<a class="toc-item" href="' + href + '"><span class="toc-num">' + (r.mastery != null ? r.mastery + '%' : '—') + '</span>'
            + '<p class="toc-title">' + r.course + '</p><p class="toc-sub">' + label + '</p></a>';
        });
        html += '</div>';
      } else {
        html += '<p class="toc-empty">No graded work yet.</p>';
      }

      const pathwayStatus = PATHWAYS.map((p) => {
        const passedCount = p.courses.filter((c) => isCourseExamPassed(c)).length;
        return { name: p.name, projectId: p.projectId, passedCount, total: p.courses.length };
      });
      const ready = pathwayStatus.filter((p) => p.passedCount === p.total && !isProjectComplete(p.projectId));
      const almostReady = pathwayStatus.filter((p) => p.passedCount > 0 && p.total - p.passedCount === 1);

      html += '<h2>What You’re Ready For</h2>';
      if (ready.length > 0) {
        html += '<div class="toc-list">';
        ready.forEach((p) => {
          html += '<a class="toc-item" href="Projects/' + p.projectId + '.html"><span class="toc-num">✓ Unlocked</span>'
            + '<p class="toc-title">' + p.name + ' Capstone</p><p class="toc-sub">Every required course exam passed.</p></a>';
        });
        html += '</div>';
      } else {
        html += '<p class="toc-empty">No capstone is fully unlocked yet.</p>';
      }

      if (almostReady.length > 0) {
        html += '<h3>Almost Ready</h3><div class="toc-list">';
        almostReady.forEach((p) => {
          const missing = PATHWAYS.find((x) => x.name === p.name).courses.find((c) => !isCourseExamPassed(c));
          html += '<a class="toc-item" href="pathways.html"><span class="toc-num">○ ' + p.passedCount + '/' + p.total + '</span>'
            + '<p class="toc-title">' + p.name + '</p><p class="toc-sub">Recommended next: ' + missing + '</p></a>';
        });
        html += '</div>';
      }

      el.innerHTML = html;
    });
  }
```

Every line from `const coursesCompleted = ...` through `el.innerHTML = html;` is byte-for-byte identical to the original function's logic — only its indentation changed (one level deeper, inside the new `.then()` callback) and the trailing `});` was added. Replace the entire original `mountLearningRecord` function (the one you found in the previous step) with this, plus the `getCourseMasteryPercents` helper placed immediately before it, as shown in the previous step's code block.

- [ ] **Step 3: Run the automated suite**

Run: `npm test`
Expected: all pass — nothing here is Node-testable (tests.js has no `module.exports`), so this just confirms you haven't broken anything else (e.g. a stray syntax error would fail Next's build in Step 4, not this).

- [ ] **Step 4: Build and serve the site**

```bash
npm run build && npm run start &
```

Wait for `- Local: http://localhost:3000` in the output before continuing.

- [ ] **Step 5: Manually verify in headless Chrome**

```bash
mkdir -p /tmp/stemplus-chrome-profile
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9333 --user-data-dir=/tmp/stemplus-chrome-profile about:blank &
sleep 2
curl -s http://localhost:9333/json/version
```

Expected: a JSON response with a `webSocketDebuggerUrl` field (confirms Chrome is up and reachable).

Then, in a Node script (no npm packages — use only `fetch` and the global `WebSocket`, both built into this Node version), open `http://localhost:3000/learning-record.html`, use `Runtime.evaluate` to:
1. First seed localStorage *before* the page's own scripts run their mount (navigate once to set storage, since `mountLearningRecord` is idempotent-guarded by `data-mounted` and won't re-run on a plain reload of the same loaded page — reload the page, or navigate to it fresh, after setting storage):
   ```js
   localStorage.setItem('stemplus:results:v1', JSON.stringify([
     { course: 'Precalculus', unit: 'Unit 1', kind: 'unit_test', version: 'a', score: 9, total: 10, passed: true, topicBreakdown: [], takenAt: new Date().toISOString() }
   ]));
   ```
2. Navigate to `/learning-record.html` (fresh navigation, so the script runs with that localStorage already present).
3. Wait ~1-2 seconds for the async mastery lookup to resolve (the element starts with "Loading your record…" — poll until that text is gone, or just wait a fixed 1500ms, matching the pattern used elsewhere in this session's manual verifications).
4. Read `document.querySelector('[data-learning-record]').innerHTML` (or query the specific `.toc-item` whose `.toc-title` text is `"Precalculus"`) and confirm its `.toc-num` text is `"17%"` — not `"—"`, not a different number, and not still showing "Loading your record…".

Expected: the Precalculus row shows `17%`, matching Task 1's `onePassedPrecalc` assertion for the identical evidence (`ready: 1, total: 6, percent: 17`) — confirming the wiring actually reaches `courseReadiness` end to end, not just that the Node-level math is right.

- [ ] **Step 6: Clean up the manual test processes**

```bash
pkill -f "remote-debugging-port=9333"
pkill -f "next start"
```

- [ ] **Step 7: Commit**

```bash
git add content/learning-record.html public/assets/tests.js
git commit -m "Wire Learning Record's per-course mastery to the shared mastery engine"
```

---

### Task 3: Small technical cleanups

**Files:**
- Delete: `components/ui/button.tsx`
- Modify: `package.json`
- Modify: `pages/[[...slug]].tsx:42-43`

**Interfaces:**
- None — all three changes are self-contained and touch nothing any other task in this plan relies on.

- [ ] **Step 1: Remove the unused Button component**

Confirm it's genuinely unused before deleting (this was last verified during this plan's own audit, but re-verify since time may have passed):

```bash
grep -rl "components/ui/button\|from '@/components/ui/button'" --include="*.tsx" --include="*.ts" . | grep -v node_modules
```

Expected: no output (or only `components/ui/button.tsx` itself, from its own internal `cn`/type references — not an external import).

```bash
rm "components/ui/button.tsx"
rmdir components/ui 2>/dev/null || true
```

(The `rmdir` only succeeds if the directory is now empty; `|| true` keeps the step from failing if there's something else in there — check `ls components/ui 2>&1` first if you want to be sure before relying on the `|| true`.)

Then remove its two now-orphaned dependencies from `package.json`'s `"dependencies"` block — confirmed used only by the file just deleted:

```bash
grep -rn "class-variance-authority\|@base-ui/react" --include="*.tsx" --include="*.ts" . | grep -v node_modules
```

Expected: no output. Then edit `package.json`, removing these two lines from `"dependencies"`:

```json
    "@base-ui/react": "^1.6.0",
```
```json
    "class-variance-authority": "^0.7.1",
```

Leave `"lucide-react"` alone — `components/Layout.tsx` imports from it too (`import { ChevronDown } from 'lucide-react';`), confirmed still needed.

- [ ] **Step 2: Fix package.json's stale manifest fields**

In `package.json`, find:

```json
  "name": "google-oauth-accounts",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
```

Change to:

```json
  "name": "stemplus",
  "version": "1.0.0",
  "description": "",
  "main": "next.config.js",
```

(`"name"` predates the current email/password auth system — the site was never actually named this. `"main"` pointed at a file that doesn't exist in this repo; `next.config.js` is the real entry point Next.js itself reads.)

- [ ] **Step 3: Add error handling to the content-file read**

In `pages/[[...slug]].tsx`, find:

```ts
  const html = fs.readFileSync(filePath, 'utf8');
```

Change to:

```ts
  let html: string;
  try {
    html = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read content file "${filePath}" for route "/${fileName}": ${(err as Error).message}`);
  }
```

- [ ] **Step 4: Run the full suite and build**

```bash
npm test && npm run build
```

Expected: `npm test` passes all 24 checks; `npm run build` compiles cleanly with no TypeScript errors and the same route list as before (`/[[...slug]]`, `/404`, four `/api/auth/*` + `/api/me` routes, same as any prior successful build).

- [ ] **Step 5: Commit**

```bash
git add components/ui package.json "pages/[[...slug]].tsx"
git commit -m "Remove unused Button component, fix stale package.json fields, add content-read error handling"
```

---
