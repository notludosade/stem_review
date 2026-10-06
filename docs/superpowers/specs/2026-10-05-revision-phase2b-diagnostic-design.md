# Revision Phase 2b — Diagnostic — Design

## Context

Spec §7 (Diagnostic Assessment System). Built on the 2a skill catalog and the 2c mastery engine. User decisions (2026-10-05): **every Pathway gets an auto-built diagnostic**; **diagnostic answers raise mastery up to Proficient**. Only Problem Set questions are used (they're the only auto-graded, answer-verified pool); Pathway coverage ranges from 5 of 22 skills (Cloud & DevOps) to 28 of 71 (General Programmer).

## Catalog

`scripts/build-skill-catalog.js` adds a top-level `pathways`: `[{ name, slug, courses }]` from `tests.js` `PATHWAYS`, slug = `projectId` minus `-capstone` (matches `content/Pathways/<slug>.html`). The check asserts each slug has a page.

## Building a diagnostic (`public/assets/diagnostic.js`, pure part exported for Node)

`buildDiagnostic(catalog, pathway, banks, random = Math.random)` → `[{ skillId, question }]`:

1. Pathway skills in Pathway course order, then unit order; keep skills with `problemTopics`.
2. 2 questions per skill when ≤ 15 testable skills, else 1; when more than 30 testable skills, keep 30 spread evenly (index `Math.floor(i * n / 30)`).
3. Questions drawn at random (no repeats) from the skill's Problem Set questions whose topic is in `problemTopics`.

Results: Mathematics 26, Engineering & Physics 20, General Programmer 28, Cloud & DevOps 10 questions.

## Taking it (`content/diagnostic.html?pathway=<slug>`)

- No or unknown `pathway`: a picker of the 10 Pathways (cards with testable-skill counts).
- Intro: question count, what's tested, Start button. If a saved attempt exists, its results show first with a Retake button.
- One question at a time ("Question 4 of 26"); choice buttons or the number box, graded with `STEMProblemAnswers` (from `problem-sets.js`); an **I don't know** button counts as wrong; no right/wrong feedback until the end.

## Results

- **Readiness** = `readiness(catalog, mastery, pathway)` in `mastery.js`: skills of the Pathway at Proficient or above ÷ all its skills, as a % with the counts ("42% — 12 of 28 skills ready"), using all saved work plus this attempt.
- Coverage note: "This diagnostic tested N of M skills; unit tests cover the rest."
- One bar per Pathway course with tested skills: correct / asked.
- **Start here**: the first Pathway skill (course order, then unit) below Proficient, linked to its course page; if none, "You're ready for the capstone" linking the project.
- Links: back to the Pathway, Retake.
- Signed in: the attempt is saved as `stemplus:diagnostics:v1[slug] = { takenAt, answers: [{ skillId, questionId, correct }] }` (latest per Pathway). Guests: results shown with "Sign in to save these results."

## Mastery

`computeMastery` evidence gains `diagnostics` (the saved object). For each skill, its answers come from the most recent saved diagnostic that tested it. All correct → Proficient; ≥ 1 correct → Practiced; none → no change. Diagnostics never award Mastered or Applied. `mastery.js` exposes `window.STEMPlusMastery = { computeMastery, readiness, studentMastery, LABELS }` for the diagnostic page.

## Ways in

- Each Pathway page's nav links: **Take the diagnostic →** (`../diagnostic.html?pathway=<slug>`).
- Signed-out homepage actions: **Take a Diagnostic** (`diagnostic.html`) after Choose a Goal.
- Goals menu → Goals category: **Take a Diagnostic** (`/diagnostic.html`).
- About patch note.

## Testing

- `scripts/check-diagnostic.js` (npm test): for every Pathway, question count follows the rule and is ≤ 30, every question's topic belongs to its skill's `problemTopics`, skill order follows Pathway course order, no duplicate question IDs; pinned counts for Mathematics (26) and Cloud & DevOps (10).
- `scripts/check-mastery.js`: diagnostic all-correct → Proficient, one correct → Practiced, none → Unseen, a newer diagnostic overrides an older one for the same skill, a perfect diagnostic never gives Mastered; `readiness` counts.
- Production build: member completes Mathematics (answers via the page) → results, saved record, updated course chips; guest sees results, nothing saved; picker lists 10; phone width has no overflow. Push; repeat member run live, then restore storage.
