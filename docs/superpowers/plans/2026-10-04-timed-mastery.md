# Timed Mastery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A timed practice mode under Problem Sets: 1–20 random reps from a 500-question pool (Precalculus, AP Calculus BC), graded on speed against a scale tuned by the student's own course mastery.

**Architecture:** `problem-banks.js` gains per-topic question templates shared by the existing 60-question loops and new 500-question `timedQuestions` grids. A new `timed-mastery.html` + `timed-mastery.js` runs the timed flow, reusing `problem-sets.js`'s answer checking (via `window.STEMProblemAnswers`) and `tests.js`'s mastery (via a new `masteryForProblemSet`). All state is in localStorage (`stemplus:timed-mastery:v1`).

**Tech Stack:** Plain browser JS in `public/assets/` (no bundler), static HTML under `content/` rendered by the Next.js catch-all shell, Node `assert` check scripts wired into `npm test`.

**Spec:** `docs/superpowers/specs/2026-10-04-timed-mastery-design.md`

## Global Constraints

- Timed pools only for `precalculus` and `ap-calculus-bc`; exactly 500 questions each; topic split 84/84/83/83/83/83; IDs prefixed `tm-precalc-` / `tm-calc-`.
- Regular `questions` for both courses stay byte-identical (60 each).
- `BASE_SCALES`: precalculus `{ fast: 20, slow: 90 }`, ap-calculus-bc `{ fast: 30, slow: 120 }`; `PENALTY_SECONDS = 5`; `MAX_REPS = 20`; default reps 10.
- `benchmarkFactor(m) = 1.25 − 0.5 × m/100`, `null` → 1. Letters: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, else F.
- Storage key `stemplus:timed-mastery:v1`, shape `{ [slug]: { best, last } }`, record `{ pct, grade, reps, factor, at }`.
- Shared `assets/*.js` must not gate on `DOMContentLoaded` (the shell re-creates scripts after load); guard double-mounting with a `dataset.mounted` flag on the DOM node.
- Verify against `npm run build && npm run start`, never `npm run dev`. Commit every change; push straight to `main`.

---

### Task 1: 500-question timed pools

**Files:**
- Modify: `public/assets/problem-banks.js` (helpers after `choose`; templates + rewritten `calculus()`/`precalculus()`; new `timedCalculus()`/`timedPrecalculus()`; 2 course entries)
- Modify: `scripts/check-problem-banks.js`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Produces: `course.timedQuestions` (array of the same question objects as `course.questions`: `{ id, topic, prompt, type: 'number', answer, tolerance, explanation, meta }`) on the `precalculus` and `ap-calculus-bc` entries of `STEMProblemBanks.courses`.

- [ ] **Step 1: Snapshot the regular banks**

```bash
node -e "const {courses}=require('./public/assets/problem-banks.js');process.stdout.write(JSON.stringify(courses.filter(c=>['precalculus','ap-calculus-bc'].includes(c.slug)).map(c=>c.questions)))" > "$SCRATCH/regular-before.json"
```
(`$SCRATCH` = the session scratchpad directory.)

- [ ] **Step 2: Write the failing audit**

In `scripts/check-problem-banks.js`, replace the block from `const ids = new Set();` through `assert(total === 1200, ...);` with:

```js
const ids = new Set();
let total = 0;

const auditPool = (label, questions) => {
  const topics = new Map();
  const prompts = new Set();
  questions.forEach((question) => {
    assert(!ids.has(question.id), `Duplicate ID: ${question.id}`);
    ids.add(question.id);
    assert(question.prompt && question.explanation, `${question.id}: missing prompt or explanation`);
    assert(!prompts.has(question.prompt), `${question.id}: duplicate prompt within ${label}`);
    prompts.add(question.prompt);
    assert(equal(question.answer, expectedAnswer(question)), `${question.id}: answer audit failed`);
    topics.set(question.topic, (topics.get(question.topic) || 0) + 1);

    if (question.type === 'choice') {
      assert(new Set(question.choices).size === question.choices.length, `${question.id}: duplicate choice`);
      assert(question.choices.includes(question.answer), `${question.id}: answer missing from choices`);
    } else {
      assert(question.type === 'number' && Number.isFinite(question.answer), `${question.id}: invalid numeric answer`);
      assert(question.tolerance > 0, `${question.id}: invalid tolerance`);
    }
  });
  return topics;
};

courses.forEach((course) => {
  assert(course.questions.length === 60, `${course.title}: expected 60 questions`);
  const topics = auditPool(course.title, course.questions);
  assert(topics.size === 6, `${course.title}: expected 6 topics`);
  topics.forEach((count, topic) => assert(count === 10, `${course.title}/${topic}: expected 10 questions`));
  total += course.questions.length;
});

assert(total === 1200, `Expected 1200 total questions, found ${total}`);

// Timed Mastery pools (timed-mastery.html) — separate from the regular 60.
const timedCourses = courses.filter((course) => course.timedQuestions);
assert(timedCourses.map((course) => course.slug).sort().join(',') === 'ap-calculus-bc,precalculus',
  `Expected timed pools for exactly ap-calculus-bc and precalculus, found: ${timedCourses.map((course) => course.slug).join(', ') || 'none'}`);
let timedTotal = 0;
timedCourses.forEach((course) => {
  assert(course.timedQuestions.length === 500, `${course.title}: expected 500 timed questions, found ${course.timedQuestions.length}`);
  const topics = auditPool(`${course.title} timed pool`, course.timedQuestions);
  const regularTopics = [...new Set(course.questions.map((question) => question.topic))].sort();
  assert(JSON.stringify([...topics.keys()].sort()) === JSON.stringify(regularTopics), `${course.title}: timed topics must match the regular bank's topics`);
  topics.forEach((count, topic) => assert(count === 83 || count === 84, `${course.title} timed/${topic}: expected 83 or 84 questions, found ${count}`));
  timedTotal += course.timedQuestions.length;
});
```

And replace the final `console.log(...)` with:

```js
console.log(`Problem-bank audit passed: ${courses.length} courses, ${total} answers + ${timedTotal} timed answers recomputed, ${localLinks} local references checked.`);
```

- [ ] **Step 3: Run it — expect FAIL**

Run: `node scripts/check-problem-banks.js`
Expected: `Error: Expected timed pools for exactly ap-calculus-bc and precalculus, found: none`

- [ ] **Step 4: Add grid helpers**

In `public/assets/problem-banks.js`, after `const choose = (n, r) => factorial(n) / (factorial(r) * factorial(n - r));` add:

```js
  const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  const nonZero = (lo, hi) => range(lo, hi).filter((value) => value !== 0);
  const grid = (...ranges) => ranges.reduce(
    (tuples, values) => tuples.flatMap((tuple) => values.map((value) => [...tuple, value])),
    [[]]
  );
  // Evenly spaced picks across a whole parameter grid, so a timed pool covers
  // the full grid instead of only its first rows. Deterministic, so question
  // IDs stay stable between page loads.
  const spread = (items, count) => {
    if (items.length < count) throw new Error(`Grid has ${items.length} tuples, needs ${count}`);
    return Array.from({ length: count }, (_, j) => items[Math.floor(j * items.length / count)]);
  };
  const addFromGrid = (questions, idPrefix, count, tuples, make) => spread(tuples, count).forEach((tuple, j) => {
    questions.push(make(`${idPrefix}-${j + 1}`, ...tuple));
  });
