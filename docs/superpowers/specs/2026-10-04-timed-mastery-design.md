# Timed Mastery — Design

## Context

Problem Sets (`content/problem-sets.html` → `content/problem-set.html?course=<slug>`, engine `public/assets/problem-sets.js`, banks `public/assets/problem-banks.js`) offers 20 courses × 60 formula-generated questions, untimed, with progress in localStorage. This adds a second, timed practice mode — **Timed Mastery** — for two courses to start: **Precalculus** and **AP Calculus BC**.

## User decisions (brainstorm, 2026-10-04)

- Grading is a **personal speed benchmark**: the time scale is tuned by the student's own mastery in that course.
- A wrong answer means **retry + time penalty** (clock keeps running, +5s per wrong try).
- **Only Precalculus and AP Calculus BC** for now.
- The **regular Problem Set stays at 60 questions**; the 500-question pool is used only by Timed Mastery.
- Bank approach: **shared per-topic question templates, separate parameter grids** (approach A).

## Goals

- `problem-sets.html` gains a "Timed Mastery" section with 2 cards.
- New page `content/timed-mastery.html?course=<slug>` + script `public/assets/timed-mastery.js`: start screen → timed run (1–20 reps, random, no repeats within a run) → results with % and letter grade.
- Each of the 2 courses gets a `timedQuestions` pool of exactly 500 audited questions.
- Results (best + last run per course) saved in localStorage.

## Non-goals

- No other courses, no server/database, no leaderboard, no change to course exam scores or gating.
- No change to the regular 60-question banks' content (verified byte-identical).
- No pause/resume — the clock keeps running if the tab is hidden.

## Design

### Bank pools (`public/assets/problem-banks.js`)

- Each loop body in `precalculus()` and `calculus()` moves into a per-topic template function, e.g. `precalcFunctionQ(id, a, b, c, x)` → `qNumber(...)`, and `precalcExponentialQ(id, base, exponent)`, `precalcArithmeticQ`/`precalcGeometricQ` for the two sequence variants. The regular loops call these templates with their existing parameters, so the 60 regular questions per course stay byte-identical (checked with a JSON dump diff before/after).
- New helpers: `range(lo, hi)`, `nonZero(lo, hi)`, `grid(...ranges)` (cartesian product) and `spread(items, count)` (evenly spaced deterministic picks across a full grid, so a pool covers the whole grid and its IDs stay stable).
- New `timedPrecalculus()` / `timedCalculus()` build exactly 500 questions each across the course's existing 6 topics (84 + 84 + 83 + 83 + 83 + 83), with IDs prefixed `tm-precalc-` / `tm-calc-`. Every grid excludes zero coefficients where the prompt would otherwise print "+ 0x", and keeps numbers in the same small range as the regular questions (speed drill, not big-number arithmetic):
  - **Precalculus:** Functions (`a∈1..3, b∈±1..3, c∈±1..4, x∈−3..3`); Composition (`a∈2..4, b∈±1..3, c∈1..4, d∈±1..3, x∈−3..3`); Polynomial larger zero (pairs `r1<r2` from `±1..8`, `r1+r2≠0`); Exponential (`base∈2..10, exponent∈−3..6`, `base^|exponent| ≤ 100000`; negative exponents display as `1/base^k`, exponent 0 allowed); Trigonometry (ordered integer-hypotenuse leg pairs, legs ≤ 75); Sequences (42 arithmetic: `a₁∈1..9, d∈±1..5, n∈5..15`; 41 geometric: `a₁∈1..5, r∈2..4, n∈3..8`, term ≤ 50000).
  - **AP Calculus BC:** Limits (`a∈−5..5, b∈±1..3, c∈±1..4`); Derivatives (`coefficient∈1..4, power∈2..5, linear∈±1..3, x∈−2..2`); Derivative applications (`k∈1..5, c∈1..5, x∈−3..3`); Integrals (`m∈1..6, b∈±1..3, upper∈1..5`); Fundamental Theorem (`k∈±1..3, c∈1..5, x∈−3..3`); Infinite series (`first∈1..20, denominator∈2..6`).
- Every timed question reuses an existing `meta.kind`, so `scripts/check-problem-banks.js` recomputes all 1,000 answers.
- Course objects gain `timedQuestions: timedPrecalculus()` / `timedQuestions: timedCalculus()`. The other 18 courses get none.

### Answer checking reuse (`public/assets/problem-sets.js`)

