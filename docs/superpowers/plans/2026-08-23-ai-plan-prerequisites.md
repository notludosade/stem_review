# Realistic Course Sequencing for AI-Generated Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI-generated custom plan (`new.html`'s "Describe Your Own Goal") never places a course before its real prerequisite, and the model is explicitly told about prerequisites and encouraged to be thorough rather than minimal.

**Architecture:** A new hand-maintained `PREREQUISITE_GRAPH` in `lib/plan-catalog.js`, used two ways: fed into `pages/api/generate-plan.js`'s system prompt (so the model makes better initial choices) and used by a new deterministic `reorderByPrerequisites()` inside `validatePlan()` (a stable topological sort that guarantees correct order regardless of what the model does — never adds or removes a course).

**Tech Stack:** Plain Node.js (`lib/`, `pages/api/`), the existing `scripts/check-*.js` assertion-script test convention.

## Global Constraints

- `PREREQUISITE_GRAPH` covers every course with a genuine prerequisite across all 4 subject hubs (math/technology/science/engineering) plus Advanced+ — confirmed with the user as full-catalog scope, not just math.
- Kept as a separate table from `public/assets/tests.js`'s own `PREREQUISITES` (Phase 4's Readiness UI, scoped to only the 5 Advanced+ courses) — different runtime, different purpose, not unified.
- `reorderByPrerequisites()` only reorders courses already in the plan — it never adds a course the model didn't choose. Auto-inserting missing prerequisites is explicitly out of scope (confirmed with the user).
- The system prompt's new thoroughness instruction is prompt-only guidance, not a deterministic minimum enforced in code.

---

### Task 1: `PREREQUISITE_GRAPH` + deterministic reorder

**Files:**
- Modify: `lib/plan-catalog.js`
- Modify: `scripts/check-plan-catalog.js`

**Interfaces:**
- Consumes: `CATALOG.courses` (existing, unchanged).
- Produces: `PREREQUISITE_GRAPH` (exported, `{[courseName: string]: string[]}`) and `reorderByPrerequisites(courses, graph)` (internal to `lib/plan-catalog.js`, not exported — Task 2 only needs `PREREQUISITE_GRAPH`). `validatePlan`'s existing signature and return shape are unchanged; only its `courses` array's *order* can now differ from the raw model output.

- [ ] **Step 1: Add `PREREQUISITE_GRAPH`, `reorderByPrerequisites`, and wire both into `validatePlan`**

In `lib/plan-catalog.js`, replace everything from the `const CATALOG = {` line through the file's end (currently lines 82-128):

```js
const CATALOG = {
  courses: buildCourses(),
  projects: buildProjects(),
  applications: buildApplications(),
  problemSets: buildProblemSets(),
};

// Drops anything the model referenced that isn't real, and enriches every
// surviving reference with its real display data (title, problem-set slug,
// project title) so the client never needs a second lookup table. A
// hallucinated course/project/problem-set/application is silently dropped,
// never surfaced and never a request-level failure.
function validatePlan(rawPlan, catalog) {
  const courseNames = new Set(catalog.courses.map((c) => c.name));
  const projectById = new Map(catalog.projects.map((p) => [p.id, p]));
  const applicationById = new Map(catalog.applications.map((a) => [a.id, a]));
  const problemSetByCourse = new Map(catalog.problemSets.map((p) => [p.course, p]));

  const courses = (rawPlan.courses || [])
    .filter((c) => c && courseNames.has(c.name))
    .map((c) => ({ name: c.name, reason: String(c.reason || '') }));

  let project = null;
  if (rawPlan.project && rawPlan.project.id && projectById.has(rawPlan.project.id)) {
    const catalogProject = projectById.get(rawPlan.project.id);
    project = { id: catalogProject.id, title: catalogProject.title, reason: String(rawPlan.project.reason || '') };
  }

  const problemSets = (rawPlan.problemSets || [])
    .filter((p) => p && problemSetByCourse.has(p.course))
    .map((p) => {
      const catalogEntry = problemSetByCourse.get(p.course);
      return { course: catalogEntry.course, slug: catalogEntry.slug, reason: String(p.reason || '') };
    });

  const applications = (rawPlan.applications || [])
    .filter((a) => a && applicationById.has(a.id))
    .map((a) => {
      const catalogEntry = applicationById.get(a.id);
      return { id: catalogEntry.id, title: catalogEntry.title, reason: String(a.reason || '') };
    });

  return { summary: String(rawPlan.summary || ''), courses, project, problemSets, applications };
}

module.exports = { CATALOG, validatePlan };
```

