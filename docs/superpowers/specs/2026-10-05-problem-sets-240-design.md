# Problem Sets ×4 (240 per set) — Design

## Context

The 20 regular Problem Sets (`public/assets/problem-banks.js`, served by `content/problem-set.html?course=<slug>`) each have 60 questions: 6 topics × 10. The user asked for 4× — **240 per set, 4,800 total**. Timed Mastery's separate 500-question pools (Precalculus, AP Calculus BC) are unchanged.

## User decisions (brainstorm, 2026-10-05)

- 240 per regular problem set; Timed Mastery untouched.
- The 8 hand-written concept topics get **240 new hand-written questions** (30 each), not generated filler.
- Approach A: every topic becomes a template + bounded parameter grid (the Timed Mastery pattern), not "run the old formulas further".

## Why not just run the existing formulas to 40

Measured on a scratch copy: ~17 topics repeat or crash past 10 (e.g. Calculus Integrals 20 unique, Proofs logic runs out of cases), and many "unique" ones turn invalid or absurd — `/61` CIDR blocks, cache hit probability 1.19, a 9-bit "8-bit" two's-complement string, 41 IPv4 host bits, fact(42) ≈ 10⁵¹, a geometric a₄₃ ≈ 10²⁰ — plus steady difficulty drift (`lim x→35`). New parameters must be chosen per topic.

## Design

### Structure

- Every topic: 40 questions = the original 10 (exact same parameters, wording, answers, and IDs) + 30 new from a bounded, domain-valid grid.
- New helper in `problem-banks.js`: `withExtras(regularTuples, gridTuples, extraCount = 30)` → the 10 regular tuples followed by `spread(...)` picks from the grid with any tuple equal to a regular one removed, so no prompt repeats. Reuses the existing `range` / `nonZero` / `grid` / `spread` helpers.
- Each numeric topic's loop body becomes a template `(id, ...params) => qNumber/qChoice(...)` (older hand-written courses) or a `make(...params) => { prompt, answer, explanation, meta, tolerance }` (courses built with `generatedCourse`). Precalculus and AP Calculus BC already have templates.
- `generatedCourse(prefix, topics)` takes `[topic, make, regular(i) → tuple, gridTuples]` entries. It emits the original 60 first, in today's order, with today's sequential IDs `<prefix>-1…60`, then the 180 new ones as `<prefix>-61…240` (topic by topic, 30 each). Older courses keep per-topic IDs and continue them (`calc-limit-11…40`).
- **Saved progress is preserved:** progress (`stemplus:problem-sets:v1:<slug>`) is keyed by question ID, and no existing ID changes meaning.

### Domain rules for new grids

- Numbers stay in the same ranges as the original 10 (speed of practice, not big-number arithmetic); no prompt prints `+ 0x`-style zero coefficients where avoidable.
- Values must be valid for their domain: probabilities and hit rates in (0, 1); CIDR prefixes /8–/30; IPv4 host bits 2–16; n-bit binary/two's-complement strings exactly n bits; physical quantities (mass, time, distance, resistance) positive; factorial/Fibonacci/2ⁿ/geometric-sequence answers ≤ 10⁶; sequence/limit indices small; points tested against an interval actually lie inside it.
- Fixed-array topics: right-triangle topics draw from all integer-hypotenuse leg pairs with legs ≤ 75 (the Timed Mastery grid). Two-variable logic has only 16 cases, so the Discrete Math and Mathematical Proofs logic topics add three-variable forms "(p op₁ q) op₂ r" with a new audit kind (`logic3` / `logic3-number`).

### Hand-written concept questions (240)

Topics: CP1 Language fundamentals; CP2 Object-oriented programming, Exceptions, Data structures, Memory and concurrency; Data Handling CB SQL and databases, Data quality and cleaning, Visualization and storytelling (exact topic names as in the bank).

- 4 choices, exactly one correct, an explanation, `meta: { kind: 'concept', expected: answer }`, IDs continuing each topic's existing prefix (`cp-concept-11…40`, `cp2-oop-11…40`, …).
- Written after reading that course's own lessons so terminology matches what was taught.
- Rules: no "all/none of the above", no trick wording, no language-specific behavior unless the prompt names the language, plausible but clearly wrong distractors, no duplicate or near-duplicate ideas within a topic.
- A separate second read of every question re-derives its keyed answer before commit.

### Copy

`content/problem-sets.html` (subtitle "Each bank has 60 checked questions", the "20 courses · 60 questions each · 1,200 questions total" box, 20 card labels, footer), `content/index.html` stat, `content/Goals/review-and-test.html` subtitle, and the Dashboard practice tile in `public/assets/tests.js` → 240 / 4,800. Timed Mastery cards stay "500 questions".

## Non-goals

- No change to Timed Mastery pools, problem-set UI, grading, or storage format.
- No new topics; every set keeps its existing 6.

## Testing

- `scripts/check-problem-banks.js`: per set exactly 240 and 6 topics × 40; all answers recomputed (new `logic3` kinds added); prompts unique within each set; IDs unique across all banks and timed pools. During the rollout the check accepts 60 (10/topic) **or** 240 (40/topic) per set; the final commit tightens it to 240 only, so `npm test` passes at every commit.
- Byte-identical check: a JSON dump of every set's original 60 questions before and after.
- Grid sanity script (not just uniqueness): flags out-of-domain values per the rules above; plus a manual read of the first and last new question of every topic.
- Browser, against `npm run build && npm run start` and then production after push: a set reports "240 practice questions"; answering saves progress; progress seeded for an original question ID before the change still shows as answered after it.