```

- [ ] **Step 5: Calculus templates + timed pool**

Replace the whole `function calculus() { … }` with:

```js
  // One template per topic, shared by the regular 60-question loops and the
  // 500-question Timed Mastery grids, so both pools word every question the
  // same way and the audit recomputes both through the same meta kinds.
  const calcLimitQ = (id, a, b, c) => {
    const answer = a * a + b * a + c;
    return qNumber(
      id, 'Limits',
      `Evaluate lim x→${a} of (x² ${term(b, 'x')} ${term(c, '')}).`,
      answer, `Polynomials are continuous, so substitute x = ${a}. The limit is ${answer}.`,
      { kind: 'polynomial-limit', a, b, c }
    );
  };
  const calcDerivativeQ = (id, coefficient, power, linear, x) => {
    const answer = coefficient * power * (x ** (power - 1)) + linear;
    return qNumber(
      id, 'Derivatives',
      `If f(x) = ${coefficient}x^${power} ${term(linear, 'x')}, find f′(${x}).`,
      answer,
      `f′(x) = ${coefficient * power}x^${power - 1} ${term(linear, '')}; substituting ${x} gives ${answer}.`,
      { kind: 'power-derivative', coefficient, power, linear, x }
    );
  };
  const calcProductQ = (id, k, c, x) => {
    const answer = (x * x + c) + (x + k) * 2 * x;
    return qNumber(
      id, 'Derivative applications',
      `For f(x) = (x + ${k})(x² + ${c}), find the tangent-line slope at x = ${x}.`,
      answer,
      `Product rule: f′(x) = (x² + ${c}) + (x + ${k})(2x). At x = ${x}, f′ = ${answer}.`,
      { kind: 'product-derivative', k, c, x }
    );
  };
  const calcIntegralQ = (id, m, b, upper) => {
    const answer = (m * upper * upper) / 2 + b * upper;
    return qNumber(
      id, 'Integrals',
      `Evaluate ∫ from 0 to ${upper} of (${m}x ${term(b, '')}) dx.`,
      answer,
      `An antiderivative is (${m}/2)x² ${term(b, 'x')}. Evaluation from 0 to ${upper} gives ${fmt(answer)}.`,
      { kind: 'linear-integral', m, b, upper }
    );
  };
  const calcFtcQ = (id, k, c, x) => {
    const answer = x * x + k * x + c;
    return qNumber(
      id, 'Fundamental Theorem',
      `Let F(x) = ∫ from 0 to x of (t² ${term(k, 't')} ${term(c, '')}) dt. Find F′(${x}).`,
      answer,
      `By the Fundamental Theorem of Calculus, F′(x) equals the integrand at x. Result: ${answer}.`,
      { kind: 'ftc', k, c, x }
    );
  };
  const calcSeriesQ = (id, first, denominator) => {
    const ratio = 1 / denominator;
    const answer = first / (1 - ratio);
    return qNumber(
      id, 'Infinite series',
      `Find the sum of the infinite geometric series with first term ${first} and common ratio 1/${denominator}. Round only if needed.`,
      answer,
      `Because |r| < 1, S = a/(1 − r) = ${first}/(1 − 1/${denominator}) = ${fmt(answer)}.`,
      { kind: 'geometric-series', first, ratio }
    );
  };

  function calculus() {
    const questions = [];
    for (let i = 0; i < 10; i += 1) questions.push(calcLimitQ(`calc-limit-${i + 1}`, i - 4, (i % 5) - 2, 3 - (i % 4)));
    for (let i = 0; i < 10; i += 1) questions.push(calcDerivativeQ(`calc-derivative-${i + 1}`, 1 + (i % 3), 2 + (i % 4), (i % 5) - 2, (i % 4) - 1));
    for (let i = 0; i < 10; i += 1) questions.push(calcProductQ(`calc-product-${i + 1}`, 1 + (i % 4), 2 + (i % 3), (i % 5) - 2));
    for (let i = 0; i < 10; i += 1) questions.push(calcIntegralQ(`calc-integral-${i + 1}`, 1 + (i % 4), (i % 5) - 1, 1 + (i % 5)));
    for (let i = 0; i < 10; i += 1) questions.push(calcFtcQ(`calc-ftc-${i + 1}`, (i % 4) - 1, 2 + (i % 3), (i % 5) - 2));
    for (let i = 0; i < 10; i += 1) questions.push(calcSeriesQ(`calc-series-${i + 1}`, 2 + i, 2 + (i % 4)));
    return questions;
  }

  // Timed Mastery pool (timed-mastery.html): 500 questions over the same 6
  // topics, from bounded parameter grids instead of the regular loops'
  // i % k cycles, which repeat long before 84. Zero coefficients are left
  // out so prompts never print "+ 0x".
  function timedCalculus() {
    const questions = [];
    addFromGrid(questions, 'tm-calc-limit', 84, grid(range(-5, 5), nonZero(-3, 3), nonZero(-4, 4)), calcLimitQ);
    addFromGrid(questions, 'tm-calc-derivative', 84, grid(range(1, 4), range(2, 5), nonZero(-3, 3), range(-2, 2)), calcDerivativeQ);
    addFromGrid(questions, 'tm-calc-product', 83, grid(range(1, 5), range(1, 5), range(-3, 3)), calcProductQ);
    addFromGrid(questions, 'tm-calc-integral', 83, grid(range(1, 6), nonZero(-3, 3), range(1, 5)), calcIntegralQ);
    addFromGrid(questions, 'tm-calc-ftc', 83, grid(nonZero(-3, 3), range(1, 5), range(-3, 3)), calcFtcQ);
    addFromGrid(questions, 'tm-calc-series', 83, grid(range(1, 20), range(2, 6)), calcSeriesQ);
    return questions;
  }
