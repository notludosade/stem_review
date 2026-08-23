# Course Context: Practice + Applications (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every course's own `index.html` page links to its matching problem set and any Application built on it, inside the "Where this fits" box that already renders there.

**Architecture:** One new hand-maintained lookup table (`APPLICATION_BY_COURSE`, mirroring the existing `PROBLEM_SET_SLUGS` pattern) plus an extension of the single existing `mountCourseContext` function in `public/assets/tests.js` — no new pages, no new markup wiring, no other function touched.

**Tech Stack:** The existing `window.STEMPlusTests` IIFE in `public/assets/tests.js`.

## Global Constraints

- Scope is courses only — do not touch Project pages, lesson pages, or `applications.html`.
- Do not modify `mountProjectMeta`, `mountRecommendedPractice`, `mountDashboard`, `mountPathwayProgress`, or `mountGeneratedPlan`.
- `mountCourseContext`'s self-removal condition must check pathway membership AND practice AND application — it only removes the box when all three are absent, not just when pathway membership is absent.
- No `encodeURIComponent` on problem-set slugs — match the sibling `mountRecommendedPractice` function's existing unencoded style (slugs are already `/^[a-z0-9-]+$/`, so encoding is a no-op either way).

---

### Task 1: `APPLICATION_BY_COURSE` + `mountCourseContext` extension

**Files:**
- Modify: `public/assets/tests.js`

**Interfaces:**
- Consumes: `PATHWAYS` (existing array), `PROBLEM_SET_SLUGS` (existing course-name-keyed object).
- Produces: `APPLICATION_BY_COURSE` (new course-name-keyed object, `{id, title}` values) — not consumed elsewhere in this plan, but available for any later phase.

- [ ] **Step 1: Add `APPLICATION_BY_COURSE`**

In `public/assets/tests.js`, immediately after the `PROBLEM_SET_SLUGS` object's closing `};` (currently line 254, immediately before the blank line that precedes `function courseMastery(course) {`), insert:

```js

  // Reverse of each Application page's own "Goes deeper in" link (one
  // course per Application, verified against content/Applications/*.html —
  // all 9 pages, one entry each). Lets a course's own index.html show which
  // Application, if any, was built on it — mirrors PROBLEM_SET_SLUGS' shape
  // and lookup pattern exactly.
  var APPLICATION_BY_COURSE = {
    'Data Handling CB': { id: 'ab-testing-a-feature-launch', title: 'A/B Testing a Feature Launch' },
    'Computer Programming Ethics': { id: 'bias-in-a-hiring-algorithm', title: 'Bias in a Hiring Algorithm' },
    'AP Physics 1': { id: 'designing-a-roller-coaster-safely', title: 'Designing a Roller Coaster Safely' },
    'Linear Algebra A': { id: 'how-recommendation-engines-work', title: 'How Recommendation Engines Work' },
    'AP Physics C: Mechanics': { id: 'keeping-a-satellite-in-orbit', title: 'Keeping a Satellite in Orbit' },
    'Differential Equations': { id: 'modeling-an-epidemic', title: 'Modeling an Epidemic' },
    'Discrete Math': { id: 'route-planning-like-gps', title: 'Route Planning Like GPS' },
    'Cloud Computing A': { id: 'scaling-a-viral-app', title: 'Scaling a Viral App Overnight' },
    'Computer Networking Fundamentals': { id: 'why-your-video-call-freezes', title: 'Why Your Video Call Freezes' },
  };
```

- [ ] **Step 2: Extend `mountCourseContext`**

Replace the current function (`public/assets/tests.js`, currently lines 960-990 including its header comment):

