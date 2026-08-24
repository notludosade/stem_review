# Realistic Course Sequencing for AI-Generated Plans — Design

## Context

The user tested the AI-generated custom plan feature (`new.html`'s "Describe Your Own Goal" → `/api/generate-plan`) and found unrealistic course ordering — e.g. `Precalculus` jumping straight to `Linear Algebra A` with no Calculus in between.

Root cause: `pages/api/generate-plan.js`'s `buildSystemPrompt()` feeds Claude a completely flat course list (name + one-sentence blurb, from `lib/plan-catalog.js`'s `buildCourses()`, which scrapes 5 hub pages) with zero prerequisite metadata. The hub pages' own listing order isn't prerequisite order either — confirmed `math.html` lists `Discrete Math` and `Mathematical Proofs` before `AP Calculus BC`, and `Linear Algebra A` right after Calculus BC but before `Multivariable Calculus`. The model has no structured signal for realistic sequencing beyond guessing from course names and one-sentence blurbs.

This session already built a course-level prerequisite table (`PREREQUISITES` in `public/assets/tests.js`, Phase 4's Readiness feature) — but it's browser-side JS scoped to only the 5 Advanced+ courses, and can't be shared with this server-side code without real client/server code-sharing complexity for a 5-row overlap that isn't worth it.

The product-vision document this multi-phase effort has been implementing already states the right philosophy for this exact problem: "The AI should NOT randomly invent an entire curriculum. It should primarily act as an intelligent planner over trusted STEM+ content. Use deterministic prerequisites and curated relationships as the backbone. Use AI for personalization around that backbone."

## Goals

- A new `PREREQUISITE_GRAPH` in `lib/plan-catalog.js` covering every course in the catalog with a genuine prerequisite, across all four subject hubs plus Advanced+ (confirmed with the user: full catalog, not just math).
- `buildSystemPrompt()` gains an explicit prerequisite section and an instruction to include a course's real prerequisites in the plan too (not just get the order right) — unless the student's own goal description shows they already know that material.
- Per the user's follow-up: strengthen the prompt further toward thoroughness — use the available course/problem-set/application budget generously when it genuinely serves the student's stated goal, rather than defaulting to the sparsest plan that technically satisfies it. This is a prompt-instruction change only, not a deterministic minimum.
- A new deterministic `reorderByPrerequisites()` in `lib/plan-catalog.js`, called from `validatePlan()`: a stable topological sort of the plan's course array using only the prerequisite edges where *both* courses are already present in that specific plan. Guarantees a prerequisite never sorts after its dependent. Confirmed with the user: reorder-only — never auto-inserts a course the model didn't choose, since that would silently expand the plan beyond the model's own stated 2-6 course budget.

## Non-goals

- Not building a UI-facing readiness/prerequisite display for these courses — that's Phase 4's existing `tests.js` feature, already shipped, unrelated to this fix.
- Not unifying this new table with Phase 4's `PREREQUISITES` table in `tests.js` — different runtime (server vs. client), different purpose (AI-prompt sequencing vs. a "you are here" UI badge), and only 5 rows actually overlap. Kept separate.
- Not auto-inserting missing prerequisite courses into the plan. If the model's final selection is missing a genuine prerequisite, the fix is the strengthened prompt instruction persuading the model to include it itself — not a deterministic override that changes the model's course *selection*, only its *order*.
- Not changing `MAX_PROMPT_LENGTH`, the rate limit, or anything else in `pages/api/generate-plan.js` outside `buildSystemPrompt()`.

## Design

**`PREREQUISITE_GRAPH`** (`lib/plan-catalog.js`), course name (matching `CATALOG.courses[].name` exactly — the real hub-page `toc-title` text) → array of required course names:

```js
const PREREQUISITE_GRAPH = {
  // Math
  'AP Calculus BC': ['Precalculus'],
  'Multivariable Calculus': ['AP Calculus BC'],
  'Linear Algebra A': ['AP Calculus BC'],
  'Differential Equations': ['Multivariable Calculus'],
  'Discrete Math': ['Precalculus'],
  'Mathematical Proofs': ['Precalculus'],
  // Technology / CS
  'Computer Programming 2': ['Computer Programming 1'],
  'Computer Programming 2+': ['Computer Programming 2'],
  'Computer Programming Ethics': ['Computer Programming 1'],
  'Programming with Packages': ['Computer Programming 1'],
  'Data Handling CB': ['Computer Programming 2'],
  'Software Engineering': ['Computer Programming 2'],
  'Systems Programming & Architecture: CS': ['Computer Programming 2'],
  'Computer Networking Fundamentals': ['Computer Programming 1'],
  'Cloud Computing A': ['Computer Programming 1'],
  'Cloud Computing B / DevOps': ['Cloud Computing A'],
  'AI Developer': ['Computer Programming 2', 'Data Handling CB'],
  'Applied Machine/Deep Learning': ['AI Developer'],
  'Game Engine Architecture': ['Computer Programming 2'],
  'Video Game Modding': ['Computer Programming 1'],
  'Designing/Mastering Operating System': ['Systems Programming & Architecture: CS'],
  // Science
  'AP Physics 1': ['Precalculus'],
  'AP Physics 2': ['AP Physics 1'],
  'AP Physics C: Mechanics': ['AP Physics 1', 'AP Calculus BC'],
  'AP Physics C: Electricity and Magnetism': ['AP Physics C: Mechanics'],
  'Quantum Physics & Optics': ['AP Physics C: Electricity and Magnetism'],
  'AP Chemistry': ['Precalculus'],
  'Organic Chemistry': ['AP Chemistry'],
  // Engineering
  'Engineering 1': ['AP Physics 1'],
  'Career Applied Engineering': ['Engineering 1'],
  'CAD & Prototyping': ['Engineering 1'],
  'Thermodynamics': ['AP Physics 2'],
  'Mechatronics': ['Engineering 1', 'Computer Programming 1'],
  'Advanced Robotics': ['Mechatronics'],
  'Nanotechnology': ['Thermodynamics'],
  'Advanced CB Engineering': ['Career Applied Engineering'],
  // Advanced+ (same 5 relationships Phase 4 already established in tests.js)
  'Real Analysis A': ['AP Calculus BC'],
  'Real Analysis B': ['Real Analysis A'],
  'Advanced Algorithms': ['Computer Programming 1', 'Computer Programming 2'],
  'Linear Algebra B': ['Linear Algebra A'],
  'Topology: Fundamentals': ['Real Analysis A'],
};
```

Every key and every listed value is a real `CATALOG.courses[].name` — the same strings `buildCourses()` already parses from the 5 hub pages, so the implementation plan must verify each one against the actual hub page text (entity-decoded) rather than trust this document alone.

**`buildSystemPrompt()` changes** (`pages/api/generate-plan.js`): add a prerequisite section built from `PREREQUISITE_GRAPH`, formatted as plain lines (e.g. `"Linear Algebra A requires: AP Calculus BC"`), with framing telling the model to include a course's real prerequisites in its own selection unless the student's goal shows prior knowledge — prefer dropping a less essential pick over silently skipping a genuine prerequisite. Separately, strengthen the existing instruction paragraph to favor thoroughness: use the available course/problem-set/application budget generously when it serves the student's stated goal, rather than the sparsest plan that technically answers it.

**`reorderByPrerequisites(courses, graph)`** (`lib/plan-catalog.js`): given the plan's validated `{name, reason}[]` course array, build an in-plan adjacency list restricted to `graph` edges where both endpoints are present, then run a stable topological sort (Kahn's algorithm, using original array position to break ties) so a prerequisite always precedes its dependent while otherwise preserving the model's own ordering. Called from `validatePlan()` immediately after the course array is built, before `validatePlan()` returns.

## Testing

- `scripts/check-plan-catalog.js` gains an assertion cross-checking every `PREREQUISITE_GRAPH` key and value against `CATALOG.courses` — the same class of drift-detection this file already does for `COURSE_PATHS` (catches a typo'd course name immediately instead of letting it silently do nothing at runtime).
- Unit-level test of `reorderByPrerequisites()`: given `[{name: 'Linear Algebra A'}, {name: 'Precalculus'}, {name: 'AP Calculus BC'}]` (deliberately out of order), confirms the sorted result places `Precalculus` before `AP Calculus BC` before `Linear Algebra A`. Also confirms it never adds or removes a course — same array length and same set of names in, just reordered.
- Live verification against the production Anthropic-backed endpoint (per this session's established pattern — `ANTHROPIC_API_KEY` only exists on Vercel): submit a goal like "I want to get really good at math" and confirm the returned course array, post-reorder, never places a course before one of its `PREREQUISITE_GRAPH` prerequisites.
- `npm test` passes.
