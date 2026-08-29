# Wire In Quantum Computing, Mechatronics, Advanced Robotics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 3 already-shipped courses (Quantum Computing, Mechatronics, Advanced Robotics) become real, reachable parts of the site — published on their hub pages, forming 2 new complete pathways with roadmap visuals and capstone projects.

**Architecture:** Task 1 makes the 3 courses "real" catalog members (hub page moves, `PATHWAYS`/`COURSE_PATHS`/`PREREQUISITE_GRAPH` entries). Task 2 builds the 2 new Pathway pages and 2 new capstone Project pages on top of that, plus moves both pathways in `pathways.html` from "Coming Soon" to published. Every piece reuses an existing, already-shipped mechanism (`mountPathwayRoadmap`, `mountProjectStatus`/`mountProjectGate`/`mountReflection`) — no new code.

**Tech Stack:** Static HTML content files, the existing `window.STEMPlusTests` IIFE in `public/assets/tests.js`, `lib/plan-catalog.js`.

## Global Constraints

- No new problem sets or Applications pages for these 3 courses — out of scope.
- No changes to `mountPathwayRoadmap`, `mountProjectStatus`, `mountProjectGate`, `mountReflection`, or any other shared function — pure data/content addition.
- Real, already-shipped lesson counts: Quantum Computing 40 lessons/8 units, Mechatronics 43 lessons/8 units, Advanced Robotics 47 lessons/8 units (confirmed via each course's own `lesson-footer`).
- Real, already-shipped directory names: `content/Advanced+ Courses/Quantum Computing/`, `content/Mechatronics/`, `content/Advanced Robotics/` — confirmed via `ls`, matching what `COURSE_PATHS` entries must point to.

---

### Task 1: Catalog membership — hub pages, `PATHWAYS`, `COURSE_PATHS`, `PREREQUISITE_GRAPH`

**Files:**
- Modify: `content/advanced.html`
- Modify: `content/engineering.html`
- Modify: `public/assets/tests.js`
- Modify: `lib/plan-catalog.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PATHWAYS` gains 2 entries (`Quantum Science`, `Robotics & Mechatronics`) that Task 2's Pathway pages depend on via `mountPathwayRoadmap`'s `PATHWAYS.find((p) => p.name === ...)` lookup. `COURSE_PATHS` gains 3 entries that Task 2's Project pages' course links depend on via `coursePath()`.

- [ ] **Step 1: Move Quantum Computing off `content/advanced.html`'s Coming Soon list**

Replace:

```html
  <div class="toc-list">
    <a class="toc-item" href="Advanced%2B%20Courses/Real%20Analysis%20A/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Real Analysis A</p>
      <p class="toc-sub">The fundamentals of real analysis — from the field and order axioms, through sequences, topology, and continuity, to a rigorous proof of the Fundamental Theorem of Calculus — 34 lessons across 6 units. Requires AP Calculus BC. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%2B%20Courses/Real%20Analysis%20B/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Real Analysis B</p>
      <p class="toc-sub">Past the fundamentals — uniform convergence, power series, metric spaces, and multivariable differentiation, then a full rebuild of integration from Lebesgue measure theory — 31 lessons across 6 units. Requires Real Analysis A. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%2B%20Courses/Advanced%20Algorithms/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Advanced Algorithms</p>
      <p class="toc-sub">CP2+ built the practical toolkit for interviews and contests — this course goes back through the same territory and proves it: exchange arguments, amortized analysis, NP-completeness, and why some problems have no known efficient algorithm at all — 34 lessons across 8 units. Requires Computer Programming 1 and Computer Programming 2. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%2B%20Courses/Linear%20Algebra%20B/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Linear Algebra B</p>
      <p class="toc-sub">Past the computation — vector spaces, linear independence, and the proofs behind the theorems Linear Algebra A used without deriving. Requires Linear Algebra A — 21 lessons across 7 units. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%2B%20Courses/Topology%20Fundamentals/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Topology: Fundamentals</p>
      <p class="toc-sub">Open sets, continuity, and connectedness stripped of distance entirely — the abstraction that generalizes everything Real Analysis proved about the real line. Requires Real Analysis A — 21 lessons across 7 units. Course complete.</p>
    </a>
  </div>

  <h2>Coming Soon</h2>
  <div class="toc-list">
    <div class="toc-item is-soon" data-tier="advanced">
      <span class="toc-num">Coming Soon</span>
      <p class="toc-title">Quantum Computing</p>
      <p class="toc-sub">Qubits, superposition, entanglement, and quantum gates — the linear algebra of computing built on a fundamentally different physical model. Requires Linear Algebra A and Linear Algebra B.</p>
    </div>
```

with:

```html
  <div class="toc-list">
    <a class="toc-item" href="Advanced%2B%20Courses/Real%20Analysis%20A/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Real Analysis A</p>
      <p class="toc-sub">The fundamentals of real analysis — from the field and order axioms, through sequences, topology, and continuity, to a rigorous proof of the Fundamental Theorem of Calculus — 34 lessons across 6 units. Requires AP Calculus BC. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%2B%20Courses/Real%20Analysis%20B/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Real Analysis B</p>
      <p class="toc-sub">Past the fundamentals — uniform convergence, power series, metric spaces, and multivariable differentiation, then a full rebuild of integration from Lebesgue measure theory — 31 lessons across 6 units. Requires Real Analysis A. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%2B%20Courses/Advanced%20Algorithms/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Advanced Algorithms</p>
      <p class="toc-sub">CP2+ built the practical toolkit for interviews and contests — this course goes back through the same territory and proves it: exchange arguments, amortized analysis, NP-completeness, and why some problems have no known efficient algorithm at all — 34 lessons across 8 units. Requires Computer Programming 1 and Computer Programming 2. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%2B%20Courses/Linear%20Algebra%20B/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Linear Algebra B</p>
      <p class="toc-sub">Past the computation — vector spaces, linear independence, and the proofs behind the theorems Linear Algebra A used without deriving. Requires Linear Algebra A — 21 lessons across 7 units. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%2B%20Courses/Topology%20Fundamentals/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Topology: Fundamentals</p>
      <p class="toc-sub">Open sets, continuity, and connectedness stripped of distance entirely — the abstraction that generalizes everything Real Analysis proved about the real line. Requires Real Analysis A — 21 lessons across 7 units. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%2B%20Courses/Quantum%20Computing/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Quantum Computing</p>
      <p class="toc-sub">Qubits, superposition, entanglement, and quantum gates — the linear algebra of computing built on a fundamentally different physical model — 40 lessons across 8 units. Requires Linear Algebra A and Linear Algebra B. Course complete.</p>
    </a>
  </div>

  <h2>Coming Soon</h2>
  <div class="toc-list">
```

- [ ] **Step 2: Move Mechatronics and Advanced Robotics off `content/engineering.html`'s Coming Soon list**

Replace:

```html
    <a class="toc-item" href="Thermodynamics/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Thermodynamics</p>
      <p class="toc-sub">The laws of thermodynamics, entropy, and heat engines — why no engine is ever 100% efficient, worked with the rigor of a college engineering-science course. Requires Engineering 1 and AP Calculus BC — 18 lessons across 6 units. Course complete.</p>
    </a>
  </div>

  <h2>Coming Soon</h2>
  <div class="toc-list">
    <div class="toc-item is-soon" data-tier="advanced">
      <span class="toc-num">Coming Soon</span>
      <p class="toc-title">Mechatronics</p>
      <p class="toc-sub">Where mechanical, electrical, and software engineering meet — sensors, actuators, microcontrollers, and the control loops that tie them together. Will require Engineering 1 and Computer Programming 1.</p>
    </div>
    <div class="toc-item is-soon" data-tier="advanced">
      <span class="toc-num">Coming Soon</span>
      <p class="toc-title">Advanced Robotics</p>
      <p class="toc-sub">Sensors, actuators, control theory, and autonomy — designing a robot that senses its environment and decides what to do about it. Will require Engineering 1 and Computer Programming 1.</p>
    </div>
    <div class="toc-item is-soon" data-tier="advanced">
      <span class="toc-num">Coming Soon</span>
      <p class="toc-title">Nanotechnology</p>
```

with:

```html
    <a class="toc-item" href="Thermodynamics/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Thermodynamics</p>
      <p class="toc-sub">The laws of thermodynamics, entropy, and heat engines — why no engine is ever 100% efficient, worked with the rigor of a college engineering-science course. Requires Engineering 1 and AP Calculus BC — 18 lessons across 6 units. Course complete.</p>
    </a>
    <a class="toc-item" href="Mechatronics/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Mechatronics</p>
      <p class="toc-sub">Where mechanical, electrical, and software engineering meet — sensors, actuators, microcontrollers, and the control loops that tie them together — 43 lessons across 8 units. Requires Engineering 1 and Computer Programming 1. Course complete.</p>
    </a>
    <a class="toc-item" href="Advanced%20Robotics/index.html" data-tier="advanced">
      <span class="toc-num">Course</span>
      <p class="toc-title">Advanced Robotics</p>
      <p class="toc-sub">Sensors, actuators, control theory, and autonomy — designing a robot that senses its environment and decides what to do about it — 47 lessons across 8 units. Requires Engineering 1 and Computer Programming 1. Course complete.</p>
    </a>
  </div>

  <h2>Coming Soon</h2>
  <div class="toc-list">
    <div class="toc-item is-soon" data-tier="advanced">
      <span class="toc-num">Coming Soon</span>
      <p class="toc-title">Nanotechnology</p>
```

- [ ] **Step 3: Add the 2 new `PATHWAYS` entries**

In `public/assets/tests.js`, replace (currently lines 214-215, the last entry and closing bracket):

```js
    { name: 'AI Developer: CB/RWA', courses: ['Computer Programming 1', 'Computer Programming 2', 'Data Handling CB', 'AI Developer', 'Applied Machine/Deep Learning', 'Cloud Computing A', 'Cloud Computing B / DevOps'], projectId: 'ai-developer-cbrwa-capstone', lessons: 171 },
  ];
```

with:

```js
    { name: 'AI Developer: CB/RWA', courses: ['Computer Programming 1', 'Computer Programming 2', 'Data Handling CB', 'AI Developer', 'Applied Machine/Deep Learning', 'Cloud Computing A', 'Cloud Computing B / DevOps'], projectId: 'ai-developer-cbrwa-capstone', lessons: 171 },
    { name: 'Quantum Science', courses: ['AP Physics 2', 'AP Physics C: Electricity and Magnetism', 'Quantum Physics & Optics', 'Quantum Computing'], projectId: 'quantum-science-capstone', lessons: 124 },
    { name: 'Robotics & Mechatronics', courses: ['Engineering 1', 'Computer Programming 1', 'Mechatronics', 'Advanced Robotics'], projectId: 'robotics-mechatronics-capstone', lessons: 138 },
  ];
```

- [ ] **Step 4: Add 3 new `COURSE_PATHS` entries, in alphabetical position**

In `public/assets/tests.js`, replace:

```js
    'Advanced Algorithms': 'Advanced+ Courses/Advanced Algorithms',
    'Algebra/Geometry Fundamentals Review': 'Algebra Geometry Fundamentals Review',
```

with:

```js
    'Advanced Algorithms': 'Advanced+ Courses/Advanced Algorithms',
    'Advanced Robotics': 'Advanced Robotics',
    'Algebra/Geometry Fundamentals Review': 'Algebra Geometry Fundamentals Review',
```

Then replace:

```js
    'Linear Algebra B': 'Advanced+ Courses/Linear Algebra B',
    'Mathematical Proofs': 'Mathematical Proofs',
```

with:

```js
    'Linear Algebra B': 'Advanced+ Courses/Linear Algebra B',
    'Mathematical Proofs': 'Mathematical Proofs',
    'Mechatronics': 'Mechatronics',
```

Then replace:

```js
    'Quantum Physics & Optics': 'Quantum Physics and Optics',
```

with:

```js
    'Quantum Computing': 'Advanced+ Courses/Quantum Computing',
    'Quantum Physics & Optics': 'Quantum Physics and Optics',
```

- [ ] **Step 5: Add `PREREQUISITE_GRAPH` entries in `lib/plan-catalog.js`**

Replace:

```js
  'Engineering 1': ['AP Physics 1'],
  'Career Applied Engineering': ['Engineering 1'],
  'CAD & Prototyping': ['Engineering 1'],
  'Thermodynamics': ['AP Physics 2'],
  // Advanced+
  'Real Analysis A': ['AP Calculus BC'],
  'Real Analysis B': ['Real Analysis A'],
  'Advanced Algorithms': ['Computer Programming 1', 'Computer Programming 2'],
  'Linear Algebra B': ['Linear Algebra A'],
  'Topology: Fundamentals': ['Real Analysis A'],
};
```

with:

```js
  'Engineering 1': ['AP Physics 1'],
  'Career Applied Engineering': ['Engineering 1'],
  'CAD & Prototyping': ['Engineering 1'],
  'Thermodynamics': ['AP Physics 2'],
  'Mechatronics': ['Engineering 1', 'Computer Programming 1'],
  'Advanced Robotics': ['Engineering 1', 'Computer Programming 1'],
  // Advanced+
  'Real Analysis A': ['AP Calculus BC'],
  'Real Analysis B': ['Real Analysis A'],
  'Advanced Algorithms': ['Computer Programming 1', 'Computer Programming 2'],
  'Linear Algebra B': ['Linear Algebra A'],
  'Topology: Fundamentals': ['Real Analysis A'],
  'Quantum Computing': ['Linear Algebra A', 'Linear Algebra B'],
};
```

- [ ] **Step 6: `npm run build`**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: `npm test`**

Run: `npm test`
Expected: all 6 checks pass — `check-plan-catalog.js`'s existing cross-check now also validates the 3 new `PREREQUISITE_GRAPH` entries automatically, since the hub-page moves in Steps 1-2 make these 3 courses real `CATALOG.courses` entries.

- [ ] **Step 8: Verify against a production build**

```bash
npm run build && npm run start > /tmp/next-start.log 2>&1 &
```
Wait for `Ready`. Use this session cookie as `scripts/verify-page.mjs`'s 3rd argument (these pages are login-gated): `session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc`.

```bash
node scripts/verify-page.mjs "http://localhost:3000/advanced.html" "(() => { const link = document.querySelector('a[href=\"Advanced%2B%20Courses/Quantum%20Computing/index.html\"]'); return { ok: !!link && !document.querySelector('.is-soon p.toc-title')?.textContent?.includes('Quantum Computing') }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/engineering.html" "(() => { const m = document.querySelector('a[href=\"Mechatronics/index.html\"]'); const r = document.querySelector('a[href=\"Advanced%20Robotics/index.html\"]'); return { ok: !!m && !!r }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` on both — Quantum Computing is a real link on `advanced.html` and no longer in a `.is-soon` card; Mechatronics and Advanced Robotics are real links on `engineering.html`.

Stop the server: `lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9`

- [ ] **Step 9: Commit**

```bash
git add content/advanced.html content/engineering.html public/assets/tests.js lib/plan-catalog.js
git commit -m "$(cat <<'EOF'
Publish Quantum Computing, Mechatronics, Advanced Robotics as real courses

Moves all 3 off their hub pages' Coming Soon sections into the real
published course list, adds 2 new PATHWAYS entries (Quantum Science,
Robotics & Mechatronics — both previously blocked on exactly these
courses per pathways.html's own Coming Soon notes), 3 new COURSE_PATHS
entries, and 3 new PREREQUISITE_GRAPH entries so the AI plan generator
can now recommend them with a correct prerequisite chain.

The 2 new Pathway pages, 2 new capstone Project pages, and the
pathways.html Coming Soon -> published move are a separate follow-up
task — this task only establishes catalog membership.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: New Pathway pages, capstone Project pages, and `pathways.html` publish

**Files:**
- Create: `content/Pathways/quantum-science.html`
- Create: `content/Pathways/robotics-mechatronics.html`
- Create: `content/Projects/quantum-science-capstone.html`
- Create: `content/Projects/robotics-mechatronics-capstone.html`
- Modify: `content/pathways.html`

**Interfaces:**
- Consumes: `PATHWAYS` entries `Quantum Science` and `Robotics & Mechatronics` (Task 1), `COURSE_PATHS` entries for the 3 new courses (Task 1) — both required for `mountPathwayRoadmap` and course links to resolve correctly.
- Produces: nothing new for other tasks — this is the last task in the plan.

- [ ] **Step 1: Create `content/Pathways/quantum-science.html`**

```html
<meta charset="UTF-8">
<link rel="icon" href="../favicon.ico?v=1" type="image/x-icon">
<title>Quantum Science Pathway — STEM+</title>
<link rel="stylesheet" href="../assets/style.css">
<script src="../assets/tests.js" defer></script>
<div class="page" data-pathway="quantum-science">
  <span class="kicker">STEM+ · Pathways · Quantum Science</span>
  <h1>Quantum Science</h1>
  <p class="subtitle">Classical mechanics and electromagnetism, then optics, then the leap into quantum computing itself. Pass every course exam below and the capstone unlocks — trace a real quantum circuit from state vector to measurement outcome, and connect it back to the classical physics it grew out of.</p>
  <p class="nav-links"><a href="../pathways.html" class="nav-toc">← Pathways</a> <a href="../index.html" class="nav-toc">STEM+ Home →</a></p>

  <div data-track-plan></div>

  <h2>Your Roadmap</h2>
  <div data-pathway-roadmap="Quantum Science"></div>

  <footer class="lesson-footer">STEM+ · Pathways · Quantum Science — 4 courses, 124 lessons, one capstone</footer>
</div>
```

- [ ] **Step 2: Create `content/Pathways/robotics-mechatronics.html`**

```html
<meta charset="UTF-8">
<link rel="icon" href="../favicon.ico?v=1" type="image/x-icon">
<title>Robotics &amp; Mechatronics Pathway — STEM+</title>
<link rel="stylesheet" href="../assets/style.css">
<script src="../assets/tests.js" defer></script>
<div class="page" data-pathway="robotics-mechatronics">
  <span class="kicker">STEM+ · Pathways · Robotics &amp; Mechatronics</span>
  <h1>Robotics &amp; Mechatronics</h1>
  <p class="subtitle">Engineering fundamentals and programming, then the sensors/actuators/control-loop toolkit, then full autonomous systems. Pass every course exam below and the capstone unlocks — design a working sensor-to-decision autonomous system and defend every trade-off in it.</p>
  <p class="nav-links"><a href="../pathways.html" class="nav-toc">← Pathways</a> <a href="../index.html" class="nav-toc">STEM+ Home →</a></p>

  <div data-track-plan></div>

  <h2>Your Roadmap</h2>
  <div data-pathway-roadmap="Robotics &amp; Mechatronics"></div>

  <footer class="lesson-footer">STEM+ · Pathways · Robotics &amp; Mechatronics — 4 courses, 138 lessons, one capstone</footer>
</div>
```

- [ ] **Step 3: Create `content/Projects/quantum-science-capstone.html`**

```html
<meta charset="UTF-8">
<link rel="icon" href="../favicon.ico?v=1" type="image/x-icon">
<title>Quantum Science Capstone — Projects — STEM+</title>
<link rel="stylesheet" href="../assets/style.css">
<script src="../assets/tests.js" defer></script>
<div class="page" data-pathway="quantum-science">
  <span class="kicker">STEM+ · Projects · Quantum Science Capstone</span>
  <h1>Quantum Science Capstone</h1>
  <p class="subtitle">An open-ended build, not a quiz — this project exists to see whether you've actually proved yourself on AP Physics 2, AP Physics C: Electricity and Magnetism, Quantum Physics &amp; Optics, and Quantum Computing.</p>
  <p class="nav-links"><a href="../Pathways/quantum-science.html" class="nav-toc">← Quantum Science Pathway</a> <a href="../projects.html" class="nav-toc">All Projects →</a></p>
  <div data-project-meta="Quantum Science"></div>

  <div data-project-gate data-required-courses="AP Physics 2|AP Physics C: Electricity and Magnetism|Quantum Physics & Optics|Quantum Computing">
    <div data-project-locked class="exam-locked" hidden></div>

    <div data-project-content hidden>
      <h2>The Brief</h2>
      <p>Trace a real quantum circuit from its initial state vector to a measured outcome, and connect it back to the classical physics that motivated it. It doesn't need to be a novel algorithm — it needs to show you can actually compute with quantum states and explain, in physical terms, why the classical picture breaks down.</p>

      <h3>Deliverables</h3>
      <ul>
        <li>A written or diagrammed connection between a classical E&amp;M or optics concept (e.g. polarization, wave interference) and its quantum analog (e.g. a qubit's state vector, a Bloch-sphere picture)</li>
        <li>A fully traced quantum circuit — at least 2 qubits, at least 3 gates (e.g. a Bell-state preparation, or a small Grover's-search instance) — showing the state vector after every gate</li>
        <li>A correct Born-rule probability calculation for every possible measurement outcome of that circuit</li>
        <li>A short written explanation of one real source of error (decoherence, gate noise, or readout error) that would affect an actual hardware run of this circuit</li>
        <li>A one-page reflection on where classical physical intuition (from AP Physics 2/C) helps and where it actively misleads once you're reasoning about superposition and entanglement</li>
      </ul>

      <h2>Reflection</h2>
      <p class="subtitle">Answer in your own words. There's no grading here — just save your answers below.</p>
      <div data-reflection data-project="quantum-science-capstone">
        <div class="reflection-item" data-reflection-item data-key="q1">
          <p class="reflection-prompt">1. Name one concept from AP Physics 2 (energy, fields, waves) that showed up again — reframed — somewhere in this project. What changed about how you had to think about it?</p>
          <textarea class="reflection-textarea" data-reflection-input></textarea>
        </div>
        <div class="reflection-item" data-reflection-item data-key="q2">
          <p class="reflection-prompt">2. AP Physics C: Electricity and Magnetism gave you a rigorous, calculus-based classical picture. Where did that picture most clearly stop being enough for this project?</p>
          <textarea class="reflection-textarea" data-reflection-input></textarea>
        </div>
        <div class="reflection-item" data-reflection-item data-key="q3">
          <p class="reflection-prompt">3. How did wave-particle duality or photon behavior from Quantum Physics &amp; Optics help you make sense of the qubit state vector you actually worked with?</p>
          <textarea class="reflection-textarea" data-reflection-input></textarea>
        </div>
        <div class="reflection-item" data-reflection-item data-key="q4">
          <p class="reflection-prompt">4. Which gate or algorithm from Quantum Computing did you build your circuit around, and why that one over the alternatives you considered?</p>
          <textarea class="reflection-textarea" data-reflection-input></textarea>
        </div>
        <div class="reflection-actions">
          <button data-reflection-save class="widget-btn">Save Reflection</button>
          <label><input type="checkbox" data-reflection-complete> Mark project complete</label>
          <span data-reflection-status class="reflection-status"></span>
        </div>
      </div>
    </div>
  </div>

  <footer class="lesson-footer">STEM+ · Projects · part of the <a href="../Pathways/quantum-science.html">Quantum Science</a> pathway</footer>
</div>
```

- [ ] **Step 4: Create `content/Projects/robotics-mechatronics-capstone.html`**

```html
<meta charset="UTF-8">
<link rel="icon" href="../favicon.ico?v=1" type="image/x-icon">
<title>Robotics &amp; Mechatronics Capstone — Projects — STEM+</title>
<link rel="stylesheet" href="../assets/style.css">
<script src="../assets/tests.js" defer></script>
<div class="page" data-pathway="robotics-mechatronics">
  <span class="kicker">STEM+ · Projects · Robotics &amp; Mechatronics Capstone</span>
  <h1>Robotics &amp; Mechatronics Capstone</h1>
  <p class="subtitle">An open-ended build, not a quiz — this project exists to see whether you've actually proved yourself on Engineering 1, Computer Programming 1, Mechatronics, and Advanced Robotics.</p>
  <p class="nav-links"><a href="../Pathways/robotics-mechatronics.html" class="nav-toc">← Robotics &amp; Mechatronics Pathway</a> <a href="../projects.html" class="nav-toc">All Projects →</a></p>
  <div data-project-meta="Robotics &amp; Mechatronics"></div>

  <div data-project-gate data-required-courses="Engineering 1|Computer Programming 1|Mechatronics|Advanced Robotics">
    <div data-project-locked class="exam-locked" hidden></div>

    <div data-project-content hidden>
      <h2>The Brief</h2>
      <p>Design a simple autonomous system — real hardware, a simulation, or a fully worked paper design if you don't have parts on hand — that combines a sensor, an actuator, a control loop, and a basic decision layer. It doesn't need to be original or ambitious; it needs to show every piece of the stack actually working together, not just described in isolation.</p>

      <h3>Deliverables</h3>
      <ul>
        <li>A system diagram showing every sensor, actuator, the control loop, and the decision layer, with signal/data flow between them</li>
        <li>Working pseudocode or real code implementing the control loop (e.g. a PID controller) and a simple decision layer (e.g. a finite state machine)</li>
        <li>A written explanation of your sensing/perception approach — what data you're reading, and how noise or uncertainty in it is handled</li>
        <li>A path-planning or motion-control component, even a simple one (waypoint following, basic obstacle avoidance logic)</li>
        <li>A short "what would break in the real world" section — sensor noise, actuation latency, mechanical imperfection, and how you'd detect or compensate for each</li>
        <li>A one-page design note on one real engineering trade-off you made, and what you gave up by making it</li>
      </ul>

      <h2>Reflection</h2>
      <p class="subtitle">Answer in your own words. There's no grading here — just save your answers below.</p>
      <div data-reflection data-project="robotics-mechatronics-capstone">
        <div class="reflection-item" data-reflection-item data-key="q1">
          <p class="reflection-prompt">1. Engineering 1 taught you to think in trade-offs before committing to a design. Which trade-off from this project came straight out of that habit?</p>
          <textarea class="reflection-textarea" data-reflection-input></textarea>
        </div>
        <div class="reflection-item" data-reflection-item data-key="q2">
          <p class="reflection-prompt">2. Which Computer Programming 1 fundamental (a loop, a function boundary, a specific data structure) mattered most in your control/decision code, and why?</p>
          <textarea class="reflection-textarea" data-reflection-input></textarea>
        </div>
        <div class="reflection-item" data-reflection-item data-key="q3">
          <p class="reflection-prompt">3. Walk through your sensor/actuator/control-loop choice from Mechatronics. What almost went wrong, and what did you change because of it?</p>
          <textarea class="reflection-textarea" data-reflection-input></textarea>
        </div>
        <div class="reflection-item" data-reflection-item data-key="q4">
          <p class="reflection-prompt">4. Which planning or autonomy idea from Advanced Robotics did you actually use, and what's the one trade-off in it you're least sure about?</p>
          <textarea class="reflection-textarea" data-reflection-input></textarea>
        </div>
        <div class="reflection-actions">
          <button data-reflection-save class="widget-btn">Save Reflection</button>
          <label><input type="checkbox" data-reflection-complete> Mark project complete</label>
          <span data-reflection-status class="reflection-status"></span>
        </div>
      </div>
    </div>
  </div>

  <footer class="lesson-footer">STEM+ · Projects · part of the <a href="../Pathways/robotics-mechatronics.html">Robotics &amp; Mechatronics</a> pathway</footer>
</div>
```

- [ ] **Step 5: Move both pathways in `content/pathways.html` from Coming Soon to published**

Replace:

```html
    <a class="toc-item" href="Pathways/cloud-devops.html" data-pathway="cloud-devops">
      <span class="toc-num">Pathway</span>
      <p class="toc-title">Cloud &amp; DevOps</p>
      <p class="toc-sub">Computer Programming 1 → Cloud Computing A → Cloud Computing B / DevOps — 3 courses, 64 lessons, one capstone. From your first program to designing and shipping the pipeline that runs it in production.</p>
      <span data-pathway-progress data-required-courses="Computer Programming 1|Cloud Computing A|Cloud Computing B / DevOps"></span>
    </a>
  </div>

  <h2>Coming Soon</h2>
  <p class="subtitle">These are real routes we're building toward — each is blocked on at least one course that isn't live yet. They'll move up to Published automatically once those courses ship.</p>
  <div class="toc-list">
    <div class="toc-item is-soon">
      <span class="toc-num">Coming Soon</span>
      <p class="toc-title">Robotics &amp; Mechatronics</p>
      <p class="toc-sub">Engineering 1 → Computer Programming 1 → Mechatronics → Advanced Robotics. Needs Mechatronics and Advanced Robotics, both still unbuilt.</p>
    </div>
    <div class="toc-item is-soon">
      <span class="toc-num">Coming Soon</span>
      <p class="toc-title">Quantum Science</p>
      <p class="toc-sub">AP Physics 2 → AP Physics C: Electricity and Magnetism → Quantum Physics &amp; Optics → Quantum Computing. Needs Quantum Computing, still unbuilt.</p>
    </div>
  </div>

  <h2>Career Pathways</h2>
```

with:

```html
    <a class="toc-item" href="Pathways/cloud-devops.html" data-pathway="cloud-devops">
      <span class="toc-num">Pathway</span>
      <p class="toc-title">Cloud &amp; DevOps</p>
      <p class="toc-sub">Computer Programming 1 → Cloud Computing A → Cloud Computing B / DevOps — 3 courses, 64 lessons, one capstone. From your first program to designing and shipping the pipeline that runs it in production.</p>
      <span data-pathway-progress data-required-courses="Computer Programming 1|Cloud Computing A|Cloud Computing B / DevOps"></span>
    </a>
    <a class="toc-item" href="Pathways/robotics-mechatronics.html" data-pathway="robotics-mechatronics">
      <span class="toc-num">Pathway</span>
      <p class="toc-title">Robotics &amp; Mechatronics</p>
      <p class="toc-sub">Engineering 1 → Computer Programming 1 → Mechatronics → Advanced Robotics — 4 courses, 138 lessons, one capstone. From engineering fundamentals to a working sensor-to-decision autonomous system.</p>
      <span data-pathway-progress data-required-courses="Engineering 1|Computer Programming 1|Mechatronics|Advanced Robotics"></span>
    </a>
    <a class="toc-item" href="Pathways/quantum-science.html" data-pathway="quantum-science">
      <span class="toc-num">Pathway</span>
      <p class="toc-title">Quantum Science</p>
      <p class="toc-sub">AP Physics 2 → AP Physics C: Electricity and Magnetism → Quantum Physics &amp; Optics → Quantum Computing — 4 courses, 124 lessons, one capstone. From classical mechanics and electromagnetism to computing with real quantum circuits.</p>
      <span data-pathway-progress data-required-courses="AP Physics 2|AP Physics C: Electricity and Magnetism|Quantum Physics &amp; Optics|Quantum Computing"></span>
    </a>
  </div>

  <h2>Career Pathways</h2>
```

- [ ] **Step 6: `npm run build`**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Verify against a production build**

```bash
npm run build && npm run start > /tmp/next-start.log 2>&1 &
```
Wait for `Ready`. Use the same session cookie as Task 1's Step 8.

```bash
node scripts/verify-page.mjs "http://localhost:3000/Pathways/quantum-science.html" "(() => { const nodes = document.querySelectorAll('.roadmap-node'); return { ok: nodes.length === 5, count: nodes.length }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/Pathways/robotics-mechatronics.html" "(() => { const nodes = document.querySelectorAll('.roadmap-node'); return { ok: nodes.length === 5, count: nodes.length }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` on both — 5 roadmap nodes (4 courses + capstone) on each, confirming `mountPathwayRoadmap` correctly resolved the new `PATHWAYS` entries.

```bash
node scripts/verify-page.mjs "http://localhost:3000/Projects/quantum-science-capstone.html" "(() => { const gate = document.querySelector('[data-project-gate]'); return { ok: !!gate && gate.getAttribute('data-required-courses').split('|').length === 4 }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
node scripts/verify-page.mjs "http://localhost:3000/Projects/robotics-mechatronics-capstone.html" "(() => { const gate = document.querySelector('[data-project-gate]'); return { ok: !!gate && gate.getAttribute('data-required-courses').split('|').length === 4 }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` on both — the project gate is present with all 4 required courses.

```bash
node scripts/verify-page.mjs "http://localhost:3000/pathways.html" "(() => { const links = Array.from(document.querySelectorAll('a.toc-item')).map((a) => a.getAttribute('href')); const comingSoonHeading = Array.from(document.querySelectorAll('h2')).find((h) => h.textContent.trim() === 'Coming Soon'); return { ok: links.includes('Pathways/quantum-science.html') && links.includes('Pathways/robotics-mechatronics.html') && !comingSoonHeading, hasComingSoon: !!comingSoonHeading }; })()" "session=eyJ1c2VySWQiOjI3LCJpc0RldmVsb3BlciI6ZmFsc2UsImV4cCI6MTc4OTUyNzczNzE2OH0.K5zzSaws6MCbuC6uwHjWW9zCaZknr2VJr_Lh03Ig0Jc"
```
Expected: `PASS` — both new pathways linked from the main list, and the "Coming Soon" section is gone entirely (it had exactly these 2 entries).

Stop the server: `lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9`

- [ ] **Step 8: `npm test`**

Run: `npm test`
Expected: all 6 checks pass — `check-content-links.js` confirms no broken links from the 4 new pages.

- [ ] **Step 9: Commit**

```bash
git add "content/Pathways/quantum-science.html" "content/Pathways/robotics-mechatronics.html" "content/Projects/quantum-science-capstone.html" "content/Projects/robotics-mechatronics-capstone.html" content/pathways.html
git commit -m "$(cat <<'EOF'
Publish the Quantum Science and Robotics & Mechatronics pathways

Two new Pathway pages (roadmap visual only, matching every other
pathway page since Phase 2 — no flat course list), two new capstone
Project pages (same data-project-gate/data-reflection structure as
the existing 8 capstones), and pathways.html moves both out of
Coming Soon into the main published list — its Coming Soon section
had exactly these two entries, so it's now gone entirely, matching
its own stated promise ("they'll move up to Published automatically
once those courses ship").

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** hub page moves (Task 1 Steps 1-2), `PATHWAYS`/`COURSE_PATHS`/`PREREQUISITE_GRAPH` additions (Task 1 Steps 3-5), 2 new Pathway pages using `mountPathwayRoadmap` not the flat-list format (Task 2 Steps 1-2), 2 new capstone Project pages matching the existing 8-capstone structure with 4 reflection questions each (Task 2 Steps 3-4), `pathways.html` Coming Soon → published move (Task 2 Step 5). All spec sections covered.
- **Placeholder scan:** none — every step has complete code or a runnable command with a stated expected result. Real lesson counts (40/43/47, sums 124/138) used throughout, not placeholders.
- **Type consistency:** `PATHWAYS` entries' `name` fields (`'Quantum Science'`, `'Robotics & Mechatronics'`) match exactly between Task 1's array entries and Task 2's `data-pathway-roadmap="..."` marker values — verified character-for-character, including the `&amp;` HTML-entity encoding for the ampersand in the second name. `COURSE_PATHS` values match the real, `ls`-confirmed directory names exactly.
