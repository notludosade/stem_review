# Assessments Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working Assessments tab: hub + one-question-per-screen runner for course, track, and goal assessments, backed by 42 hand-written question pools (3 questions per unit, 9 question types).

**Architecture:** One data-driven page (`content/assessments.html`) driven by `public/assets/assessments.js`, which holds a pure engine (draw / grade / score, exported to Node) and the browser UI. Question pools are JSON files, one per course, in `public/assets/assessments/`. Course/unit/track data comes from the existing `public/assets/skill-catalog.json`. `scripts/check-assessments.js` validates engine + every pool in `npm test`.

**Tech Stack:** Vanilla JS (no build step for assets), JSON, Node built-ins for checks (`node:assert`, `node:vm`, `node:child_process`), local `python3` to verify Python reference solutions, existing Pyodide worker for in-browser Python.

**Spec:** `docs/superpowers/specs/2026-11-19-assessments-design.md`

## Global Constraints

- Every page lives under `content/`; shared JS/CSS/JSON under `public/assets/` (served at `/assets/...`).
- Shared scripts are re-executed by `components/LegacyContent.tsx` after page load: init with `if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init); else init();` and guard double-mount on the mount element (`mount.dataset.mounted`), never with `let`/`const` flags.
- Save points: return early when `window.STEMPlusAccount` exists and `canSave()` is false; still save when `STEMPlusAccount` is absent (Node).
- Storage key: `stemplus:assessments:v1` = `{ results: { "<kind>:<slug>": { best, last, at, units } }, inProgress: { "<kind>:<slug>": attempt } }`.
- Question IDs `<slug>.u<N>.q<1-3>` are permanent. Never change what an existing ID means.
- Exactly 3 questions per unit, 3 different types. Each pool uses ≥5 distinct types. `code` only in `CODE_COURSES`, and every `CODE_COURSES` pool has ≥2 `code` questions.
- Course slug = prefix of the course's skill IDs in `skill-catalog.json` (e.g. `computer-programming-2-plus`).
- Pass labels: `Strong` ≥ 0.85, `Developing` ≥ 0.6, else `Review`.
- New CSS uses only existing tokens (`--accent`, `--accent-soft`, `--border`, `--muted`, `--correct`, `--correct-soft`, `--incorrect`, `--incorrect-soft`, `--code-bg`, `--text`, `--bg`), so dark mode needs no extra rules.
- Git: commit after every task. Implementer subagents **commit only, never push**; the controller pushes. Stage only your own files (`git add <paths>`), never `git add -A` — the user edits in parallel.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Browser verification: `npm run build && npm run start` (never `npm run dev`), then `node scripts/verify-page.mjs <url> '<async expression>'`.

## File Map

| File | Action | Responsibility |
|---|---|---|
| `public/Bash for Cybersecurity/course.js`, `public/Cybersecurity+/course.js` | commit as-is | Codex's finished lesson-copy expansion (Task 1) |
| `components/Layout.tsx`, `scripts/check-nav-links.js` | commit as-is | Codex's nav link + search seed (Task 1) |
| `public/assets/assessments.js` | create | Engine + UI |
| `scripts/check-assessments.js` | create | Engine tests + pool validator |
| `package.json` | modify | add check to `npm test` |
| `public/assets/javascript-sandbox.js` | modify | expose `window.STEMJavaScriptRunner` without needing the problem list |
| `content/assessments.html` | modify | drop `problem-banks.js`, add `javascript-sandbox.js` |
| `public/assets/style.css` | modify | `.assess-*` rules |
| `public/assets/progress-sync.js`, `scripts/check-progress-sync.js` | modify | sync the new key |
| `public/assets/assessments/<slug>.json` ×42 | create | question pools |
| `content/patch-notes.html`, `content/about.html` | modify | ship notes |

---

### Task 1: Baseline and commit Codex's finished work

**Files:**
- Commit: `public/Bash for Cybersecurity/course.js`, `public/Cybersecurity+/course.js`, `components/Layout.tsx`, `scripts/check-nav-links.js`
- Leave uncommitted for Task 4: `content/assessments.html`

- [ ] **Step 1: Run the full suite with Codex's changes in place**

Run: `npm test 2>&1 | tail -20`
Expected: all checks pass. If `check-nav-links` or `check-global-search` fails only because `/assessments.html` is new, note it; `content/assessments.html` exists so both should pass. If any cybersecurity check fails, stop and report the exact failing line — do not edit Codex's lesson copy to force a pass.

- [ ] **Step 2: Commit the cybersecurity lesson expansion on its own**

```bash
git add "public/Bash for Cybersecurity/course.js" public/Cybersecurity+/course.js
git commit -m "Expand Bash for Cybersecurity and Cybersecurity+ lesson copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Commit the Assessments nav link + check**

```bash
git add components/Layout.tsx scripts/check-nav-links.js
git commit -m "Add Assessments to the site nav and search

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Do **not** push yet: the nav link would point at a page with no script. The controller pushes the cybersecurity commit together with the finished feature in Task 10 (or pushes now if the user asks).

---

### Task 2: Engine (draw, grade, score) with tests

**Files:**
- Create: `public/assets/assessments.js` (engine half only in this task)
- Create: `scripts/check-assessments.js` (engine tests only in this task)
- Modify: `package.json` (`test` script)

**Interfaces:**
- Consumes: `public/assets/problem-sets.js` Node export `{ parseNumber(raw: string): number, answersClose(value: number, answer: number, tolerance: number): boolean }`; browser global `window.STEMProblemAnswers` (same two functions).
- Produces (Node `module.exports` and browser `window.STEMAssessments`):
  - `TYPES: { [type]: { badge: string, icon: string, how: string } }` for the 9 types `single, multi, truefalse, number, text, order, match, written, code`
  - `GOALS: Array<{ slug, title, courses: string[] | null, summary?: string }>`
  - `SUBJECTS: string[]`, `SUBJECT_OF: { [courseName]: subject }`
  - `shuffle(list, rng?) → array` (copy), `scramble(list, rng?) → array` (never the original order when length ≥ 2)
  - `drawCourse(pool, rng?) → question[]` (2 per unit, unit order)
  - `drawSections(pools, rng?) → Array<{ course, slug, questions: question[] }>` (1 per unit)
  - `normalizeText(value) → string`
  - `isAnswered(question, response) → boolean`
  - `grade(question, response) → number in [0, 1]`
  - `scoreAttempt(entries: Array<{ question, slug, response }>) → { points, total, units: { [unitId]: { points, total } }, courses: { [slug]: { points, total } } }` where `unitId = <slug>.u<N>`
  - `label(fraction) → 'Strong' | 'Developing' | 'Review'`
- Response shapes (used by Task 4 UI): `single`/`text`/`number`: string; `multi`: string[]; `truefalse`: boolean; `order`: string[]; `match`: `{ [left]: right }`; `written`: `{ text: string, rubric: boolean[] }`; `code`: `{ code: string, passed: number, total: number, ranCode: string }`.

- [ ] **Step 1: Write the failing engine test**

Create `scripts/check-assessments.js`:

```js
'use strict';
// Assessments: engine behavior + every question pool's structure and answer keys.
const assert = require('node:assert');
const A = require('../public/assets/assessments.js');

// Seeded RNG so draws are reproducible.
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const q = (unit, k, type, extra) => Object.assign({ id: `demo.u${unit}.q${k}`, unit, type, prompt: 'p', explanation: 'e' }, extra);
const demo = {
  course: 'Demo', slug: 'demo',
  questions: [
    q(1, 1, 'single', { choices: ['a', 'b', 'c'], answer: 'b' }),
    q(1, 2, 'truefalse', { answer: true }),
    q(1, 3, 'number', { answer: 0.75 }),
    q(2, 1, 'multi', { choices: ['a', 'b', 'c', 'd'], answers: ['a', 'c'] }),
    q(2, 2, 'order', { items: ['x', 'y', 'z'] }),
    q(2, 3, 'match', { pairs: [['1', 'one'], ['2', 'two'], ['3', 'three']] }),
  ],
};

// drawCourse: 2 per unit, distinct types, unit order.
for (let seed = 1; seed < 30; seed += 1) {
  const drawn = A.drawCourse(demo, seeded(seed));
  assert.strictEqual(drawn.length, 4, 'two per unit');
  assert.deepStrictEqual(drawn.map((x) => x.unit), [1, 1, 2, 2], 'unit order');
  assert.notStrictEqual(drawn[0].type, drawn[1].type, 'unit 1 types differ');
  assert.notStrictEqual(drawn[2].type, drawn[3].type, 'unit 2 types differ');
}
// drawSections: 1 per unit per pool, sections keep pool order.
const sections = A.drawSections([demo, Object.assign({}, demo, { course: 'Demo 2', slug: 'demo2' })], seeded(7));
assert.deepStrictEqual(sections.map((s) => s.slug), ['demo', 'demo2']);
sections.forEach((s) => assert.deepStrictEqual(s.questions.map((x) => x.unit), [1, 2], '1 per unit'));

// scramble never returns the original order.
for (let seed = 1; seed < 50; seed += 1) {
  assert.notDeepStrictEqual(A.scramble(['x', 'y', 'z'], seeded(seed)), ['x', 'y', 'z']);
}
assert.notDeepStrictEqual(A.scramble(['x', 'y'], () => 0.999), ['x', 'y'], 'constant rng still scrambles');

// grade: every type.
const [single, tf, num, multi, order, match] = demo.questions;
assert.strictEqual(A.grade(single, 'b'), 1);
assert.strictEqual(A.grade(single, 'a'), 0);
assert.strictEqual(A.grade(tf, true), 1);
assert.strictEqual(A.grade(tf, false), 0);
assert.strictEqual(A.grade(num, '3/4'), 1, 'fraction accepted');
assert.strictEqual(A.grade(num, '75%'), 1, 'percent accepted');
assert.strictEqual(A.grade(num, '0.8'), 0);
assert.strictEqual(A.grade(num, ''), 0);
assert.strictEqual(A.grade(multi, ['c', 'a']), 1, 'order of picks irrelevant');
assert.strictEqual(A.grade(multi, ['a']), 0, 'missing one');
assert.strictEqual(A.grade(multi, ['a', 'b', 'c']), 0, 'extra wrong pick');
assert.strictEqual(A.grade(order, ['x', 'y', 'z']), 1);
assert.strictEqual(A.grade(order, ['y', 'x', 'z']), 0);
assert.strictEqual(A.grade(match, { 1: 'one', 2: 'two', 3: 'one' }), 2 / 3, 'partial pairs');
const text = { type: 'text', answers: ['Big O', 'O notation'] };
assert.strictEqual(A.grade(text, '  big   o '), 1, 'case and spaces ignored');
assert.strictEqual(A.grade(text, 'theta'), 0);
const written = { type: 'written', rubric: ['a', 'b', 'c', 'd'], model: 'm' };
assert.strictEqual(A.grade(written, { text: 'x', rubric: [true, false, true, false] }), 0.5);
assert.strictEqual(A.grade(written, { text: 'x' }), 0, 'not self-scored yet');
const code = { type: 'code', tests: [1, 2, 3, 4], starter: 'def f(x):\n    pass' };
assert.strictEqual(A.grade(code, { code: 'x', passed: 3, total: 4 }), 0.75);
assert.strictEqual(A.grade(single, undefined), 0, 'unanswered');

// isAnswered.
assert.strictEqual(A.isAnswered(num, '  '), false);
assert.strictEqual(A.isAnswered(multi, []), false);
assert.strictEqual(A.isAnswered(order, ['x', 'y', 'z']), true);
assert.strictEqual(A.isAnswered(code, { code: 'def f(x):\n    pass' }), false, 'untouched starter');
assert.strictEqual(A.isAnswered(code, { code: 'def f(x):\n    return x' }), true);
assert.strictEqual(A.isAnswered(tf, false), true, 'false is an answer');

// scoreAttempt + label.
const score = A.scoreAttempt([
  { question: single, slug: 'demo', response: 'b' },
  { question: tf, slug: 'demo', response: false },
  { question: match, slug: 'demo', response: { 1: 'one', 2: 'two', 3: 'one' } },
]);
assert.strictEqual(score.total, 3);
assert.ok(Math.abs(score.points - (1 + 0 + 2 / 3)) < 1e-9);
assert.deepStrictEqual(score.units['demo.u1'], { points: 1, total: 2 });
assert.strictEqual(score.courses.demo.total, 3);
assert.strictEqual(A.label(0.85), 'Strong');
assert.strictEqual(A.label(0.6), 'Developing');
assert.strictEqual(A.label(0.59), 'Review');

console.log('check-assessments: engine OK');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check-assessments.js`
Expected: FAIL with `Cannot find module '../public/assets/assessments.js'`.