```

- [ ] **Step 6: Precalculus templates + timed pool**

Replace the whole `function precalculus() { … }` with:

```js
  const precalcFunctionQ = (id, a, b, c, x) => {
    const answer = a * x * x + b * x + c;
    return qNumber(
      id, 'Functions',
      `If f(x) = ${a}x² ${term(b, 'x')} ${term(c, '')}, find f(${x}).`,
      answer, `Substitute x = ${x}: f(${x}) = ${answer}.`,
      { kind: 'quadratic-eval', a, b, c, x }
    );
  };
  const precalcCompositionQ = (id, a, b, c, d, x) => {
    const answer = a * (c * x + d) + b;
    return qNumber(
      id, 'Composition and inverses',
      `Let f(x) = ${a}x ${term(b, '')} and g(x) = ${c}x ${term(d, '')}. Find (f ∘ g)(${x}).`,
      answer, `First g(${x}) = ${c * x + d}; then f(${c * x + d}) = ${answer}.`,
      { kind: 'linear-composition', a, b, c, d, x }
    );
  };
  const precalcPolynomialQ = (id, r1, r2) => {
    const sum = r1 + r2;
    const product = r1 * r2;
    return qNumber(
      id, 'Polynomial functions',
      `What is the larger zero of x² ${term(-sum, 'x')} ${term(product, '')}?`,
      Math.max(r1, r2), `Factoring gives (x − ${r1})(x − ${r2}), so the larger zero is ${Math.max(r1, r2)}.`,
      { kind: 'quadratic-larger-root', sum, product }
    );
  };
  // Negative exponents show the value as a fraction (2^x = 1/8), since
  // 0.125 would give the answer away less cleanly than the real notation.
  const precalcExponentialQ = (id, base, exponent) => {
    const value = base ** exponent;
    const shown = exponent < 0 ? `1/${base ** -exponent}` : value;
    return qNumber(
      id, 'Exponential and logarithmic functions',
      `Solve for x: ${base}^x = ${shown}.`,
      exponent, `Because ${shown} = ${base}^${exponent}, x = ${exponent}.`,
      { kind: 'exponential-solve', base, value }
    );
  };
  const precalcTrigQ = (id, opposite, adjacent) => {
    const hypotenuse = Math.hypot(opposite, adjacent);
    return qNumber(
      id, 'Trigonometry',
      `In a right triangle, angle θ has opposite side ${opposite} and adjacent side ${adjacent}. Find sin θ.`,
      opposite / hypotenuse,
      `The hypotenuse is ${hypotenuse}, so sin θ = opposite/hypotenuse = ${opposite}/${hypotenuse} = ${fmt(opposite / hypotenuse)}.`,
      { kind: 'right-triangle-sine', opposite, adjacent }
    );
  };
  const precalcArithmeticQ = (id, first, difference, n) => {
    const answer = first + (n - 1) * difference;
    return qNumber(
      id, 'Sequences',
      `An arithmetic sequence has a₁ = ${first} and common difference ${difference}. Find a_${n}.`,
      answer, `a_n = a₁ + (n − 1)d = ${first} + (${n} − 1)(${difference}) = ${answer}.`,
      { kind: 'arithmetic-term', first, difference, n }
    );
  };
  const precalcGeometricQ = (id, first, ratio, n) => {
    const answer = first * ratio ** (n - 1);
    return qNumber(
      id, 'Sequences',
      `A geometric sequence has a₁ = ${first} and common ratio ${ratio}. Find a_${n}.`,
      answer, `a_n = a₁r^(n−1) = ${first}(${ratio}^${n - 1}) = ${answer}.`,
      { kind: 'geometric-term', first, ratio, n }
    );
  };

  function precalculus() {
    const questions = [];
    for (let i = 0; i < 10; i += 1) questions.push(precalcFunctionQ(`precalc-function-${i + 1}`, 1 + (i % 3), (i % 5) - 2, 3 - (i % 4), i - 4));
    for (let i = 0; i < 10; i += 1) questions.push(precalcCompositionQ(`precalc-composition-${i + 1}`, 2 + (i % 3), (i % 4) - 1, 1 + (i % 4), 2 - (i % 5), i - 3));
    for (let i = 0; i < 10; i += 1) questions.push(precalcPolynomialQ(`precalc-polynomial-${i + 1}`, i - 5, i + 2));
    for (let i = 0; i < 10; i += 1) questions.push(precalcExponentialQ(`precalc-exponential-${i + 1}`, 2 + (i % 4), 1 + (i % 6)));
    const triples = [[3, 4], [5, 12], [8, 15], [7, 24], [9, 12], [12, 16], [15, 20], [10, 24], [18, 24], [20, 21]];
    triples.forEach(([opposite, adjacent], i) => questions.push(precalcTrigQ(`precalc-trig-${i + 1}`, opposite, adjacent)));
    for (let i = 0; i < 10; i += 1) {
      const n = 4 + i;
      questions.push(i % 2 === 0
        ? precalcArithmeticQ(`precalc-sequence-${i + 1}`, 2 + i, 1 + (i % 4), n)
        : precalcGeometricQ(`precalc-sequence-${i + 1}`, 1 + (i % 3), 2 + (i % 2), n));
    }
    return questions;
  }

  // Timed Mastery pool — see timedCalculus() above.
  function timedPrecalculus() {
    const questions = [];
    addFromGrid(questions, 'tm-precalc-function', 84, grid(range(1, 3), nonZero(-3, 3), nonZero(-4, 4), range(-3, 3)), precalcFunctionQ);
    addFromGrid(questions, 'tm-precalc-composition', 84, grid(range(2, 4), nonZero(-3, 3), range(1, 4), nonZero(-3, 3), range(-3, 3)), precalcCompositionQ);
    addFromGrid(questions, 'tm-precalc-polynomial', 83,
      grid(nonZero(-8, 8), nonZero(-8, 8)).filter(([r1, r2]) => r1 < r2 && r1 + r2 !== 0), precalcPolynomialQ);
    addFromGrid(questions, 'tm-precalc-exponential', 83,
      grid(range(2, 10), range(-3, 6)).filter(([base, exponent]) => base ** Math.abs(exponent) <= 100000), precalcExponentialQ);
    addFromGrid(questions, 'tm-precalc-trig', 83,
      grid(range(1, 75), range(1, 75)).filter(([opposite, adjacent]) => Number.isInteger(Math.hypot(opposite, adjacent))), precalcTrigQ);
    addFromGrid(questions, 'tm-precalc-arithmetic', 42, grid(range(1, 9), nonZero(-5, 5), range(5, 15)), precalcArithmeticQ);
    addFromGrid(questions, 'tm-precalc-geometric', 41,
      grid(range(1, 5), range(2, 4), range(3, 8)).filter(([first, ratio, n]) => first * ratio ** (n - 1) <= 50000), precalcGeometricQ);
    return questions;
  }