with:

```js
const CATALOG = {
  courses: buildCourses(),
  projects: buildProjects(),
  applications: buildApplications(),
  problemSets: buildProblemSets(),
};

// Course-level prerequisites for the AI plan generator — every course with
// a genuine prerequisite, across all four subject hubs plus Advanced+. Only
// used by pages/api/generate-plan.js's system prompt and by
// reorderByPrerequisites() below; deliberately kept separate from
// public/assets/tests.js's own PREREQUISITES table (Phase 4's course-context
// "Readiness" UI, scoped to only the 5 Advanced+ courses) — different
// runtime (server vs. browser), different purpose, not worth unifying
// across that boundary for 5 overlapping rows.
const PREREQUISITE_GRAPH = {
  // Math
  'AP Calculus BC': ['Precalculus'],
  'Multivariable Calculus': ['AP Calculus BC'],
  'Linear Algebra A': ['AP Calculus BC'],
  'Differential Equations': ['Multivariable Calculus'],
  'Discrete Math': ['Precalculus'],
  'Mathematical Proofs': ['Precalculus'],
  // Technology / CS
  'Computer Programming 2': ['Computer Programming 1'],
  'Computer Programming 2+': ['Computer Programming 2'],
  'Computer Programming Ethics': ['Computer Programming 1'],
  'Programming with Packages': ['Computer Programming 1'],
  'Data Handling CB': ['Computer Programming 2'],
  'Software Engineering': ['Computer Programming 2'],
  'Systems Programming & Architecture: CS': ['Computer Programming 2'],
  'Computer Networking Fundamentals': ['Computer Programming 1'],
  'Cloud Computing A': ['Computer Programming 1'],
  'Cloud Computing B / DevOps': ['Cloud Computing A'],
  'AI Developer': ['Computer Programming 2', 'Data Handling CB'],
  'Applied Machine/Deep Learning': ['AI Developer'],
  'Game Engine Architecture': ['Computer Programming 2'],
  'Video Game Modding': ['Computer Programming 1'],
  'Designing/Mastering Operating System': ['Systems Programming & Architecture: CS'],
  // Science
  'AP Physics 1': ['Precalculus'],
  'AP Physics 2': ['AP Physics 1'],
  'AP Physics C: Mechanics': ['AP Physics 1', 'AP Calculus BC'],
  'AP Physics C: Electricity and Magnetism': ['AP Physics C: Mechanics'],
  'Quantum Physics & Optics': ['AP Physics C: Electricity and Magnetism'],
  'AP Chemistry': ['Precalculus'],
  'Organic Chemistry': ['AP Chemistry'],
  // Engineering
  'Engineering 1': ['AP Physics 1'],
  'Career Applied Engineering': ['Engineering 1'],
  'CAD & Prototyping': ['Engineering 1'],
  'Thermodynamics': ['AP Physics 2'],
  'Mechatronics': ['Engineering 1', 'Computer Programming 1'],
  'Advanced Robotics': ['Mechatronics'],
  'Nanotechnology': ['Thermodynamics'],
  'Advanced CB Engineering': ['Career Applied Engineering'],
  // Advanced+
  'Real Analysis A': ['AP Calculus BC'],
  'Real Analysis B': ['Real Analysis A'],
  'Advanced Algorithms': ['Computer Programming 1', 'Computer Programming 2'],
  'Linear Algebra B': ['Linear Algebra A'],
  'Topology: Fundamentals': ['Real Analysis A'],
};

// Deterministic reorder (never adds or removes a course) so a prerequisite
// always sorts before its dependent, using only the PREREQUISITE_GRAPH
// edges where BOTH courses are present in this specific plan — a stable
// topological sort (Kahn's algorithm, ties broken by original position) so
// unrelated courses keep the order the model chose. If the graph data ever
// contains a cycle, no course in that cycle can reach in-degree 0 and the
// sort would silently drop it — fails safe by returning the original,
// unsorted list instead of ever dropping a course from a student's plan.
function reorderByPrerequisites(courses, graph) {
  const names = courses.map((c) => c.name);
  const nameSet = new Set(names);
  const indexOf = new Map(names.map((name, i) => [name, i]));

  const inDegree = new Map(names.map((name) => [name, 0]));
  const dependents = new Map(names.map((name) => [name, []]));
  names.forEach((name) => {
    (graph[name] || []).filter((prereq) => nameSet.has(prereq)).forEach((prereq) => {
      dependents.get(prereq).push(name);
      inDegree.set(name, inDegree.get(name) + 1);
    });
  });

  const available = names.filter((name) => inDegree.get(name) === 0);
  available.sort((a, b) => indexOf.get(a) - indexOf.get(b));

  const sortedNames = [];
  while (available.length > 0) {
    const name = available.shift();
    sortedNames.push(name);
    dependents.get(name).forEach((dependent) => {
      inDegree.set(dependent, inDegree.get(dependent) - 1);
      if (inDegree.get(dependent) === 0) {
        const pos = indexOf.get(dependent);
        let i = 0;
        while (i < available.length && indexOf.get(available[i]) < pos) i++;
        available.splice(i, 0, dependent);
      }
    });
  }

  if (sortedNames.length !== names.length) return courses;
  const courseByName = new Map(courses.map((c) => [c.name, c]));
  return sortedNames.map((name) => courseByName.get(name));
}

// Drops anything the model referenced that isn't real, and enriches every
// surviving reference with its real display data (title, problem-set slug,
// project title) so the client never needs a second lookup table. A
// hallucinated course/project/problem-set/application is silently dropped,
// never surfaced and never a request-level failure. The surviving course
// array is also reordered so a prerequisite always precedes its dependent.
function validatePlan(rawPlan, catalog) {
  const courseNames = new Set(catalog.courses.map((c) => c.name));
  const projectById = new Map(catalog.projects.map((p) => [p.id, p]));
  const applicationById = new Map(catalog.applications.map((a) => [a.id, a]));
  const problemSetByCourse = new Map(catalog.problemSets.map((p) => [p.course, p]));

  const courses = reorderByPrerequisites(
    (rawPlan.courses || [])
      .filter((c) => c && courseNames.has(c.name))
      .map((c) => ({ name: c.name, reason: String(c.reason || '') })),
    PREREQUISITE_GRAPH
  );

  let project = null;
  if (rawPlan.project && rawPlan.project.id && projectById.has(rawPlan.project.id)) {
    const catalogProject = projectById.get(rawPlan.project.id);
    project = { id: catalogProject.id, title: catalogProject.title, reason: String(rawPlan.project.reason || '') };
  }

  const problemSets = (rawPlan.problemSets || [])
    .filter((p) => p && problemSetByCourse.has(p.course))
    .map((p) => {
      const catalogEntry = problemSetByCourse.get(p.course);
      return { course: catalogEntry.course, slug: catalogEntry.slug, reason: String(p.reason || '') };
    });

  const applications = (rawPlan.applications || [])
    .filter((a) => a && applicationById.has(a.id))
    .map((a) => {
      const catalogEntry = applicationById.get(a.id);
      return { id: catalogEntry.id, title: catalogEntry.title, reason: String(a.reason || '') };
    });

  return { summary: String(rawPlan.summary || ''), courses, project, problemSets, applications };
}

module.exports = { CATALOG, PREREQUISITE_GRAPH, validatePlan };
```

