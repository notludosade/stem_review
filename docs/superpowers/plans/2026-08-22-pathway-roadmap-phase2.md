# Pathway Roadmap (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat course-status list on 7 of the 8 static Pathway pages with the same connected "you are here" roadmap visual Phase 1 built for the AI-generated plan.

**Architecture:** Pure reuse — zero new CSS (Phase 1's `.roadmap-path`/`.roadmap-node`/`.is-done`/`.is-current`/`.box-label` classes carry over unchanged), one new render function in `public/assets/tests.js` driven by the existing `PATHWAYS` array, and a one-line marker-div swap in each of the 7 static HTML files. `mathematics.html` is excluded (two-part route, pathway-exam-gated capstone — structurally incompatible).

**Tech Stack:** Static HTML content files, the existing `window.STEMPlusTests` IIFE in `public/assets/tests.js`, plain CSS reuse.

## Global Constraints

- No new CSS classes — reuse `.roadmap-path`, `.roadmap-node`, `.is-done`, `.is-current`, `.roadmap-node-title`, `.box-label` exactly as Phase 1 defined them in `public/assets/style.css`.
- `content/Pathways/mathematics.html` is out of scope — do not touch it.
- `mountTrackPlan` (in `public/assets/tests.js`) must not be modified. Its `[data-course-status]` DOM-scrape must keep working unchanged — the new roadmap markup keeps emitting those spans (present, never separately mounted/styled) for exactly that reason.
- Roadmap nodes show course/project title and link only — no reason/description text (no per-course data source exists for pathway pages, unlike the AI-generated plan).

---

### Task 1: `mountPathwayRoadmap` + pilot page (`ai-data.html`)

**Files:**
- Modify: `public/assets/tests.js` (new function + `initTests()` wiring)
- Modify: `content/Pathways/ai-data.html`

**Interfaces:**
- Consumes: `PATHWAYS` (module-level array, each entry `{name, courses: string[], projectId, lessons}`), `coursePath(name)` → URL-encoded directory string or `null`, `isCourseExamPassed(name)` → boolean, `isProjectComplete(id)` → boolean, `mountProjectStatus(el)` (existing, mounts a `[data-project-status]` span's lock badge).
- Produces: `mountPathwayRoadmap(el)` — reads `el.getAttribute('data-pathway-roadmap')`, renders the pathway's course + capstone roadmap into `el.innerHTML`. Wired into `initTests()` via `document.querySelectorAll('[data-pathway-roadmap]').forEach(mountPathwayRoadmap)`, placed before the existing `[data-track-plan]` line. Task 2 depends on this function and this markup contract (`<div data-pathway-roadmap="<PATHWAYS name>"></div>`) existing exactly as built here.

- [ ] **Step 1: Add `mountPathwayRoadmap` to `public/assets/tests.js`**

Insert immediately after `mountGeneratedPlan`'s closing brace (the line `  }` that follows `Array.prototype.slice.call(document.querySelectorAll('[data-project-status]')).forEach(mountProjectStatus);` inside `mountGeneratedPlan`, currently around line 898), and before the `// "Where this fits" box for a course's own index.html` comment block:

```js
  // Pathway page roadmap: <div data-pathway-roadmap="<PATHWAYS name>"></div>,
  // placed where "The Route" + "Capstone Project" used to be. Reuses Phase
  // 1's exact .roadmap-path/.roadmap-node CSS — no new styles. Unlike
  // mountGeneratedPlan's roadmap (a short AI-picked course subset that can
  // diverge from its pathway's full required-course list), this roadmap's
  // own course list IS the pathway's full required-course list, so the
  // capstone's "current" state can never mismatch its lock badge — no
  // separate unlocked-check needed here.
  //
  // Also emits one <span data-course-status="…"> per course, never
  // separately mounted/styled — its sole purpose is staying discoverable to
  // mountTrackPlan's existing [data-course-status] DOM-scrape, which runs
  // later in initTests() and needs these spans to already exist by then.
  function mountPathwayRoadmap(el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';

    const name = el.getAttribute('data-pathway-roadmap');
    const pathway = PATHWAYS.find((p) => p.name === name);
    if (!pathway) { el.remove(); return; }

    const firstNotDoneIndex = pathway.courses.findIndex((c) => !isCourseExamPassed(c));

    let html = '<div class="roadmap-path">';

    pathway.courses.forEach((course, i) => {
      const dir = coursePath(course);
      const href = dir ? '../' + dir + '/index.html' : '../pathways.html';
      const done = isCourseExamPassed(course);
      const current = !done && i === firstNotDoneIndex;
      const stateClass = done ? ' is-done' : (current ? ' is-current' : '');
      html += '<div class="roadmap-node' + stateClass + '">';
      if (current) html += '<span class="box-label">You are here</span>';
      html += '<p class="roadmap-node-title"><a href="' + href + '">' + (done ? '✓ ' : '') + course + '</a></p>';
      html += '<span data-course-status="' + course + '"></span>';
      html += '</div>';
    });

    const allCoursesDone = firstNotDoneIndex === -1;
    const projectDone = isProjectComplete(pathway.projectId);
    const projectCurrent = allCoursesDone && !projectDone;
    const projectStateClass = projectDone ? ' is-done' : (projectCurrent ? ' is-current' : '');
    const requiredCourses = pathway.courses.join('|');
    html += '<div class="roadmap-node' + projectStateClass + '">';
    if (projectCurrent) html += '<span class="box-label">You are here</span>';
    html += '<p class="roadmap-node-title"><a href="../Projects/' + pathway.projectId + '.html">'
      + (projectDone ? '✓ ' : '') + pathway.name + ' Capstone</a></p>';
    html += '<span data-project-status data-required-courses="' + requiredCourses + '"></span>';
    html += '</div>';

    html += '</div>';

    if (allCoursesDone && projectDone) {
      html += '<p class="toc-empty">✓ Every course and the capstone are complete.</p>';
    }

    el.innerHTML = html;

    Array.prototype.slice.call(document.querySelectorAll('[data-project-status]')).forEach(mountProjectStatus);
  }
```

- [ ] **Step 2: Wire it into `initTests()`, before `[data-track-plan]`**

In `public/assets/tests.js`, find this line inside `initTests()`:

```js
    document.querySelectorAll('[data-track-plan]').forEach(mountTrackPlan);
```

Replace it with:

```js
    // mountPathwayRoadmap must run before mountTrackPlan: it injects the
    // data-course-status spans mountTrackPlan's own querySelectorAll scrape
    // depends on finding already in the DOM. Do not reorder these two lines.
    document.querySelectorAll('[data-pathway-roadmap]').forEach(mountPathwayRoadmap);
    document.querySelectorAll('[data-track-plan]').forEach(mountTrackPlan);
```

- [ ] **Step 3: Convert the pilot page — `content/Pathways/ai-data.html`**

Replace:

```html
  <h2>The Route</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Computer%20Programming%201/index.html">
      <span class="toc-num">1 of 4</span>
      <p class="toc-title">Computer Programming 1</p>
      <p class="toc-sub">Variables, control flow, functions, strings, and collections — you'll need all of it to wrangle data in code.</p>
      <span data-course-status="Computer Programming 1"></span>
    </a>
    <a class="toc-item" href="../Computer%20Programming%202/index.html">
      <span class="toc-num">2 of 4</span>
      <p class="toc-title">Computer Programming 2</p>
      <p class="toc-sub">Data structures, recursion, and complexity — the toolkit that makes "process a million rows" a reasonable sentence.</p>
      <span data-course-status="Computer Programming 2"></span>
    </a>
    <a class="toc-item" href="../Data%20Handling%20CB/index.html">
      <span class="toc-num">3 of 4</span>
      <p class="toc-title">Data Handling: CB</p>
      <p class="toc-sub">Spreadsheets, SQL, statistics, cleaning, and honest visualization — the unglamorous work every model quietly depends on.</p>
      <span data-course-status="Data Handling CB"></span>
    </a>
    <a class="toc-item" href="../AI%20Developer/index.html">
      <span class="toc-num">4 of 4</span>
      <p class="toc-title">AI Developer</p>
      <p class="toc-sub">From how machine learning actually works to building and deploying a real AI application, responsibly.</p>
      <span data-course-status="AI Developer"></span>
    </a>
  </div>

  <h2>Capstone Project</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Projects/ai-data-capstone.html" data-pathway="ai-data">
      <span class="toc-num">Capstone</span>
      <p class="toc-title">AI &amp; Data Capstone</p>
      <p class="toc-sub">Take a real dataset from raw file to a small, responsibly-scoped AI or ML feature, and write up what you'd trust it to do. Unlocks once all four course exams above are passed.</p>
      <span data-project-status data-required-courses="Computer Programming 1|Computer Programming 2|Data Handling CB|AI Developer"></span>
    </a>
  </div>
```

with:

```html
  <h2>Your Roadmap</h2>
  <div data-pathway-roadmap="AI &amp; Data"></div>
```

- [ ] **Step 4: `npm run build`**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Verify against a production build**

```bash
npm run build && npm run start > /tmp/next-start.log 2>&1 &
```
Wait for `Ready` in `/tmp/next-start.log`, then:

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/ai-data.html" "(() => { localStorage.clear(); localStorage.setItem('stemplus:results:v1', JSON.stringify([{ course: 'Computer Programming 1', unit: 'Unit 1', kind: 'course_exam', score: 10, total: 10, passed: true, topicBreakdown: [], takenAt: new Date().toISOString() }])); return { ok: true }; })()"
node scripts/verify-page.mjs "http://localhost:3000/Pathways/ai-data.html" "(() => { const nodes = Array.from(document.querySelectorAll('.roadmap-node')); return { ok: nodes.length === 5 && nodes[0].classList.contains('is-done') && nodes[1].classList.contains('is-current') && !nodes[4].classList.contains('is-done') && !nodes[4].classList.contains('is-current'), states: nodes.map((n) => n.className) }; })()"
```
Expected: `PASS` — 5 nodes (4 courses + capstone), first course `is-done`, second `is-current`, capstone node neither (locked, 1/4 passed).

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/ai-data.html" "(() => { const checkboxes = document.querySelectorAll('[data-track-plan-course]'); return { ok: checkboxes.length === 4, count: checkboxes.length }; })()"
```
Expected: `PASS` — Track Customization's checklist still lists all 4 courses (confirms `mountTrackPlan`'s scrape still works against the dynamically-injected `data-course-status` spans).

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/ai-data.html" "(() => { localStorage.clear(); return { ok: true }; })()"
```

Stop the server: `lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9`

- [ ] **Step 6: `npm test`**

Run: `npm test`
Expected: all 5 checks pass.

- [ ] **Step 7: Commit**

```bash
git add public/assets/tests.js content/Pathways/ai-data.html
git commit -m "$(cat <<'EOF'
Give AI & Data pathway page the roadmap visual (pilot)

Adds mountPathwayRoadmap, reusing Phase 1's exact roadmap CSS with
the pathway's own PATHWAYS entry as the course list instead of an
AI-generated plan. Unlike the AI-plan case, this roadmap's course
list IS the pathway's full required-course list, so the capstone's
unlock state can never diverge from its own lock badge.

mountTrackPlan is untouched — the new markup keeps emitting
data-course-status spans (unstyled) so its existing DOM-scrape keeps
working; mountPathwayRoadmap is wired into initTests() before
mountTrackPlan for exactly that reason.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Convert the remaining 6 pathway pages

**Files:**
- Modify: `content/Pathways/software-engineer.html`
- Modify: `content/Pathways/cloud-devops.html`
- Modify: `content/Pathways/competitive-programmer.html`
- Modify: `content/Pathways/engineering-physics.html`
- Modify: `content/Pathways/general-programmer.html`
- Modify: `content/Pathways/ai-developer-cbrwa.html`

**Interfaces:**
- Consumes: `mountPathwayRoadmap` and the `<div data-pathway-roadmap="<PATHWAYS name>"></div>` markup contract built in Task 1 — unchanged, no new interface needed.
- Produces: nothing new for later tasks — this is the last task in the plan.

Each file gets the identical transformation as Task 1's Step 3: delete the `<h2>The Route</h2>` + course `.toc-list` + `<h2>Capstone Project</h2>` + capstone `.toc-list` blocks, replace with `<h2>Your Roadmap</h2>` + one `data-pathway-roadmap` marker div carrying that pathway's exact `PATHWAYS` `name` string.

- [ ] **Step 1: `content/Pathways/software-engineer.html`**

Replace:

```html
  <h2>The Route</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Computer%20Programming%201/index.html">
      <span class="toc-num">1 of 4</span>
      <p class="toc-title">Computer Programming 1</p>
      <p class="toc-sub">Variables, control flow, functions, strings, and collections — the vocabulary everything downstream assumes.</p>
      <span data-course-status="Computer Programming 1"></span>
    </a>
    <a class="toc-item" href="../Computer%20Programming%202/index.html">
      <span class="toc-num">2 of 4</span>
      <p class="toc-title">Computer Programming 2</p>
      <p class="toc-sub">OOP, data structures, recursion, and memory models — the difference between code that runs once and code that lasts.</p>
      <span data-course-status="Computer Programming 2"></span>
    </a>
    <a class="toc-item" href="../Computer%20Programming%20Ethics/index.html">
      <span class="toc-num">3 of 4</span>
      <p class="toc-title">Computer Programming Ethics</p>
      <p class="toc-sub">Security, privacy, fairness, and licensing — the judgment calls that separate code that works from code you'd stand behind.</p>
      <span data-course-status="Computer Programming Ethics"></span>
    </a>
    <a class="toc-item" href="../Software%20Engineering/index.html">
      <span class="toc-num">4 of 4</span>
      <p class="toc-title">Software Engineering</p>
      <p class="toc-sub">Version control, testing, design patterns, architecture, and agile process — how the first three courses' skills survive contact with a team.</p>
      <span data-course-status="Software Engineering"></span>
    </a>
  </div>

  <h2>Capstone Project</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Projects/software-engineer-capstone.html" data-pathway="swe">
      <span class="toc-num">Capstone</span>
      <p class="toc-title">Software Engineer Capstone</p>
      <p class="toc-sub">Design, build, and document a small multi-file application, then defend the engineering decisions behind it in writing. Unlocks once all four course exams above are passed.</p>
      <span data-project-status data-required-courses="Computer Programming 1|Computer Programming 2|Computer Programming Ethics|Software Engineering"></span>
    </a>
  </div>
```

with:

```html
  <h2>Your Roadmap</h2>
  <div data-pathway-roadmap="Software Engineer"></div>
```

- [ ] **Step 2: `content/Pathways/cloud-devops.html`**

Replace:

```html
  <h2>The Route</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Computer%20Programming%201/index.html">
      <span class="toc-num">1 of 3</span>
      <p class="toc-title">Computer Programming 1</p>
      <p class="toc-sub">Variables, control flow, functions, strings, and collections — enough to script and configure everything the next two courses touch.</p>
      <span data-course-status="Computer Programming 1"></span>
    </a>
    <a class="toc-item" href="../Cloud%20Computing%20A/index.html">
      <span class="toc-num">2 of 3</span>
      <p class="toc-title">Cloud Computing A</p>
      <p class="toc-sub">Compute, storage, networking, and managed services — the building blocks a provider's dashboard is standing on, and why teams stopped running their own servers.</p>
      <span data-course-status="Cloud Computing A"></span>
    </a>
    <a class="toc-item" href="../Cloud%20Computing%20B/index.html">
      <span class="toc-num">3 of 3</span>
      <p class="toc-title">Cloud Computing B / DevOps</p>
      <p class="toc-sub">CI/CD pipelines, infrastructure as code, container orchestration, and observability — how those building blocks get shipped to and operated in production continuously.</p>
      <span data-course-status="Cloud Computing B / DevOps"></span>
    </a>
  </div>

  <h2>Capstone Project</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Projects/cloud-devops-capstone.html" data-pathway="cloud-devops">
      <span class="toc-num">Capstone</span>
      <p class="toc-title">Cloud &amp; DevOps Capstone</p>
      <p class="toc-sub">Design a cloud architecture and the CI/CD pipeline that ships and operates it, then defend every infrastructure decision behind both. Unlocks once all three course exams above are passed.</p>
      <span data-project-status data-required-courses="Computer Programming 1|Cloud Computing A|Cloud Computing B / DevOps"></span>
    </a>
  </div>
```

with:

```html
  <h2>Your Roadmap</h2>
  <div data-pathway-roadmap="Cloud &amp; DevOps"></div>
```

- [ ] **Step 3: `content/Pathways/competitive-programmer.html`**

Replace:

```html
  <h2>The Route</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Computer%20Programming%201/index.html">
      <span class="toc-num">1 of 4</span>
      <p class="toc-title">Computer Programming 1</p>
      <p class="toc-sub">Variables, control flow, functions, strings, and collections — the baseline every pattern below builds on.</p>
      <span data-course-status="Computer Programming 1"></span>
    </a>
    <a class="toc-item" href="../Computer%20Programming%202/index.html">
      <span class="toc-num">2 of 4</span>
      <p class="toc-title">Computer Programming 2</p>
      <p class="toc-sub">Data structures, recursion, and algorithmic complexity — the vocabulary contest problems are stated in.</p>
      <span data-course-status="Computer Programming 2"></span>
    </a>
    <a class="toc-item" href="../Computer%20Programming%202%2B/index.html">
      <span class="toc-num">3 of 4</span>
      <p class="toc-title">Computer Programming 2+</p>
      <p class="toc-sub">Two pointers through DP, greedy, and bit tricks — the pattern library for technical interviews and competitive programming.</p>
      <span data-course-status="Computer Programming 2+"></span>
    </a>
    <a class="toc-item" href="../Advanced%2B%20Courses/Advanced%20Algorithms/index.html">
      <span class="toc-num">4 of 4</span>
      <p class="toc-title">Advanced Algorithms</p>
      <p class="toc-sub">Exchange arguments, amortized analysis, and NP-completeness — proving the CP2+ toolkit actually works, and where it stops working.</p>
      <span data-course-status="Advanced Algorithms"></span>
    </a>
  </div>

  <h2>Capstone Project</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Projects/competitive-programmer-capstone.html" data-pathway="algorithms">
      <span class="toc-num">Capstone</span>
      <p class="toc-title">Competitive Programmer Capstone</p>
      <p class="toc-sub">Take on an unseen, contest-style problem set under a time box, then write up the approach you'd give in a technical interview. Unlocks once all four course exams above are passed.</p>
      <span data-project-status data-required-courses="Computer Programming 1|Computer Programming 2|Computer Programming 2+|Advanced Algorithms"></span>
    </a>
  </div>
```

with:

```html
  <h2>Your Roadmap</h2>
  <div data-pathway-roadmap="Competitive Programmer"></div>
```

- [ ] **Step 4: `content/Pathways/engineering-physics.html`**

Replace:

```html
  <h2>The Route</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Precalculus/index.html">
      <span class="toc-num">1 of 5</span>
      <p class="toc-title">Precalculus</p>
      <p class="toc-sub">Functions, trigonometry, and systems of equations — the algebra every equation below is written in.</p>
      <span data-course-status="Precalculus"></span>
    </a>
    <a class="toc-item" href="../AP%20Physics%201/index.html">
      <span class="toc-num">2 of 5</span>
      <p class="toc-title">AP Physics 1</p>
      <p class="toc-sub">Kinematics, forces, energy, momentum, rotation, oscillations, and fluids — the mechanics an engineer designs against.</p>
      <span data-course-status="AP Physics 1"></span>
    </a>
    <a class="toc-item" href="../Engineering%201/index.html">
      <span class="toc-num">3 of 5</span>
      <p class="toc-title">Engineering 1</p>
      <p class="toc-sub">How engineers actually think — statics, materials, systems thinking, and the disciplines' differences — before specializing.</p>
      <span data-course-status="Engineering 1"></span>
    </a>
    <a class="toc-item" href="../AP%20Physics%202/index.html">
      <span class="toc-num">4 of 5</span>
      <p class="toc-title">AP Physics 2</p>
      <p class="toc-sub">Thermodynamics, electricity and magnetism, and optics — the physics behind everything that isn't pure mechanics.</p>
      <span data-course-status="AP Physics 2"></span>
    </a>
    <a class="toc-item" href="../Career%20Applied%20Engineering/index.html">
      <span class="toc-num">5 of 5</span>
      <p class="toc-title">Career Applied Engineering</p>
      <p class="toc-sub">Resumes, interviews, workplace communication, project management, and licensure — turning technical skill into a career.</p>
      <span data-course-status="Career Applied Engineering"></span>
    </a>
  </div>

  <h2>Capstone Project</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Projects/engineering-physics-capstone.html" data-pathway="engineering">
      <span class="toc-num">Capstone</span>
      <p class="toc-title">Engineering &amp; Physics Capstone</p>
      <p class="toc-sub">Design a physical system under real constraints, back it with the physics, and present it the way a working engineer would. Unlocks once all five course exams above are passed.</p>
      <span data-project-status data-required-courses="Precalculus|AP Physics 1|Engineering 1|AP Physics 2|Career Applied Engineering"></span>
    </a>
  </div>
```

with:

```html
  <h2>Your Roadmap</h2>
  <div data-pathway-roadmap="Engineering &amp; Physics"></div>
```

- [ ] **Step 5: `content/Pathways/general-programmer.html`**

Replace:

```html
  <h2>The Route</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Computer%20Programming%201/index.html">
      <span class="toc-num">1 of 9</span>
      <p class="toc-title">Computer Programming 1</p>
      <p class="toc-sub">Variables, control flow, functions, strings, and collections — the vocabulary everything downstream assumes.</p>
      <span data-course-status="Computer Programming 1"></span>
    </a>
    <a class="toc-item" href="../Computer%20Programming%202/index.html">
      <span class="toc-num">2 of 9</span>
      <p class="toc-title">Computer Programming 2</p>
      <p class="toc-sub">OOP, data structures, recursion, and memory models — the difference between code that runs once and code that lasts.</p>
      <span data-course-status="Computer Programming 2"></span>
    </a>
    <a class="toc-item" href="../Computer%20Programming%20Ethics/index.html">
      <span class="toc-num">3 of 9</span>
      <p class="toc-title">Computer Programming Ethics</p>
      <p class="toc-sub">Security, privacy, fairness, and licensing — the judgment calls that separate code that works from code you'd stand behind.</p>
      <span data-course-status="Computer Programming Ethics"></span>
    </a>
    <a class="toc-item" href="../Computer%20Programming%202%2B/index.html" data-tier="advanced">
      <span class="toc-num">4 of 9</span>
      <p class="toc-title">Computer Programming 2+</p>
      <p class="toc-sub">Interview- and contest-grade patterns — two pointers through DP, greedy, and bit tricks — the algorithmic toolkit a generalist is expected to already have.</p>
      <span data-course-status="Computer Programming 2+"></span>
    </a>
    <a class="toc-item" href="../Software%20Engineering/index.html" data-tier="advanced">
      <span class="toc-num">5 of 9</span>
      <p class="toc-title">Software Engineering</p>
      <p class="toc-sub">Version control, testing, design patterns, architecture, and agile process — how code survives contact with a team.</p>
      <span data-course-status="Software Engineering"></span>
    </a>
    <a class="toc-item" href="../Data%20Handling%20CB/index.html">
      <span class="toc-num">6 of 9</span>
      <p class="toc-title">Data Handling: CB</p>
      <p class="toc-sub">Spreadsheets, SQL, and statistics — the databases and data literacy every real system eventually needs.</p>
      <span data-course-status="Data Handling CB"></span>
    </a>
    <a class="toc-item" href="../Systems%20Programming%20%26%20Architecture/index.html" data-tier="advanced">
      <span class="toc-num">7 of 9</span>
      <p class="toc-title">Systems Programming &amp; Architecture: CS</p>
      <p class="toc-sub">Memory, the stack and heap, processes, the OS, and low-level languages like C — how a computer actually runs everything the first six courses wrote.</p>
      <span data-course-status="Systems Programming &amp; Architecture: CS"></span>
    </a>
    <a class="toc-item" href="../Computer%20Networking%20Fundamentals/index.html">
      <span class="toc-num">8 of 9</span>
      <p class="toc-title">Computer Networking Fundamentals</p>
      <p class="toc-sub">Packets, addressing, routing, TCP/UDP, and HTTP — how the systems from the last course actually talk to each other.</p>
      <span data-course-status="Computer Networking Fundamentals"></span>
    </a>
    <a class="toc-item" href="../Advanced%2B%20Courses/Advanced%20Algorithms/index.html" data-tier="advanced">
      <span class="toc-num">9 of 9</span>
      <p class="toc-title">Advanced Algorithms</p>
      <p class="toc-sub">Exchange arguments, amortized analysis, NP-completeness — going back through Computer Programming 2+'s toolkit and proving why it works.</p>
      <span data-course-status="Advanced Algorithms"></span>
    </a>
  </div>

  <h2>Capstone Project</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Projects/general-programmer-capstone.html" data-pathway="general-programmer">
      <span class="toc-num">Capstone</span>
      <p class="toc-title">General Programmer Capstone</p>
      <p class="toc-sub">Design, build, and document a multi-file application with its own data layer, network interface, and a documented systems-level constraint — then defend the engineering, algorithmic, and systems decisions behind all of it. Unlocks once all nine course exams above are passed.</p>
      <span data-project-status data-required-courses="Computer Programming 1|Computer Programming 2|Computer Programming Ethics|Computer Programming 2+|Software Engineering|Data Handling CB|Systems Programming &amp; Architecture: CS|Computer Networking Fundamentals|Advanced Algorithms"></span>
    </a>
  </div>
```

with:

```html
  <h2>Your Roadmap</h2>
  <div data-pathway-roadmap="General Programmer"></div>
```

- [ ] **Step 6: `content/Pathways/ai-developer-cbrwa.html`**

Replace:

```html
  <h2>The Route</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Computer%20Programming%201/index.html">
      <span class="toc-num">1 of 7</span>
      <p class="toc-title">Computer Programming 1</p>
      <p class="toc-sub">Variables, control flow, functions, strings, and collections — the vocabulary everything downstream assumes.</p>
      <span data-course-status="Computer Programming 1"></span>
    </a>
    <a class="toc-item" href="../Computer%20Programming%202/index.html">
      <span class="toc-num">2 of 7</span>
      <p class="toc-title">Computer Programming 2</p>
      <p class="toc-sub">OOP, data structures, recursion, and memory models — enough engineering discipline to build something that survives past a notebook.</p>
      <span data-course-status="Computer Programming 2"></span>
    </a>
    <a class="toc-item" href="../Data%20Handling%20CB/index.html">
      <span class="toc-num">3 of 7</span>
      <p class="toc-title">Data Handling: CB</p>
      <p class="toc-sub">Spreadsheets, SQL, statistics, and honest visualization — every model is only as good as the data pipeline feeding it.</p>
      <span data-course-status="Data Handling CB"></span>
    </a>
    <a class="toc-item" href="../AI%20Developer/index.html">
      <span class="toc-num">4 of 7</span>
      <p class="toc-title">AI Developer</p>
      <p class="toc-sub">How machine learning actually works, building and deploying a real AI application, responsibly.</p>
      <span data-course-status="AI Developer"></span>
    </a>
    <a class="toc-item" href="../Applied%20Machine%20Deep%20Learning/index.html" data-tier="advanced">
      <span class="toc-num">5 of 7</span>
      <p class="toc-title">Applied Machine/Deep Learning</p>
      <p class="toc-sub">Beyond the concepts — building, training, and tuning real neural networks by hand, from a single perceptron to transformers.</p>
      <span data-course-status="Applied Machine/Deep Learning"></span>
    </a>
    <a class="toc-item" href="../Cloud%20Computing%20A/index.html">
      <span class="toc-num">6 of 7</span>
      <p class="toc-title">Cloud Computing A</p>
      <p class="toc-sub">Compute, storage, networking, and managed services — what an AI system actually runs on once it leaves your laptop.</p>
      <span data-course-status="Cloud Computing A"></span>
    </a>
    <a class="toc-item" href="../Cloud%20Computing%20B/index.html">
      <span class="toc-num">7 of 7</span>
      <p class="toc-title">Cloud Computing B / DevOps</p>
      <p class="toc-sub">CI/CD, infrastructure as code, and observability — how a model actually gets shipped, monitored, and kept healthy in production.</p>
      <span data-course-status="Cloud Computing B / DevOps"></span>
    </a>
  </div>

  <h2>Capstone Project</h2>
  <div class="toc-list">
    <a class="toc-item" href="../Projects/ai-developer-cbrwa-capstone.html" data-pathway="ai-cbrwa">
      <span class="toc-num">Capstone</span>
      <p class="toc-title">AI Developer: CB/RWA Capstone</p>
      <p class="toc-sub">Take a real dataset to a trained model you built and tuned yourself, then design and defend the cloud pipeline that would actually serve and monitor it in production. Unlocks once all seven course exams above are passed.</p>
      <span data-project-status data-required-courses="Computer Programming 1|Computer Programming 2|Data Handling CB|AI Developer|Applied Machine/Deep Learning|Cloud Computing A|Cloud Computing B / DevOps"></span>
    </a>
  </div>
```

with:

```html
  <h2>Your Roadmap</h2>
  <div data-pathway-roadmap="AI Developer: CB/RWA"></div>
```

- [ ] **Step 7: `npm run build`**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 8: Verify all 6 pages against a production build**

```bash
npm run build && npm run start > /tmp/next-start.log 2>&1 &
```
Wait for `Ready`, then for each of the 6 pages, confirm the roadmap rendered with the right node count and the Track Customization checklist still lists every course:

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/software-engineer.html" "(() => { const nodes = document.querySelectorAll('.roadmap-node'); const boxes = document.querySelectorAll('[data-track-plan-course]'); return { ok: nodes.length === 5 && boxes.length === 4, nodes: nodes.length, boxes: boxes.length }; })()"
node scripts/verify-page.mjs "http://localhost:3000/Pathways/cloud-devops.html" "(() => { const nodes = document.querySelectorAll('.roadmap-node'); const boxes = document.querySelectorAll('[data-track-plan-course]'); return { ok: nodes.length === 4 && boxes.length === 3, nodes: nodes.length, boxes: boxes.length }; })()"
node scripts/verify-page.mjs "http://localhost:3000/Pathways/competitive-programmer.html" "(() => { const nodes = document.querySelectorAll('.roadmap-node'); const boxes = document.querySelectorAll('[data-track-plan-course]'); return { ok: nodes.length === 5 && boxes.length === 4, nodes: nodes.length, boxes: boxes.length }; })()"
node scripts/verify-page.mjs "http://localhost:3000/Pathways/engineering-physics.html" "(() => { const nodes = document.querySelectorAll('.roadmap-node'); const boxes = document.querySelectorAll('[data-track-plan-course]'); return { ok: nodes.length === 6 && boxes.length === 5, nodes: nodes.length, boxes: boxes.length }; })()"
node scripts/verify-page.mjs "http://localhost:3000/Pathways/general-programmer.html" "(() => { const nodes = document.querySelectorAll('.roadmap-node'); const boxes = document.querySelectorAll('[data-track-plan-course]'); return { ok: nodes.length === 10 && boxes.length === 9, nodes: nodes.length, boxes: boxes.length }; })()"
node scripts/verify-page.mjs "http://localhost:3000/Pathways/ai-developer-cbrwa.html" "(() => { const nodes = document.querySelectorAll('.roadmap-node'); const boxes = document.querySelectorAll('[data-track-plan-course]'); return { ok: nodes.length === 8 && boxes.length === 7, nodes: nodes.length, boxes: boxes.length }; })()"
```
Expected: `PASS` on all 6 — node count is courses+1 (capstone), checkbox count matches course count exactly (confirms `mountTrackPlan` still works on every converted page, not just the Task 1 pilot).

Stop the server: `lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9`

- [ ] **Step 9: `npm test`**

Run: `npm test`
Expected: all 5 checks pass — `check-content-links.js` confirms no broken links from the restructure across all 6 files.

- [ ] **Step 10: Commit**

```bash
git add content/Pathways/software-engineer.html content/Pathways/cloud-devops.html content/Pathways/competitive-programmer.html content/Pathways/engineering-physics.html content/Pathways/general-programmer.html content/Pathways/ai-developer-cbrwa.html
git commit -m "$(cat <<'EOF'
Give the remaining 6 pathway pages the roadmap visual

Same mountPathwayRoadmap mechanism the AI & Data pilot page already
uses — no JS changes, just replacing each page's static Route +
Capstone Project sections with a data-pathway-roadmap marker.
mathematics.html stays on its current flat-list rendering (two-part
route, pathway-exam-gated capstone — doesn't fit the same shape).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** roadmap visual on 7 pathway pages reusing Phase 1 CSS (Tasks 1+2), `mathematics.html` excluded (Global Constraints + task file lists), `pathways.html`/Goals pages untouched (not in either task's file list), `mountTrackPlan` unmodified with its scrape kept working via emitted spans + ordering fix (Task 1 Steps 1-2, explicitly tested in both tasks' verification steps), no reason/description text on nodes (Task 1 Step 1's code has none), no new CSS (Global Constraints, confirmed no `style.css` file in either task's file list). All spec sections have a task.
- **Placeholder scan:** none — every step has complete code, exact `old_string`/`new_string` HTML, or a runnable command with a stated expected result.
- **Type consistency:** `mountPathwayRoadmap(el)` defined once in Task 1 Step 1; Task 2 introduces no new function, only reuses the `data-pathway-roadmap="<name>"` markup contract Task 1 already established, with each `<name>` value matching its `PATHWAYS` entry's `name` field exactly (verified against the `PATHWAYS` array read directly from `public/assets/tests.js:207-215` while writing this plan).