```

- [ ] **Step 7: Attach the pools to the course entries**

Replace `questions: calculus()` with:
```js
      questions: calculus(),
      timedQuestions: timedCalculus()
```
Replace `questions: precalculus()` with:
```js
      questions: precalculus(),
      timedQuestions: timedPrecalculus()
```

- [ ] **Step 8: Run audit + regular-bank diff — expect PASS / no diff**

```bash
node scripts/check-problem-banks.js
node -e "const {courses}=require('./public/assets/problem-banks.js');process.stdout.write(JSON.stringify(courses.filter(c=>['precalculus','ap-calculus-bc'].includes(c.slug)).map(c=>c.questions)))" > "$SCRATCH/regular-after.json"
cmp "$SCRATCH/regular-before.json" "$SCRATCH/regular-after.json" && echo IDENTICAL
```
Expected: `Problem-bank audit passed: 20 courses, 1200 answers + 1000 timed answers recomputed, …` and `IDENTICAL`.

- [ ] **Step 9: Wire the audit into `npm test`**

In `package.json`, append ` && node scripts/check-problem-banks.js` to the end of the `test` script. Run `npm test`; expect all checks to pass.

- [ ] **Step 10: Commit**

```bash
git add public/assets/problem-banks.js scripts/check-problem-banks.js package.json
git commit -m "Add 500-question Timed Mastery pools for Precalculus and AP Calculus BC"
```

---

### Task 2: Timed Mastery page

**Files:**
- Create: `public/assets/timed-mastery.js`
- Create: `content/timed-mastery.html`
- Create: `scripts/check-timed-mastery.js`
- Modify: `public/assets/problem-sets.js` (expose `window.STEMProblemAnswers`)
- Modify: `public/assets/tests.js` (`masteryForProblemSet` + export)
- Modify: `scripts/check-problem-banks.js` (link-check `timed-mastery.html`)
- Modify: `package.json` (`test` script)

**Interfaces:**
- Consumes: `course.timedQuestions` (Task 1); `STEMProblemBanks.getCourse(slug)`.
- Produces: `window.STEMProblemAnswers = { parseNumber, answersClose }`; `window.STEMPlusTests.masteryForProblemSet(slug) → number 0–100 | null`; Node exports of `timed-mastery.js`: `{ BASE_SCALES, PENALTY_SECONDS, MAX_REPS, benchmarkFactor, questionScore, effectiveSeconds, letterGrade, clampReps }`; DOM hooks `[data-timed-mastery]`, `[data-timed-reps]`, `[data-timed-start]`, `[data-timed-prompt]`, `[data-timed-input]`, `[data-timed-check]`, `[data-timed-feedback]`, `[data-timed-next]`, `[data-timed-result]`, `[data-timed-again]`.

- [ ] **Step 1: Write the failing grading check**

Create `scripts/check-timed-mastery.js`:

```js
'use strict';

const assert = require('node:assert');
const {
  BASE_SCALES, PENALTY_SECONDS, MAX_REPS,
  benchmarkFactor, questionScore, effectiveSeconds, letterGrade, clampReps,
} = require('../public/assets/timed-mastery.js');
const { courses } = require('../public/assets/problem-banks.js');

assert.strictEqual(benchmarkFactor(null), 1, 'no course data → standard scale');
assert.strictEqual(benchmarkFactor(undefined), 1, 'missing mastery → standard scale');
assert.strictEqual(benchmarkFactor(0), 1.25, '0% mastery → 25% more lenient');
assert.strictEqual(benchmarkFactor(50), 1, '50% mastery → standard scale');
assert.strictEqual(benchmarkFactor(100), 0.75, '100% mastery → 25% stricter');

assert.strictEqual(questionScore(20, 20, 90), 100, 'exactly at the fast mark is full credit');
assert.strictEqual(questionScore(3, 20, 90), 100, 'faster than the fast mark is full credit');
assert.strictEqual(questionScore(90, 20, 90), 0, 'exactly at the slow mark is zero');
assert.strictEqual(questionScore(400, 20, 90), 0, 'slower than the slow mark is zero');
assert.strictEqual(questionScore(55, 20, 90), 50, 'midpoint is 50%');

assert.strictEqual(PENALTY_SECONDS, 5);
assert.strictEqual(effectiveSeconds(12, 0), 12, 'no wrong tries → raw time');
assert.strictEqual(effectiveSeconds(12, 2), 22, 'two wrong tries → +10s');

[[100, 'A'], [90, 'A'], [89, 'B'], [80, 'B'], [79, 'C'], [70, 'C'], [69, 'D'], [60, 'D'], [59, 'F'], [0, 'F']]
  .forEach(([pct, grade]) => assert.strictEqual(letterGrade(pct), grade, `${pct}% should be ${grade}`));

assert.strictEqual(MAX_REPS, 20);
assert.strictEqual(clampReps('7'), 7);
assert.strictEqual(clampReps('25'), 20, 'reps cap at 20');
assert.strictEqual(clampReps('0'), 1, 'reps floor at 1');
assert.strictEqual(clampReps('-3'), 1, 'negative reps floor at 1');
assert.strictEqual(clampReps(''), 10, 'empty reps → default 10');