- [ ] **Step 2: Cross-check `PREREQUISITE_GRAPH` against the real catalog, and test the reorder**

In `scripts/check-plan-catalog.js`, change the import line (currently line 2):

```js
const { CATALOG, validatePlan } = require('../lib/plan-catalog');
```

to:

```js
const { CATALOG, PREREQUISITE_GRAPH, validatePlan } = require('../lib/plan-catalog');
```

Then, immediately before the final `console.log('check-plan-catalog: OK');` line, insert:

```js
// Every PREREQUISITE_GRAPH key and prerequisite value must be a real
// catalog course name — a typo here would silently produce a dead
// relationship (the AI prompt just wouldn't mention it, and
// reorderByPrerequisites would just skip it — no error, just wrong data).
const catalogCourseNames = new Set(CATALOG.courses.map((c) => c.name));
Object.keys(PREREQUISITE_GRAPH).forEach((course) => {
  assert.ok(catalogCourseNames.has(course), `PREREQUISITE_GRAPH key "${course}" is not a real catalog course`);
  PREREQUISITE_GRAPH[course].forEach((prereq) => {
    assert.ok(catalogCourseNames.has(prereq), `PREREQUISITE_GRAPH["${course}"] lists "${prereq}", which is not a real catalog course`);
  });
});

// reorderByPrerequisites (exercised through validatePlan): a deliberately
// scrambled course order must come back sorted so every prerequisite
// precedes its dependent, with no course added or removed.
const rawPlanScrambled = {
  summary: '',
  courses: [
    { name: 'Linear Algebra A', reason: 'c' },
    { name: 'Precalculus', reason: 'a' },
    { name: 'AP Calculus BC', reason: 'b' },
  ],
  project: null,
  problemSets: [],
  applications: [],
};
const reordered = validatePlan(rawPlanScrambled, CATALOG).courses.map((c) => c.name);
assert.deepStrictEqual(reordered, ['Precalculus', 'AP Calculus BC', 'Linear Algebra A']);
```

