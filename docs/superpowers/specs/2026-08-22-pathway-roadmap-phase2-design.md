# Pathway Roadmap (Phase 2) — Design

## Context

Phase 1 (shipped) unified STEM+'s two goal-entry paths into one front door and gave the AI-generated custom plan a connected "you are here" roadmap visual on `my-plan.html`, replacing a flat card list.

Phase 2 of the product-vision document ("Build the student's main Roadmap experience") is scoped here to: give the 8 static Pathway pages the same roadmap treatment. Today, `content/Pathways/*.html` show each pathway's courses as a flat `.toc-list` with a small "Exam passed"/"Locked" text badge per item (`data-course-status`), plus a separate capstone card below with its own lock badge. This is the exact shape Phase 1 already replaced for the AI-plan case — extending the same visual to Pathways is a direct reuse of existing infrastructure, not a new feature.

## Goals

- Replace the "The Route" + "Capstone Project" sections on 7 of the 8 Pathway pages with the same `.roadmap-path`/`.roadmap-node` visual Phase 1 built (done ✓ / current "you are here" / upcoming), using the pathway's own `courses[]` array from the existing `PATHWAYS` constant in `public/assets/tests.js` as the course list, and the capstone project as the terminal node.
- Reuse Phase 1's CSS classes as-is (`.roadmap-path`, `.roadmap-node`, `.is-done`, `.is-current`, `.box-label`) — no new CSS.
- Preserve the Track Customization checklist (`data-track-plan`, shipped earlier this session) exactly as it works today on these pages — it discovers its course list by scraping `[data-course-status]` spans out of the DOM, and that must keep working without modifying `mountTrackPlan` itself.

## Non-goals

- Not touching `content/Pathways/mathematics.html`. Its "Route" is two parts (Precalculus/AP Calculus BC, then a mid-pathway exam gate, then Real Analysis A/B) and its capstone unlocks on `data-required-pathway-exam="Mathematics"` (a pathway-exam pass/fail), not per-course completion. This doesn't fit a single linear roadmap without inventing a second, different visual shape — the same reasoning Phase 1's `plan-catalog.js` already used to exclude `mathematics-capstone` from the AI-plan catalog. `mathematics.html` keeps its current flat-list rendering.
- Not touching `pathways.html` (the hub listing all 8 pathway cards). It already has a one-line "You are here: X (n/m passed)" indicator per card (`mountPathwayProgress`) — a card grid across pathways isn't a single course sequence, so a roadmap-path visual doesn't apply there.
- Not touching `content/Goals/*.html`. They also carry `data-track-plan`, but their course lists are custom curated sequences, not 1:1 with any single `PATHWAYS` entry — out of scope for this phase.
- Not adding per-course reason/description text to roadmap nodes. Phase 1's AI-plan roadmap shows a reason because the model generates one per course; pathway pages have no equivalent per-course data source, and each page's own intro paragraph already explains why the sequence exists. Nodes show title and link only.
- Not changing `mountTrackPlan`'s implementation. Its `[data-course-status]` DOM-scrape stays exactly as-is; the new roadmap markup keeps emitting those spans (unstyled, unmounted) purely so the scrape keeps finding them.

## Design

**Per-page change (7 files: `ai-data.html`, `ai-developer-cbrwa.html`, `cloud-devops.html`, `competitive-programmer.html`, `engineering-physics.html`, `general-programmer.html`, `software-engineer.html`):**

Replace:
```html
<h2>The Route</h2>
<div class="toc-list"> ... one .toc-item per course, each with a data-course-status span ... </div>

<h2>Capstone Project</h2>
<div class="toc-list">
  <a class="toc-item" href="../Projects/<id>.html" data-pathway="<slug>">
    ...
    <span data-project-status data-required-courses="..."></span>
  </a>
</div>
```
with:
```html
<h2>Your Roadmap</h2>
<div data-pathway-roadmap="<PATHWAYS name, e.g. AI & Data>"></div>
```

**New `mountPathwayRoadmap(el)` in `public/assets/tests.js`:**

- Reads the pathway name from `el.getAttribute('data-pathway-roadmap')`, looks it up in the existing `PATHWAYS` array (`PATHWAYS.find((p) => p.name === name)`).
- For each course in `pathway.courses`, in order: state is `is-done` (`isCourseExamPassed`), `is-current` (first not-done course), or upcoming (plain). Link is `'../' + coursePath(course) + '/index.html'`. Also emits `<span data-course-status="<course>"></span>` inside the node — never separately mounted/styled (state is conveyed by the node's own dot styling, matching Phase 1's choice); its only purpose is staying discoverable to `mountTrackPlan`'s existing scrape.
- Project is the terminal node: `../Projects/<pathway.projectId>.html`, `is-done` via `isProjectComplete(pathway.projectId)`, `is-current` once every course in `pathway.courses` is passed and the project isn't done yet (no possible mismatch here — unlike Phase 1's AI-plan case, this roadmap's own course list *is* the full required-course list, so "all courses in this list done" and "project unlocked" are the same computation, not two different ones). Carries the existing `data-project-status data-required-courses="<pathway.courses joined by |>"` span, mounted via the existing `mountProjectStatus`.
- Heading: `<h2>Your Roadmap</h2>` stays as static markup outside the mounted div (matches every other mount-target pattern in this file — the div is a below-heading contents such as `data-generated-plan`/`data-dashboard`), same as Phase 1's `my-plan.html` heading pattern.

**Ordering fix in `initTests()`:** `mountPathwayRoadmap`'s `querySelectorAll('[data-pathway-roadmap]').forEach(mountPathwayRoadmap)` call must run *before* the existing `document.querySelectorAll('[data-track-plan]').forEach(mountTrackPlan)` line, since `mountTrackPlan` needs the roadmap's dynamically-injected `data-course-status` spans to already be in the DOM when it scrapes. A one-line comment at the call site states this ordering requirement explicitly, since it's the kind of invariant a future edit could silently break by reordering.

## Testing

Same discipline as Phase 1: `scripts/verify-page.mjs` against `npm run build && npm run start` (never `npm run dev`).

- All 7 touched pages: seed a mix of passed/unpassed courses via `stemplus:results:v1`, confirm the roadmap shows the right done/current/upcoming split and the project node only goes current once every course in that pathway is passed.
- At least 2 of the 7 pages: confirm `data-track-plan`'s checklist still lists every course (the actual regression risk from replacing the static list it scrapes).
- `npm test` (existing 5 checks, `check-content-links.js` catches any broken link from the restructure).