- [ ] **Step 3: Write the engine**

Create `public/assets/assessments.js`:

```js
// STEM+ Assessments: course, track, and goal assessments.
// The engine (draw, grade, score) is pure and exported for
// scripts/check-assessments.js; the UI further down only runs in a browser.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./problem-sets.js') : root.STEMProblemAnswers);
  if (isNode) module.exports = api;
  else root.STEMAssessments = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (numbers) {
  'use strict';

  const TYPES = {
    single: { badge: 'Multiple choice', icon: '◉', how: 'Pick the one best answer.' },
    multi: { badge: 'Select all that apply', icon: '▣', how: 'Tick every correct option. You need all of them, and no wrong ones, to score.' },
    truefalse: { badge: 'True / False', icon: '⇄', how: 'Decide whether the statement is true or false.' },
    number: { badge: 'Type a number', icon: '#', how: 'Type a number. Fractions like 3/4, decimals, and percents are accepted.' },
    text: { badge: 'Type a short answer', icon: '✎', how: 'Type a word or short phrase. Capital letters and extra spaces don’t matter.' },
    order: { badge: 'Put in order', icon: '⇅', how: 'Use the ↑ and ↓ buttons to put the items in order, first at the top. The whole order must be right to score.' },
    match: { badge: 'Match pairs', icon: '⇔', how: 'Choose the partner for each item on the left. Each correct pair earns part of the point.' },
    written: { badge: 'Written answer', icon: '¶', how: 'Write a few sentences. After you submit, compare with a model answer and score yourself with a checklist.' },
    code: { badge: 'Code it up', icon: '</>', how: 'Write the function, then press Run tests. Each passing test earns part of the point.' },
  };

  const GOALS = [
    { slug: 'get-ahead', title: 'Get Ahead in School', courses: ['Algebra/Geometry Fundamentals Review', 'Precalculus', 'AP Calculus BC', 'Multivariable Calculus'] },
    { slug: 'prepare-for-college', title: 'Prepare for College', courses: ['Precalculus', 'AP Calculus BC', 'AP Physics 1', 'Computer Programming 1'] },
    { slug: 'stronger-at-math', title: 'Become Stronger at Math', courses: ['Algebra/Geometry Fundamentals Review', 'Discrete Math', 'Mathematical Proofs', 'Linear Algebra A'] },
    { slug: 'challenge-myself', title: 'Challenge Myself', courses: ['Real Analysis A', 'Real Analysis B', 'Topology: Fundamentals', 'Linear Algebra B', 'Advanced Algorithms'] },
    { slug: 'review-and-test', title: 'Review & Test Myself', courses: null, summary: 'Covers every course you’ve started in this browser.' },
  ];

  const SUBJECTS = ['Math', 'Science', 'Technology', 'Engineering', 'Advanced+'];
  const SUBJECT_OF = {
    'Algebra/Geometry Fundamentals Review': 'Math', 'Precalculus': 'Math', 'AP Calculus BC': 'Math',
    'Multivariable Calculus': 'Math', 'Differential Equations': 'Math', 'Discrete Math': 'Math',
    'Linear Algebra A': 'Math', 'Mathematical Proofs': 'Math',
    'AP Physics 1': 'Science', 'AP Physics 2': 'Science', 'AP Physics C: Mechanics': 'Science',
    'AP Physics C: Electricity and Magnetism': 'Science', 'Quantum Physics & Optics': 'Science',
    'Computer Programming 1': 'Technology', 'Computer Programming 2': 'Technology',
    'Computer Programming 2+': 'Technology', 'Computer Programming Ethics': 'Technology',
    'Software Engineering': 'Technology', 'Data Handling CB': 'Technology', 'AI Developer': 'Technology',
    'Applied Machine/Deep Learning': 'Technology', 'Programming with Packages': 'Technology',
    'Computer Networking Fundamentals': 'Technology', 'Systems Programming & Architecture: CS': 'Technology',
    'Cloud Computing A': 'Technology', 'Cloud Computing B / DevOps': 'Technology',
    'Cybersecurity+': 'Technology', 'Bash for Cybersecurity': 'Technology',
    'Game Engine Architecture': 'Technology', 'Video Game Modding': 'Technology',
    'Engineering 1': 'Engineering', 'Career Applied Engineering': 'Engineering', 'CAD & Prototyping': 'Engineering',
    'Mechatronics': 'Engineering', 'Advanced Robotics': 'Engineering', 'Thermodynamics': 'Engineering',
    'Advanced Algorithms': 'Advanced+', 'Real Analysis A': 'Advanced+', 'Real Analysis B': 'Advanced+',
    'Topology: Fundamentals': 'Advanced+', 'Linear Algebra B': 'Advanced+', 'Quantum Computing': 'Advanced+',
  };

  const shuffle = (list, rng = Math.random) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  // A "Put in order" question must never start already solved.
  const scramble = (list, rng = Math.random) => {
    const out = shuffle(list, rng);
    return list.length > 1 && out.every((item, i) => item === list[i]) ? list.slice(1).concat(list[0]) : out;
  };

  const unitsOf = (pool) => [...new Set(pool.questions.map((question) => question.unit))].sort((a, b) => a - b);
  const pick = (pool, perUnit, rng) => unitsOf(pool).flatMap((unit) => (
    shuffle(pool.questions.filter((question) => question.unit === unit), rng).slice(0, perUnit)
  ));
  const drawCourse = (pool, rng = Math.random) => pick(pool, 2, rng);
  const drawSections = (pools, rng = Math.random) => pools.map((pool) => ({ course: pool.course, slug: pool.slug, questions: pick(pool, 1, rng) }));

  const normalizeText = (value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ');

  const isAnswered = (question, response) => {
    if (response === undefined || response === null) return false;
    switch (question.type) {
      case 'number': case 'text': return String(response).trim() !== '';
      case 'multi': return response.length > 0;
      case 'match': return Object.keys(response).length > 0;
      case 'written': return String(response.text || '').trim() !== '';
      case 'code': return String(response.code || '').trim() !== String(question.starter || '').trim();
      default: return true;
    }
  };

  const grade = (question, response) => {
    if (!isAnswered(question, response)) return 0;
    switch (question.type) {
      case 'single': case 'truefalse': return response === question.answer ? 1 : 0;
      case 'multi': {
        const wanted = new Set(question.answers);
        return response.length === wanted.size && response.every((choice) => wanted.has(choice)) ? 1 : 0;
      }
      case 'number': {
        const value = numbers.parseNumber(String(response));
        return Number.isFinite(value) && numbers.answersClose(value, question.answer, question.tolerance ?? 0.001) ? 1 : 0;
      }
      case 'text': return question.answers.some((answer) => normalizeText(answer) === normalizeText(response)) ? 1 : 0;
      case 'order': return response.length === question.items.length && response.every((item, i) => item === question.items[i]) ? 1 : 0;
      case 'match': return question.pairs.filter(([left, right]) => response[left] === right).length / question.pairs.length;
      case 'written': return Array.isArray(response.rubric) ? response.rubric.filter(Boolean).length / question.rubric.length : 0;
      case 'code': return response.total ? response.passed / response.total : 0;
      default: return 0;
    }
  };

  const scoreAttempt = (entries) => {
    const units = {};
    const courses = {};
    let points = 0;
    entries.forEach(({ question, slug, response }) => {
      const value = grade(question, response);
      const unitId = `${slug}.u${question.unit}`;
      points += value;
      units[unitId] = units[unitId] || { points: 0, total: 0 };
      units[unitId].points += value;
      units[unitId].total += 1;
      courses[slug] = courses[slug] || { points: 0, total: 0 };
      courses[slug].points += value;
      courses[slug].total += 1;
    });
    return { points, total: entries.length, units, courses };
  };

  const label = (fraction) => (fraction >= 0.85 ? 'Strong' : fraction >= 0.6 ? 'Developing' : 'Review');

  const api = { TYPES, GOALS, SUBJECTS, SUBJECT_OF, shuffle, scramble, drawCourse, drawSections, normalizeText, isAnswered, grade, scoreAttempt, label };
  if (typeof document === 'undefined') return api;

  // ---- Browser UI (Task 4) goes here ----

  return api;
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-assessments.js`
Expected: `check-assessments: engine OK`

- [ ] **Step 5: Wire into `npm test`**

In `package.json` `test`, insert `node scripts/check-assessments.js && ` immediately before `node scripts/check-nav-links.js`.

Run: `npm test 2>&1 | tail -5`
Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add public/assets/assessments.js scripts/check-assessments.js package.json
git commit -m "Add assessments engine: draw, grade, and score for nine question types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pool validator (content checks)

**Files:**
- Modify: `scripts/check-assessments.js` (append content section)
- Create: `public/assets/assessments/.gitkeep` is NOT needed; the directory is created by the first pool in Task 7. The validator must pass when the directory does not exist yet.

**Interfaces:**
- Consumes: `A.TYPES`, `A.GOALS`, `A.SUBJECTS`, `A.SUBJECT_OF`, `A.grade` from Task 2; `public/assets/skill-catalog.json` (`skills[].id/course`, `pathways[].slug/courses`).
- Produces: `CODE_COURSES` set (in the check) and the pool JSON contract every content task follows:
  `{ course: string, slug: string, questions: Question[] }` with per-type fields exactly as listed in the spec's type table.

- [ ] **Step 1: Append the validator plus a self-test of the validator**

Append to `scripts/check-assessments.js` (before the final `console.log`, then change that log line as shown):

