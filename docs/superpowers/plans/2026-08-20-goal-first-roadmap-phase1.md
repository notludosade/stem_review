# Goal-First Entry + Roadmap Visual (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give STEM+ one coherent goal-first front door (`new.html`, 4 categories replacing 8 disconnected cards) and turn the AI-generated plan's course list into a connected "you are here" roadmap visual instead of a flat card grid.

**Architecture:** Pure content/presentation reshape over infrastructure that already exists — the AI plan generator, `pathways.html`, `projects.html`, and the individual Goals pages are all untouched. Task 1 restructures `new.html`'s markup only. Task 2 adds new CSS classes and rewrites how `mountGeneratedPlan` builds its Courses/Project HTML — the function's data inputs (`plan.courses`, `plan.project`) and every helper it already calls (`coursePath`, `isCourseExamPassed`, `isProjectComplete`, `PATHWAYS`, `mountProjectStatus`) are unchanged.

**Tech Stack:** Static HTML content files, vanilla JS (`public/assets/tests.js`'s existing IIFE), plain CSS custom properties (no new variables, no new dependencies).

## Global Constraints

- No changes to `lib/anthropic.js`, `pages/api/generate-plan.js`, `lib/plan-catalog.js`, or `isPlanFinished` — the AI generation pipeline and its data shape are unchanged.
- No real branching in the roadmap visual (parallel tracks). The AI still returns one ordered course array; only its rendering changes.
- `Goals/prepare-for-college.html` stays on disk but gets no link from `new.html` (fully redundant with "Pursue a Field" → `pathways.html`, a superset).
- New CSS reuses only existing custom properties (`--border`, `--correct`, `--correct-soft`, `--accent`, `--bg`, `--text`, `--muted`) — no new variables.
- Spec: `docs/superpowers/specs/2026-08-20-goal-first-roadmap-phase1-design.md`.

---

### Task 1: `new.html` restructure — 4-category front door

**Files:**
- Modify: `content/new.html`

**Interfaces:**
- Consumes: nothing new — `data-generate-plan` and its inner markup (`mountGeneratePlan`'s contract, already built) are carried over unchanged, just relocated to sit under an `id="explore"` heading.
- Produces: nothing new for other tasks to consume — this task is self-contained.

- [ ] **Step 1: Replace the page body**

In `content/new.html`, replace everything from the line `  <p class="subtitle">Trying the new STEM+ experience.` (currently line 7) through the closing `</div>` (currently line 76) — i.e., everything inside `<div class="page">` — with:

```html
  <span class="kicker">STEM+</span>
  <h1>Where do you want STEM to take you?</h1>
  <p class="subtitle">Tell STEM+ where you're headed. We'll map what to learn, what to practice, what to build, and what to do next — using the real courses, pathways, and projects already on this site.</p>

  <div class="toc-list">
    <a class="toc-item" href="Goals/get-ahead.html">
      <span class="toc-num">Get Ahead</span>
      <p class="toc-title">Get Ahead in School</p>
      <p class="toc-sub">Work ahead of your current class — algebra through calculus, at your own pace.</p>
    </a>
    <a class="toc-item" href="pathways.html">
      <span class="toc-num">Pursue a Field</span>
      <p class="toc-title">AI · Engineering · Math · Software</p>
      <p class="toc-sub">8 multi-course pathways, each ending in a real capstone project.</p>
    </a>
    <a class="toc-item" href="projects.html">
      <span class="toc-num">Build Something</span>
      <p class="toc-title">Start with a Project</p>
      <p class="toc-sub">Pick something you want to build. See exactly which courses you need to actually build it.</p>
    </a>
    <a class="toc-item" href="#explore">
      <span class="toc-num">Explore</span>
      <p class="toc-title">Describe Your Own Goal</p>
      <p class="toc-sub">Not sure yet? Describe what you're curious about and we'll build a plan from it.</p>
    </a>
  </div>

  <h2 id="explore">Describe Your Own Goal</h2>
  <p class="subtitle">Not seeing what you want above? Describe it, and we'll build a plan from the real courses, projects, and problem sets in STEM+.</p>
  <div data-generate-plan>
    <textarea class="reflection-textarea" data-generate-plan-input placeholder="e.g. I want to build robots that use computer vision"></textarea>
    <p class="nav-links">
      <button type="button" class="widget-btn" data-generate-plan-submit>Generate My Plan</button>
    </p>
    <p data-generate-plan-status class="reflection-status"></p>
  </div>

  <h2>More Specific Starting Points</h2>
  <p class="subtitle">A few curated routes that don't fit neatly into the four categories above.</p>
  <div class="toc-list">
    <a class="toc-item" href="Goals/stronger-at-math.html">
      <span class="toc-num">Goal</span>
      <p class="toc-title">Become Stronger at Math</p>
      <p class="toc-sub">Logic, proof-writing, and linear algebra — real mathematical strength, not just a faster class.</p>
    </a>
    <a class="toc-item" href="Goals/challenge-myself.html">
      <span class="toc-num">Goal</span>
      <p class="toc-title">Challenge Myself</p>
      <p class="toc-sub">Real Analysis, Advanced Algorithms — the most rigorous track on the site.</p>
    </a>
    <a class="toc-item" data-category="problem-sets" href="Goals/review-and-test.html">
      <span class="toc-num">Goal</span>
      <p class="toc-title">Review &amp; Test Myself</p>
      <p class="toc-sub">Already know the material? See your actual weak spots and jump straight to practice — no lessons required.</p>
    </a>
  </div>

  <p class="subtitle">Prefer to browse the full course catalog on your own? <a href="index.html">See everything →</a></p>

  <footer class="lesson-footer">STEM+ · free for anybody to learn · <a href="developer.html">Developer</a></footer>
```

The file's first 6 lines (`<meta>`, `<link rel="icon">`, `<title>`, `<link rel="stylesheet">`, `<script src="assets/tests.js" defer>`, `<div class="page">`) and the final closing `</div>` stay exactly as they are — only the content between them changes.

- [ ] **Step 2: Verify no broken internal links**

Run: `npm run build`
Expected: succeeds (confirms the file is well-formed and every route it references still exists as a real page).

- [ ] **Step 3: Verify the restructured page for real, against a production build**

```bash
npm run build && npm run start > /tmp/next-start.log 2>&1 &
```
Wait for `Ready` in `/tmp/next-start.log`, then:

```bash
node scripts/verify-page.mjs "http://localhost:3000/new.html" "(() => { const cards = Array.from(document.querySelectorAll('.toc-list')[0].querySelectorAll('a.toc-item')).map((a) => a.getAttribute('href')); const prepareLink = document.querySelector('a[href=\"Goals/prepare-for-college.html\"]'); return { ok: cards.length === 4 && cards.includes('Goals/get-ahead.html') && cards.includes('pathways.html') && cards.includes('projects.html') && cards.includes('#explore') && !prepareLink, cards, hasPrepareLink: !!prepareLink }; })()"
```
Expected: `PASS` — exactly 4 cards in the first `.toc-list`, linking to the 4 real destinations, and no link to `prepare-for-college.html` anywhere on the page.

```bash
node scripts/verify-page.mjs "http://localhost:3000/new.html" "(() => { const secondary = document.querySelectorAll('.toc-list')[1]; const links = Array.from(secondary.querySelectorAll('a.toc-item')).map((a) => a.getAttribute('href')); return { ok: links.length === 3 && links.includes('Goals/stronger-at-math.html') && links.includes('Goals/challenge-myself.html') && links.includes('Goals/review-and-test.html'), links }; })()"
```
Expected: `PASS` — the second `.toc-list` (secondary starting points) has exactly the 3 remaining Goals pages.

```bash
node scripts/verify-page.mjs "http://localhost:3000/new.html" "(() => { const el = document.querySelector('[data-generate-plan]'); const heading = document.getElementById('explore'); return { ok: !!el && !!heading && heading.tagName === 'H2', found: !!el }; })()"
```
Expected: `PASS` — the existing generate-plan section is intact and anchored at `#explore`.

- [ ] **Step 4: Run the full regression suite**

Run: `npm test`
Expected: all 5 checks pass — `check-content-links.js` specifically is what would catch a broken link introduced by this restructure.

- [ ] **Step 5: Stop the local server**

```bash
lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9
```

- [ ] **Step 6: Commit**

```bash
git add content/new.html
git commit -m "$(cat <<'EOF'
Restructure the Goals page into 4 categories, one front door

Replaces 8 disconnected goal cards with 4 (Get Ahead / Pursue a Field
/ Build Something / Explore), each routing to something that already
exists — pathways.html and projects.html are already fields/projects
in everything but name. The free-text AI generator moves under
"Explore" instead of sitting as a separate, disconnected section.
Goals/prepare-for-college.html is now fully redundant with "Pursue a
Field" (a superset) and is no longer linked; the 3 remaining curated
Goals pages that don't fit any of the 4 categories move to a
lower-emphasis "More specific starting points" list.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `my-plan.html` roadmap visual

**Files:**
- Modify: `public/assets/style.css`
- Modify: `public/assets/tests.js:823-882` (`mountGeneratedPlan`)

**Interfaces:**
- Consumes: `coursePath`, `isCourseExamPassed`, `isProjectComplete`, `PATHWAYS`, `mountProjectStatus`, `escapeHtml`, `loadCustomPlan` — all pre-existing in `tests.js`, all unchanged.
- Produces: nothing new for other tasks — `my-plan.html` is a terminal page, nothing else renders from its output.

- [ ] **Step 1: Add the roadmap CSS**

In `public/assets/style.css`, immediately after line 888 (`.reflection-status.is-saved { color: var(--correct); }`), add:

```css

/* Connected roadmap path (my-plan.html) */
.roadmap-path {
  position: relative;
  margin: 1.5rem 0;
  padding-left: 2.25rem;
}
.roadmap-path::before {
  content: '';
  position: absolute;
  left: 0.6rem;
  top: 0.6rem;
  bottom: 0.6rem;
  width: 2px;
  background: var(--border);
}
.roadmap-node {
  position: relative;
  margin-bottom: 1.25rem;
}
.roadmap-node::before {
  content: '';
  position: absolute;
  left: -2.25rem;
  top: 0.35rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: var(--bg);
  border: 2px solid var(--border);
}
.roadmap-node.is-done::before { border-color: var(--correct); background: var(--correct-soft); }
.roadmap-node.is-current::before { border-color: var(--accent); background: var(--accent); }
.roadmap-node.is-current .roadmap-node-title a { color: var(--accent); }
.roadmap-node-title { font-weight: 600; margin: 0 0 0.25rem; }
.roadmap-node-title a { color: var(--text); text-decoration: none; }
.roadmap-node-title a:hover { text-decoration: underline; }
```

- [ ] **Step 2: Rewrite `mountGeneratedPlan`'s Courses + Project sections**

In `public/assets/tests.js`, replace the block from `if ((plan.courses || []).length > 0) {` through the matching `}` that closes the Project section (currently lines 835-858 — the Courses `if` block and the Project `if` block that immediately follows it) with:

```js
    if ((plan.courses || []).length > 0 || plan.project) {
      const courses = plan.courses || [];
      const firstNotDoneIndex = courses.findIndex((c) => !isCourseExamPassed(c.name));
      html += '<h2>Your Roadmap</h2><div class="roadmap-path">';

      courses.forEach((c, i) => {
        const dir = coursePath(c.name);
        const href = dir ? dir + '/index.html' : 'pathways.html';
        const done = isCourseExamPassed(c.name);
        const current = !done && i === firstNotDoneIndex;
        const stateClass = done ? ' is-done' : (current ? ' is-current' : '');
        html += '<div class="roadmap-node' + stateClass + '">';
        if (current) html += '<span class="box-label">You are here</span>';
        html += '<p class="roadmap-node-title"><a href="' + href + '">' + (done ? '✓ ' : '') + c.name + '</a></p>';
        if (current) html += '<p class="toc-sub">' + escapeHtml(c.reason) + '</p>';
        html += '</div>';
      });

      if (plan.project) {
        const pathway = PATHWAYS.find((p) => p.projectId === plan.project.id);
        const requiredCourses = pathway ? pathway.courses.join('|') : '';
        const allCoursesDone = firstNotDoneIndex === -1;
        const projectDone = isProjectComplete(plan.project.id);
        const projectCurrent = allCoursesDone && !projectDone;
        const projectStateClass = projectDone ? ' is-done' : (projectCurrent ? ' is-current' : '');
        html += '<div class="roadmap-node' + projectStateClass + '">';
        if (projectCurrent) html += '<span class="box-label">You are here</span>';
        html += '<p class="roadmap-node-title"><a href="Projects/' + plan.project.id + '.html">' + (projectDone ? '✓ ' : '') + plan.project.title + '</a></p>';
        if (projectCurrent || projectDone) html += '<p class="toc-sub">' + escapeHtml(plan.project.reason) + '</p>';
        if (pathway) html += '<span data-project-status data-required-courses="' + requiredCourses + '"></span>';
        html += '</div>';
      }

      html += '</div>';

      const projectFinished = !plan.project || isProjectComplete(plan.project.id);
      if (firstNotDoneIndex === -1 && projectFinished) {
        html += '<p class="toc-empty">✓ Everything in this plan is complete.</p>';
      }
    }
```

- [ ] **Step 3: Update the trailing mount calls**

Immediately after this block, `mountGeneratedPlan` currently ends with:

```js
    el.innerHTML = html;

    Array.prototype.slice.call(document.querySelectorAll('[data-course-status]')).forEach(mountCourseStatus);
    Array.prototype.slice.call(document.querySelectorAll('[data-project-status]')).forEach(mountProjectStatus);
  }
```

Change it to:

```js
    el.innerHTML = html;

    Array.prototype.slice.call(document.querySelectorAll('[data-project-status]')).forEach(mountProjectStatus);
  }
