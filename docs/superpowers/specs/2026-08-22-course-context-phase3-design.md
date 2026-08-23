# Course Context: Practice + Applications (Phase 3) — Design

## Context

Phase 3 of the product-vision document ("Connect existing courses, lessons, problems, projects, exams, and applications to roadmap milestones") turned out to be mostly already built. Investigation found `mountCourseContext` (a "Where this fits" box already mounted on every course's own `index.html`, showing which pathway(s) a course belongs to, what it builds on, and what comes next), `mountProjectMeta` (required-courses summary on Project pages), `mountRecommendedPractice` (mastery-ranked practice strip on `problem-sets.html`), and the full dashboard's Continue/Review/Practice/Milestone/Path sections all already connect content to progress. `my-plan.html`'s AI-generated roadmap already joins courses, practice, and applications together — but only for students who used the free-text generator.

Two genuine gaps remain, both isolated to a single function:

1. A course's own `index.html` has no link to its matching problem set anywhere — the only route to practice is the generic top-nav link, identical for every course.
2. Applications link back to their source course (`content/Applications/*.html` each end with "Goes deeper in: <course>"), but nothing links forward from a course to its matching Application(s) — that join only exists inside the AI-plan generator's output, not as a standing page feature.

## Goals

- Every course's own `index.html` gains a link to its matching problem set (where one exists) and to any Application(s) built on that course (where one exists) — both surfaced inside the box `mountCourseContext` already renders there.
- New `APPLICATION_BY_COURSE` lookup table in `public/assets/tests.js`, mirroring the existing `PROBLEM_SET_SLUGS` table's pattern: course name → `{id, title}`, one entry per `content/Applications/*.html` page. Values are read from each Application page's own existing "Goes deeper in" link, so the table can't silently drift from the real content it's describing.
- `mountCourseContext`'s self-removal condition widens from "this course belongs to zero of the 8 `PATHWAYS` pathways" to "this course has nothing to show at all" (no pathway, no practice link, no application link). Without this, 4 of the 9 Applications' source courses — `Linear Algebra A`, `Differential Equations`, `Discrete Math`, `AP Physics C: Mechanics`, all electives outside every `PATHWAYS` entry — would keep losing the box entirely before ever reaching the new Practice/Applications lines, defeating the point of the feature for nearly half the Applications inventory.

## Non-goals

- Not touching Project pages, individual lesson pages, or the Applications hub (`applications.html`)'s own personalization. Confirmed with the user: this phase is courses only.
- Not changing `mountProjectMeta`, `mountRecommendedPractice`, `mountDashboard`, `mountPathwayProgress`, or `mountGeneratedPlan` — all already connect their respective content types adequately; re-touching them isn't this phase's job.
- Not adding exam "due for review" surfacing at the course level — that's dashboard-only today and stays that way; not one of the two gaps this phase targets.
- Not building a reverse Applications hub personalization (e.g. "Recommended for You" on `applications.html`) — out of scope, a different page than the one this phase touches.

## Design

**New lookup table**, placed near `PROBLEM_SET_SLUGS` in `public/assets/tests.js` for discoverability (same file, same section, same key-naming convention as every other course-name-keyed table in this file):

```js
var APPLICATION_BY_COURSE = {
  'Data Handling CB': { id: 'ab-testing-a-feature-launch', title: 'A/B Testing a Feature Launch' },
  'Computer Programming Ethics': { id: 'bias-in-a-hiring-algorithm', title: 'Bias in a Hiring Algorithm' },
  'AP Physics 1': { id: 'designing-a-roller-coaster-safely', title: 'Designing a Roller Coaster Safely' },
  'Linear Algebra A': { id: 'how-recommendation-engines-work', title: 'How Recommendation Engines Work' },
  'AP Physics C: Mechanics': { id: 'keeping-a-satellite-in-orbit', title: 'Keeping a Satellite in Orbit' },
  'Differential Equations': { id: 'modeling-an-epidemic', title: 'Modeling an Epidemic' },
  'Discrete Math': { id: 'route-planning-like-gps', title: 'Route Planning Like GPS' },
  'Cloud Computing A': { id: 'scaling-a-viral-app', title: 'Scaling a Viral App Overnight' },
  'Computer Networking Fundamentals': { id: 'why-your-video-call-freezes', title: 'Why Your Video Call Freezes' },
};
```

Every key is verified against `COURSE_PATHS` (the canonical course-name spelling every other table in this file uses) — all 9 already exist there today, so no course-name drift risk at table-creation time. One Application per course (confirmed: all 9 Applications map to 9 distinct courses, no course has more than one).

**`mountCourseContext` changes** (`public/assets/tests.js:968-994`):

- After the existing pathway-membership paragraphs (unchanged), append, if present:
  - `PROBLEM_SET_SLUGS[course]` → `<p>Practice: <a href="' + root + 'problem-set.html?course=' + slug + '">Problem Set</a></p>`
  - `APPLICATION_BY_COURSE[course]` → `<p>See it in action: <a href="' + root + 'Applications/' + id + '.html">' + title + '</a></p>`
- Self-removal condition changes from `if (memberships.length === 0)` to a check across all three sources — the box only self-removes if there is truly nothing to show:
  ```js
  const hasPractice = !!PROBLEM_SET_SLUGS[course];
  const hasApplication = !!APPLICATION_BY_COURSE[course];
  if (memberships.length === 0 && !hasPractice && !hasApplication) {
    el.remove();
    return;
  }
  ```
- When `memberships.length === 0` but practice/application content exists, the box renders with just the `box-label` and the new lines — no pathway paragraph, since there's genuinely nothing to say there.

## Testing

Same discipline as Phases 1-2: `scripts/verify-page.mjs` against `npm run build && npm run start`.

- A pathway-member course (e.g. `AP Physics 1`) shows pathway text + Practice link + Applications link — all three present together.
- An elective course with no pathway but with practice+application content (`Linear Algebra A`) shows Practice + Applications lines with no pathway paragraph, and the box does NOT self-remove (regression check against the widened condition).
- A course with a pathway but no problem bank and no matching Application (spot-check one, e.g. `Software Engineering` — in `PATHWAYS` but absent from both `PROBLEM_SET_SLUGS` and `APPLICATION_BY_COURSE`) shows only the pathway paragraph — no empty "Practice:"/"See it in action:" lines.
- A course with genuinely nothing (no pathway, no problem set, no application — if one exists) still self-removes.
- `npm test` (existing 5 checks) passes.