```js
// ---------------- Content ----------------
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const catalog = require('../public/assets/skill-catalog.json');

const POOL_DIR = path.join(__dirname, '..', 'public', 'assets', 'assessments');
const CODE_COURSES = new Set([
  'computer-programming-1', 'computer-programming-2', 'computer-programming-2-plus', 'software-engineering',
  'data-handling-cb', 'ai-developer', 'applied-machine-deep-learning', 'programming-with-packages',
  'advanced-algorithms', 'game-engine-architecture',
]);
const courseNames = [...new Set(catalog.skills.map((skill) => skill.course))];
const slugOf = (name) => catalog.skills.find((skill) => skill.course === name).id.split('.')[0];
const unitNumbers = (name) => catalog.skills.filter((skill) => skill.course === name).map((skill) => Number(skill.id.split('.u')[1]));

// Subjects, tracks, goals all point at real catalog courses.
courseNames.forEach((name) => assert.ok(A.SUBJECTS.includes(A.SUBJECT_OF[name]), `SUBJECT_OF is missing ${name}`));
Object.keys(A.SUBJECT_OF).forEach((name) => assert.ok(courseNames.includes(name), `SUBJECT_OF has unknown course ${name}`));
catalog.pathways.forEach((track) => track.courses.forEach((name) => assert.ok(courseNames.includes(name), `track ${track.slug}: unknown course ${name}`)));
A.GOALS.filter((goal) => goal.courses).forEach((goal) => goal.courses.forEach((name) => assert.ok(courseNames.includes(name), `goal ${goal.slug}: unknown course ${name}`)));

const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const uniqueStrings = (list, min, max) => Array.isArray(list) && list.length >= min && list.length <= max
  && list.every(nonEmpty) && new Set(list).size === list.length;
const plain = (value) => value === null || ['number', 'string', 'boolean'].includes(typeof value) || (Array.isArray(value) && value.every(plain));
const JS_BLOCKED = /\b(?:import|export)\b|\brequire\s*\(|\b(?:self|globalThis|indexedDB|caches)\b/;
const PY_BLOCKED = /^\s*(?:import|from)\s|\b(?:open|input)\s*\(/m;

const CHECKS = {
  single: (x) => [
    !uniqueStrings(x.choices, 3, 5) && 'choices: 3–5 unique non-empty strings',
    !x.choices?.includes(x.answer) && 'answer must be one of choices',
  ],
  multi: (x) => [
    !uniqueStrings(x.choices, 4, 6) && 'choices: 4–6 unique non-empty strings',
    !(uniqueStrings(x.answers, 2, (x.choices?.length || 1) - 1) && x.answers.every((a) => x.choices.includes(a))) && 'answers: ≥2 choices, not all of them',
  ],
  truefalse: (x) => [typeof x.answer !== 'boolean' && 'answer must be true or false'],
  number: (x) => [
    !Number.isFinite(x.answer) && 'answer must be a finite number',
    x.tolerance !== undefined && !(x.tolerance > 0) && 'tolerance must be > 0',
    Number.isFinite(x.answer) && A.grade(x, String(x.answer)) !== 1 && 'answer does not grade as correct',
  ],
  text: (x) => [!uniqueStrings(x.answers, 1, 8) && 'answers: 1–8 unique non-empty strings'],
  order: (x) => [!uniqueStrings(x.items, 3, 6) && 'items: 3–6 unique non-empty strings'],
  match: (x) => [
    !(Array.isArray(x.pairs) && x.pairs.length >= 3 && x.pairs.length <= 6 && x.pairs.every((p) => Array.isArray(p) && p.length === 2 && p.every(nonEmpty))) && 'pairs: 3–6 [left, right] string pairs',
    Array.isArray(x.pairs) && (new Set(x.pairs.map((p) => p[0])).size !== x.pairs.length || new Set(x.pairs.map((p) => p[1])).size !== x.pairs.length) && 'pair sides must be unique',
  ],
  written: (x) => [
    !uniqueStrings(x.rubric, 3, 4) && 'rubric: 3–4 unique points',
    !nonEmpty(x.model) && 'model answer required',
  ],
  code: (x) => [
    !['python', 'javascript'].includes(x.language) && 'language must be python or javascript',
    !/^[A-Za-z_]\w*$/.test(x.functionName || '') && 'functionName must be an identifier',
    !(nonEmpty(x.starter) && x.starter.includes(x.functionName)) && 'starter must define functionName',
    !nonEmpty(x.reference) && 'reference solution required',
    !(Array.isArray(x.tests) && x.tests.length >= 3 && x.tests.every((t) => Array.isArray(t.args) && t.args.every(plain) && 'expected' in t && plain(t.expected))) && 'tests: ≥3 { args: [...], expected } with only numbers/strings/booleans/null/arrays',
    x.language === 'javascript' && JS_BLOCKED.test(`${x.starter}\n${x.reference}`) && 'JS may not use modules or worker globals',
    x.language === 'python' && PY_BLOCKED.test(`${x.starter}\n${x.reference}`) && 'Python may not import, open, or input',
  ],
};

function validatePool(file, pool) {
  const errors = [];
  const fail = (message) => errors.push(`${path.basename(file)}: ${message}`);
  if (!courseNames.includes(pool.course)) { fail(`unknown course "${pool.course}"`); return errors; }
  if (pool.slug !== slugOf(pool.course)) fail(`slug must be ${slugOf(pool.course)}`);
  if (path.basename(file, '.json') !== pool.slug) fail('file name must equal slug');
  if (!Array.isArray(pool.questions)) { fail('questions must be an array'); return errors; }
  const units = unitNumbers(pool.course);
  units.forEach((unit) => {
    const inUnit = pool.questions.filter((x) => x.unit === unit);
    if (inUnit.length !== 3) fail(`unit ${unit} has ${inUnit.length} questions, needs 3`);
    if (new Set(inUnit.map((x) => x.type)).size !== inUnit.length) fail(`unit ${unit} repeats a question type`);
  });
  const ids = new Set();
  const types = new Set();
  pool.questions.forEach((x) => {
    const where = x.id || '(missing id)';
    if (!units.includes(x.unit)) fail(`${where}: unit ${x.unit} is not in the catalog`);
    if (![1, 2, 3].map((k) => `${pool.slug}.u${x.unit}.q${k}`).includes(x.id)) fail(`${where}: id must be ${pool.slug}.u${x.unit}.q1-3`);
    if (ids.has(x.id)) fail(`${where}: duplicate id`);
    ids.add(x.id);
    if (!A.TYPES[x.type]) { fail(`${where}: unknown type "${x.type}"`); return; }
    types.add(x.type);
    if (!nonEmpty(x.prompt) || !nonEmpty(x.explanation)) fail(`${where}: prompt and explanation required`);
    if (x.code !== undefined && !nonEmpty(x.code)) fail(`${where}: code block must be a non-empty string`);
    CHECKS[x.type](x).filter(Boolean).forEach((message) => fail(`${where}: ${message}`));
  });
  if (types.size < 5) fail(`uses ${types.size} question types, needs ≥5`);
  const codeCount = pool.questions.filter((x) => x.type === 'code').length;
  if (CODE_COURSES.has(pool.slug) && codeCount < 2) fail(`programming course needs ≥2 code questions (has ${codeCount})`);
  if (!CODE_COURSES.has(pool.slug) && codeCount) fail('code questions are only allowed in CODE_COURSES');
  return errors;
}

// Same equality rule as the browser JS worker in javascript-sandbox.js.
const equal = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => equal(value, b[i]));
  return a === b;
};
function passedJs(code, functionName, tests) {
  try {
    const context = vm.createContext({});
    vm.runInContext(`"use strict";\n${code}\n;globalThis.__fn = typeof ${functionName} === 'function' ? ${functionName} : null;`, context, { timeout: 2000 });
    if (!context.__fn) return 0;
    return tests.filter((t) => { try { return equal(context.__fn(...structuredClone(t.args)), t.expected); } catch (err) { return false; } }).length;
  } catch (err) { return 0; }
}
// Same rules as public/assets/python-worker.js: blocked imports, same equality.
const PY_HARNESS = String.raw`
import builtins, json, math, sys
def _eq(actual, expected):
    if isinstance(actual, bool) or isinstance(expected, bool):
        return actual is expected
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(actual, list) and isinstance(expected, list):
        return len(actual) == len(expected) and all(_eq(a, b) for a, b in zip(actual, expected))
    return actual == expected
def _blocked(*a, **k):
    raise ImportError('blocked')
out = []
for job in json.load(sys.stdin):
    safe = dict(vars(builtins)); safe['__import__'] = _blocked
    ns = {'__builtins__': safe, '__name__': '__main__'}
    passed = 0
    try:
        exec(job['code'], ns)
        fn = ns.get(job['fn'])
        for t in job['tests']:
            try:
                if _eq(fn(*t['args']), t['expected']): passed += 1
            except Exception:
                pass
    except Exception:
        pass
    out.append(passed)
print(json.dumps(out))
`;
function passedPythonBatch(jobs) {
  if (!jobs.length) return [];
  const run = spawnSync('python3', ['-I', '-c', PY_HARNESS], { input: JSON.stringify(jobs), encoding: 'utf8', timeout: 60000 });
  assert.strictEqual(run.status, 0, `python3 harness failed: ${run.stderr}`);
  return JSON.parse(run.stdout);
}

function validateCode(pools) {
  const errors = [];
  const python = [];
  pools.forEach(({ file, pool }) => pool.questions.filter((x) => x.type === 'code' && Array.isArray(x.tests)).forEach((x) => {
    if (x.language === 'javascript') {
      if (passedJs(x.reference, x.functionName, x.tests) !== x.tests.length) errors.push(`${path.basename(file)}: ${x.id}: reference fails its tests`);
      if (passedJs(x.starter, x.functionName, x.tests) === x.tests.length) errors.push(`${path.basename(file)}: ${x.id}: starter already passes every test`);
    }
    if (x.language === 'python') {
      python.push({ file, x, kind: 'reference', job: { code: x.reference, fn: x.functionName, tests: x.tests } });
      python.push({ file, x, kind: 'starter', job: { code: x.starter, fn: x.functionName, tests: x.tests } });
    }
  }));
  passedPythonBatch(python.map((p) => p.job)).forEach((passed, i) => {
    const { file, x, kind } = python[i];
    if (kind === 'reference' && passed !== x.tests.length) errors.push(`${path.basename(file)}: ${x.id}: reference fails its tests`);
    if (kind === 'starter' && passed === x.tests.length) errors.push(`${path.basename(file)}: ${x.id}: starter already passes every test`);
  });
  return errors;
}

// The validator catches bad pools (self-test with a deliberately broken pool).
const broken = { course: 'Computer Programming 1', slug: 'computer-programming-1', questions: [
  { id: 'computer-programming-1.u1.q1', unit: 1, type: 'single', prompt: 'p', explanation: 'e', choices: ['a', 'b', 'c'], answer: 'z' },
] };
const brokenErrors = validatePool('computer-programming-1.json', broken);
assert.ok(brokenErrors.some((e) => e.includes('answer must be one of choices')), 'validator flags a bad single answer');
assert.ok(brokenErrors.some((e) => e.includes('unit 2 has 0 questions')), 'validator flags a missing unit');
assert.ok(validateCode([{ file: 'x.json', pool: { questions: [
  { id: 'x.u1.q1', type: 'code', language: 'python', functionName: 'f', starter: 'def f(x):\n    pass', reference: 'def f(x):\n    return x + 2', tests: [{ args: [1], expected: 2 }, { args: [2], expected: 3 }, { args: [3], expected: 4 }] },
  { id: 'x.u1.q2', type: 'code', language: 'javascript', functionName: 'g', starter: 'function g(x) {}', reference: 'function g(x) { return x * 2; }', tests: [{ args: [1], expected: 2 }, { args: [2], expected: 4 }, { args: [3], expected: 6 }] },
] } }]).some((e) => e.includes('x.u1.q1: reference fails')), 'code check flags a wrong Python reference');

// Validate every pool that exists.
const poolFiles = fs.existsSync(POOL_DIR) ? fs.readdirSync(POOL_DIR).filter((name) => name.endsWith('.json')) : [];
const pools = poolFiles.map((name) => {
  const file = path.join(POOL_DIR, name);
  let pool;
  try { pool = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { throw new Error(`${name}: invalid JSON: ${err.message}`); }
  return { file, pool };
});
const problems = pools.flatMap(({ file, pool }) => validatePool(file, pool)).concat(validateCode(pools));
assert.ok(!problems.length, `assessment pool problems:\n  ${problems.join('\n  ')}`);
```

Then replace the last line with:

```js
console.log(`check-assessments: engine OK, ${pools.length} pools / ${pools.reduce((n, p) => n + p.pool.questions.length, 0)} questions OK`);
```

- [ ] **Step 2: Run it**

Run: `node scripts/check-assessments.js`
Expected: `check-assessments: engine OK, 0 pools / 0 questions OK`

- [ ] **Step 3: Prove it catches a bad pool on disk**

```bash
mkdir -p public/assets/assessments
echo '{"course":"Precalculus","slug":"precalculus","questions":[]}' > public/assets/assessments/precalculus.json
node scripts/check-assessments.js; echo "exit $?"
rm public/assets/assessments/precalculus.json; rmdir public/assets/assessments
```
Expected: non-zero exit listing `precalculus.json: unit 1 has 0 questions, needs 3` and `uses 0 question types`.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-assessments.js
git commit -m "Validate assessment pools: structure, coverage, and code reference solutions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Page UI — hub, runner, question card, results, saving