```

(The `[data-course-status]`/`mountCourseStatus` call is removed — the new roadmap markup no longer emits `data-course-status` spans; each course's done/current state is computed directly via `isCourseExamPassed` at render time instead of through that separately-mounted badge.)

- [ ] **Step 4: Verify against a production build**

```bash
npm run build && npm run start > /tmp/next-start.log 2>&1 &
```
Wait for `Ready`, then use the existing throwaway test account's session cookie:

```bash
COOKIE="session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```

Seed a plan with a mix of a passed course, an unpassed course, and no project, then confirm the roadmap states:

```bash
node scripts/verify-page.mjs "http://localhost:3000/my-plan.html" "(() => { localStorage.setItem('stemplus:results:v1', JSON.stringify([{ course: 'Computer Programming 1', unit: 'Unit 1', kind: 'course_exam', score: 10, total: 10, passed: true, topicBreakdown: [], takenAt: new Date().toISOString() }])); localStorage.setItem('stemplus:custom-plan:v1', JSON.stringify({ summary: 'Test plan', courses: [{ name: 'Computer Programming 1', reason: 'Foundations' }, { name: 'Computer Programming 2', reason: 'Next step' }], project: null, problemSets: [], applications: [] })); return { ok: true }; })()" "$COOKIE"
node scripts/verify-page.mjs "http://localhost:3000/my-plan.html" "(() => { const nodes = Array.from(document.querySelectorAll('.roadmap-node')); return { ok: nodes.length === 2 && nodes[0].classList.contains('is-done') && nodes[1].classList.contains('is-current'), states: nodes.map((n) => n.className) }; })()" "$COOKIE"
```
Expected: `PASS` — first node `is-done`, second node `is-current`.

