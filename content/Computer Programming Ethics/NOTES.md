# Notes

## Course outline (self-designed — no external standards body for this exact course)
1. Unit 1 — Why Ethics Lives in Code
2. Unit 2 — Secure by Default
3. Unit 3 — Privacy & Data Minimization
4. Unit 4 — Transparency & Honest Failure
5. Unit 5 — Bias & Fairness in Algorithms
6. Unit 6 — Licensing, Attribution & Open Source Trust
7. Unit 7 — Code as a Professional Artifact

Roughly 3–4 lessons per unit (~24 lessons total). Treat this list the way the AP Calc BC College Board CED was treated: the backbone for scope and ordering, checked before each unit rather than re-derived.

## Conventions
- Lives directly under `STEM+/` (not `AP STEM+/`) since it isn't an AP course — flat whole-course lesson numbering (0001, 0002, … continuing across units) like `Precalculus/`, not the AP Calc per-unit reset-to-0001 scheme.
- Code shown across languages via language tabs (Python / Java / JavaScript / C++) using the shared `mountTabs(container, 'data-tab', 'data-panel')` component from `../assets/interactive.js` — reuse the same `.fm-tabs` / `.fm-tab` / `.fm-panel` markup pattern already used for function-machine tabs in AP Calc. Not every lesson needs all 4 languages; use whichever best illustrate the point (usually 2–4).
- New shared CSS this course introduced: `pre.code-block` plus `.code-good` / `.code-bad` / `.code-label` variants in `../assets/style.css`, for showing before/after or good/bad code contrasts. Reuse rather than re-inventing per lesson.
- First course in the "Computer Programming" strand: Ethics → Computer Programming 1 → Computer Programming 2 → AI Developer. Ethics comes first on purpose — establish defaults before syntax fluency.
- Verification workflow: same as Precalc/AP Calc — cheap per-lesson balanced-tag + `node --check` on inline scripts, batched glossary/index/hub bookkeeping once per completed unit.
