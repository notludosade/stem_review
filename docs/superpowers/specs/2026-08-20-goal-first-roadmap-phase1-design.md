# Goal-First Entry + Roadmap Visual (Phase 1) — Design

## Context

The user shared a large product-direction document reframing STEM+ around a "GOAL → ROADMAP → LEARN → PRACTICE → PROVE → BUILD → ADVANCE" loop, prioritized into 7 phases, with explicit instructions not to attempt more than one phase at a time and to prefer extending existing systems over rebuilding.

Inspection found Phase 1 ("Transform Goals into the foundation of personalized Roadmaps") is already substantially built: the AI-generated custom plan feature shipped earlier this session (free-text goal → Claude picks real courses/project/problem-sets/applications from the site's own catalog, rendered on `my-plan.html` with live progress tracking) already *is* the goal-to-roadmap mechanism the vision describes. `dashboard.html` and `learning-record.html` already cover "what should I do next" and "what have I demonstrated." Grep confirmed zero existing infrastructure for skills-below-course-level, prerequisite graphs, or readiness scoring — those (the doc's Sections 7-9) are genuinely new territory for a later phase, not this one.

What's actually missing to call Phase 1 done: the site has **two disconnected goal-entry paths** (8 static cards on `new.html`, plus the separate free-text generator added below them) instead of one coherent front door, and the generated plan renders as a flat card list rather than the "you are here / next / done" visual the vision describes. This spec closes both gaps using only what already exists — no new data model, no AI schema change, no new pages.

## Goals

- Replace `new.html`'s 8 goal cards with 4 categories, matching the vision document's own homepage sketch: **Get Ahead**, **Pursue a Field**, **Build Something**, **Explore**. Each routes to something that already exists:
  - Get Ahead → `Goals/get-ahead.html` (unchanged)
  - Pursue a Field → `pathways.html` (the 8 existing Pathways already are fields)
  - Build Something → `projects.html` (the 8 capstones already show their requirements)
  - Explore → scrolls to the existing free-text generator section on the same page (unchanged logic — `mountGeneratePlan`, `/api/generate-plan`, `stemplus:custom-plan:v1`)
- Give `my-plan.html`'s course list a connected-path visual: each course is a node in a vertical line, states are done (✓) / current ("you are here") / upcoming, ending at the capstone project node if one was picked. Same data (`plan.courses`, `plan.project`) — display only, `mountGeneratedPlan`'s data handling is untouched.
- Keep the 3 goal pages that don't map to any of the 4 categories (`Goals/challenge-myself.html`, `Goals/stronger-at-math.html`, `Goals/review-and-test.html`) reachable via a small, lower-emphasis "More specific starting points" list under the 4 main cards — not deleted, not hidden, just no longer competing with the primary 4.
- Keep `index.html` (the classic catalog homepage) as the "browse everything" fallback, same mechanism as today (a link between the two pages), reworded to match the vision's "don't hide the existing curriculum, just stop making it the whole identity" framing instead of the current "trying the new experience" framing (which reads backwards once `new.html` is the primary goal-first experience, not an experiment).

## Non-goals