- [ ] **Step 3: Run it**

Run: `node scripts/check-plan-catalog.js`
Expected: `check-plan-catalog: OK` — this exercises every new assertion, including the reorder test and the full `PREREQUISITE_GRAPH` cross-check against all ~35 entries.

- [ ] **Step 4: `npm test`**

Run: `npm test`
Expected: all 5 checks pass.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-catalog.js scripts/check-plan-catalog.js
git commit -m "$(cat <<'EOF'
Add a course prerequisite graph and deterministic plan reordering

The AI-generated custom plan could place a course before its real
prerequisite (e.g. Precalculus straight to Linear Algebra A, no
Calculus in between) because validatePlan never knew course
relationships existed — it only checked whether each course was real.

PREREQUISITE_GRAPH covers every course with a genuine prerequisite
across all four subject hubs plus Advanced+. reorderByPrerequisites,
now called from validatePlan, is a deterministic topological sort
that guarantees a prerequisite always precedes its dependent in the
final plan — it only reorders courses the model already chose, never
adds one, so a plan's course count and selection stay exactly what
the model decided.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: System prompt — teach the model about prerequisites and thoroughness

**Files:**
- Modify: `pages/api/generate-plan.js`
- Create: `scripts/check-generate-plan-prompt.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PREREQUISITE_GRAPH` from Task 1 (`require('../../lib/plan-catalog')`).
- Produces: `buildSystemPrompt` attached to the exported request handler (`handler.buildSystemPrompt`) so it's testable without a live API call. No other module depends on this.

- [ ] **Step 1: Import `PREREQUISITE_GRAPH` and rewrite `buildSystemPrompt`**

In `pages/api/generate-plan.js`, change the import line (currently line 4):

```js
const { CATALOG, validatePlan } = require('../../lib/plan-catalog');
```

to:

```js
const { CATALOG, PREREQUISITE_GRAPH, validatePlan } = require('../../lib/plan-catalog');
```

Then replace the `buildSystemPrompt` function (currently lines 9-25):

```js
function buildSystemPrompt(catalog) {
  const courseLines = catalog.courses.map((c) => `- ${c.name}: ${c.blurb}`).join('\n');
  const projectLines = catalog.projects.map((p) => `- ${p.id}: ${p.title} — ${p.blurb}`).join('\n');
  const problemSetLines = catalog.problemSets.map((p) => `- ${p.course}: ${p.blurb}`).join('\n');
  const applicationLines = catalog.applications.map((a) => `- ${a.id}: ${a.title}`).join('\n');

  return 'You are building a custom STEM+ learning plan for a highly motivated high schooler, from their own description of what they want to pursue. ' +
    'STEM+ is a free site with courses, capstone projects, practice problem sets, and short real-world "Applications" pages.\n\n' +
    'Build the plan using ONLY the real courses, projects, problem sets, and applications listed below — never invent one, never rename one. ' +
    "A course sequence can freely mix across subjects; it is not limited to any single existing pathway.\n\n" +
    `Available courses:\n${courseLines}\n\n` +
    `Available capstone projects (pick at most one, only if it genuinely fits the courses you chose):\n${projectLines}\n\n` +
    `Available problem sets (extra practice once a course is underway):\n${problemSetLines}\n\n` +
    `Available Applications pages (short real-world application reads):\n${applicationLines}\n\n` +
    'Call submit_plan with: a 2-3 sentence summary of the plan and why it fits the student\'s goal; an ordered array of 2-6 courses, each with a ' +
    'one-sentence reason tied to the student\'s stated goal; a project (set id to the empty string "" if none of the listed projects is a strong ' +
    'match for the chosen courses — never force one); 0-3 problemSets; 0-3 applications.';
}
```