courses.filter((course) => course.timedQuestions).forEach((course) => {
  const scale = BASE_SCALES[course.slug];
  assert.ok(scale && scale.fast > 0 && scale.fast < scale.slow, `${course.slug} has a timed pool but no valid BASE_SCALES entry`);
});

console.log('Timed Mastery grading checks passed.');
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `node scripts/check-timed-mastery.js`
Expected: `Error: Cannot find module '../public/assets/timed-mastery.js'`

- [ ] **Step 3: Create `public/assets/timed-mastery.js`**

```js
// STEM+ Timed Mastery (timed-mastery.html?course=<slug>): a timed run of
// 1–20 random questions from a course's 500-question timedQuestions pool in
// problem-banks.js. Each question's time, plus a penalty per wrong try, is
// scored against a speed scale tuned by the student's own mastery in that
// course (tests.js masteryForProblemSet). Results stay in this browser.
(function () {
  'use strict';

  // Seconds: full credit at or under `fast`, zero at or over `slow`, linear
  // in between — before the personal benchmark factor below. Hand-tuned;
  // adjust here if real runs feel too strict or too lenient.
  const BASE_SCALES = {
    precalculus: { fast: 20, slow: 90 },
    'ap-calculus-bc': { fast: 30, slow: 120 },
  };
  const PENALTY_SECONDS = 5;
  const MAX_REPS = 20;
  const DEFAULT_REPS = 10;
  const STORAGE_KEY = 'stemplus:timed-mastery:v1';

  // 100% course mastery → 0.75× (stricter), 50% → 1×, 0% → 1.25× (more
  // lenient). No graded course work yet → the standard 1× scale.
  const benchmarkFactor = (mastery) => (mastery == null ? 1 : 1.25 - 0.5 * (mastery / 100));
  const questionScore = (seconds, fast, slow) => {
    if (seconds <= fast) return 100;
    if (seconds >= slow) return 0;
    return (slow - seconds) / (slow - fast) * 100;
  };
  const effectiveSeconds = (rawSeconds, wrongTries) => rawSeconds + wrongTries * PENALTY_SECONDS;
  const letterGrade = (pct) => (pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F');
  const clampReps = (value) => {
    const reps = Number.parseInt(value, 10);
    return Number.isFinite(reps) ? Math.min(MAX_REPS, Math.max(1, reps)) : DEFAULT_REPS;
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = { BASE_SCALES, PENALTY_SECONDS, MAX_REPS, benchmarkFactor, questionScore, effectiveSeconds, letterGrade, clampReps };
    return;
  }

  const mount = document.querySelector('[data-timed-mastery]');
  // The Next.js shell re-creates this script after load (and twice in dev's
  // Strict Mode) — the flag lives on the DOM node, not in this closure, so
  // a second execution can't bind a second set of listeners.
  if (!mount || mount.dataset.mounted) return;
  mount.dataset.mounted = '1';

  const slug = new URLSearchParams(window.location.search).get('course');
  const bankApi = window.STEMProblemBanks;
  const answerApi = window.STEMProblemAnswers;
  const course = bankApi && bankApi.getCourse(slug);
  const baseScale = course && BASE_SCALES[course.slug];
  const title = document.querySelector('[data-timed-title]');
  const subtitle = document.querySelector('[data-timed-subtitle]');

  if (!course || !course.timedQuestions || !baseScale || !answerApi) {
    if (subtitle) subtitle.textContent = '';
    mount.innerHTML = '<p class="toc-empty">Timed Mastery isn’t available for this course. <a href="problem-sets.html">Back to Problem Sets</a></p>';
    return;
  }

  const tests = window.STEMPlusTests;
  const mastery = tests && tests.masteryForProblemSet ? tests.masteryForProblemSet(course.slug) : null;
  const factor = benchmarkFactor(mastery);
  const fast = baseScale.fast * factor;
  const slow = baseScale.slow * factor;
  const seconds = (value) => `${Number(value.toFixed(1))}s`;
  const benchmarkLine = mastery == null
    ? `No graded ${course.title} unit tests or exams in this browser yet, so you’re on the standard scale: full credit at or under ${seconds(fast)}, zero at ${seconds(slow)}.`
    : `Tuned to your ${mastery}% ${course.title} mastery: full credit at or under ${seconds(fast)}, zero at ${seconds(slow)}.`;

  document.title = `${course.title} Timed Mastery — STEM+`;
  document.querySelector('.page').dataset.tier = course.tier;
  if (title) title.textContent = `${course.title} Timed Mastery`;
  if (subtitle) subtitle.textContent = `${course.timedQuestions.length} questions · answer each one correctly, as fast as you can.`;

  const loadHistory = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_) {
      return {};
    }
  };
  const saveRun = (record) => {
    const history = loadHistory();
    const previous = history[course.slug] || {};
    history[course.slug] = {
      best: previous.best && previous.best.pct >= record.pct ? previous.best : record,
      last: record,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      return true;
    } catch (_) {
      return false;
    }
  };
  const pickRandom = (items, count) => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  };
  const recordText = (record) => `${record.grade} (${record.pct}%) over ${record.reps} rep${record.reps === 1 ? '' : 's'}`;

  let deck = [];
  let results = [];
  let clockTimer = null;

  const stopClock = () => {
    if (clockTimer) window.clearInterval(clockTimer);
    clockTimer = null;
  };

  const renderStart = () => {
    stopClock();
    const saved = loadHistory()[course.slug];
    mount.innerHTML = `
      <div class="box why"><span class="box-label">Your benchmark</span>
        <p data-timed-benchmark></p>
        <p>Each wrong try adds ${PENALTY_SECONDS}s. A: 90%+ · B: 80%+ · C: 70%+ · D: 60%+.</p>
      </div>
      <p class="problem-stats" data-timed-history></p>
      <div class="problem-toolbar">
        <label for="timed-reps">Reps (1–${MAX_REPS})</label>
        <input type="number" id="timed-reps" class="quiz-fill-input" data-timed-reps min="1" max="${MAX_REPS}" value="${DEFAULT_REPS}">
        <button type="button" class="widget-btn" data-timed-start>Start</button>
      </div>`;
    mount.querySelector('[data-timed-benchmark]').textContent = benchmarkLine;
    mount.querySelector('[data-timed-history]').textContent = saved && saved.best && saved.last
      ? `Personal best: ${recordText(saved.best)} · Last run: ${recordText(saved.last)}`
      : 'No runs yet in this browser.';
    mount.querySelector('[data-timed-start]').addEventListener('click', () => {
      deck = pickRandom(course.timedQuestions, clampReps(mount.querySelector('[data-timed-reps]').value));
      results = [];
      renderQuestion();
    });
  };

  const renderQuestion = () => {
    const current = deck[results.length];
    let wrongTries = 0;
    let solved = false;
    mount.innerHTML = `
      <div class="quiz problem-card">
        <div class="problem-meta"><span>Question ${results.length + 1} of ${deck.length}</span><span data-timed-topic></span></div>
        <p class="problem-stats" data-timed-clock></p>
        <p class="quiz-prompt problem-prompt" data-timed-prompt></p>
        <div class="quiz-choices" data-timed-choices hidden></div>
        <div class="quiz-fill-row" data-timed-fill hidden>
          <label class="sr-only" for="timed-answer">Your answer</label>
          <input class="quiz-fill-input" id="timed-answer" data-timed-input inputmode="decimal" autocomplete="off" placeholder="Enter number, fraction, or percent">
          <button type="button" class="quiz-fill-check" data-timed-check>Check answer</button>
        </div>
        <p class="quiz-feedback" data-timed-feedback aria-live="polite" hidden></p>
        <p class="quiz-explain" data-timed-explanation hidden></p>
        <button type="button" class="widget-btn problem-next" data-timed-next hidden></button>
      </div>`;
    const clock = mount.querySelector('[data-timed-clock]');
    const choices = mount.querySelector('[data-timed-choices]');
    const fillRow = mount.querySelector('[data-timed-fill]');
    const input = mount.querySelector('[data-timed-input]');
    const checkButton = mount.querySelector('[data-timed-check]');
    const feedback = mount.querySelector('[data-timed-feedback]');
    const explanation = mount.querySelector('[data-timed-explanation]');
    const nextButton = mount.querySelector('[data-timed-next]');
    mount.querySelector('[data-timed-topic]').textContent = current.topic;
    mount.querySelector('[data-timed-prompt]').textContent = current.prompt;

    const startedAt = performance.now();
    const elapsed = () => (performance.now() - startedAt) / 1000;
    const tick = () => {
      clock.textContent = `${elapsed().toFixed(1)}s${wrongTries ? ` + ${wrongTries * PENALTY_SECONDS}s penalty` : ''}`;
    };
    tick();
    stopClock();
    clockTimer = window.setInterval(tick, 100);

    const showFeedback = (text, isCorrect) => {
      feedback.textContent = text;
      feedback.className = `quiz-feedback ${isCorrect ? 'is-correct' : 'is-incorrect'}`;
      feedback.hidden = false;
    };
    const markWrong = () => {
      wrongTries += 1;
      tick();
      showFeedback(`Not quite — +${PENALTY_SECONDS}s. Try again.`, false);
    };
    const markCorrect = () => {
      solved = true;
      stopClock();
      const raw = elapsed();
      const effective = effectiveSeconds(raw, wrongTries);
      const score = questionScore(effective, fast, slow);
      results.push({ topic: current.topic, raw, wrongTries, effective, score });
      clock.textContent = seconds(effective);
      input.disabled = true;
      checkButton.disabled = true;
      choices.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      showFeedback(`Correct · ${seconds(effective)}${wrongTries ? ` (${seconds(raw)} + ${wrongTries * PENALTY_SECONDS}s penalty)` : ''} · ${Math.round(score)}%`, true);
      explanation.textContent = current.explanation;
      explanation.hidden = false;
      nextButton.textContent = results.length === deck.length ? 'See results' : 'Next question';
      nextButton.hidden = false;
      nextButton.focus();
    };
    const checkFill = () => {
      if (solved) return;
      const value = answerApi.parseNumber(input.value);
      if (!Number.isFinite(value)) {
        showFeedback('Enter a number, fraction, or percent.', false);
        return;
      }
      if (answerApi.answersClose(value, current.answer, current.tolerance)) markCorrect();
      else {
        markWrong();
        input.select();
      }
    };

    if (current.type === 'choice') {
      choices.hidden = false;
      pickRandom(current.choices, current.choices.length).forEach((answer) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quiz-choice';
        button.textContent = answer;
        button.addEventListener('click', () => {
          if (solved) return;
          if (answer === current.answer) {
            button.classList.add('is-correct');
            markCorrect();
          } else {
            button.disabled = true;
            button.classList.add('is-incorrect');
            markWrong();
          }
        });
        choices.appendChild(button);
      });
    } else {
      fillRow.hidden = false;
      checkButton.addEventListener('click', checkFill);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') checkFill();
      });
      window.setTimeout(() => input.focus(), 0);
    }
    nextButton.addEventListener('click', () => {
      if (results.length === deck.length) renderResults();
      else renderQuestion();
    });
  };

  const renderResults = () => {
    stopClock();
    const pct = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
    const grade = letterGrade(pct);
    const saved = saveRun({ pct, grade, reps: results.length, factor: Number(factor.toFixed(3)), at: new Date().toISOString() });
    const rows = results.map((r, i) => `<tr><td>${i + 1}</td><td>${r.topic}</td><td>${seconds(r.raw)}</td><td>${r.wrongTries}</td><td>${seconds(r.effective)}</td><td>${Math.round(r.score)}%</td></tr>`).join('');
    mount.innerHTML = `
      <div class="box why" data-timed-result><span class="box-label">Result</span>
        <p class="test-result-score">${grade} · ${pct}%</p>
        <p data-timed-benchmark></p>
        ${saved ? '' : '<p class="test-result-note test-result-error">This browser couldn’t save this result.</p>'}
      </div>
      <table>
        <thead><tr><th>#</th><th>Topic</th><th>Time</th><th>Wrong tries</th><th>With penalty</th><th>Score</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="nav-links"><button type="button" class="widget-btn" data-timed-again>Run again</button></p>`;
    mount.querySelector('[data-timed-benchmark]').textContent = benchmarkLine;
    mount.querySelector('[data-timed-again]').addEventListener('click', renderStart);
  };

  renderStart();
}());
```

- [ ] **Step 4: Run the grading check — expect PASS**

Run: `node scripts/check-timed-mastery.js`
Expected: `Timed Mastery grading checks passed.`

- [ ] **Step 5: Expose answer checking from `problem-sets.js`**

In `public/assets/problem-sets.js`, replace:
```js
  if (typeof module === 'object' && module.exports) {
    module.exports = { parseNumber, answersClose };
    return;
  }
