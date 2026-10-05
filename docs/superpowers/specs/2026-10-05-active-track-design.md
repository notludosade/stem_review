# Active Track on the Dashboard — Design

## Context

The homepage Dashboard's Continue Learning section (`renderDashboard` in `public/assets/tests.js`) shows one card: the most recently attempted course that isn't passed. With no saved progress the whole Dashboard is replaced by a "haven't started" message. There is no notion of which track a student is following.

## User decisions (brainstorm, 2026-10-05)

- Confirm a track in **both** places: a button on each Pathway page (and the AI plan page), and a picker + Confirm button inside the Continue Learning card.
- Selectable tracks: the **10 Pathways** and the student's **AI-generated plan**. One active track at a time.
- Approach A: store the choice in this browser (`stemplus:active-track:v1`), like all other progress.

## Design

### Storage & logic (`public/assets/tests.js`)

- `ACTIVE_TRACK_STORAGE_KEY = 'stemplus:active-track:v1'`; value `{ type: 'pathway', name }` or `{ type: 'plan' }`. `loadActiveTrack()` / `saveActiveTrack(track | null)` (null removes it).
- `resolveTrack(track)` → `{ label, href, courses, projectId, capstoneLabel }` or `null`:
  - pathway: from `PATHWAYS` (name match); `href = 'Pathways/' + slug + '.html'` where `slug = projectId` minus `-capstone` (true for all 10); capstone label `<name> Capstone`.
  - plan: from `loadCustomPlan()`; label "My AI plan", `href = 'my-plan.html'`, courses = plan course names, project from `plan.project` (may be none).
  - Unknown pathway or no saved plan → `null`.
- `trackStatus(resolved)` → `{ passed, total, next, nextUnit, projectId, projectDone, complete }` using `isCourseExamPassed` (so skipped courses count, developer mode passes everything), `isProjectComplete`, and `nextUnitFor(course)` — the first attempted-but-uncleared unit, the same rule the existing in-progress card uses (that card now calls the shared helper too).

### Continue Learning card (`renderDashboard`)

- First card in the section is the track card:
  - **Active, in progress:** "Your track" · linked track name · "2 of 4 courses passed · Up next: <course link> · Unit 3" (unit only when one is pending) · "Change track" button revealing the picker.
  - **All courses passed, capstone not done:** "All 4 courses passed · Up next: <capstone link>".
  - **Complete:** "Track complete" · "✓ <name>" · "Every course and the capstone are done — pick your next track." · picker shown.
  - **None / invalid:** "Pick your track" with a short prompt and the picker shown.
- Picker: `<select>` of the 10 Pathways (+ "My AI plan" when a plan exists), current choice preselected, and a **Confirm** button; confirming saves and re-renders the Dashboard.
- The existing "In progress" card still follows, unless its course is the track's next course.
- With no saved progress, the Dashboard now renders the Continue Learning section (track card) followed by the existing "haven't started" hint, instead of only the hint.

### Track choice block (`mountTrackChoice`, markup `<div data-track-choice="<PATHWAYS name>|plan" data-root="../|">`)

- Placed after the nav links on all 10 `content/Pathways/*.html` pages (`data-root="../"`) and on `content/my-plan.html` (`data-track-choice="plan"`, `data-root=""`).
- Not the active track → **Make this my track** (plan page: **Make this plan my track**). Active → "✓ This is your track — it leads your Dashboard." + **Stop following**. Clicking either saves and re-renders.
- Removes itself when `resolveTrack` returns null (e.g. no AI plan yet).

### Copy

`content/about.html` — the Oct 5 patch entry gains a sentence about choosing a track.

## Non-goals

No server/account storage, no multiple simultaneous tracks, no change to Pathway roadmaps or gating.

## Testing

- New `scripts/check-active-track.js` (in `npm test`), loading `tests.js` with an in-memory `localStorage`: no track → null; Quantum Science → next "AP Physics 2", 0/4; passing a course exam and skipping a course advance `next`/`passed`; all courses passed → `next` null, not complete until the capstone is marked complete; plan track with no plan → null, with a plan → its courses; unknown pathway → null; `nextUnitFor` picks the first uncleared attempted unit.
- Production-build browser checks: pick from the Dashboard picker; pick from a Pathway page; Stop following clears it; Change track switches it; seeded passed exam advances the card; AI plan as track; new user (no progress) sees the picker; screenshots desktop + phone. Then the same on production.
