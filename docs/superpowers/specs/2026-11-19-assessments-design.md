# Assessments Tab — Design

Date: 2026-11-19
Status: approved in brainstorming, awaiting spec review

## Goal

A new top-level **Assessments** tab where a student checks what they know across
a whole course, a whole track (pathway), or a goal. Questions are varied in type,
and every question uses the same, easy-to-follow card structure. Assessments are
low-stakes: no gating, no effect on mastery (yet). Results show what to review next.

## What Codex already did (kept)

- Nav link + search seed in `components/Layout.tsx`.
- `scripts/check-nav-links.js` requires `/assessments.html`.
- `content/assessments.html` page shell with a `[data-assessments]` mount.

Missing: `public/assets/assessments.js` (page currently stuck on "Loading
assessments…") and all question content. The shell's `assets/problem-banks.js`
include is dropped (not needed); `assets/problem-sets.js` stays for
`window.STEMProblemAnswers` (number grading).

Separately, Codex left finished, uncommitted lesson-copy expansions in
`public/Bash for Cybersecurity/course.js` and `public/Cybersecurity+/course.js`
(24/24 lessons each). These get verified with `npm test` and committed on their
own, not mixed into the assessments work.

## Architecture

One data-driven page. No per-assessment HTML.

| Piece | Role |
|---|---|
| `content/assessments.html` | Hub (no query) and runner (`?course=<slug>`, `?track=<slug>`, `?goal=<slug>`). |
| `public/assets/assessments.js` | Hub rendering, draw logic, card UI, grading, results, saving. Pure functions (draw, grade, score) exported via `module.exports` for Node checks, same UMD-ish pattern as `problem-sets.js`. |
| `public/assets/assessments/<course-slug>.json` | One question pool per course (42 files). Loaded with `fetch` on demand. |
| `public/assets/skill-catalog.json` | Existing. Source of course list, unit list per course (`<course-slug>.u<N>`), unit names, first-lesson links, and `pathways` (tracks). |
| `scripts/check-assessments.js` | New content + engine check, added to `npm test`. |

Course slug = the prefix of that course's skill IDs in `skill-catalog.json`.

### Tracks and goals

- **Tracks:** the 10 entries in `skill-catalog.json` `pathways` (`slug`, `courses`).
- **Goals:** a small `GOALS` array in `assessments.js`:
  - `get-ahead`: Algebra/Geometry Fundamentals Review, Precalculus, AP Calculus BC, Multivariable Calculus.
  - `stronger-at-math`: Algebra/Geometry Fundamentals Review, Discrete Math, Mathematical Proofs, Linear Algebra A.
  - `challenge-myself`: Real Analysis A, Real Analysis B, Topology: Fundamentals, Linear Algebra B, Advanced Algorithms.
  - `prepare-for-college`: Precalculus, AP Calculus BC, AP Physics 1, Computer Programming 1 (chosen here; the goal page itself only links pathways).
  - `review-and-test`: dynamic — every course with at least one entry in `stemplus:results:v1` in this browser. If none, the page asks the student to pick courses (checkboxes) and builds the assessment from those.

The first four goals' course lists match the courses each `content/Goals/*.html`
page links.

## Question pool format

```json
{
  "course": "Computer Programming 2",
  "slug": "computer-programming-2",
  "questions": [
    { "id": "computer-programming-2.u3.q1", "unit": 3, "type": "multi", "prompt": "...", "...": "..." }
  ]
}
```

Rules:
- Exactly **3 questions per unit**, each a **different type**.
- `id` = `<slug>.u<N>.q<1-3>`. IDs are permanent; never change what an ID means.
- Every question has `explanation` (shown in review).
- Prompts may contain inline code in backticks; a `code` field (string) may hold a
  code block shown under the prompt. Rendered as text (escaped), never HTML.

### The 9 types

| `type` | Badge | Fields | Scoring |
|---|---|---|---|
| `single` | Multiple choice | `choices[]` (3–5), `answer` (string, one of choices) | 1 / 0 |
| `multi` | Select all that apply | `choices[]` (4–6), `answers[]` (≥2, subset) | all-or-nothing |
| `truefalse` | True / False | `answer` (boolean) | 1 / 0 |
| `number` | Type a number | `answer` (number), `tolerance` (optional, default 0.001) | 1 / 0 via `STEMProblemAnswers` |
| `text` | Type a short answer | `answers[]` (accepted forms) | 1 / 0, case-insensitive, trimmed, inner whitespace collapsed |
| `order` | Put in order | `items[]` (3–6, correct order) | all-or-nothing |
| `match` | Match pairs | `pairs[]` of `[left, right]` (3–6) | fraction of correct pairs |
| `written` | Written answer | `rubric[]` (3–4 points), `model` (model answer) | self-scored: ticked rubric points / total |
| `code` | Code it up | `language` (`python`\|`javascript`), `functionName`, `starter`, `tests[]` of `{args, expected}` (≥3), `reference` | fraction of tests passed |

`code` only appears in programming courses. Choice order for `single`/`multi`
and item order for `order` / right-column order for `match` are shuffled at
render time; the JSON holds the correct answer only.

## Drawing questions

- **Course assessment:** for every unit, pick 2 of its 3 questions at random.
  Because the 3 are different types, each unit always shows 2 types. Length =
  2 × units (10–20). Questions appear in unit order. Retake = new random pick.
- **Track / goal assessment:** for every unit of every course, pick 1 of 3 at
  random. Grouped into **one section per course** (courses deduped, in listed
  order). Length = total units (≈25–55).
- Randomness uses `Math.random`; the drawn question IDs are stored with the
  attempt so autosave can restore the exact same set.

## Question card UI (one per screen)

Fixed skeleton, identical for every type:

1. Header: `Section 2 of 4 · <Course>` (sections only for track/goal), progress
   bar, `Question 6 of 16`.
2. Card:
   - `Unit 3 · <unit name>` (from skill catalog).
   - Type badge (icon + type name, e.g. `▣ SELECT ALL THAT APPLY`).
   - **How to answer** line, fixed text per type, including how it's scored
     (e.g. "Tick every correct option. Partial picks score 0.").
   - Prompt (+ optional code block).
   - Answer area:
     - `single`: radio list. `truefalse`: two large buttons (True / False).
     - `multi`: checkbox list.
     - `number` / `text`: one input with a label.
     - `order`: numbered list, each row has ↑ / ↓ buttons (keyboard and phone friendly, no drag).
     - `match`: each left term has a `<select>` of the right-column options.
     - `written`: textarea. Self-scoring happens on the results screen.
     - `code`: monospace textarea prefilled with `starter`, plus a **Run tests** button showing which visible test cases pass (tests are the scoring tests; no hidden set).
   - Footer: `← Previous` / `Next question →`.
3. Under the card: question map (numbers, filled when answered, current one
   highlighted) and **Submit assessment** (confirms if any are unanswered).

No feedback until submit. Native form controls throughout, labeled for screen
readers. Styling reuses `assets/style.css` tokens; new rules prefixed
`.assess-` with light/dark variants following the existing 4-rule pattern.

## Results screen

- Overall score (points / total, %).
- Breakdown: per unit (course assessment) or per course section with per-unit
  rows inside (track/goal). Each row: score + label `Strong` (≥ 85%),
  `Developing` (60–84%), `Review` (< 60%).
- **Review next:** for every `Review` unit, a link to that unit's first lesson
  (`skill.lessons[0].page`) and its unit test page (`skill.testPage`).
- **Written questions:** shown right after the score, with the student's answer, the model
  answer, and rubric checkboxes; the score updates as they tick. Saved when
  they press **Save score** (written questions count 0 until then).
- Answer review: every question with the student's answer, the correct answer,
  and the explanation.
- Buttons: **Retake** (new draw) and **Back to Assessments**.

## Hub (`assessments.html`, no query)

Three sections matching Codex's anchors `#courses`, `#tracks`, `#goals`, as
`toc-item` cards. Courses grouped by subject (Math, Science, Technology,
Engineering, Advanced+) via a `SUBJECT_OF` map (course name → subject) in
`assessments.js`, matching which hub page links each course;
`check-assessments.js` asserts it covers every catalog course exactly once.
Card counts come from the skill catalog (no pool fetch on the hub). Each card
shows question count (e.g. "16 questions · 8 units") and, if saved, best score.

## Saving

Key `stemplus:assessments:v1`:

```json
{
  "results": { "course:computer-programming-2": { "best": 0.81, "last": 0.75, "at": "2026-11-19T…", "units": { "computer-programming-2.u1": 1 } } },
  "inProgress": { "track:software-engineer": { "ids": ["…"], "answers": { "…": "…" }, "index": 12, "at": "…" } }
}
```

- Every write returns early when `window.STEMPlusAccount` exists and
  `canSave()` is false (site rule). Guests see `noteIfGuest(…)`. Writes still
  happen when `STEMPlusAccount` is absent (Node checks).
- Autosave: `inProgress` updated on every answer change (debounced) for every
  assessment (one code path); cleared on submit. Opening an assessment with
  saved progress offers **Resume** or **Start over**.
- Cloud sync: add the key to `EXACT_KEYS` in `public/assets/progress-sync.js`
  with a merge that keeps the higher `best` per result id and the newer `at`
  per `inProgress` id.

## Code runners

- **JavaScript:** a disposable `Worker` per run, built from a Blob with the same
  equality/timeout approach as `javascript-sandbox.js` (that file can't be
  reused directly: it exits unless `STEMJavaScriptProblems` is loaded).
  5-second timeout.
- **Python:** `new Worker('assets/python-worker.js', { type: 'module' })`,
  created on first Python run only, posting `{ id, mode: 'problem', code,
  functionName, tests }` exactly as `python-sandbox.js` does. 5-second timeout;
  on timeout the worker is terminated and recreated on next run.
- If a runner fails to load, the question shows the error and scores 0 tests;
  the rest of the assessment still works.

## Error handling

- Unknown `?course/track/goal` slug or a pool that fails to load: message with a
  link back to the hub. A track/goal whose course pool fails to load skips that
  section and says so.
- Corrupt localStorage value: ignored and overwritten on next save.

## Content authoring

- 308 units × 3 = 924 questions across 42 pool files.
- Written by parallel subagents, one course per agent, each given: the course's
  unit list and lesson titles from the skill catalog, the pool schema, and the
  rule to base questions on that course's actual lesson pages.
- Answer-key quality: `check-assessments.js` catches structural errors; then a
  separate review pass (different agents) re-derives every keyed answer, since
  a wrong key hurts trust more than a lesson typo.

## Checks (`scripts/check-assessments.js`, in `npm test`)

- Every skill-catalog course has a pool file; every pool unit maps to a catalog unit.
- `SUBJECT_OF` covers every catalog course exactly once.
- Every unit has exactly 3 questions with 3 distinct types; IDs match `<slug>.u<N>.q<k>` and are unique.
- Per-type field validation (table above), e.g. `single.answer ∈ choices`, `multi.answers ⊂ choices` with ≥2, `order`/`match` items unique, `written` 3–4 rubric points, no empty strings.
- `code`: JS references run in Node `vm` against their tests; Python references run via `python3` subprocess; all must pass. `code` only in courses marked programming in the check's allowlist.
- Each pool uses ≥5 distinct types overall.
- Every track and goal course name resolves to a catalog course with a pool.
- Engine: `drawCourse` gives 2 per unit with distinct types; `drawSections` gives 1 per unit per course; grading functions score sample answers correctly for all 9 types.

Plus a real-browser pass with `scripts/verify-page.mjs` against `npm run build && npm run start`: hub renders all three sections, one course / one track / one goal assessment can be completed and submitted, results and saving work.

## Also on ship

- Dated entry at the top of `content/patch-notes.html`.
- `content/about.html` "What's inside" mentions Assessments.

## Out of scope

- Assessments feeding mastery states or unlocking anything.
- AI grading of written answers.
- Hidden test cases for code questions.
- Java / C++ / Bash code questions (no runner on this page).
