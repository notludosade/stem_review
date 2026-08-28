# Wire In Quantum Computing, Mechatronics, Advanced Robotics — Design

## Context

Three full 8-unit courses were just written and shipped: Quantum Computing (40 lessons, `content/Advanced+ Courses/Quantum Computing/`), Mechatronics (43 lessons, `content/Mechatronics/`), and Advanced Robotics (47 lessons, `content/Advanced Robotics/`). All three currently exist only as raw content — none of them are linked from anywhere else on the site, and none count toward a real pathway yet.

`content/pathways.html` already documents exactly what this unlocks, in its own "Coming Soon" section:
- **Quantum Science**: `AP Physics 2 → AP Physics C: Electricity and Magnetism → Quantum Physics & Optics → Quantum Computing`. The first three are already live; Quantum Computing was the only missing piece.
- **Robotics & Mechatronics**: `Engineering 1 → Computer Programming 1 → Mechatronics → Advanced Robotics`. The first two are already live; Mechatronics and Advanced Robotics were the missing pieces.

This spec wires all three courses into the site's existing pathway/catalog machinery — no new architecture, no new UI concepts. Every piece of this mirrors a pattern the site already has 7 working examples of.

## Goals

- Move all 3 courses off their hub pages' "Coming Soon" sections into the real, published course list.
- Add 2 new `PATHWAYS` entries (`public/assets/tests.js`) — Quantum Science and Robotics & Mechatronics.
- Add `COURSE_PATHS` entries for the 3 new courses.
- Create 2 new Pathway detail pages using the `mountPathwayRoadmap` marker pattern (Phase 2's established format) — never the old flat-list format.
- Create 2 new capstone Project pages, matching the existing 8 capstones' `data-project-gate`/`data-reflection` structure.
- Move both pathways from `pathways.html`'s "Coming Soon" section into its main published list.
- Add `PREREQUISITE_GRAPH` entries (`lib/plan-catalog.js`) for the 3 new courses, now that they're real catalog courses the AI plan generator can recommend.

## Non-goals

- Not writing new problem sets or Applications pages for these courses — out of scope, a separate content type this spec doesn't touch.
- Not changing `mountPathwayRoadmap`, `mountProjectStatus`, or any other shared function — this is pure data/content addition using existing mechanisms.
- Not touching `content/Advanced+ Courses/Quantum Computing/`, `content/Mechatronics/`, or `content/Advanced Robotics/`'s own lesson content — that's already shipped and reviewed.
- Not building the "Robotics & Mechatronics" or "Quantum Science" capstones as anything more elaborate than the existing 8 capstones' pattern (an open-ended build/problem-set brief + a per-course reflection checklist) — matching site convention, not inventing a new project format.

## Design

**Hub page moves:**
- `content/advanced.html`: Quantum Computing's `<div class="toc-item is-soon">` becomes a real `<a class="toc-item" href="Advanced%2B%20Courses/Quantum%20Computing/index.html">`, `is-soon`/`Coming Soon` label removed, lesson count updated to the real 40, "Course complete." appended (matching the other 5 real Advanced+ courses' blurb pattern).
- `content/engineering.html`: same treatment for Mechatronics (43 lessons) and Advanced Robotics (47 lessons), moved from the "Coming Soon" section into the main list.

**`PATHWAYS` (public/assets/tests.js)** — 2 new entries, appended to the existing 8-entry array:
```js
{ name: 'Quantum Science', courses: ['AP Physics 2', 'AP Physics C: Electricity and Magnetism', 'Quantum Physics & Optics', 'Quantum Computing'], projectId: 'quantum-science-capstone', lessons: <real sum of all 4 courses' lesson counts> },
{ name: 'Robotics & Mechatronics', courses: ['Engineering 1', 'Computer Programming 1', 'Mechatronics', 'Advanced Robotics'], projectId: 'robotics-mechatronics-capstone', lessons: <real sum> },
```
Course order matches `pathways.html`'s own stated sequence exactly (already-live courses first, matching how every other pathway orders its prerequisite chain).

**`COURSE_PATHS`** — 3 new entries, directory paths matching what the content-writing agents actually created: `'Quantum Computing': 'Advanced+ Courses/Quantum Computing'`, `'Mechatronics': 'Mechatronics'`, `'Advanced Robotics': 'Advanced Robotics'`.

**2 new Pathway pages** (`content/Pathways/quantum-science.html`, `content/Pathways/robotics-mechatronics.html`): identical skeleton to the 7 existing non-Mathematics pathway pages — kicker, h1, subtitle, nav-links, `<div data-track-plan></div>`, `<h2>Your Roadmap</h2><div data-pathway-roadmap="<PATHWAYS name>"></div>`, footer. No flat course list ever — `mountPathwayRoadmap` (already shipped, Phase 2) renders the roadmap entirely client-side from the new `PATHWAYS` entries.

**2 new capstone Project pages** (`content/Projects/quantum-science-capstone.html`, `content/Projects/robotics-mechatronics-capstone.html`): same structure as `software-engineer-capstone.html` (read as the reference) — `data-project-meta`, `data-project-gate data-required-courses="..."` wrapping locked/content divs, a Brief + Deliverables section tailored to the pathway, and a `data-reflection` block with one question per required course (4 questions each, matching the 4-course pathways). Briefs:
- **Quantum Science capstone**: work through a small quantum computing problem end-to-end — implement or trace a simple quantum circuit (e.g. a Bell-state preparation or a small Grover's-search instance) and explain the physics and computation together.
- **Robotics & Mechatronics capstone**: design (in writing/diagram, simulated or physical depending on the student's resources) a simple autonomous system that combines a sensor, an actuator, a control loop, and a basic decision/planning layer — tying together both courses' full stack.

**`pathways.html`:** both entries move from the "Coming Soon" section (deleted from there) into the main published `.toc-list`, each with a `<span data-pathway-progress data-required-courses="...">` badge matching the other 8 entries' format exactly.

**`PREREQUISITE_GRAPH` (lib/plan-catalog.js):**
```js
'Quantum Computing': ['Linear Algebra A', 'Linear Algebra B'],
'Mechatronics': ['Engineering 1', 'Computer Programming 1'],
'Advanced Robotics': ['Engineering 1', 'Computer Programming 1'],
```
matching each course's own stated prerequisite text. The existing `check-plan-catalog.js` cross-check (asserting every `PREREQUISITE_GRAPH` key/value is a real catalog course) will automatically cover these three once the hub-page moves make them real `CATALOG.courses` entries — no separate assertion needed.

## Testing

Same discipline as every prior phase this session: `scripts/verify-page.mjs` against `npm run build && npm run start`, using the existing developer test account's session cookie for the login-gated Pathway/Project pages.

- Both new Pathway pages render a `.roadmap-path` with 4 nodes (3 courses + capstone, or 4 courses + capstone depending on final course-count), correct done/current/upcoming states.
- Both new capstone pages: `data-project-gate` locks correctly against their 4 required courses, unlocks once all 4 are passed (matching `mountProjectStatus`'s existing, unchanged logic).
- `pathways.html`: both pathways appear in the main list with a working `data-pathway-progress` badge; the "Coming Soon" section either shrinks to remove them or disappears entirely if these were its only 2 entries.
- `content/advanced.html` and `content/engineering.html`: the 3 moved courses render as real, clickable cards; no `is-soon` styling remains on them.
- `check-plan-catalog.js`'s existing cross-check assertion now also validates the 3 new `PREREQUISITE_GRAPH` entries automatically — confirm it still passes.
- `npm test` (all 6 checks) passes.
