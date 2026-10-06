# Revision Phase 4a — Applications: Concepts Used + Completion — Design

## Context

Spec §12 (Applications should become a major feature). Phase 4 = 4a Applications, 4b project rubrics, 4c sandbox labs (deferred). User decisions (2026-10-05): build 4a then 4b, defer 4c; **an Application is complete when both "Check your understanding" questions are answered correctly**.

## Catalog

`scripts/build-skill-catalog.js` gains a hand-written `APPLICATION_SKILLS` (Application slug → skill IDs) and emits `applications: [{ slug, title, skills }]` (title from the page `<h1>`):

| slug | skills |
|---|---|
| ab-testing-a-feature-launch | data-handling-cb.u4, data-handling-cb.u6, discrete-math.u4 |
| bias-in-a-hiring-algorithm | computer-programming-ethics.u5, data-handling-cb.u4, data-handling-cb.u7, ai-developer.u9 |
| designing-a-roller-coaster-safely | ap-physics-1.u2, ap-physics-1.u3 |
| how-recommendation-engines-work | linear-algebra-a.u1, linear-algebra-a.u7, ai-developer.u3 |
| keeping-a-satellite-in-orbit | ap-physics-1.u2, ap-physics-c-mechanics.u2, ap-physics-c-mechanics.u7 |
| modeling-an-epidemic | ap-calculus-bc.u7, differential-equations.u6, differential-equations.u7 |
| route-planning-like-gps | discrete-math.u5, computer-programming-2.u3, advanced-algorithms.u4 |
| scaling-a-viral-app | cloud-computing-a.u2, cloud-computing-a.u4, cloud-computing-a.u6 |
| why-your-video-call-freezes | computer-networking-fundamentals.u1, computer-networking-fundamentals.u2, computer-networking-fundamentals.u5 |

The generator throws when a page has no entry or an ID doesn't exist; the check asserts every `content/Applications/*.html` is listed.

## Application pages

- `<div data-application-concepts></div>` before each page's first `<h2>`; `<script src="../assets/mastery.js" defer>` after `quiz.js`.
- `mastery.js` renders a **Concepts used** box for everyone: one row per skill — "Course · Unit N: Name", linking the unit's first lesson. Signed in: a ✓ (Proficient or above) / ○ marker and the state chip. Status line: signed in → "Completed ✓" or "Answer both questions below correctly to complete this Application."; guest → "Sign in to record completing this Application."
- Completion: after any `[data-quiz] .quiz-choice` click, if every `[data-quiz]` has all choices disabled and none `.is-incorrect`, the page records `stemplus:applications:v1[slug] = ISO time` (only when `STEMPlusAccount.canSave()`) and the status updates. Dev-mode answer reveal doesn't disable choices, so it never counts.

## Applications hub

`content/applications.html` loads `mastery.js`; for signed-in students each completed Application's card gets a "Completed" chip.

## Mastery

Evidence gains `completedApplications` (slugs). A skill is **Applied** when Mastered and (a completed capstone covers its course, or a completed Application lists it).

## Testing

- Catalog check (every Application listed, IDs exist, titles).
- `check-mastery.js`: completed Application → its listed Mastered skills Applied; unlisted or non-Mastered skills unchanged.
- Production build: guest sees concepts without states; member answering both correctly is saved and shows Completed; hub chip; a Mastered listed skill shows Applied on its course page; a wrong answer doesn't complete. Push; repeat live; restore storage.
