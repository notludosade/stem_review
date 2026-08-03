# Notes

## Course outline (self-designed, informed by CS50 / MIT OCW pacing)
1. Unit 1 — Program Anatomy & Setup (compiled vs interpreted vs JIT, hello world, comments)
2. Unit 2 — Variables, Types & Operators (static vs dynamic typing, arithmetic/comparison/logical operators)
3. Unit 3 — Control Flow (if/else, boolean logic, while loops, for loops)
4. Unit 4 — Functions (defining/calling, parameters, return values, scope)
5. Unit 5 — Strings (literals, concatenation, common operations, interpolation/formatting)
6. Unit 6 — Arrays, Lists & Collections (fixed arrays vs dynamic lists, indexing, iterating)
7. Unit 7 — Basic I/O (console input/output, reading a text file)
8. Unit 8 — Intro to Objects & Classes (defining a class, instances, methods, basic encapsulation)

Roughly 3 lessons per unit (~24 lessons total). Treat this list as the course backbone, same role the College Board CED plays for AP Calc BC.

## Conventions
- Lives directly under `STEM+/` — flat whole-course lesson numbering (0001, 0002, … continuing across all 8 units), matching `Precalculus/`.
- Every lesson shows the concept in all four languages (Python, Java, JavaScript, C++) via language tabs — `mountTabs(container, 'data-tab', 'data-panel')` from `../assets/interactive.js`, four `.fm-tab` buttons + four `.fm-panel` code blocks (`pre.code-block`) per comparison, both from `../assets/style.css`.
- Order languages consistently everywhere: Python, Java, JavaScript, C++ (roughly least-to-most syntactic ceremony) — don't shuffle the order lesson to lesson.
- Depends on Computer Programming Ethics being read first (assumed prior course, not re-taught here) — see `[[../Computer Programming Ethics/NOTES.md]]`-style cross-reference in lesson content only where directly relevant (e.g. the input-validation lesson can point back to the injection-risk lesson in Ethics).
- Verification workflow: same per-unit batching as Precalc/AP Calc BC — cheap per-lesson balanced-tag + `node --check`, glossary/index/hub bookkeeping batched once per completed unit.