with:

```js
function buildSystemPrompt(catalog) {
  const courseLines = catalog.courses.map((c) => `- ${c.name}: ${c.blurb}`).join('\n');
  const projectLines = catalog.projects.map((p) => `- ${p.id}: ${p.title} — ${p.blurb}`).join('\n');
  const problemSetLines = catalog.problemSets.map((p) => `- ${p.course}: ${p.blurb}`).join('\n');
  const applicationLines = catalog.applications.map((a) => `- ${a.id}: ${a.title}`).join('\n');
  const prerequisiteLines = Object.keys(PREREQUISITE_GRAPH)
    .map((course) => `- ${course} requires: ${PREREQUISITE_GRAPH[course].join(', ')}`)
    .join('\n');

  return 'You are building a custom STEM+ learning plan for a highly motivated high schooler, from their own description of what they want to pursue. ' +
    'STEM+ is a free site with courses, capstone projects, practice problem sets, and short real-world "Applications" pages.\n\n' +
    'Build the plan using ONLY the real courses, projects, problem sets, and applications listed below — never invent one, never rename one. ' +
    "A course sequence can freely mix across subjects; it is not limited to any single existing pathway.\n\n" +
    `Available courses:\n${courseLines}\n\n` +
    'Known course prerequisites — if you include a course below, also include its listed prerequisites in the plan unless the student\'s own ' +
    'description makes clear they already know that material. Prefer dropping a less essential course over silently skipping a genuine ' +
    `prerequisite:\n${prerequisiteLines}\n\n` +
    `Available capstone projects (pick at most one, only if it genuinely fits the courses you chose):\n${projectLines}\n\n` +
    `Available problem sets (extra practice once a course is underway):\n${problemSetLines}\n\n` +
    `Available Applications pages (short real-world application reads):\n${applicationLines}\n\n` +
    'Call submit_plan with: a 2-3 sentence summary of the plan and why it fits the student\'s goal; an ordered array of 2-6 courses, each with a ' +
    'one-sentence reason tied to the student\'s stated goal; a project (set id to the empty string "" if none of the listed projects is a strong ' +
    'match for the chosen courses — never force one); 0-3 problemSets; 0-3 applications. Favor thoroughness over minimalism: use as much of that ' +
    'budget as genuinely serves the student\'s stated goal — a real prerequisite chain, relevant practice, and a fitting real-world Application ' +
    'all make for a plan the student learns more from, not just one that technically answers their prompt.';
}
```

- [ ] **Step 2: Make `buildSystemPrompt` reachable for testing without touching the Next.js API contract**

The file currently defines the request handler as an anonymous default export (`module.exports = async (req, res) => { ... };`, opening at what's currently line 29 and closing at the file's final line, 107). Change it to a named `handler` function with `buildSystemPrompt` attached before export, so it's reachable for testing without a live API call. Next.js only requires the default export to be callable as `(req, res) => ...` — an extra property on that same function object doesn't change its behavior as an API route.

Replace the opening line (currently line 29):

```js
module.exports = async (req, res) => {
```

with:

```js
async function handler(req, res) {
```

Replace the file's final 4 lines (currently lines 104-107 — the end of the `catch` block, unique in the file: it's the only occurrence of this exact `res.json({ error: 'plan generation is temporarily unavailable, try again shortly' });` line immediately followed by a bare closing brace):

```js
    res.statusCode = 502;
    res.json({ error: 'plan generation is temporarily unavailable, try again shortly' });
  }
};
```

with:

```js
    res.statusCode = 502;
    res.json({ error: 'plan generation is temporarily unavailable, try again shortly' });
  }
}

handler.buildSystemPrompt = buildSystemPrompt;
module.exports = handler;
```

- [ ] **Step 3: Write `scripts/check-generate-plan-prompt.js`**