Now seed both courses as passed and confirm the completion message appears:

```bash
node scripts/verify-page.mjs "http://localhost:3000/my-plan.html" "(() => { localStorage.setItem('stemplus:results:v1', JSON.stringify([{ course: 'Computer Programming 1', unit: 'Unit 1', kind: 'course_exam', score: 10, total: 10, passed: true, topicBreakdown: [], takenAt: new Date().toISOString() }, { course: 'Computer Programming 2', unit: 'Unit 1', kind: 'course_exam', score: 10, total: 10, passed: true, topicBreakdown: [], takenAt: new Date().toISOString() }])); return { ok: true }; })()" "$COOKIE"
node scripts/verify-page.mjs "http://localhost:3000/my-plan.html" "(() => { const nodes = Array.from(document.querySelectorAll('.roadmap-node')); const complete = document.querySelector('.toc-empty'); return { ok: nodes.every((n) => n.classList.contains('is-done')) && !!complete && complete.textContent.indexOf('complete') !== -1, complete: complete ? complete.textContent : null }; })()" "$COOKIE"
```
Expected: `PASS` — both nodes `is-done`, completion message present.

Clean up:

```bash
node scripts/verify-page.mjs "http://localhost:3000/my-plan.html" "(() => { localStorage.clear(); return { ok: true }; })()" "$COOKIE"
```