```js
  // "Where this fits" box for a course's own index.html: <div
  // data-course-context="Exact Course Name" data-root="../"></div> — data-root
  // is the relative prefix back to the site root (matches the depth of the
  // <script src> already on that page: "../" for most courses, "../../" for
  // the ones nested under Advanced+ Courses/ or AP STEM+/). Reuses PATHWAYS,
  // the same table the Learning Record already computes readiness from, so
  // prerequisite/next/capstone claims can't drift from what's shown there.
  function mountCourseContext(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';
    const course = el.getAttribute('data-course-context');
    const root = el.getAttribute('data-root') || '';
    const memberships = PATHWAYS.filter((p) => p.courses.indexOf(course) !== -1);
    if (memberships.length === 0) {
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

- [ ] **Step 3: `npm run build`**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Verify against a production build**

```bash
npm run build && npm run start > /tmp/next-start.log 2>&1 &
```
Wait for `Ready` in `/tmp/next-start.log`. These pages are login-gated (pre-existing site behavior, unrelated to this work) — use this session cookie as `scripts/verify-page.mjs`'s 3rd argument: `session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc`.

Pathway-member course with both practice and application (`AP Physics 1`):

```bash
node scripts/verify-page.mjs "http://localhost:3000/AP%20Physics%201/index.html" "(() => { const box = document.querySelector('[data-course-context]'); const html = box.innerHTML; return { ok: html.indexOf('Part of the') !== -1 && html.indexOf('Practice:') !== -1 && html.indexOf('problem-set.html?course=ap-physics-1') !== -1 && html.indexOf('See it in action:') !== -1 && html.indexOf('Designing a Roller Coaster Safely') !== -1, html }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` — pathway paragraph, Practice link, and Applications link all present.

Elective with no pathway but with practice+application (`Linear Algebra A`) — regression check that the box no longer self-removes:

```bash
node scripts/verify-page.mjs "http://localhost:3000/Linear%20Algebra%20A/index.html" "(() => { const box = document.querySelector('[data-course-context]'); if (!box) return { ok: false, reason: 'box was removed' }; const html = box.innerHTML; return { ok: html.indexOf('Part of the') === -1 && html.indexOf('Practice:') !== -1 && html.indexOf('problem-set.html?course=linear-algebra-a') !== -1 && html.indexOf('How Recommendation Engines Work') !== -1, html }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` — no pathway paragraph (this course is in no `PATHWAYS` entry), but the box still renders with Practice + Applications lines.

Pathway-member course with neither practice nor application (`Software Engineering` — confirm no empty lines render):

```bash
node scripts/verify-page.mjs "http://localhost:3000/Software%20Engineering/index.html" "(() => { const box = document.querySelector('[data-course-context]'); const html = box.innerHTML; return { ok: html.indexOf('Part of the') !== -1 && html.indexOf('Practice:') === -1 && html.indexOf('See it in action:') === -1, html }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` — pathway paragraph only, no Practice or Applications lines.

Stop the server: `lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9`

- [ ] **Step 5: `npm test`**

Run: `npm test`
Expected: all 5 checks pass.

- [ ] **Step 6: Commit**

```bash
git add public/assets/tests.js
git commit -m "$(cat <<'EOF'
Add Practice + Applications links to every course's context box

mountCourseContext already told a student which pathway a course
belongs to; it now also links to that course's problem set and any
Application built on it, using the same lookup-table pattern as the
existing PROBLEM_SET_SLUGS table. Self-removal now checks all three
sources instead of just pathway membership, so electives outside every
PATHWAYS entry (Linear Algebra A, Differential Equations, Discrete
Math, AP Physics C: Mechanics) stop losing the box entirely — 4 of the
9 Applications' source courses were silently unreachable from their
own course page before this fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** `APPLICATION_BY_COURSE` table (Step 1), Practice + Applications lines appended to the box (Step 2), widened self-removal condition (Step 2, explicitly tested by the `Linear Algebra A` regression check in Step 4), no-empty-lines case for courses with neither (Step 4's `Software Engineering` check), no other function touched (Global Constraints, confirmed — the diff is one insertion + one function replacement, both in the same file). All spec sections have coverage.
- **Placeholder scan:** none — every step has complete code or a runnable command with a stated expected result.
- **Type consistency:** `APPLICATION_BY_COURSE[course]` returns `{id, title}` — used consistently in `mountCourseContext`'s new lines (`application.id`, `application.title`). `PROBLEM_SET_SLUGS[course]` returns a string, used directly in the URL, matching its existing type from `mountRecommendedPractice`'s usage elsewhere in the same file.