**Files:**
- Modify: `public/assets/assessments.js` (replace the `// ---- Browser UI (Task 4) goes here ----` line)
- Modify: `public/assets/javascript-sandbox.js:4-5,73`
- Modify: `content/assessments.html`
- Modify: `public/assets/style.css` (append)

**Interfaces:**
- Consumes: Task 2 engine names (closure scope, same file); `window.STEMProblemAnswers` (problem-sets.js); `window.STEMPlusAccount.{canSave(), noteIfGuest(text)}`; `/assets/skill-catalog.json`; `/assets/assessments/<slug>.json`; `/assets/python-worker.js` protocol: post `{ id, mode: 'problem', code, functionName, tests }`, receives `{ type: 'ready' }`, `{ type: 'fatal', error }`, `{ type: 'result', id, payload: { ok, output, results: [{ index, passed, actual, expected, error? }], error? } }`.
- Produces: `window.STEMJavaScriptRunner(payload) → Promise<{ ok, results?, output, error? }>` with payload `{ mode: 'problem', code, functionName, tests }`; URLs `assessments.html?course=<slug>`, `?track=<slug>`, `?goal=<slug>`; attempt object `{ id, kind, title, sections: [{ course, slug, ids }], layout: { [questionId]: string[] }, responses: { [questionId]: response }, index, at }` stored in `inProgress`.

- [ ] **Step 1: Expose the JS runner without the problem list**

In `public/assets/javascript-sandbox.js`, delete line 5 (`  if (!api) return;`). Then replace

```js
  window.STEMFunctionSandbox = {
```

with

```js
  // Assessments use the runner directly; they don't load the problem list.
  window.STEMJavaScriptRunner = runWorker;
  if (!api) return;
  window.STEMFunctionSandbox = {
```

Run: `node scripts/check-javascript-cpp-sandboxes.js`
Expected: passes (it doesn't load this file's browser half).

- [ ] **Step 2: Update the page shell**

Replace the three `<script>` lines in `content/assessments.html` with:

```html
<script src="assets/problem-sets.js" defer></script>
<script src="assets/javascript-sandbox.js" defer></script>
<script src="assets/assessments.js" defer></script>
```

In the same file, change the three nav anchors `href="#courses"`, `href="#tracks"`, `href="#goals"` to `href="assessments.html#courses"`, `href="assessments.html#tracks"`, `href="assessments.html#goals"` so they also work from a running assessment.

(`problem-sets.js` provides `STEMProblemAnswers` and exits early because the page has no `[data-problem-set]`; `problem-banks.js` is dropped so `?course=` never builds a bank.)

- [ ] **Step 3: Write the browser UI**

Replace `  // ---- Browser UI (Task 4) goes here ----` in `public/assets/assessments.js` with:

