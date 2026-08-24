# Course-Level Readiness (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Advanced+ course's own `index.html` shows its prerequisites and a plain-language readiness verdict, inside the "Where this fits" box that's already mounted there.

**Architecture:** One new hand-maintained lookup table (`PREREQUISITES`, mirroring the existing `PROBLEM_SET_SLUGS`/`APPLICATION_BY_COURSE` pattern) plus a third extension of the single existing `mountCourseContext` function in `public/assets/tests.js` — no new pages, no new markup wiring, no other function touched.

**Tech Stack:** The existing `window.STEMPlusTests` IIFE in `public/assets/tests.js`.

## Global Constraints

- Only the 5 shipped Advanced+ courses get an entry — not the 4 "Coming Soon" placeholders on `advanced.html` (they have no real `index.html`).
- No lock/gate enforcement, no "Prepare First"/"Start Anyway" buttons, no estimated-preparation time — the course stays freely clickable exactly as today; only the box's content changes.
- `mountCourseContext`'s self-removal condition must check pathway membership AND practice AND application AND prerequisites — it only removes the box when all four are absent.
- Do not modify `mountProjectMeta`, `mountRecommendedPractice`, `mountDashboard`, `mountPathwayProgress`, `mountGeneratedPlan`, or `mountPathwayRoadmap`.

---

### Task 1: `PREREQUISITES` + `mountCourseContext` extension

**Files:**
- Modify: `public/assets/tests.js`

**Interfaces:**
- Consumes: `PATHWAYS`, `PROBLEM_SET_SLUGS`, `APPLICATION_BY_COURSE`, `coursePath()`, `isCourseExamPassed()` — all pre-existing, unchanged.
- Produces: `PREREQUISITES` (new course-name-keyed object, `string[]` values) — not consumed elsewhere in this plan.

- [ ] **Step 1: Add `PREREQUISITES`**

In `public/assets/tests.js`, immediately after `APPLICATION_BY_COURSE`'s closing `};` (currently line 271, immediately before the blank line that precedes `function courseMastery(course) {`), insert:

```js

  // Transcribed from content/advanced.html's own prerequisite prose (e.g.
  // "Requires AP Calculus BC") — only the 5 shipped Advanced+ courses, not
  // the 4 "Coming Soon" placeholders with no real index.html to attach a
  // context box to. Every key and every listed value already exists in
  // COURSE_PATHS, verified against the file directly.
  var PREREQUISITES = {
    'Real Analysis A': ['AP Calculus BC'],
    'Real Analysis B': ['Real Analysis A'],
    'Advanced Algorithms': ['Computer Programming 1', 'Computer Programming 2'],
    'Linear Algebra B': ['Linear Algebra A'],
    'Topology: Fundamentals': ['Real Analysis A'],
  };
```

- [ ] **Step 2: Extend `mountCourseContext`**

Replace the current function (lines 978-1023, including its header comment):

```js
  // "Where this fits" box for a course's own index.html: <div
  // data-course-context="Exact Course Name" data-root="../"></div> — data-root
  // is the relative prefix back to the site root (matches the depth of the
  // <script src> already on that page: "../" for most courses, "../../" for
  // the ones nested under Advanced+ Courses/ or AP STEM+/). Reuses PATHWAYS,
  // the same table the Learning Record already computes readiness from, so
  // prerequisite/next/capstone claims can't drift from what's shown there.
  // Also surfaces this course's problem set (PROBLEM_SET_SLUGS) and matching
  // Application (APPLICATION_BY_COURSE), if either exists. Self-removes only
  // when there's truly nothing to show — no pathway, no practice, and no
  // application — not just when there's no pathway, so electives outside
  // every PATHWAYS entry (e.g. Linear Algebra A) still get a box when they
  // have a problem set or an Application built on them.
  function mountCourseContext(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';
    const course = el.getAttribute('data-course-context');
    const root = el.getAttribute('data-root') || '';
    const memberships = PATHWAYS.filter((p) => p.courses.indexOf(course) !== -1);
    const problemSetSlug = PROBLEM_SET_SLUGS[course];
    const application = APPLICATION_BY_COURSE[course];
    if (memberships.length === 0 && !problemSetSlug && !application) {
      el.remove();
      return;
    }
    let html = '<span class="box-label">Where this fits</span>';
    memberships.forEach((p) => {
      const idx = p.courses.indexOf(course);
      const prereq = idx > 0 ? p.courses[idx - 1] : null;
      const next = idx < p.courses.length - 1 ? p.courses[idx + 1] : null;
      let line = 'Part of the <a href="' + root + 'pathways.html">' + p.name + '</a> pathway';
      if (prereq) line += ' — builds on ' + prereq;
      if (next) {
        line += ', leads to ' + next;
      } else {
        line += '. Last course before the capstone — <a href="' + root + 'Projects/' + p.projectId + '.html">' + p.name + ' Capstone</a>';
      }
      html += '<p>' + line + '.</p>';
    });
    if (problemSetSlug) {
      html += '<p>Practice: <a href="' + root + 'problem-set.html?course=' + problemSetSlug + '">Problem Set</a></p>';
    }
    if (application) {
      html += '<p>See it in action: <a href="' + root + 'Applications/' + application.id + '.html">' + application.title + '</a></p>';
    }
    el.classList.add('box', 'why');
    el.innerHTML = html;
  }
```