```
with:
```js
  if (typeof module === 'object' && module.exports) {
    module.exports = { parseNumber, answersClose };
    return;
  }
  // Shared with timed-mastery.js, which grades answers exactly the same way.
  // That page has no [data-problem-set] mount, so the rest of this file
  // exits early there.
  window.STEMProblemAnswers = { parseNumber, answersClose };
```

- [ ] **Step 6: Add `masteryForProblemSet` to `tests.js`**

In `public/assets/tests.js`, after the closing `}` of `function courseMastery(course) { … }` add:
```js

  // Timed Mastery's personal benchmark (timed-mastery.js): mastery for a
  // problem-sets.html ?course= slug, via the same PROBLEM_SET_SLUGS table
  // the Recommended Practice strip already ranks by. null for an unknown
  // slug or a course with no graded attempts in this browser.
  function masteryForProblemSet(slug) {
    const course = Object.keys(PROBLEM_SET_SLUGS).find((name) => PROBLEM_SET_SLUGS[name] === slug);
    return course ? courseMastery(course) : null;
  }
```
And in the final `return { … }`, change `isDevMode, setDevMode, answerMatches,` to `isDevMode, setDevMode, answerMatches, masteryForProblemSet,`.

- [ ] **Step 7: Create `content/timed-mastery.html`**

```html
<meta charset="UTF-8">
<link rel="icon" href="favicon.ico?v=1" type="image/x-icon">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Timed Mastery — STEM+</title>
<link rel="stylesheet" href="assets/style.css">
<script src="assets/problem-banks.js" defer></script>
<script src="assets/problem-sets.js" defer></script>
<script src="assets/tests.js" defer></script>
<script src="assets/timed-mastery.js" defer></script>
<div class="page" data-category="problem-sets">
  <span class="kicker">STEM+ · Problem Sets · Timed Mastery</span>
  <h1 data-timed-title>Timed Mastery</h1>
  <p class="subtitle" data-timed-subtitle>Loading timed bank…</p>
  <p class="nav-links"><a href="problem-sets.html" class="nav-toc">← All Problem Sets</a> <a href="index.html" class="nav-toc">STEM+ Home</a></p>

  <div data-timed-mastery></div>

  <footer class="lesson-footer">Results stay in this browser. Timed Mastery does not affect course exam scores.</footer>