In the browser branch, before page logic: `window.STEMProblemAnswers = { parseNumber, answersClose };`. On `timed-mastery.html` there is no `[data-problem-set]` mount, so `problem-sets.js` exits early after exposing the helpers. Timed Mastery accepts answers exactly the way regular Problem Sets do (fractions, percents, rounding tolerance).

### Mastery lookup (`public/assets/tests.js`)

New exported `masteryForProblemSet(slug)`: reverse-looks-up `PROBLEM_SET_SLUGS` to get the canonical course name, then returns `courseMastery(course)` — a 0–100 integer, or `null` if the slug is unknown or the course has no graded attempts in this browser.

### Grading (`public/assets/timed-mastery.js`, pure functions exported for Node)

- `BASE_SCALES = { precalculus: { fast: 20, slow: 90 }, 'ap-calculus-bc': { fast: 30, slow: 120 } }` (seconds), `PENALTY_SECONDS = 5`, `MAX_REPS = 20`.
- `benchmarkFactor(mastery)` = `1.25 − 0.5 × mastery/100`; `null` → `1`. The effective scale is `fast × factor`, `slow × factor`.
- Effective time per question = raw seconds + 5 × wrong tries.
- `questionScore(t, fast, slow)` = 100 at or under `fast`, 0 at or over `slow`, linear in between.
- Run % = `Math.round(mean of question scores)`. `letterGrade(pct)`: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, otherwise F.

### Page (`content/timed-mastery.html`)

Loads `problem-banks.js`, `problem-sets.js`, `tests.js`, `timed-mastery.js` (in that order, all `defer`). One `<div data-timed-mastery>` mount; the script renders three views into it and guards against double mounting with `mount.dataset.mounted`:

1. **Start:** a benchmark line (e.g. "Tuned to your 86% Precalculus mastery — full credit at or under 16.4s, zero at 73.8s", or the standard-scale wording when there's no course data), personal best + last run, reps `<input type="number" min="1" max="20" value="10">`, and a Start button.
2. **Run:** "Question N of R", topic, a live clock (raw seconds + penalty shown), prompt, and the numeric input (multiple-choice also supported for future courses: a wrong choice is disabled after it's clicked). Wrong → "Not quite — +5s. Try again."; a non-number → "Enter a number, fraction, or percent." with no penalty. Correct → clock stops, shows time + explanation + Next (or "See results" on the last).
3. **Results:** a per-question table (topic, raw time, wrong tries, effective time, score %), the run % + letter grade, the benchmark line, and "Run again" (back to the start screen).

Results save to `stemplus:timed-mastery:v1` as `{ [slug]: { best, last } }`, each `{ pct, grade, reps, factor, at }`; `best` is replaced only by a higher `pct`.

### Hub (`content/problem-sets.html`)

New `<h2>Timed Mastery</h2>` section after `<div data-recommended-practice>`, before `<h2>Mathematics</h2>`: one subtitle line + 2 `toc-item` cards → `timed-mastery.html?course=precalculus` and `timed-mastery.html?course=ap-calculus-bc`.

### Catalog fix (`lib/plan-catalog.js`)

`buildProblemSets()` only accepts hrefs starting with `problem-set.html?`, so the Timed Mastery cards never become duplicate AI-plan problem sets. `scripts/check-plan-catalog.js` adds an assertion that problem-set course names are unique.

## Error handling

- Unknown slug, or a course without `timedQuestions`/`BASE_SCALES` → "Timed Mastery isn't available for this course." + link back to Problem Sets.
- Reps clamped to 1–20 in JS as well as by the input; empty/invalid → 10.
- localStorage read failure → treated as no history; write failure → results still show, plus "This browser couldn't save this result."

## Testing

- `scripts/check-problem-banks.js`: per-pool audit for the 2 timed pools (exactly 500, same 6 topics as the regular bank, 83–84 per topic, IDs unique across every bank and pool, prompts unique within the pool, every answer recomputed), `timed-mastery.html` added to the link check, and the hub must link both timed cards. Wired into `npm test` (it isn't today).
- New `scripts/check-timed-mastery.js` (wired into `npm test`): `benchmarkFactor` at null/0/50/100, `questionScore` clamp points + midpoint, penalty arithmetic, `letterGrade` cutoffs.
- JSON-dump diff: regular `questions` for both courses byte-identical before/after the template refactor.
- `scripts/verify-page.mjs` against `npm run build && npm run start` with a fresh login cookie: a 3-rep run with one wrong try → 3 result rows, a `+5s` row, and a saved `stemplus:timed-mastery:v1` record; `problem-sets.html` shows the section; the regular Precalculus set still reports 60 questions.
- After pushing to `main`: the same checks against production (`https://stem-review.vercel.app`).