with:

```js
  // "Where this fits" box for a course's own index.html: <div
  // data-course-context="Exact Course Name" data-root="../"></div> — data-root
  // is the relative prefix back to the site root (matches the depth of the
  // <script src> already on that page: "../" for most courses, "../../" for
  // the ones nested under Advanced+ Courses/ or AP STEM+/). Reuses PATHWAYS,
  // the same table the Learning Record already computes readiness from, so
  // prerequisite/next/capstone claims can't drift from what's shown there.
  // Also surfaces this course's problem set (PROBLEM_SET_SLUGS), matching
  // Application (APPLICATION_BY_COURSE), and — for Advanced+ courses —
  // its prerequisites (PREREQUISITES) with a readiness verdict computed
  // from isCourseExamPassed. Self-removes only when there's truly nothing
  // to show — no pathway, no practice, no application, and no
  // prerequisites — not just when there's no pathway, so courses outside
  // every PATHWAYS entry (e.g. Linear Algebra A, Topology: Fundamentals)
  // still get a box when any of the other three apply.
  function mountCourseContext(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';
    const course = el.getAttribute('data-course-context');
    const root = el.getAttribute('data-root') || '';
    const memberships = PATHWAYS.filter((p) => p.courses.indexOf(course) !== -1);
    const problemSetSlug = PROBLEM_SET_SLUGS[course];
    const application = APPLICATION_BY_COURSE[course];
    const prerequisites = PREREQUISITES[course] || [];
    if (memberships.length === 0 && !problemSetSlug && !application && prerequisites.length === 0) {
      el.remove();
      return;
    }
    let html = '<span class="box-label">Where this fits</span>';
    memberships.forEach((p) => {
      const idx = p.courses.indexOf(course);
      const prereq = idx > 0 ? p.courses[idx - 1] : null;
      const next = idx < p.courses.length - 1 ? p.courses[idx + 1] : null;
      let line = 'Part of the <a href="' + root + 'pathways.html">' + p.name + '</a> pathway';
      if (prereq) line += ' — builds on ' + prereq;
      if (next) {
        line += ', leads to ' + next;
      } else {
        line += '. Last course before the capstone — <a href="' + root + 'Projects/' + p.projectId + '.html">' + p.name + ' Capstone</a>';
      }
      html += '<p>' + line + '.</p>';
    });
    if (problemSetSlug) {
      html += '<p>Practice: <a href="' + root + 'problem-set.html?course=' + problemSetSlug + '">Problem Set</a></p>';
    }
    if (application) {
      html += '<p>See it in action: <a href="' + root + 'Applications/' + application.id + '.html">' + application.title + '</a></p>';
    }
    if (prerequisites.length > 0) {
      const prereqLinks = prerequisites.map((p) => {
        const dir = coursePath(p);
        const href = dir ? root + dir + '/index.html' : root + 'pathways.html';
        return '<a href="' + href + '">' + p + '</a>';
      }).join(', ');
      html += '<p>Prerequisites: ' + prereqLinks + '</p>';
      const notReady = prerequisites.filter((p) => !isCourseExamPassed(p));
      if (notReady.length === 0) {
        html += '<p>You can start now — every prerequisite exam is passed.</p>';
      } else {
        html += '<p>Review recommended — ' + notReady.join(', ') + (notReady.length === 1 ? ' isn’t' : ' aren’t') + ' passed yet.</p>';
      }
    }
    el.classList.add('box', 'why');
    el.innerHTML = html;
  }
```

- [ ] **Step 3: `npm run build`**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Verify against a production build**

```bash
npm run build && npm run start > /tmp/next-start.log 2>&1 &
```
Wait for `Ready`. These pages are login-gated (pre-existing site behavior) — use this session cookie as `scripts/verify-page.mjs`'s 3rd argument: `session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc`.