```js
const assert = require('assert');
const { CATALOG, PREREQUISITE_GRAPH } = require('../lib/plan-catalog');
const { buildSystemPrompt } = require('../pages/api/generate-plan');

const prompt = buildSystemPrompt(CATALOG);

// Every PREREQUISITE_GRAPH relationship must actually appear in the text
// sent to Claude, or the model has no way to know about it.
Object.keys(PREREQUISITE_GRAPH).forEach((course) => {
  assert.ok(prompt.includes(`${course} requires: ${PREREQUISITE_GRAPH[course].join(', ')}`),
    `prompt is missing the prerequisite line for "${course}"`);
});

assert.ok(prompt.includes('also include its listed prerequisites'), 'prompt is missing the prerequisite-inclusion instruction');
assert.ok(prompt.toLowerCase().includes('favor thoroughness'), 'prompt is missing the thoroughness instruction');

console.log('check-generate-plan-prompt: OK');
```

- [ ] **Step 4: Run it**

Run: `node scripts/check-generate-plan-prompt.js`
Expected: `check-generate-plan-prompt: OK`.

- [ ] **Step 5: Wire it into `npm test`**

In `package.json`, change the `"test"` script (currently line 10):

```json
    "test": "node scripts/check-auth-session.js && node scripts/check-password.js && node scripts/check-content.js && node scripts/check-content-links.js && node scripts/check-plan-catalog.js",
```

to:

```json
    "test": "node scripts/check-auth-session.js && node scripts/check-password.js && node scripts/check-content.js && node scripts/check-content-links.js && node scripts/check-plan-catalog.js && node scripts/check-generate-plan-prompt.js",
```

- [ ] **Step 6: `npm run build`**

Run: `npm run build`
Expected: succeeds — confirms the `handler`/`module.exports` restructuring in Step 2 didn't break the Next.js API route.

- [ ] **Step 7: `npm test`**

Run: `npm test`
Expected: all 6 checks pass (5 existing + the new one).

- [ ] **Step 8: Commit**

```bash
git add pages/api/generate-plan.js scripts/check-generate-plan-prompt.js package.json
git commit -m "$(cat <<'EOF'
Tell the AI plan generator about prerequisites and favor thoroughness

buildSystemPrompt previously gave the model a flat course list with no
relationship data — it had to guess realistic sequencing from names
and one-sentence blurbs alone. It now lists every real prerequisite
relationship (PREREQUISITE_GRAPH, added in the previous commit) and
instructs the model to include a course's prerequisites in its own
selection, not just get the order right — the deterministic reorder
added earlier only fixes order among courses already chosen, it can't
fix an omission.

Also strengthens the existing instruction toward thoroughness: use the
available course/problem-set/application budget generously when it
serves the student's goal, rather than the sparsest plan that
technically answers it.

buildSystemPrompt is now reachable off the exported handler
(handler.buildSystemPrompt) so its output is unit-testable without a
live Anthropic API call — ANTHROPIC_API_KEY only exists on Vercel, so
this repo has never been able to test real model calls locally.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** `PREREQUISITE_GRAPH` covering all 4 hubs + Advanced+ (Task 1 Step 1), kept separate from `tests.js`'s `PREREQUISITES` (Global Constraints, no `public/assets/` file touched by either task), reorder-only/never-auto-insert (Task 1's `reorderByPrerequisites` never adds a name to `sortedNames` beyond what was in the input), prompt gains prerequisite section + inclusion instruction (Task 2 Step 1), thoroughness instruction (Task 2 Step 1), cross-check assertion against `CATALOG.courses` (Task 1 Step 2), reorder unit test (Task 1 Step 2, exact spec example: Precalculus → AP Calculus BC → Linear Algebra A). All spec sections covered.
- **Placeholder scan:** none — every step has complete code or a runnable command with a stated expected result. Live-API verification (mentioned in the spec's Testing section) is deliberately not a blocking automated step in this plan — `ANTHROPIC_API_KEY` only exists on Vercel (established constraint from earlier sessions), so it's a manual post-deploy check the user can run themselves on the live site, not something an implementer can verify locally or in CI.
- **Type consistency:** `PREREQUISITE_GRAPH`'s shape (`{[name: string]: string[]}`) is defined once in Task 1 and consumed identically in Task 2 (`Object.keys(...)`, `[course].join(', ')`) and in `scripts/check-generate-plan-prompt.js`. `reorderByPrerequisites(courses, graph)`'s parameter names and `validatePlan`'s call site match exactly (Task 1 Step 1's two code blocks are the single source of truth for both).