</div>
```

- [ ] **Step 8: Link-check the new page**

In `scripts/check-problem-banks.js`, change `const pages = ['problem-sets.html', 'problem-set.html', 'sandbox.html'];` to `const pages = ['problem-sets.html', 'problem-set.html', 'timed-mastery.html', 'sandbox.html'];`.

- [ ] **Step 9: Wire the grading check into `npm test`, run everything**

Append ` && node scripts/check-timed-mastery.js` to `package.json`'s `test` script. Run `npm test` and `npm run build`; expect both to pass.

- [ ] **Step 10: Commit**

```bash
git add public/assets/timed-mastery.js content/timed-mastery.html scripts/check-timed-mastery.js public/assets/problem-sets.js public/assets/tests.js scripts/check-problem-banks.js package.json
git commit -m "Add the Timed Mastery page and personal speed grading"
```

---

### Task 3: Problem Sets hub section + AI-catalog fix

**Files:**
- Modify: `content/problem-sets.html`
- Modify: `lib/plan-catalog.js` (`buildProblemSets`)
- Modify: `scripts/check-plan-catalog.js`
- Modify: `scripts/check-problem-banks.js`

**Interfaces:**
- Consumes: `timed-mastery.html` (Task 2).
- Produces: nothing new for other code.

- [ ] **Step 1: Add the failing checks**

In `scripts/check-plan-catalog.js`, after the line `assert.ok(CATALOG.problemSets.length >= 20, …);` add:
```js
const problemSetCourses = CATALOG.problemSets.map((p) => p.course);
assert.strictEqual(new Set(problemSetCourses).size, problemSetCourses.length, `duplicate problem-set courses in the AI-plan catalog: ${problemSetCourses.join(', ')}`);
```
In `scripts/check-problem-banks.js`, after the line asserting `'Catalog course count does not match bank data'` add:
```js
timedCourses.forEach((course) => assert(catalog.includes(`timed-mastery.html?course=${course.slug}`), `Catalog missing Timed Mastery card for ${course.slug}`));
```

- [ ] **Step 2: Add the hub section**

In `content/problem-sets.html`, replace:
```html
  <div data-recommended-practice></div>

  <h2>Mathematics</h2>
```
with:
```html
  <div data-recommended-practice></div>

  <h2>Timed Mastery</h2>
  <p class="subtitle">Speed reps from a 500-question bank — answer each question correctly as fast as you can, up to 20 per run. Your grade is scaled to your own mastery in that course.</p>
  <div class="toc-list">
    <a class="toc-item" href="timed-mastery.html?course=precalculus">
      <span class="toc-num">500 questions · Timed</span>
      <p class="toc-title">Precalculus</p>
      <p class="toc-sub">Functions, composition, polynomials, exponentials, trigonometry, and sequences — against the clock.</p>
    </a>
    <a class="toc-item" href="timed-mastery.html?course=ap-calculus-bc">
      <span class="toc-num">500 questions · Timed</span>
      <p class="toc-title">AP Calculus BC</p>
      <p class="toc-sub">Limits, derivatives, applications, integrals, the Fundamental Theorem, and series — against the clock.</p>
    </a>
  </div>

  <h2>Mathematics</h2>