`Real Analysis A` — single prerequisite, `AP Calculus BC`. First reset to a clean baseline — clear results AND `stemplus:devmode:v1` (a separate session on this same machine used and cleared this flag already, but `isCourseExamPassed()` returns `true` unconditionally whenever it's on, which would silently mask this exact check, so don't assume it's already off):

```bash
node scripts/verify-page.mjs "http://localhost:3000/Advanced%2B%20Courses/Real%20Analysis%20A/index.html" "(() => { localStorage.removeItem('stemplus:results:v1'); localStorage.removeItem('stemplus:devmode:v1'); return { ok: true }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/Advanced%2B%20Courses/Real%20Analysis%20A/index.html" "(() => { const box = document.querySelector('[data-course-context]'); const html = box.innerHTML; return { ok: html.indexOf('Prerequisites:') !== -1 && html.indexOf('AP Calculus BC') !== -1 && html.indexOf('Review recommended') !== -1 && html.indexOf('AP Calculus BC isn’t passed yet') !== -1, html }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` — Prerequisites line present, "Review recommended" verdict naming `AP Calculus BC`.

Now seed a passed exam for `AP Calculus BC` and confirm the "ready" wording:

```bash
node scripts/verify-page.mjs "http://localhost:3000/Advanced%2B%20Courses/Real%20Analysis%20A/index.html" "(() => { localStorage.setItem('stemplus:results:v1', JSON.stringify([{ course: 'AP Calculus BC', unit: 'Unit 1', kind: 'course_exam', score: 10, total: 10, passed: true, topicBreakdown: [], takenAt: new Date().toISOString() }])); return { ok: true }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/Advanced%2B%20Courses/Real%20Analysis%20A/index.html" "(() => { const box = document.querySelector('[data-course-context]'); const html = box.innerHTML; return { ok: html.indexOf('You can start now') !== -1 && html.indexOf('Review recommended') === -1, html }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` — "You can start now," no "Review recommended" text.

`Advanced Algorithms` — two prerequisites, already has pathway + practice content from before this phase. Confirm the new Prerequisites line coexists correctly and the multi-name "aren’t" wording is right when only one of two prerequisites is missing (results already seeded above only cover `AP Calculus BC`, so both `Computer Programming 1` and `Computer Programming 2` are still unpassed — seed just one):

```bash
node scripts/verify-page.mjs "http://localhost:3000/Advanced%2B%20Courses/Advanced%20Algorithms/index.html" "(() => { localStorage.setItem('stemplus:results:v1', JSON.stringify([{ course: 'Computer Programming 1', unit: 'Unit 1', kind: 'course_exam', score: 10, total: 10, passed: true, topicBreakdown: [], takenAt: new Date().toISOString() }])); return { ok: true }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/Advanced%2B%20Courses/Advanced%20Algorithms/index.html" "(() => { const box = document.querySelector('[data-course-context]'); const html = box.innerHTML; return { ok: html.indexOf('Part of the') !== -1 && html.indexOf('Practice:') !== -1 && html.indexOf('Prerequisites:') !== -1 && html.indexOf('Computer Programming 2 isn’t passed yet') !== -1, html }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` — pathway line, Practice line, and Prerequisites line all present together, verdict names only the still-missing `Computer Programming 2`.

`Topology: Fundamentals` — zero pathway, zero practice, zero application; currently self-removes entirely. Confirm the widened self-removal condition fixes this:

```bash
node scripts/verify-page.mjs "http://localhost:3000/Advanced%2B%20Courses/Topology%20Fundamentals/index.html" "(() => { const box = document.querySelector('[data-course-context]'); if (!box) return { ok: false, reason: 'box was removed' }; const html = box.innerHTML; return { ok: html.indexOf('Part of the') === -1 && html.indexOf('Practice:') === -1 && html.indexOf('Prerequisites:') !== -1 && html.indexOf('Real Analysis A') !== -1, html }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` — box present (no self-removal), no pathway or practice lines (this course genuinely has neither), Prerequisites line naming `Real Analysis A`.

Clean up:

```bash
node scripts/verify-page.mjs "http://localhost:3000/developer.html" "(() => { localStorage.removeItem('stemplus:results:v1'); localStorage.removeItem('stemplus:devmode:v1'); return { ok: true }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```

Stop the server: `lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9`

- [ ] **Step 5: `npm test`**

Run: `npm test`
Expected: all 5 checks pass.

- [ ] **Step 6: Commit**

```bash
git add public/assets/tests.js
git commit -m "$(cat <<'EOF'
Add course-level Readiness for the 5 shipped Advanced+ courses

mountCourseContext now shows each Advanced+ course's prerequisites
(transcribed from advanced.html's own prose) and a plain-language
readiness verdict — "You can start now" or "Review recommended,"
naming whichever prerequisite course exam isn't passed yet — computed
from the same isCourseExamPassed check every other gate on the site
already uses. No lock, no buttons, no fabricated time estimate: the
course was already freely clickable and stays that way, this only
adds the guidance the vision doc's "not gatekeeping" framing called
for.

Self-removal widens once more (a third time, same recurring pattern
Phase 3 first fixed) to also check prerequisites — 3 of the 5 target
courses have no pathway, no practice, and no Application entry, so
their context box was silently disappearing entirely before this fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** `PREREQUISITES` table (Step 1, all 5 shipped courses, "Coming Soon" ones excluded per Global Constraints), Prerequisites line + readiness verdict appended to the box (Step 2), widened self-removal condition (Step 2, explicitly tested by the `Topology: Fundamentals` regression check in Step 4), coexistence with pre-existing pathway/Practice lines (Step 4's `Advanced Algorithms` check), no lock/buttons/time-estimate (Step 2's code has none — only two `<p>` lines added). All spec sections covered.
- **Placeholder scan:** none — every step has complete code or a runnable command with a stated expected result.
- **Type consistency:** `PREREQUISITES[course]` returns `string[]`, used consistently in the new `.map()`/`.filter()` calls. `coursePath()` and `isCourseExamPassed()` are called with the same signatures they already have everywhere else in this file — no new parameter shapes introduced.