- [ ] **Step 5: Run the full regression suite**

Run: `npm test`
Expected: all 5 checks pass.

- [ ] **Step 6: Stop the local server**

```bash
lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9
```

- [ ] **Step 7: Commit**

```bash
git add public/assets/style.css public/assets/tests.js
git commit -m "$(cat <<'EOF'
Render the generated plan as a connected roadmap, not a card grid

mountGeneratedPlan's Courses section becomes a vertical path of
roadmap-node elements — done (checkmark), current ("you are here",
with its reason and a link), or upcoming (title only, no premature
detail) — computed directly from isCourseExamPassed at render time.
The capstone project becomes the path's terminal node using the same
states, still carrying its real data-project-status unlock badge.
Same plan.courses/plan.project data as before; only how it's rendered
changes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** 4-category restructure with real destinations (Task 1), `prepare-for-college.html` unlinked (Task 1, verified by an explicit negative check in Step 3), 3 remaining Goals pages in a secondary list (Task 1), `#explore` anchor carrying the unchanged generator (Task 1), classic-homepage link reworded and demoted (Task 1), roadmap visual with done/current/upcoming states and no real branching (Task 2), project as terminal node reusing the real `data-project-status` badge (Task 2), completion message when everything's done (Task 2). All spec sections have a task.
- **Placeholder scan:** none — every step has complete code or a real, runnable command with a stated expected result.
- **Type consistency:** `mountGeneratedPlan`'s signature and every helper it calls (`coursePath`, `isCourseExamPassed`, `isProjectComplete`, `PATHWAYS`, `mountProjectStatus`, `escapeHtml`, `loadCustomPlan`) are unchanged from their existing definitions elsewhere in `tests.js` — Task 2 only rewrites the function's internal HTML-building logic, never its interface.
