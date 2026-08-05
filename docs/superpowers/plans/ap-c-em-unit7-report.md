# AP Physics C: Electricity and Magnetism — Unit 7 Authoring Report

## Scope

Wrote the final unit (Unit 7) of AP Physics C: Electricity and Magnetism — 3 lessons plus two unit tests — continuing the course-wide lesson numbering (0019–0021) after the concurrent agent's Unit 6 (lessons 0016–0018). Did not touch Unit 5, Unit 6, `index.html`, `course-exam.html`, `progress-report.html`, or `reference/glossary.html`, per scope boundaries.

## Files created

All under `public/AP Physics C Electricity and Magnetism/Unit 7/`:

1. **`0019-electromagnetic-induction-and-faradays-law.html`** — Magnetic flux recap, Faraday's law (EMF = −dΦ_B/dt, and for N turns), a two-derivation treatment of motional EMF (EMF = BLv, via both dΦ/dt and the qv×B force directly), a "why changing flux" box (the three ways flux can change — B, A, θ), a numeric worked example, and a slider widget (B, L, v) computing EMF = BLv live with an animated rod-on-rails SVG. Filename matches exactly what the task specified (the concurrent Unit 6 agent links to this name).

2. **`0020-lenzs-law-self-inductance-and-rl-circuits.html`** — Lenz's law (direction of induced current) with an explicit energy-conservation argument for *why* it must hold (a "why" box: reversing the rule would create a runaway free-energy loop), self-inductance (EMF = −L dI/dt), the RL circuit differential equation and its solution (charging and discharging), and a side-by-side table explicitly paralleling this lesson's RL results against Unit 5's RC circuit results (as the task requested). Widget: L/R sliders driving a live τ = L/R and I(τ) readout against a fixed normalized charging curve (curve axis is in units of τ, so it never needs to be redrawn — only the text readout translates τ and I(τ) into real units).

3. **`0021-maxwells-equations-and-electromagnetic-waves.html`** — Course capstone. Assembles all four Maxwell equations (Gauss's law, no monopoles, Faraday's law, Ampère–Maxwell law) into one table, explains the displacement-current term Maxwell added and the surface-choice contradiction it resolves, derives (at a qualitative/course-appropriate level) that Faraday's law + the Ampère–Maxwell law in vacuum predict a self-sustaining EM wave, computes v = 1/√(μ₀ε₀) ≈ 3.00×10⁸ m/s numerically, and explicitly concludes **"light itself is an electromagnetic wave."** Includes a "Looking Ahead" box naming Quantum Physics & Optics as the next course and quoting back its own opening idea. Widget: a wavelength slider (380–750 nm, matching the Quantum Physics lesson's own slider range) driving a live f = c/λ readout and an animated traveling E/B wave pair. Follows the site's established "final lesson of a course" convention (checked against `AP Physics C Mechanics/Unit 8/0024-...html`): kicker gets "· Course Capstone", nav-links drop nav-next (prev → toc → glossary only), footer reads "Lesson 21 of the course sequence — course complete" instead of "Lesson 21 of 24".

4. **`unit-test-a.html`** and **`unit-test-b.html`** — 10-point unit tests (5 single-part, 1 pt each; 5 two-part, 0.5 pt/part), copying the Unit 4 test's exact structure (`data-test`, `data-test-item`, `data-topic`, `quiz-part`/`data-part`, `data-test-submit`/`data-test-result`). Cover all three lessons' topics: Faraday's Law, Motional EMF, Lenz's Law (×2), RL Circuits/Self-Inductance (×2), and Maxwell's Equations (×2). Version B reuses the same question structure with different numbers/orderings, matching Unit 4's A/B pattern.

## `data-answers` pipe-vs-comma audit

Grepped every `data-answers="..."` value across all 5 new files (13 total instances) and manually confirmed each:

```
0019-...html:  data-answers="1|1.0|1.00"
0020-...html:  data-answers="5|5.0"
0021-...html:  data-answers="3|3.0|3.00|2.998"
unit-test-a:   data-answers="1.41|1.4|1.42"
unit-test-a:   data-answers="2.4"
unit-test-a:   data-answers="0.5|.5|0.50"
unit-test-a:   data-answers="2|2.0"
unit-test-a:   data-answers="5|5.0"
unit-test-b:   data-answers="6.28|6.3"
unit-test-b:   data-answers="1.2"
unit-test-b:   data-answers="0.5|.5|0.50"
unit-test-b:   data-answers="2|2.0"
unit-test-b:   data-answers="6|6.0"
```

Every multi-form value uses `|` (never `,`), and no correct answer is or contains a literal `|`. All numeric answers were independently recomputed with a Python script and match the values written into the HTML (worked examples, quiz fill-ins, and both unit tests' fill-in parts) — see calculations in-session for EMF, τ, self-inductance EMF, and c = 1/√(μ₀ε₀) checks.

## "Light is an EM wave" capstone check

Confirmed by grep: lesson `0021` contains the literal sentence **"light itself is an electromagnetic wave"** in bold, immediately following the numeric derivation of v ≈ 3.00×10⁸ m/s from μ₀ and ε₀, with an explicit callout that this matches the independently-measured speed of light (Fizeau, 1849) with no light in the derivation. The lesson's "Looking Ahead" box then explicitly names Quantum Physics & Optics and echoes its actual opening sentence ("light as an electromagnetic wave"), so the dependency the next course assumes is genuinely satisfied.

## Structural verification performed

- All internal nav-links within Unit 7 resolve to files actually created (0019 ↔ 0020 ↔ 0021 chain correct; unit-test-a ↔ unit-test-b cross-links correct).
- HTML tag balance (div/svg/script/table/thead/tbody/g/p/button) checked programmatically across all 5 files — no mismatches.
- Every MC quiz block has exactly 4 choices and exactly 1 `data-correct="true"` (checked via count across all files).
- Course-wide `<footer>` numbering follows the existing (if internally inconsistent) site convention of "Lesson N of 24" for lessons 19–20, deviating only for the true final lesson (21), matching exactly how Mechanics' Unit 8 handles its own final lesson.

## Concerns / loose ends

1. **Unit 6 nav-prev link is a guess, as instructed.** `0019`'s nav-prev points to `../Unit%206/0018-sources-of-magnetic-fields.html`, per the task's explicit best-guess instruction. If the concurrent agent's actual Unit 6 lesson 18 filename differs, this is a one-line fix, not a blocker.
2. **Course-wide lesson count says "24" but only 21 lessons will exist** (3 units × 7 = 21: Units 1–4 already built at 3 lessons each, Unit 5/6/7 also 3 each). This "of 24" inconsistency already existed in Units 1–4 before I started (pre-existing, out of my scope) — I preserved it for lessons 19–20 to stay consistent with the rest of the site, and only deviated for lesson 21 (the true final lesson) using the site's own established capstone convention. Whoever does the course-level cleanup pass may want to reconcile this site-wide number.
3. **OpenStax citation URLs** (Sections 13.1, 14.4, 16.1) were written by matching the established real chapter/section structure of *University Physics Volume 2* and the site's existing citation-link format, but were not live-verified via network fetch (matching how prior lessons' citations were evidently also not spot-checked). Low risk, but worth a live check in a later link-audit pass.
4. `reference/glossary.html` does not exist yet for this course (confirmed — no `reference/` directory present anywhere in this course yet). All three lessons link to it anyway, matching every other lesson in Units 1–6, since course-level files are explicitly out of scope for this pass.