```js
  const KEY = 'stemplus:assessments:v1';
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (value) => esc(value).replace(/`([^`]+)`/g, '<code>$1</code>');
  const pct = (fraction) => `${Math.round(fraction * 100)}%`;
  const canSave = () => !window.STEMPlusAccount || window.STEMPlusAccount.canSave();
  const loadStore = () => {
    try {
      const data = JSON.parse(window.localStorage.getItem(KEY) || '{}');
      return { results: data.results || {}, inProgress: data.inProgress || {} };
    } catch (err) { return { results: {}, inProgress: {} }; }
  };
  const saveStore = (store) => {
    if (!canSave()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch (err) { console.error('Could not save assessment progress', err); }
  };
  const startedCourses = () => {
    try { return [...new Set(JSON.parse(window.localStorage.getItem('stemplus:results:v1') || '[]').map((r) => r.course))]; } catch (err) { return []; }
  };

  const courseList = (catalog) => [...new Set(catalog.skills.map((s) => s.course))].map((name) => {
    const skills = catalog.skills.filter((s) => s.course === name);
    return { name, slug: skills[0].id.split('.')[0], units: skills.length };
  });
  const unitCount = (catalog, names) => names.reduce((n, name) => n + catalog.skills.filter((s) => s.course === name).length, 0);
  const skillFor = (catalog, slug, unit) => catalog.skills.find((s) => s.id === `${slug}.u${unit}`);
  const pools = {};
  const loadPool = (slug) => {
    pools[slug] = pools[slug] || fetch(`/assets/assessments/${encodeURIComponent(slug)}.json`).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
    return pools[slug];
  };

  // ---------- Hub ----------
  function renderHub(mount, catalog) {
    const store = loadStore();
    const best = (id) => (store.results[id] ? ` · Best ${pct(store.results[id].best)}` : '');
    const card = (href, num, title, sub, id) => `<a class="toc-item" href="${href}"><span class="toc-num">${esc(num)}</span><p class="toc-title">${esc(title)}</p><p class="toc-sub">${esc(sub)}${best(id)}</p></a>`;
    const courses = courseList(catalog);
    let html = '<h2 id="courses">Courses</h2><p class="subtitle">Two questions from every unit, in mixed formats. Each retake draws a new mix.</p>';
    SUBJECTS.forEach((subject) => {
      const list = courses.filter((c) => SUBJECT_OF[c.name] === subject);
      if (!list.length) return;
      html += `<h3>${esc(subject)}</h3><div class="toc-list">${list.map((c) => card(`assessments.html?course=${encodeURIComponent(c.slug)}`, subject, c.name, `${c.units * 2} questions · ${c.units} units`, `course:${c.slug}`)).join('')}</div>`;
    });
    html += '<h2 id="tracks">Tracks</h2><p class="subtitle">One question from every unit of every course in the track, grouped into a section per course. Your answers save as you go.</p><div class="toc-list">';
    html += catalog.pathways.map((t) => card(`assessments.html?track=${encodeURIComponent(t.slug)}`, 'Track', t.name, `${unitCount(catalog, t.courses)} questions · ${t.courses.length} course sections`, `track:${t.slug}`)).join('');
    html += '</div><h2 id="goals">Goals</h2><p class="subtitle">Assessments built around the goals on the Choose a Goal page.</p><div class="toc-list">';
    html += GOALS.map((g) => card(`assessments.html?goal=${encodeURIComponent(g.slug)}`, 'Goal', g.title, g.courses ? `${unitCount(catalog, g.courses)} questions · ${g.courses.length} course sections` : g.summary, `goal:${g.slug}`)).join('');
    html += '</div>';
    mount.innerHTML = html;
    if (window.location.hash) {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  // ---------- Target resolution ----------
  function resolveTarget(catalog, params) {
    const course = params.get('course');
    const track = params.get('track');
    const goal = params.get('goal');
    if (course) {
      const found = courseList(catalog).find((c) => c.slug === course);
      return found && { id: `course:${found.slug}`, kind: 'course', title: `${found.name} Assessment`, courses: [found.name] };
    }
    if (track) {
      const found = catalog.pathways.find((t) => t.slug === track);
      return found && { id: `track:${found.slug}`, kind: 'track', title: `${found.name} Track Assessment`, courses: found.courses };
    }
    if (goal) {
      const found = GOALS.find((g) => g.slug === goal);
      if (!found) return null;
      const names = courseList(catalog).map((c) => c.name);
      const courses = found.courses || startedCourses().filter((name) => names.includes(name));
      return { id: `goal:${found.slug}`, kind: 'goal', title: `${found.title} — Goal Assessment`, courses, pickable: !found.courses };
    }
    return null;
  }

  function renderPicker(mount, catalog, target, start) {
    const courses = courseList(catalog);
    mount.innerHTML = `<div class="box"><span class="box-label">Choose courses to review</span><p>You haven’t started a course in this browser yet. Pick the courses you want this assessment to cover.</p>${SUBJECTS.map((subject) => {
      const list = courses.filter((c) => SUBJECT_OF[c.name] === subject);
      return list.length ? `<fieldset class="assess-fieldset"><legend>${esc(subject)}</legend>${list.map((c) => `<label class="assess-option"><input type="checkbox" value="${esc(c.name)}"> ${esc(c.name)}</label>`).join('')}</fieldset>` : '';
    }).join('')}<p><button type="button" class="widget-btn" data-pick-start>Start assessment</button> <span class="assess-hint" data-pick-hint></span></p></div>`;
    mount.querySelector('[data-pick-start]').addEventListener('click', () => {
      const chosen = [...mount.querySelectorAll('input[type=checkbox]:checked')].map((box) => box.value);
      if (!chosen.length) { mount.querySelector('[data-pick-hint]').textContent = 'Pick at least one course.'; return; }
      start(Object.assign({}, target, { courses: chosen }));
    });
  }

  // ---------- Code runners ----------
  let pyReady = null;
  let pyWorker = null;
  let pyId = 0;
  const pyPending = new Map();
  const startPython = () => {
    if (pyReady) return pyReady;
    pyReady = new Promise((resolve, reject) => {
      pyWorker = new Worker('/assets/python-worker.js', { type: 'module' });
      pyWorker.onmessage = ({ data }) => {
        if (data.type === 'ready') resolve(pyWorker);
        else if (data.type === 'fatal') reject(new Error(data.error));
        else if (data.type === 'result' && pyPending.has(data.id)) {
          const entry = pyPending.get(data.id);
          pyPending.delete(data.id);
          window.clearTimeout(entry.timer);
          entry.resolve(data.payload);
        }
      };
      pyWorker.onerror = () => reject(new Error('Python could not start. Check your connection and try again.'));
    });
    pyReady.catch(() => { pyReady = null; });
    return pyReady;
  };
  const runPython = async (payload) => {
    const worker = await startPython();
    return new Promise((resolve, reject) => {
      const id = ++pyId;
      const timer = window.setTimeout(() => {
        pyPending.delete(id);
        worker.terminate();
        pyReady = null;
        reject(new Error('Program stopped after 5 seconds. Check for an infinite loop.'));
      }, 5000);
      pyPending.set(id, { resolve, timer });
      worker.postMessage(Object.assign({ id }, payload));
    });
  };
  const runCode = (question, code) => {
    const payload = { mode: 'problem', code, functionName: question.functionName, tests: question.tests };
    if (question.language === 'python') return runPython(payload);
    if (!window.STEMJavaScriptRunner) return Promise.reject(new Error('The JavaScript runner did not load. Refresh to try again.'));
    return window.STEMJavaScriptRunner(payload);
  };

  // ---------- Runner ----------
  function newAttempt(target, loaded) {
    const sections = target.kind === 'course'
      ? [{ course: loaded[0].course, slug: loaded[0].slug, questions: drawCourse(loaded[0]) }]
      : drawSections(loaded);
    const layout = {};
    sections.forEach((s) => s.questions.forEach((x) => {
      if (x.type === 'single' || x.type === 'multi') layout[x.id] = shuffle(x.choices);
      if (x.type === 'order') layout[x.id] = scramble(x.items);
      if (x.type === 'match') layout[x.id] = shuffle(x.pairs.map((p) => p[1]));
    }));
    return {
      id: target.id, kind: target.kind, title: target.title,
      sections: sections.map((s) => ({ course: s.course, slug: s.slug, ids: s.questions.map((x) => x.id) })),
      layout, responses: {}, index: 0, at: new Date().toISOString(),
    };
  }

  async function mountRunner(mount, catalog, target) {
    document.title = `${target.title} — STEM+`;
    const heading = document.querySelector('.page h1');
    if (heading) heading.textContent = target.title;
    const subtitle = document.querySelector('.page .subtitle');
    if (subtitle) subtitle.textContent = target.kind === 'course'
      ? 'Two questions from every unit. Answer in any order, then submit to see your results.'
      : 'One question from every unit of every course, grouped by course. Your answers save as you go.';
    if (window.STEMPlusAccount) window.STEMPlusAccount.noteIfGuest('Assessment results aren’t saved for guests.');
    mount.innerHTML = '<p class="toc-empty">Loading questions…</p>';
    const slugs = target.courses.map((name) => courseList(catalog).find((c) => c.name === name).slug);
    const loaded = await Promise.all(slugs.map((slug) => loadPool(slug).catch(() => null)));
    const available = loaded.filter(Boolean);
    const skipped = target.courses.filter((_, i) => !loaded[i]);
    if (!available.length) {
      mount.innerHTML = '<p class="toc-empty">These questions couldn’t load. <a href="assessments.html">Back to Assessments</a></p>';
      return;
    }
    const byId = {};
    available.forEach((pool) => pool.questions.forEach((x) => { byId[x.id] = x; }));
    const notice = skipped.length ? `<p class="assess-hint">Skipped (questions couldn’t load): ${esc(skipped.join(', '))}.</p>` : '';
    const saved = loadStore().inProgress[target.id];
    const begin = (attempt) => runAttempt(mount, catalog, target, attempt, byId, notice);
    if (saved && saved.sections.every((s) => s.ids.every((id) => byId[id]))) {
      const answered = Object.keys(saved.responses).length;
      mount.innerHTML = `${notice}<div class="box"><span class="box-label">Saved progress</span><p>You answered ${answered} question${answered === 1 ? '' : 's'} on ${esc(new Date(saved.at).toLocaleDateString())}.</p><p><button type="button" class="widget-btn" data-resume>Resume</button> <button type="button" class="widget-btn" data-restart>Start over</button></p></div>`;
      mount.querySelector('[data-resume]').addEventListener('click', () => begin(saved));
      mount.querySelector('[data-restart]').addEventListener('click', () => begin(newAttempt(target, available)));
    } else {
      begin(newAttempt(target, available));
    }
  }

  function runAttempt(mount, catalog, target, attempt, byId, notice) {
    const order = attempt.sections.flatMap((s, si) => s.ids.map((id) => ({ id, si, slug: s.slug })));
    let saveTimer = null;
    const persist = (now) => {
      window.clearTimeout(saveTimer);
      const write = () => { attempt.at = new Date().toISOString(); const store = loadStore(); store.inProgress[attempt.id] = attempt; saveStore(store); };
      if (now) write(); else saveTimer = window.setTimeout(write, 400);
    };
    const setResponse = (id, value, now) => { attempt.responses[id] = value; persist(now); renderMap(); };

    function answerArea(x) {
      const r = attempt.responses[x.id];
      const lay = attempt.layout[x.id];
      switch (x.type) {
        case 'single':
          return `<fieldset class="assess-fieldset"><legend class="assess-sr">Choices</legend>${lay.map((c, i) => `<label class="assess-option"><input type="radio" name="assess-${esc(x.id)}" data-choice="${i}"${r === c ? ' checked' : ''}> <span>${fmt(c)}</span></label>`).join('')}</fieldset>`;
        case 'multi':
          return `<fieldset class="assess-fieldset"><legend class="assess-sr">Choices</legend>${lay.map((c, i) => `<label class="assess-option"><input type="checkbox" data-choice="${i}"${(r || []).includes(c) ? ' checked' : ''}> <span>${fmt(c)}</span></label>`).join('')}</fieldset>`;
        case 'truefalse':
          return `<div class="assess-tf">${[true, false].map((v) => `<button type="button" class="assess-tf-btn" data-tf="${v}" aria-pressed="${r === v}">${v ? 'True' : 'False'}</button>`).join('')}</div>`;
        case 'number': case 'text':
          return `<label class="assess-field"><span>Your answer</span><input type="text" data-input autocomplete="off" spellcheck="false"${x.type === 'number' ? ' inputmode="decimal"' : ''} value="${esc(r || '')}"></label>`;
        case 'order': {
          const items = r || lay;
          return `<ol class="assess-order">${items.map((item, i) => `<li><span>${fmt(item)}</span><span class="assess-order-btns"><button type="button" data-move="${i}" data-dir="-1" aria-label="Move ${esc(item)} up"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" data-move="${i}" data-dir="1" aria-label="Move ${esc(item)} down"${i === items.length - 1 ? ' disabled' : ''}>↓</button></span></li>`).join('')}</ol>`;
        }
        case 'match':
          return `<div class="assess-match">${x.pairs.map(([left], i) => `<label class="assess-match-row"><span>${fmt(left)}</span><select data-match="${i}"><option value="">Choose…</option>${lay.map((right, j) => `<option value="${j}"${r && r[left] === right ? ' selected' : ''}>${esc(right)}</option>`).join('')}</select></label>`).join('')}</div>`;
        case 'written':
          return `<label class="assess-field"><span>Your answer</span><textarea class="reflection-textarea" data-input rows="6">${esc((r && r.text) || '')}</textarea></label>`;
        case 'code': {
          const code = (r && r.code) || x.starter;
          return `<p class="assess-hint">Language: ${x.language === 'python' ? 'Python' : 'JavaScript'} · write <code>${esc(x.functionName)}</code></p><textarea class="assess-code" data-input spellcheck="false" rows="10" aria-label="Your code">${esc(code)}</textarea><p class="assess-hint">Tests:</p><ul class="assess-tests">${x.tests.map((t) => `<li><code>${esc(x.functionName)}(${esc(t.args.map((a) => JSON.stringify(a)).join(', '))})</code> → <code>${esc(JSON.stringify(t.expected))}</code></li>`).join('')}</ul><p><button type="button" class="widget-btn" data-run>Run tests</button></p><div class="assess-run-out" data-run-out aria-live="polite">${r && r.total ? `${r.passed} of ${r.total} tests passed.` : ''}</div>`;
        }
        default: return '';
      }
    }

    function renderMap() {
      const map = mount.querySelector('[data-map]');
      if (!map) return;
      map.innerHTML = order.map((o, i) => `<button type="button" data-goto="${i}" class="assess-map-btn${i === attempt.index ? ' is-current' : ''}${isAnswered(byId[o.id], attempt.responses[o.id]) ? ' is-answered' : ''}" aria-label="Question ${i + 1}${isAnswered(byId[o.id], attempt.responses[o.id]) ? ', answered' : ''}">${i + 1}</button>`).join('');
    }

    function render() {
      const o = order[attempt.index];
      const x = byId[o.id];
      const section = attempt.sections[o.si];
      const skill = skillFor(catalog, o.slug, x.unit);
      const type = TYPES[x.type];
      const sectionLine = attempt.sections.length > 1 || attempt.kind !== 'course' ? `<p class="assess-section">Section ${o.si + 1} of ${attempt.sections.length} · ${esc(section.course)}</p>` : '';
      mount.innerHTML = `${notice}${sectionLine}<div class="assess-progress" aria-hidden="true"><div style="width:${((attempt.index + 1) / order.length) * 100}%"></div></div><p class="assess-count">Question ${attempt.index + 1} of ${order.length}</p>
<article class="assess-card" tabindex="-1" aria-labelledby="assess-prompt">
  <p class="assess-unit">Unit ${x.unit}${skill ? ` · ${esc(skill.name)}` : ''}</p>
  <p class="assess-badge"><span aria-hidden="true">${esc(type.icon)}</span> ${esc(type.badge)}</p>
  <p class="assess-how"><strong>How to answer:</strong> ${esc(type.how)}</p>
  <p class="assess-prompt" id="assess-prompt">${fmt(x.prompt)}</p>
  ${x.code ? `<pre class="code-block"><code>${esc(x.code)}</code></pre>` : ''}
  <div class="assess-answer">${answerArea(x)}</div>
  <div class="assess-nav"><button type="button" class="widget-btn" data-prev${attempt.index === 0 ? ' disabled' : ''}>← Previous</button><button type="button" class="widget-btn" data-next${attempt.index === order.length - 1 ? ' disabled' : ''}>Next question →</button></div>
</article>
<nav class="assess-map" aria-label="Question map" data-map></nav>
<p class="assess-submit"><button type="button" class="widget-btn" data-submit>Submit assessment</button></p>`;
      renderMap();
    }

    const go = (index) => { attempt.index = index; persist(true); render(); mount.querySelector('.assess-card').focus(); };

    async function runTests(x, button) {
      const out = mount.querySelector('[data-run-out]');
      const code = mount.querySelector('[data-input]').value;
      button.disabled = true;
      out.textContent = x.language === 'python' && !pyReady ? 'Loading Python (first run takes a few seconds)…' : 'Running tests…';
      try {
        const result = await runCode(x, code);
        const results = result.results || [];
        const passed = results.filter((t) => t.passed).length;
        setResponse(x.id, { code, passed, total: x.tests.length, ranCode: code }, true);
        out.innerHTML = result.error && !results.length
          ? `<span class="assess-bad">${esc(result.error)}</span>`
          : `${passed} of ${x.tests.length} tests passed.<ul class="assess-tests">${results.map((t) => `<li class="${t.passed ? 'assess-good' : 'assess-bad'}">${t.passed ? '✓' : '✗'} Test ${t.index}${t.passed ? '' : `: got ${esc(t.error || t.actual)}, expected ${esc(t.expected)}`}</li>`).join('')}</ul>`;
      } catch (err) {
        setResponse(x.id, { code, passed: 0, total: x.tests.length, ranCode: code }, true);
        out.innerHTML = `<span class="assess-bad">${esc(err.message)}</span>`;
      } finally { button.disabled = false; }
    }

    async function submit() {
      const unanswered = order.filter((o) => !isAnswered(byId[o.id], attempt.responses[o.id])).length;
      if (unanswered && !window.confirm(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered and will score 0. Submit anyway?`)) return;
      mount.innerHTML = '<p class="toc-empty">Checking your code and scoring…</p>';
      for (const o of order) {
        const x = byId[o.id];
        const r = attempt.responses[o.id];
        if (x.type === 'code' && isAnswered(x, r) && r.ranCode !== r.code) {
          try {
            const result = await runCode(x, r.code);
            r.passed = (result.results || []).filter((t) => t.passed).length;
          } catch (err) { r.passed = 0; }
          r.total = x.tests.length;
          r.ranCode = r.code;
        }
      }
      window.clearTimeout(saveTimer);
      showResults(mount, catalog, target, attempt, byId, order);
    }

    mount.onclick = (event) => {
      const el = event.target.closest('button');
      if (!el || !mount.contains(el)) return;
      const x = byId[order[attempt.index].id];
      if (el.dataset.goto !== undefined) go(Number(el.dataset.goto));
      else if (el.hasAttribute('data-prev')) go(attempt.index - 1);
      else if (el.hasAttribute('data-next')) go(attempt.index + 1);
      else if (el.hasAttribute('data-submit')) submit();
      else if (el.dataset.tf !== undefined) { setResponse(x.id, el.dataset.tf === 'true', true); render(); }
      else if (el.dataset.move !== undefined) {
        const items = (attempt.responses[x.id] || attempt.layout[x.id]).slice();
        const i = Number(el.dataset.move);
        const j = i + Number(el.dataset.dir);
        [items[i], items[j]] = [items[j], items[i]];
        setResponse(x.id, items, true);
        render();
        const again = mount.querySelector(`[data-move="${j}"][data-dir="${el.dataset.dir}"]`) || mount.querySelector(`[data-move="${j}"]`);
        if (again) again.focus();
      } else if (el.hasAttribute('data-run')) runTests(x, el);
    };
    mount.onchange = (event) => {
      const x = byId[order[attempt.index].id];
      const el = event.target;
      if (el.dataset.choice !== undefined && x.type === 'single') setResponse(x.id, attempt.layout[x.id][Number(el.dataset.choice)], true);
      if (el.dataset.choice !== undefined && x.type === 'multi') {
        const picked = [...mount.querySelectorAll('[data-choice]:checked')].map((box) => attempt.layout[x.id][Number(box.dataset.choice)]);
        setResponse(x.id, picked, true);
      }
      if (el.dataset.match !== undefined) {
        const r = Object.assign({}, attempt.responses[x.id] || {});
        const left = x.pairs[Number(el.dataset.match)][0];
        if (el.value === '') delete r[left]; else r[left] = attempt.layout[x.id][Number(el.value)];
        setResponse(x.id, r, true);
      }
    };
    mount.oninput = (event) => {
      if (!event.target.hasAttribute('data-input')) return;
      const x = byId[order[attempt.index].id];
      const value = event.target.value;
      if (x.type === 'written') setResponse(x.id, Object.assign({}, attempt.responses[x.id], { text: value }));
      else if (x.type === 'code') setResponse(x.id, Object.assign({ passed: 0, total: 0, ranCode: null }, attempt.responses[x.id], { code: value }));
      else setResponse(x.id, value);
    };
    render();
  }

  // ---------- Results ----------
  function showResponse(x, r) {
    if (!isAnswered(x, r)) return 'No answer';
    switch (x.type) {
      case 'multi': return r.join(', ');
      case 'truefalse': return r ? 'True' : 'False';
      case 'order': return r.join(' → ');
      case 'match': return x.pairs.map(([left]) => `${left} → ${r[left] || '—'}`).join('; ');
      case 'written': return r.text;
      case 'code': return `${r.passed || 0} of ${x.tests.length} tests passed`;
      default: return String(r);
    }
  }
  function showCorrect(x) {
    switch (x.type) {
      case 'single': return x.answer;
      case 'multi': return x.answers.join(', ');
      case 'truefalse': return x.answer ? 'True' : 'False';
      case 'number': return String(x.answer);
      case 'text': return x.answers[0];
      case 'order': return x.items.join(' → ');
      case 'match': return x.pairs.map(([l, r]) => `${l} → ${r}`).join('; ');
      default: return '';
    }
  }

  function showResults(mount, catalog, target, attempt, byId, order) {
    const entries = order.map((o) => ({ question: byId[o.id], slug: o.slug, response: attempt.responses[o.id] }));
    const record = () => {
      const score = scoreAttempt(entries);
      const fraction = score.total ? score.points / score.total : 0;
      const store = loadStore();
      const prev = store.results[attempt.id];
      const units = {};
      Object.entries(score.units).forEach(([id, u]) => { units[id] = u.points / u.total; });
      store.results[attempt.id] = { best: Math.max(fraction, prev ? prev.best : 0), last: fraction, at: new Date().toISOString(), units };
      delete store.inProgress[attempt.id];
      saveStore(store);
      return { score, fraction };
    };
    let { score, fraction } = record();

    const written = entries.filter((e) => e.question.type === 'written');
    const unitRows = (slug) => Object.entries(score.units).filter(([id]) => id.startsWith(`${slug}.u`)).map(([id, u]) => {
      const skill = catalog.skills.find((s) => s.id === id);
      const f = u.points / u.total;
      const l = label(f);
      const links = l === 'Review' && skill ? ` <a href="${encodeURI(skill.lessons[0] ? skill.lessons[0].page : skill.testPage)}">Review lesson</a> · <a href="${encodeURI(skill.testPage)}">Unit test</a>` : '';
      return `<tr><td>${esc(skill ? `${skill.unit} · ${skill.name}` : id)}</td><td>${Math.round(u.points * 10) / 10} / ${u.total}</td><td class="assess-label-${l.toLowerCase()}">${l}${links}</td></tr>`;
    }).join('');
    const summary = () => {
      const sections = attempt.sections.map((s) => {
        const c = score.courses[s.slug] || { points: 0, total: 0 };
        const head = attempt.sections.length > 1 ? `<h3>${esc(s.course)} — ${pct(c.total ? c.points / c.total : 0)}</h3>` : '';
        return `${head}<table class="assess-table"><thead><tr><th>Unit</th><th>Score</th><th>Status</th></tr></thead><tbody>${unitRows(s.slug)}</tbody></table>`;
      }).join('');
      return `<div class="box"><span class="box-label">Your score</span><p class="assess-score">${pct(fraction)} <span>(${Math.round(score.points * 10) / 10} of ${score.total} points) · ${label(fraction)}</span></p>${written.length ? '<p class="assess-hint">Written answers count once you score them below.</p>' : ''}</div>${sections}`;
    };

    const writtenHtml = written.map((e) => {
      const r = e.response || { text: '' };
      return `<div class="box" data-written="${esc(e.question.id)}"><span class="box-label">Score your written answer</span><p>${fmt(e.question.prompt)}</p><p class="assess-hint">Your answer</p><p class="assess-written-text">${esc(r.text || 'No answer')}</p><p class="assess-hint">Model answer</p><p>${fmt(e.question.model)}</p><p class="assess-hint">Tick each point your answer covered:</p>${e.question.rubric.map((point, i) => `<label class="assess-option"><input type="checkbox" data-rubric="${i}"${r.rubric && r.rubric[i] ? ' checked' : ''}${isAnswered(e.question, r) ? '' : ' disabled'}> ${fmt(point)}</label>`).join('')}</div>`;
    }).join('');

    const reviewHtml = entries.map((e, i) => {
      const x = e.question;
      const value = grade(x, e.response);
      const correct = x.type === 'written' ? '' : x.type === 'code'
        ? `<p class="assess-hint">Reference solution</p><pre class="code-block"><code>${esc(x.reference)}</code></pre>`
        : `<p><strong>Correct answer:</strong> ${fmt(showCorrect(x))}</p>`;
      return `<details class="assess-review ${value === 1 ? 'is-right' : value > 0 ? 'is-partial' : 'is-wrong'}"><summary>${i + 1}. ${esc(TYPES[x.type].badge)} · ${Math.round(value * 100) / 100} pt</summary><p>${fmt(x.prompt)}</p>${x.code ? `<pre class="code-block"><code>${esc(x.code)}</code></pre>` : ''}<p><strong>Your answer:</strong> ${fmt(showResponse(x, e.response))}</p>${correct}<p class="assess-explain">${fmt(x.explanation)}</p></details>`;
    }).join('');

    mount.innerHTML = `<div data-summary>${summary()}</div>${writtenHtml}${written.length ? '<p><button type="button" class="widget-btn" data-save-written>Save score</button> <span class="assess-hint" data-saved></span></p>' : ''}<h2>Review your answers</h2>${reviewHtml}<p class="assess-nav"><a class="widget-btn" href="assessments.html?${attempt.kind}=${encodeURIComponent(attempt.id.split(':')[1])}" data-retake>Retake</a> <a class="widget-btn" href="assessments.html">Back to Assessments</a></p>`;
    mount.onclick = (event) => {
      if (event.target.hasAttribute('data-retake') && attempt.kind === 'goal' && target.pickable) {
        event.preventDefault();
        mountRunner(mount, catalog, target); // keeps the picked courses
        return;
      }
      if (!event.target.hasAttribute('data-save-written')) return;
      ({ score, fraction } = record());
      mount.querySelector('[data-summary]').innerHTML = summary();
      mount.querySelector('[data-saved]').textContent = canSave() ? 'Saved.' : 'Sign in to save scores.';
    };
    mount.onchange = (event) => {
      const box = event.target.closest('[data-written]');
      if (!box || event.target.dataset.rubric === undefined) return;
      const entry = written.find((e) => e.question.id === box.dataset.written);
      entry.response = Object.assign({}, entry.response, { rubric: [...box.querySelectorAll('[data-rubric]')].map((b) => b.checked) });
      attempt.responses[entry.question.id] = entry.response;
      score = scoreAttempt(entries);
      fraction = score.total ? score.points / score.total : 0;
      mount.querySelector('[data-summary]').innerHTML = summary();
    };
    mount.oninput = null;
    window.scrollTo(0, 0);
  }

  // ---------- Init ----------
  function init() {
    const mount = document.querySelector('[data-assessments]');
    if (!mount || mount.dataset.mounted) return;
    mount.dataset.mounted = '1';
    fetch('/assets/skill-catalog.json').then((res) => res.json()).then((catalog) => {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('course') && !params.has('track') && !params.has('goal')) { renderHub(mount, catalog); return; }
      const target = resolveTarget(catalog, params);
      if (!target) {
        mount.innerHTML = '<p class="toc-empty">That assessment doesn’t exist. <a href="assessments.html">Back to Assessments</a></p>';
        return;
      }
      if (target.pickable && !target.courses.length) renderPicker(mount, catalog, target, (chosen) => mountRunner(mount, catalog, chosen));
      else mountRunner(mount, catalog, target);
    }).catch((err) => {
      mount.innerHTML = '<p class="toc-empty">Assessments couldn’t load. Refresh to try again.</p>';
      console.error(err);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
```

- [ ] **Step 4: Append CSS**

Append to `public/assets/style.css`:

```css
/* Assessments (assessments.js). Only existing tokens, so dark mode is automatic. */
.assess-section { font-size: 0.85rem; color: var(--muted); margin: 1rem 0 0.25rem; text-transform: uppercase; letter-spacing: 0.04em; }
.assess-progress { height: 0.4rem; background: var(--border); border-radius: 999px; overflow: hidden; }
.assess-progress > div { height: 100%; background: var(--accent); }
.assess-count { font-size: 0.9rem; color: var(--muted); margin: 0.4rem 0 0.8rem; }
.assess-card { border: 1px solid var(--border); border-radius: 0.6rem; padding: 1rem 1.1rem; background: var(--bg); }
.assess-unit { font-size: 0.85rem; color: var(--muted); margin: 0 0 0.4rem; }
.assess-badge { display: inline-block; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent); background: var(--accent-soft); border-radius: 999px; padding: 0.15rem 0.6rem; margin: 0 0 0.5rem; }
.assess-how { font-size: 0.9rem; color: var(--muted); margin: 0 0 0.8rem; padding-bottom: 0.8rem; border-bottom: 1px solid var(--border); }
.assess-prompt { font-size: 1.05rem; margin: 0 0 0.8rem; }
.assess-answer { margin: 0 0 1rem; }
.assess-fieldset { border: 0; padding: 0; margin: 0 0 0.6rem; }
.assess-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.assess-option { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.55rem 0.7rem; border: 1px solid var(--border); border-radius: 0.45rem; margin: 0 0 0.45rem; cursor: pointer; }
.assess-option:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
.assess-option input { margin-top: 0.25rem; }
.assess-tf { display: flex; gap: 0.6rem; }
.assess-tf-btn { flex: 1; font: inherit; padding: 0.8rem; border: 1px solid var(--border); border-radius: 0.45rem; background: var(--bg); color: var(--text); cursor: pointer; }
.assess-tf-btn[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
.assess-field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; color: var(--muted); }
.assess-field input { font: inherit; color: var(--text); background: var(--bg); padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: 0.4rem; }
.assess-order { padding-left: 1.4rem; margin: 0; }
.assess-order li { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; padding: 0.45rem 0.6rem; border: 1px solid var(--border); border-radius: 0.45rem; margin: 0 0 0.4rem; }
.assess-order-btns { display: flex; gap: 0.3rem; }
.assess-order-btns button { font: inherit; min-width: 2.2rem; min-height: 2.2rem; border: 1px solid var(--border); border-radius: 0.35rem; background: var(--bg); color: var(--text); cursor: pointer; }
.assess-order-btns button:disabled { opacity: 0.35; cursor: default; }
.assess-match-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
.assess-match-row select { font: inherit; color: var(--text); background: var(--bg); padding: 0.4rem; border: 1px solid var(--border); border-radius: 0.4rem; min-width: 0; }
.assess-code { width: 100%; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9rem; background: var(--code-bg); color: var(--text); border: 1px solid var(--border); border-radius: 0.4rem; padding: 0.6rem; }
.assess-tests { font-size: 0.85rem; margin: 0.3rem 0; }
.assess-good { color: var(--correct); }
.assess-bad { color: var(--incorrect); }
.assess-nav { display: flex; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; }
.assess-map { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 1rem 0; }
.assess-map-btn { font: inherit; font-size: 0.8rem; min-width: 2.1rem; min-height: 2.1rem; border: 1px solid var(--border); border-radius: 0.35rem; background: var(--bg); color: var(--text); cursor: pointer; }
.assess-map-btn.is-answered { background: var(--accent-soft); border-color: var(--accent); }
.assess-map-btn.is-current { outline: 2px solid var(--accent); outline-offset: 1px; font-weight: 700; }
.assess-submit { text-align: right; }
.assess-hint { font-size: 0.85rem; color: var(--muted); }
.assess-score { font-size: 2rem; font-weight: 700; margin: 0.2rem 0; }
.assess-score span { font-size: 0.95rem; font-weight: 400; color: var(--muted); }
.assess-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 0 0 1.2rem; }
.assess-table th, .assess-table td { text-align: left; padding: 0.4rem; border-bottom: 1px solid var(--border); }
.assess-label-strong { color: var(--correct); }
.assess-label-review { color: var(--incorrect); }
.assess-written-text { white-space: pre-wrap; }
.assess-review { border: 1px solid var(--border); border-left-width: 4px; border-radius: 0.45rem; padding: 0.5rem 0.8rem; margin: 0 0 0.5rem; }
.assess-review.is-right { border-left-color: var(--correct); }
.assess-review.is-partial { border-left-color: var(--accent); }
.assess-review.is-wrong { border-left-color: var(--incorrect); }
.assess-review summary { cursor: pointer; font-weight: 600; }
.assess-explain { color: var(--muted); }
@media (max-width: 520px) { .assess-match-row { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Run the Node checks**

Run: `node scripts/check-assessments.js && node scripts/check-inline-script-syntax.js && node scripts/check-content.js && node --check public/assets/assessments.js`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add public/assets/assessments.js public/assets/javascript-sandbox.js content/assessments.html public/assets/style.css
git commit -m "Build the Assessments hub, one-question-per-screen runner, and results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cloud sync for `stemplus:assessments:v1`

**Files:**
- Modify: `public/assets/progress-sync.js` (`EXACT_KEYS`, a new `mergeAssessments`, `mergeForKey`)
- Modify: `scripts/check-progress-sync.js`

**Interfaces:**
- Consumes: existing `mergeIdMap(local, remote, collide)` in progress-sync.js.
- Produces: `mergeForKey('stemplus:assessments:v1', local, remote) → { results, inProgress }`.

- [ ] **Step 1: Write the failing check**

Insert before the final `console.log` in `scripts/check-progress-sync.js`:

```js
// Shape: assessments — higher best wins, newer last wins, stale in-progress attempts drop.
assert.ok(isSyncedKey('stemplus:assessments:v1'), 'assessments key is synced');
const mergedAssess = mergeForKey('stemplus:assessments:v1',
  { results: { 'course:precalculus': { best: 0.9, last: 0.6, at: '2026-11-20T00:00:00.000Z', units: {} } }, inProgress: { 'track:mathematics': { at: '2026-11-18T00:00:00.000Z', responses: { a: 1 } } } },
  { results: { 'course:precalculus': { best: 0.7, last: 0.7, at: '2026-11-19T00:00:00.000Z', units: {} }, 'track:mathematics': { best: 0.5, last: 0.5, at: '2026-11-19T00:00:00.000Z', units: {} } }, inProgress: {} });
assert.strictEqual(mergedAssess.results['course:precalculus'].best, 0.9, 'higher best survives');
assert.strictEqual(mergedAssess.results['course:precalculus'].last, 0.6, 'newer last survives');
assert.strictEqual(mergedAssess.inProgress['track:mathematics'], undefined, 'in-progress older than a finished result is dropped');
assert.deepStrictEqual(mergeForKey('stemplus:assessments:v1', undefined, { results: {}, inProgress: {} }), { results: {}, inProgress: {} }, 'remote-only passes through');
```

Run: `node scripts/check-progress-sync.js`
Expected: FAIL `assessments key is synced`.

- [ ] **Step 2: Implement**

In `public/assets/progress-sync.js`: add `'stemplus:assessments:v1',` to `EXACT_KEYS`. Add after `mergeIdMap`/`keepEither`:

```js
  // Assessments: best score by value, everything else from the newer attempt;
  // an in-progress attempt older than that assessment's finished result is stale.
  function mergeAssessments(local, remote) {
    const l = local || {};
    const r = remote || {};
    const newer = (a, b) => ((a.at || '') >= (b.at || '') ? a : b);
    const results = mergeIdMap(l.results, r.results, (a, b) => Object.assign({}, newer(a, b), { best: Math.max(a.best || 0, b.best || 0) }));
    const inProgress = mergeIdMap(l.inProgress, r.inProgress, newer);
    Object.keys(inProgress).forEach((id) => {
      if (results[id] && (results[id].at || '') >= (inProgress[id].at || '')) delete inProgress[id];
    });
    return { results, inProgress };
  }
```

In `mergeForKey`, add as the first line: `if (key === 'stemplus:assessments:v1') return mergeAssessments(local, remote);`

Update the final log line's count text in `check-progress-sync.js` from `all 8 synced-key shapes` to `all 9 synced-key shapes`.

- [ ] **Step 3: Run**

Run: `node scripts/check-progress-sync.js`
Expected: `check-progress-sync: OK (allowlist and merge rules for all 9 synced-key shapes verified)`

- [ ] **Step 4: Commit**

```bash
git add public/assets/progress-sync.js scripts/check-progress-sync.js
git commit -m "Sync assessment results across devices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Content authoring guide (shared by Tasks 7–8)

No code. Every pool author follows this; the controller pastes it into each content subagent prompt.

**Inputs per course:**
- Units: `node -e 'const c=require("./public/assets/skill-catalog.json"); c.skills.filter(s=>s.course==="<COURSE NAME>").forEach(s=>console.log(s.id, "|", s.name, "|", s.lessons.map(l=>l.title).join("; ")))'`
- Lessons: HTML under `content/<course dir>/Unit N/` (folder from `skill.lessons[].page`). Runtime courses (`Cybersecurity+`, `Bash for Cybersecurity`, `Programming with Packages`) keep lesson data in `public/<course dir>/course.js`.
- Base every question on what that unit's lessons actually teach. No outside topics.

**File:** `public/assets/assessments/<slug>.json`:

```json
{
  "course": "<exact catalog course name>",
  "slug": "<slug>",
  "questions": [
    { "id": "<slug>.u1.q1", "unit": 1, "type": "single", "prompt": "Which loop always runs its body at least once?", "choices": ["do-while", "while", "for", "for-each"], "answer": "do-while", "explanation": "A do-while checks its condition after the body runs." },
    { "id": "<slug>.u1.q2", "unit": 1, "type": "multi", "prompt": "Which of these are valid Python identifiers?", "choices": ["total_2", "_count", "2total", "class"], "answers": ["total_2", "_count"], "explanation": "Identifiers can't start with a digit or be a keyword." },
    { "id": "<slug>.u1.q3", "unit": 1, "type": "truefalse", "prompt": "In Python, `len([1, [2, 3]])` is 3.", "answer": false, "explanation": "The nested list counts as one element, so the length is 2." },
    { "id": "<slug>.u2.q1", "unit": 2, "type": "number", "prompt": "What does `7 // 2` evaluate to in Python?", "answer": 3, "explanation": "Floor division drops the remainder." },
    { "id": "<slug>.u2.q2", "unit": 2, "type": "text", "prompt": "Name the Python keyword that exits a loop immediately.", "answers": ["break"], "explanation": "`break` ends the innermost loop." },
    { "id": "<slug>.u2.q3", "unit": 2, "type": "order", "prompt": "Put the steps of a binary search in order.", "items": ["Find the middle element", "Compare it with the target", "Discard the half that can't contain the target", "Repeat on the remaining half"], "explanation": "Binary search halves the range each step." },
    { "id": "<slug>.u3.q1", "unit": 3, "type": "match", "prompt": "Match each data structure to its access pattern.", "pairs": [["Stack", "Last in, first out"], ["Queue", "First in, first out"], ["Array", "Index lookup"]], "explanation": "..." },
    { "id": "<slug>.u3.q2", "unit": 3, "type": "written", "prompt": "Explain why a hash table lookup is usually O(1) and when it isn't.", "rubric": ["Says the key is hashed to an index", "Says lookup goes straight to that index", "Names collisions as the slowdown", "Mentions worst case O(n)"], "model": "A hash function turns the key into an array index, so lookup jumps straight there. Collisions put several keys in one bucket; if many collide, lookup degrades toward O(n).", "explanation": "..." },
    { "id": "<slug>.u3.q3", "unit": 3, "type": "code", "language": "python", "prompt": "Write `count_evens(nums)` that returns how many numbers in the list are even.", "functionName": "count_evens", "starter": "def count_evens(nums):\n    # your code here\n    pass", "tests": [{ "args": [[1, 2, 4]], "expected": 2 }, { "args": [[]], "expected": 0 }, { "args": [[-2, 3]], "expected": 1 }], "reference": "def count_evens(nums):\n    return sum(1 for n in nums if n % 2 == 0)", "explanation": "Check each number with `% 2 == 0` and count the matches." }
  ]
}
```

**Rules:**
- 3 questions per catalog unit, 3 different types, IDs `q1`–`q3`. Course uses ≥6 of the 9 types overall.
- `written`: at most one per two units (self-scored, slower). `code`: only in `CODE_COURSES`, ≥2 per course, aim for one per two units there; Python unless the unit teaches JavaScript. No imports, `open`, `input`, `require`, or `export`. Tests use only numbers, strings, booleans, null, and (nested) arrays; ≥3 tests including an edge case. Starter must fail the tests.
- `single`: 3–5 choices, one clearly correct, plausible distractors, no "all/none of the above". `multi`: 4–6 choices, ≥2 correct, not all.
- `truefalse`: a single precise claim; prompt is a statement, not a question.
- `number`: exact value; add `tolerance` only for rounding (say so in the prompt, e.g. "to two decimal places" with `tolerance: 0.005`). Units go in the prompt, not the answer.
- `text`: one word / short phrase; list every reasonable accepted form in `answers` (spellings, symbols, abbreviations).
- `order`: 3–6 steps with one defensible order. `match`: 3–6 pairs, one-to-one.
- Inline code in backticks; longer code in `"code": "..."` (shown in a code block under the prompt).
- Every `explanation` says why the answer is right in 1–2 sentences.
- Plain, exam-style wording. The question may be hard; the instructions must not be confusing.

**After writing each pool:** `node scripts/check-assessments.js` must pass. Then re-read every keyed answer and re-derive it yourself (compute numbers, re-trace orders, re-check each multi option). Commit only your pool files (`git add public/assets/assessments/<slug>.json`), never push.

---

### Task 7: Pilot pools + browser verification

**Files:**
- Create: `public/assets/assessments/computer-programming-2.json`, `public/assets/assessments/precalculus.json`

**Interfaces:**
- Consumes: pool contract (Task 3), authoring guide (Task 6), UI (Task 4).

- [ ] **Step 1: Write both pools following Task 6**

Computer Programming 2 (8 units, 24 questions, ≥2 `code`), Precalculus (6 units, 18 questions, no `code`).

- [ ] **Step 2: Validate**

Run: `node scripts/check-assessments.js`
Expected: `check-assessments: engine OK, 2 pools / 42 questions OK`

- [ ] **Step 3: Build and start production server**

Run (background): `npm run build && npm run start -- -p 3123`
Wait until `curl -s -o /dev/null -w '%{http_code}' http://localhost:3123/assessments.html` prints `200`.

- [ ] **Step 4: Verify the hub**

```bash
node scripts/verify-page.mjs 'http://localhost:3123/assessments.html' '(async () => { await new Promise(r => setTimeout(r, 1500)); const ids = ["courses","tracks","goals"].map(id => !!document.getElementById(id)); const cards = document.querySelectorAll("[data-assessments] .toc-item").length; return { ok: ids.every(Boolean) && cards === 42 + 10 + 5, ids, cards }; })()'
```
Expected: `ok: true`, `cards: 57`.

- [ ] **Step 5: Verify a full course attempt (answer, navigate, submit, save)**

```bash
node scripts/verify-page.mjs 'http://localhost:3123/assessments.html?course=precalculus' '(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  await wait(1500);
  window.STEMPlusAccount && (window.STEMPlusAccount.canSave = () => true);
  window.confirm = () => true;
  localStorage.removeItem("stemplus:assessments:v1");
  const m = document.querySelector("[data-assessments]");
  const restart = m.querySelector("[data-restart]");
  if (restart) { restart.click(); await wait(300); }
  const count = m.querySelector(".assess-count").textContent;
  const hasSkeleton = ["assess-unit","assess-badge","assess-how","assess-prompt","assess-answer"].every(c => m.querySelector("." + c));
  const first = m.querySelector("input[type=radio], input[type=checkbox], [data-tf], [data-input]");
  if (first.matches("[data-tf]")) first.click(); else if (first.type === "radio" || first.type === "checkbox") { first.click(); } else { first.value = "1"; first.dispatchEvent(new Event("input", { bubbles: true })); }
  await wait(600);
  const saved = JSON.parse(localStorage.getItem("stemplus:assessments:v1") || "{}");
  m.querySelector("[data-next]").click();
  const second = m.querySelector(".assess-count").textContent;
  m.querySelector("[data-submit]").click();
  await wait(800);
  const after = JSON.parse(localStorage.getItem("stemplus:assessments:v1") || "{}");
  return { ok: count === "Question 1 of 12" && hasSkeleton && !!saved.inProgress?.["course:precalculus"] && second === "Question 2 of 12" && !!m.querySelector(".assess-score") && !!after.results?.["course:precalculus"] && !after.inProgress?.["course:precalculus"], count, second, hasSkeleton };
})()'
```
Expected: `ok: true` (Precalculus has 6 units, so 12 questions).

- [ ] **Step 6: Verify a JS-free code question runs (Python) and order/match controls work**

```bash
node scripts/verify-page.mjs 'http://localhost:3123/assessments.html?course=computer-programming-2' '(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  await wait(1500);
  const m = document.querySelector("[data-assessments]");
  const total = Number(m.querySelector(".assess-count").textContent.match(/of (\d+)/)[1]);
  const seen = {};
  for (let i = 0; i < total; i += 1) {
    m.querySelectorAll("[data-goto]")[i].click();
    const badge = m.querySelector(".assess-badge").textContent.trim();
    seen[badge] = true;
    if (m.querySelector("[data-move]") && !seen.moved) { const before = [...m.querySelectorAll(".assess-order li span:first-child")].map(s => s.textContent); m.querySelector("[data-move][data-dir=\"1\"]").click(); const after = [...m.querySelectorAll(".assess-order li span:first-child")].map(s => s.textContent); seen.moved = before[0] === after[1]; }
    if (m.querySelector("[data-match]") && !seen.matched) { const s = m.querySelector("[data-match]"); s.value = "0"; s.dispatchEvent(new Event("change", { bubbles: true })); seen.matched = true; }
  }
  return { ok: total === 16, total, badges: Object.keys(seen) };
})()'
```
Expected: `ok: true`, badges include at least 4 different type names. If no code question was drawn this run, rerun; then manually confirm Run tests in one code question shows `N of M tests passed` (Pyodide loads from CDN; allow ~10 s):

```bash
node scripts/verify-page.mjs 'http://localhost:3123/assessments.html?course=computer-programming-2' '(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  await wait(1500);
  const m = document.querySelector("[data-assessments]");
  const buttons = m.querySelectorAll("[data-goto]");
  for (let i = 0; i < buttons.length; i += 1) { m.querySelectorAll("[data-goto]")[i].click(); if (m.querySelector("[data-run]")) break; }
  if (!m.querySelector("[data-run]")) return { ok: false, reason: "no code question drawn; rerun" };
  m.querySelector("[data-run]").click();
  for (let t = 0; t < 40 && !/tests passed|stopped|could not/.test(m.querySelector("[data-run-out]").textContent); t += 1) await wait(500);
  return { ok: /0 of \d+ tests passed/.test(m.querySelector("[data-run-out]").textContent), out: m.querySelector("[data-run-out]").textContent.slice(0, 120) };
})()'
```
Expected: `ok: true` (the untouched starter fails every test).

- [ ] **Step 7: Verify a track with missing pools degrades cleanly**

```bash
node scripts/verify-page.mjs 'http://localhost:3123/assessments.html?track=software-engineer' '(async () => { await new Promise(r => setTimeout(r, 2000)); const m = document.querySelector("[data-assessments]"); return { ok: /Skipped/.test(m.textContent) && /Section 1 of 1/.test(m.textContent), text: m.textContent.slice(0, 200) }; })()'
```
Expected: `ok: true` (only CP2 exists among Software Engineer's 4 courses). Clear any `inProgress` it left: no action needed, it's a test profile.

- [ ] **Step 8: Stop the server and commit**

```bash
git add public/assets/assessments/computer-programming-2.json public/assets/assessments/precalculus.json
git commit -m "Add pilot assessment pools: Computer Programming 2 and Precalculus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Checkpoint:** show the user one screenshot-equivalent description (or let them open the local server) before writing 40 more pools — the card structure is the thing they asked to be clear.

---

### Task 8: Remaining 40 pools (parallel batches)

**Files:** create `public/assets/assessments/<slug>.json` for every slug below. One subagent per batch, each following Task 6. Batches touch disjoint files, so they can run in parallel.

| Batch | Slugs |
|---|---|
| B1 Math I | `algebra-geometry-fundamentals-review`, `ap-calculus-bc`, `multivariable-calculus` |
| B2 Math II | `differential-equations`, `discrete-math`, `linear-algebra-a`, `mathematical-proofs` |
| B3 Science | `ap-physics-1`, `ap-physics-2`, `ap-physics-c-mechanics`, `ap-physics-c-electricity-and-magnetism`, `quantum-physics-optics` |
| B4 Programming | `computer-programming-1`, `computer-programming-2-plus`, `computer-programming-ethics`, `software-engineering` |
| B5 Data & AI | `data-handling-cb`, `ai-developer`, `applied-machine-deep-learning`, `programming-with-packages` |
| B6 Systems & Security | `computer-networking-fundamentals`, `systems-programming-architecture-cs`, `cloud-computing-a`, `cloud-computing-b-devops`, `cybersecurity-plus`, `bash-for-cybersecurity` |
| B7 Games & Engineering I | `game-engine-architecture`, `video-game-modding`, `engineering-1`, `career-applied-engineering`, `cad-prototyping` |
| B8 Engineering II | `mechatronics`, `advanced-robotics`, `thermodynamics`, `quantum-computing` |
| B9 Advanced | `advanced-algorithms`, `real-analysis-a`, `real-analysis-b`, `topology-fundamentals`, `linear-algebra-b` |

- [ ] **Step 1: Dispatch B1–B9** with the Task 6 guide, the batch's slugs + exact catalog course names, and: "commit only your pool files, do not push; run `node scripts/check-assessments.js` before committing".

- [ ] **Step 2: After all batches land, require full coverage**

Append to `scripts/check-assessments.js` just before the final `console.log`:

```js
// Every catalog course has a pool (so every course, track, and goal assessment is complete).
const missingPools = courseNames.filter((name) => !poolFiles.includes(`${slugOf(name)}.json`));
assert.ok(!missingPools.length, `missing assessment pools: ${missingPools.join(', ')}`);
```

Run: `node scripts/check-assessments.js`
Expected: `check-assessments: engine OK, 42 pools / 924 questions OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/check-assessments.js
git commit -m "Require an assessment pool for every course

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Answer-key review pass

- [ ] **Step 1:** Dispatch review subagents (different from the authors), same 9 batches plus the 2 pilot pools. Each reviewer, per question: re-derive the keyed answer independently; check `multi` options one by one; check `order` is the only defensible order; check `number` tolerance and units; check `text` accepts obvious alternate forms; check `truefalse` claims are precise; check the question matches its unit's lessons; check `written` rubric points match the model answer. Fix in place, keeping IDs and types unchanged (an ID's meaning may be corrected, never replaced with a different question). Commit only, no push. Report the count and list of fixes.

- [ ] **Step 2:** `node scripts/check-assessments.js && npm test 2>&1 | tail -5` — all pass.

---

### Task 10: Ship notes, full verification, push

**Files:**
- Modify: `content/patch-notes.html` (new top entry)
- Modify: `content/about.html` ("What's inside" card)

- [ ] **Step 1: Patch note**

Insert as the first `patch-entry` in `content/patch-notes.html` (after the nav-links `<p>`):

```html
  <p class="patch-entry"><span class="patch-date">Nov 19, 2026</span>Added <a href="assessments.html">Assessments</a>: check what you know across a whole course, a full track, or a goal. Every course has a pool of 3 questions per unit in nine formats (multiple choice, select all, true/false, typed answers, put in order, match pairs, written answers, and code-it-up problems that run in your browser). Each question shows the same clear layout: unit, question type, and a one-line “how to answer.” Results break down by unit with links to what to review next. Also expanded the lesson explanations in Bash for Cybersecurity and Cybersecurity+.</p>
```

- [ ] **Step 2: About card**

In `content/about.html` "What's inside" list, after the Problem Sets card, add:

```html
    <a class="toc-item" href="assessments.html">
      <span class="toc-num">Check</span>
      <p class="toc-title">Assessments</p>
      <p class="toc-sub">Course, track, and goal assessments in nine question formats, with a per-unit breakdown and what to review next.</p>
      <p class="toc-stat">924 questions · 42 courses · 10 tracks · 5 goals</p>
    </a>
```

- [ ] **Step 3: Full suite + production build**

Run: `npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -5`
Expected: all checks pass; build succeeds.

- [ ] **Step 4: Browser pass on a complete track and goal**

With `npm run start -- -p 3123` running:

```bash
node scripts/verify-page.mjs 'http://localhost:3123/assessments.html?track=software-engineer' '(async () => { await new Promise(r => setTimeout(r, 2500)); const m = document.querySelector("[data-assessments]"); return { ok: !/Skipped/.test(m.textContent) && /Section 1 of 4/.test(m.textContent) && /Question 1 of 30/.test(m.textContent), text: m.textContent.slice(0, 160) }; })()'
node scripts/verify-page.mjs 'http://localhost:3123/assessments.html?goal=review-and-test' '(async () => { await new Promise(r => setTimeout(r, 2000)); localStorage.removeItem("stemplus:results:v1"); return { ok: true }; })()'
node scripts/verify-page.mjs 'http://localhost:3123/assessments.html?goal=review-and-test' '(async () => { await new Promise(r => setTimeout(r, 2000)); const m = document.querySelector("[data-assessments]"); const boxes = m.querySelectorAll("input[type=checkbox]"); boxes[0].click(); m.querySelector("[data-pick-start]").click(); await new Promise(r => setTimeout(r, 1500)); return { ok: !!m.querySelector(".assess-card"), boxes: boxes.length }; })()'
```
Expected: all `ok: true` (Software Engineer = 8 + 8 + 7 + 7 = 30 units).

- [ ] **Step 5: Commit, then push (controller only)**

```bash
git add content/patch-notes.html content/about.html
git commit -m "Announce Assessments in patch notes and About

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 6: Production smoke check** (after Vercel deploys, ~2 min)

Run: `curl -s -o /dev/null -w '%{http_code}\n' https://stem-review.vercel.app/assessments.html && curl -s -o /dev/null -w '%{http_code}\n' https://stem-review.vercel.app/assets/assessments/precalculus.json`
Expected: `200` and `200`. Then repeat Task 7 Step 4 against `https://stem-review.vercel.app/assessments.html`.
