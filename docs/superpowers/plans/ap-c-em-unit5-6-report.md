# AP Physics C: E&M — Unit 5 completion + Unit 6 report

Scope: finish Unit 5 (Kirchhoff's laws was the only lesson written; RC circuits and both unit tests were missing) and write all of Unit 6 ("Magnetic Fields") from scratch — 3 lessons + 2 unit tests. Unit 7, index.html, course-exam.html, progress-report.html, and glossary.html were explicitly out of scope (handled by a concurrent agent / a later phase).

## Files created (10 total)

**Unit 5** (`public/AP Physics C Electricity and Magnetism/Unit 5/`)
- `0014-rc-circuits-as-a-differential-equation.html` — derives R(dQ/dt) + Q/C = ε from the loop rule, solves by separation of variables to get Q(t) = Cε(1−e^(−t/RC)), introduces τ = RC. Slider widget (ε, R, C, t) computing V(t) and I(t) live.
- `0015-rc-discharging-and-time-constants.html` — mirrors 0014 for discharging (V(t) = V₀e^(−t/RC)), compares the 63.2%/36.8% figures at t = τ, covers the 5τ "practically done" convention. Toggle widget (charging vs. discharging) sharing one set of R/C/t sliders.
- `unit-test-a.html`, `unit-test-b.html` — 10 points each (5 single @ 1 pt, 5 two-part @ 0.5+0.5), covering junction rule, loop rule, RC charging, RC discharging, and time constants across all three Unit 5 lessons.

**Unit 6** (`public/AP Physics C Electricity and Magnetism/Unit 6/`, new directory)
- `0016-magnetic-force-on-moving-charges.html` — F = qv × B, right-hand rule, derives r = mv/(qB) and T = 2πm/(qB) for circular motion, why magnetic force does no work. Widget: proton/electron toggle + v/B sliders computing r and T.
- `0017-magnetic-force-on-currents-and-torque-on-loops.html` — scales F = qv×B up to F = IL×B (with the nAL-charges derivation sketch), derives loop torque τ = IAB sinθ = μ×B, ties it to the DC motor commutator. Widget: I/A/B/θ sliders computing torque live.
- `0018-sources-of-magnetic-fields.html` — Biot-Savart law, straight-wire result B = μ₀I/(2πr), Ampère's law framed as the magnetic analog of Gauss's law, solenoid field B = μ₀nI. Widget: toggle between straight-wire and solenoid modes.
- `unit-test-a.html`, `unit-test-b.html` — 10 points each, same 5+5 structure, covering force on a moving charge, circular motion, force on a current-carrying wire, torque on a loop, and sources of B across all three Unit 6 lessons.

## Navigation chain

`0013 → 0014 → 0015 → Unit 6/0016 → 0017 → 0018 → Unit 7/0019` (the last link assumes the concurrent agent's file `Unit 7/0019-electromagnetic-induction-and-faradays-law.html`, per instructions — it may not exist yet at time of writing, which is expected). `nav-prev`/`nav-next`/`nav-toc`/`nav-glossary` all follow the existing four-link pattern exactly, including the `../Unit%20N/` URL-encoding convention used elsewhere in the course. Verified every href resolves to the correct sibling/cross-unit file and that lesson-footer counts ("Lesson N of 24") are consistent with the course-wide numbering already established by Units 1–5.

## `data-answers` pipe-vs-comma audit

Grepped every `data-answers="..."` attribute across all 10 new files (26 total occurrences) and manually checked each one:
- None use a comma to separate alternate answer forms — every multi-form answer uses `|` (e.g. `data-answers="5.22|5.2"`).
- None contain a literal `|` as answer content (all are numeric fill-ins, so this class of bug doesn't apply here).
- Cross-checked with `grep -n 'data-answers="[^"|]*,[^"|]*"'` (the rough comma-without-pipe filter from the known bug pattern) — zero hits.

All numeric fill-in answers were computed with a Python script (not by hand) and double-checked against the values embedded in each question's own `quiz-explain` text, so the displayed worked solution and the graded answer always agree.

## Content-correctness self-review notes

- Verified real OpenStax *University Physics Volume 2* section numbers/URLs by fetching them live rather than trusting memory, since I found the existing Unit 4/5 lessons already cite section numbers that 404 on the current live site (an older OpenStax edition's numbering — pre-existing, out of scope, left untouched). My new "Go to the source" links (10.5 RC Circuits; 11.3, 11.4/11.5; 12.1, 12.5/12.6) were all fetched and confirmed live and topically correct at write time.
- During review I caught and fixed two duplication issues before finishing: (1) Unit 6 Test A originally reused the exact same numbers as three of Lesson 0017/0018's own recall-quiz questions (a student could answer the test from memorized lesson numbers rather than re-deriving), and (2) Lesson 0015's own recall quiz reused its worked example's exact V₀/τ, letting the answer be copied instead of computed. Both were caught by systematically diffing all quiz/test prompts against each other and rewritten with fresh, distinct numbers (re-verified with Python).
- One judgment call: AP Physics C doesn't mandate a specific "fully charged/discharged" cutoff, so the 5τ (≈99.3%) convention used in the why-box and both Unit 5 tests is presented as an engineering convention, not a hard physical law — this matches how OpenStax's own RC-circuits section frames it.
- Unit 5's subtitle title "DC Circuit Analysis" and Unit 6's "Magnetic Fields" (per the task) were inferred/given since `index.html` (where unit titles would normally live) doesn't exist yet in this course — consistent with Unit 4's existing test subtitle ("Current & Resistance.").

## Status

DONE. No blockers. `git status` was not touched (no commits made, per instructions).