- Not touching `lib/anthropic.js`, `pages/api/generate-plan.js`, `lib/plan-catalog.js`, or `isPlanFinished` — the AI generation pipeline and its data shape are unchanged. This is a front-door and presentation reshape, not a new feature.
- Not building real branching (parallel tracks converging) in the roadmap visual — confirmed with the user. The AI still returns one ordered course list; the visual just renders that list as a connected path instead of a card grid. Real branching (Section 4 of the vision doc, in full) is a later-phase decision, not this one.
- Not building Skills, prerequisites, readiness scoring, or the Frontier (vision doc Sections 7-9). Confirmed via grep: none of this exists today at any level; introducing it is out of scope for finishing Phase 1.
- Not deleting `Goals/prepare-for-college.html`. It was a pure router to 3 of the 8 pathways — now fully redundant with "Pursue a Field" → `pathways.html` (a superset). The file stays on disk (preserve existing content, per the vision doc's own instruction) but is no longer linked from `new.html`'s navigation, in either the primary 4 or the secondary list — linking a redundant subset next to its own superset would be confusing, not helpful.
- Not changing which file is the site's root (`/`). `index.html` stays root; `new.html` stays a separate page reached via the existing banner link. Swapping the root route is a bigger, unrequested architectural decision.

## `new.html` restructure

New order, replacing the current hero + "Choose Your Goal" + "Describe Your Own Goal" + "The Loop" sections:

```html
<span class="kicker">STEM+</span>
<h1>Where do you want STEM to take you?</h1>
<p class="subtitle">Tell STEM+ where you're headed. We'll map what to learn, what to practice, what to build, and what to do next — using the real courses, pathways, and projects already on this site.</p>

<div class="toc-list">
  <a class="toc-item" href="Goals/get-ahead.html">
    <span class="toc-num">Get Ahead</span>
    <p class="toc-title">Get Ahead in School</p>
    <p class="toc-sub">Work ahead of your current class — algebra through calculus, at your own pace.</p>
  </a>
  <a class="toc-item" href="pathways.html">
    <span class="toc-num">Pursue a Field</span>
    <p class="toc-title">AI · Engineering · Math · Software</p>
    <p class="toc-sub">8 multi-course pathways, each ending in a real capstone project.</p>
  </a>
  <a class="toc-item" href="projects.html">
    <span class="toc-num">Build Something</span>
    <p class="toc-title">Start with a Project</p>
    <p class="toc-sub">Pick something you want to build. See exactly which courses you need to actually build it.</p>
  </a>
  <a class="toc-item" href="#explore">
    <span class="toc-num">Explore</span>
    <p class="toc-title">Describe Your Own Goal</p>
    <p class="toc-sub">Not sure yet? Describe what you're curious about and we'll build a plan from it.</p>
  </a>
</div>

<h2 id="explore">Describe Your Own Goal</h2>
<!-- unchanged: data-generate-plan / mountGeneratePlan section, exactly as it exists today -->

<h2>More Specific Starting Points</h2>
<p class="subtitle">A few curated routes that don't fit neatly into the four categories above.</p>
<div class="toc-list">
  <a class="toc-item" href="Goals/stronger-at-math.html">
    <span class="toc-num">Goal</span>
    <p class="toc-title">Become Stronger at Math</p>
    <p class="toc-sub">Logic, proof-writing, and linear algebra — real mathematical strength, not just a faster class.</p>
  </a>
  <a class="toc-item" href="Goals/challenge-myself.html">
    <span class="toc-num">Goal</span>
    <p class="toc-title">Challenge Myself</p>
    <p class="toc-sub">Real Analysis, Advanced Algorithms — the most rigorous track on the site.</p>
  </a>
  <a class="toc-item" data-category="problem-sets" href="Goals/review-and-test.html">
    <span class="toc-num">Goal</span>
    <p class="toc-title">Review &amp; Test Myself</p>
    <p class="toc-sub">Already know the material? See your actual weak spots and jump straight to practice — no lessons required.</p>
  </a>
</div>

<p class="subtitle">Prefer to browse the full course catalog on your own? <a href="index.html">See everything →</a></p>

<footer class="lesson-footer">STEM+ · free for anybody to learn · <a href="developer.html">Developer</a></footer>
```

The top banner ("Trying the new STEM+ experience...") is removed — `new.html` is now the primary goal-first experience, not an experiment, so that framing is backwards. Its job (a way back to the classic catalog) moves to the quiet secondary line near the footer, matching the vision doc's own "Browse all courses, as a secondary option" instruction.

"The Loop" section is dropped — its content ("Choose a Goal → Learn → Practice → Prove → Build → Advance") is now what the whole page structurally *is*, not a sentence explaining it after the fact.

`data-pathway`/`data-category` attributes on the old cards were never consumed by any `querySelectorAll` in `tests.js` (confirmed earlier this session) — safe to drop them on the removed cards; kept on `review-and-test.html`'s card since that one already existed unchanged.

## `my-plan.html` roadmap visual

New CSS classes (`public/assets/style.css`), reusing existing color variables (`--border`, `--correct`, `--correct-soft`, `--accent`, `--muted`, `--text`) for full dark-mode consistency — no new variables:

```css
.roadmap-path {
  position: relative;
  margin: 1.5rem 0;
  padding-left: 2.25rem;
}
.roadmap-path::before {
  content: '';
  position: absolute;
  left: 0.6rem;
  top: 0.6rem;
  bottom: 0.6rem;
  width: 2px;
  background: var(--border);
}
.roadmap-node {
  position: relative;
  margin-bottom: 1.25rem;
}
.roadmap-node::before {
  content: '';
  position: absolute;
  left: -2.25rem;
  top: 0.35rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: var(--bg);
  border: 2px solid var(--border);
}
.roadmap-node.is-done::before { border-color: var(--correct); background: var(--correct-soft); }
.roadmap-node.is-current::before { border-color: var(--accent); background: var(--accent); }
.roadmap-node.is-current .roadmap-node-title { color: var(--accent); }
```

`mountGeneratedPlan` (`public/assets/tests.js`) changes only how the Courses section is built — the same `plan.courses` array, the same `coursePath()`/`isCourseExamPassed()` calls already in place, wrapped in `.roadmap-path`/`.roadmap-node` markup instead of `.toc-list`/`.toc-item`:

```html
<div class="roadmap-path">
  <div class="roadmap-node is-done">          <!-- exam passed -->
    <p class="roadmap-node-title">✓ Computer Programming 1</p>
  </div>
  <div class="roadmap-node is-current">        <!-- first not-yet-passed course -->
    <span class="box-label">You are here</span>
    <p class="roadmap-node-title">Computer Programming 2</p>
    <p class="toc-sub">Adds data structures, recursion...</p>
    <a class="widget-btn" href="Computer%20Programming%202/index.html">Continue</a>
  </div>
  <div class="roadmap-node">                   <!-- upcoming -->
    <p class="roadmap-node-title">AI Developer</p>
  </div>
  <!-- capstone project, if plan.project, as the terminal node -->
</div>
```

State per course: `is-done` if `isCourseExamPassed(c.name)`; the *first* not-done course gets `is-current` ("you are here") with its reason text and a direct link; every course after that renders as a plain upcoming node (title only, no premature detail — matches the vision doc's "reduce decision fatigue" principle, only the current step gets elaborated). If every course is done and a project exists, the project node becomes current the same way; if the project is also done, the whole path shows all-done with a completion message (reusing the "Plan Complete" language already discussed for the earlier Applications-tracking conversation, if that ships first — otherwise a plain "All courses complete" line, since that feature is a separate, not-yet-built piece).

## Testing

Matches this session's established discipline (`scripts/verify-page.mjs` against a production build, the throwaway test account's session cookie for gated pages):
- `new.html`'s 4 category cards link to the right real destinations (`Goals/get-ahead.html`, `pathways.html`, `projects.html`, `#explore`); the "More specific starting points" 3 links are present and correct; `prepare-for-college.html` is not linked from anywhere on the page.
- The `#explore` anchor actually scrolls to (or the page loads with) the existing generate-plan section, and that section's behavior (sign-in gate, finish-first gate, submit flow) is unchanged — a regression check, not new behavior.
- `my-plan.html`: seed a plan with a mix of passed/unpassed courses, confirm the first unpassed course gets `is-current` and every course before it gets `is-done`; seed a plan where every course is passed, confirm the project (if any) becomes the current node instead.
- `npm test` (existing 5 checks, including `check-content-links.js`, which is exactly what would catch a broken link from the restructured `new.html`) still passes.