```

- [ ] **Step 3: Run checks — expect the catalog check to FAIL**

Run: `node scripts/check-problem-banks.js && node scripts/check-plan-catalog.js`
Expected: problem-banks passes; plan-catalog fails with `duplicate problem-set courses in the AI-plan catalog: … Precalculus, AP Calculus BC, …`.

- [ ] **Step 4: Fix `buildProblemSets`**

In `lib/plan-catalog.js`, replace:
```js
function buildProblemSets() {
  return parseTocItems('problem-sets.html')
    .map((item) => {
```
with:
```js
// Only regular problem-set cards: problem-sets.html also links Timed Mastery
// runs (timed-mastery.html?course=…), which aren't separate problem sets and
// would otherwise appear in the AI-plan catalog as duplicates.
function buildProblemSets() {
  return parseTocItems('problem-sets.html')
    .filter((item) => item.href.startsWith('problem-set.html?'))
    .map((item) => {
```

- [ ] **Step 5: Run `npm test` — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add content/problem-sets.html lib/plan-catalog.js scripts/check-plan-catalog.js scripts/check-problem-banks.js
git commit -m "Link Timed Mastery from Problem Sets; keep its cards out of the AI-plan catalog"
```

---

### Task 4: Production-build verification, push, live verification

**Files:** none (verification only; fix-forward commits if anything fails).

- [ ] **Step 1: Start a production build**

```bash
npm run build && (npm run start > "$SCRATCH/next-start.log" 2>&1 &)
```
Wait until `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/new.html` prints `200`.

- [ ] **Step 2: Fresh login cookie (test account `sdd-verify-task1@example.com`)**

```bash
COOKIE=$(curl -s -i -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"sdd-verify-task1@example.com","password":"testpass123"}' | grep -i '^set-cookie: session=' | sed -E 's/^[Ss]et-[Cc]ookie: (session=[^;]+).*/\1/')
echo "${COOKIE:0:20}…"
```

- [ ] **Step 3: End-to-end run (3 reps, one wrong try)**

Save as `$SCRATCH/timed-run.js`:
```js
(async () => {
  const course = window.STEMProblemBanks.getCourse('precalculus');
  const mount = document.querySelector('[data-timed-mastery]');
  localStorage.removeItem('stemplus:timed-mastery:v1');
  mount.querySelector('[data-timed-reps]').value = '3';
  mount.querySelector('[data-timed-start]').click();
  const steps = [];
  for (let i = 0; i < 3; i += 1) {
    const prompt = mount.querySelector('[data-timed-prompt]').textContent;
    const question = course.timedQuestions.find((q) => q.prompt === prompt);
    const input = mount.querySelector('[data-timed-input]');
    let wrongFeedback = null;
    if (i === 0) {
      input.value = String(question.answer + 1000);
      mount.querySelector('[data-timed-check]').click();
      wrongFeedback = mount.querySelector('[data-timed-feedback]').textContent;
    }
    input.value = String(question.answer);
    mount.querySelector('[data-timed-check]').click();
    steps.push({ id: question.id, wrongFeedback, feedback: mount.querySelector('[data-timed-feedback]').textContent });
    mount.querySelector('[data-timed-next]').click();
  }
  const rows = mount.querySelectorAll('tbody tr').length;
  const firstWrong = mount.querySelector('tbody tr td:nth-child(4)').textContent;
  const saved = JSON.parse(localStorage.getItem('stemplus:timed-mastery:v1'));
  const result = mount.querySelector('[data-timed-result]').textContent.replace(/\s+/g, ' ').trim();
  return { ok: rows === 3 && firstWrong === '1' && steps[0].wrongFeedback.includes('+5s') && saved.precalculus.last.reps === 3, rows, firstWrong, steps, saved, result };
})()
```
Run: `node scripts/verify-page.mjs "http://localhost:3000/timed-mastery.html?course=precalculus" "$(cat "$SCRATCH/timed-run.js")" "$COOKIE"`
Expected: `PASS`.

- [ ] **Step 4: Hub, regular-set, unavailable-course, mastery checks**

```bash
node scripts/verify-page.mjs "http://localhost:3000/problem-sets.html" "(() => { const links = [...document.querySelectorAll('a.toc-item')].map((a) => a.getAttribute('href')); return { ok: links.includes('timed-mastery.html?course=precalculus') && links.includes('timed-mastery.html?course=ap-calculus-bc') }; })()" "$COOKIE"
node scripts/verify-page.mjs "http://localhost:3000/problem-set.html?course=precalculus" "(() => { const t = document.querySelector('[data-problem-subtitle]').textContent; return { ok: t.startsWith('60 practice questions'), t }; })()" "$COOKIE"
node scripts/verify-page.mjs "http://localhost:3000/timed-mastery.html?course=discrete-math" "(() => { const t = document.querySelector('[data-timed-mastery]').textContent; return { ok: t.includes('isn’t available'), t }; })()" "$COOKIE"
node scripts/verify-page.mjs "http://localhost:3000/timed-mastery.html?course=ap-calculus-bc" "(() => { const key = 'stemplus:results:v1'; const prev = localStorage.getItem(key); localStorage.setItem(key, JSON.stringify([{ course: 'AP Calculus BC', unit: 'Unit 1', kind: 'unit_test', version: 'A', score: 8, total: 10, passed: true, topicBreakdown: [{ topic: 'Limits', correct: 1 }, { topic: 'Limits', correct: 1 }, { topic: 'Series', correct: 0.5 }], takenAt: new Date().toISOString() }])); const seeded = window.STEMPlusTests.masteryForProblemSet('ap-calculus-bc'); localStorage.removeItem(key); const empty = window.STEMPlusTests.masteryForProblemSet('ap-calculus-bc'); if (prev !== null) localStorage.setItem(key, prev); return { ok: seeded === 75 && empty === null, seeded, empty, line: document.querySelector('[data-timed-benchmark]').textContent }; })()" "$COOKIE"
```
Expected: `PASS` ×4. (Mastery: Limits 100%, Series 50% → mean 75; with no results → null. The verify profile is shared across runs, so the check saves and restores any existing results.)

Stop the server: `lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill -9`

- [ ] **Step 5: Push**

```bash
git push origin main
```

- [ ] **Step 6: Wait for the Vercel production deploy**

Poll until `curl -s -o /dev/null -w '%{http_code}' https://stem-review.vercel.app/assets/timed-mastery.js` prints `200` (public assets aren't login-gated).

- [ ] **Step 7: Live verification**

Repeat Steps 2–4 against `https://stem-review.vercel.app` (login via its `/api/auth/login`). Expected: `PASS` on every check.
