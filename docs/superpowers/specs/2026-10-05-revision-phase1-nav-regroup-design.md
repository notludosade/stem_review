# Revision Phase 1 — Release 3: Navigation Regroup — Design

## Context

From the "STEM+ Product Review & Revision Specification" §22 (Navigation Redesign) and the audit in `docs/revision/2026-10-05-architecture-report.md` §8. Releases 1–2 (housekeeping, guest access, signed-out homepage) are live. User approved this design 2026-10-05.

## Goal

Top bar becomes **STEM+ · Learn · Practice · Build · Goals · About · account**. Every current nav link stays; only the grouping changes.

## Menus

| Menu | Eyebrow | Categories (in order) | Source today |
|---|---|---|---|
| Learn | Courses by subject | Math · Science · Technology & Computer Science · Engineering & Physics · Advanced+ | Subjects (unchanged) |
| Practice | Problem sets & timed drills | Timed Mastery · Mathematics · Technology & Computer Science · Science, Engineering & Physics · Advanced+ | Problem Sets (unchanged) |
| Build | Code, apply, create | Sandbox · Applications · Projects | Sandbox + Tracks |
| Goals | Where you're headed | Goals · Pathways | Tracks |

- **Build → Sandbox** merges today's three sandbox categories (Core Languages, Package Mastery, Guided Projects) into one: Python Sandbox, Java Sandbox, JavaScript Sandbox, C++ Sandbox, Pandas Package Mastery, Guided Programming Projects. "Browse all" → `/sandbox.html`.
- **Build → Applications** (9) and **Build → Projects** (10 capstones) move unchanged from Tracks.
- **Goals → Goals** (5 goal pages, Describe Your Own Goal, My Plan; "Browse all" → `/new.html`) and **Goals → Pathways** (10) move unchanged from Tracks.
- The **Tracks** menu is removed.
- **Not added:** Dashboard (the homepage is the Dashboard; the user removed its nav link, so the STEM+ brand link reaches it) and Profile (doesn't exist until Phase 5).
- **About** stays immediately before the account.

## Files

- `components/Layout.tsx`: replace `SUBJECT_/TRACK_/PROBLEM_SET_/SANDBOX_CATEGORIES` with `LEARN_/PRACTICE_/BUILD_/GOAL_CATEGORIES`; four `NavMenu`s. `NavMenu` and styling unchanged.
- `scripts/check-nav-links.js`: require every hub page in the nav (`/pathways.html`, `/projects.html`, `/applications.html`, `/new.html`, `/problem-sets.html`, `/sandbox.html`, `/about.html`) and the four menu labels.
- `content/about.html`: patch-note entry.
- No content pages change (old menu names only appear in historical patch notes).

## Testing

- The set of nav hrefs before and after is identical.
- `npm test`, `npm run build`.
- Production build in the browser: each of the four menus opens and lists its categories in order; Tracks is gone.
- Phone-width screenshot: top bar has no horizontal overflow.
- Push; repeat the menu check on production.
