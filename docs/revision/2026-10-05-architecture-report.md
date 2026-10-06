# STEM+ Repository Architecture Report (Revision Priority 0)

Prepared 2026-10-05 against `main` at `d8b704d`, as the audit step the "STEM+ Product Review & Revision Specification" requires before any major change. Nothing was modified to produce it.

## 1. Project structure

| Area | What it is |
|---|---|
| `content/` (22 MB, 1,859 `.html` files) | Every page. 28 top-level pages (hubs, Dashboard, About, Goals, sandboxes…), 40 course directories, `Pathways/`, `Projects/`, `Applications/`, `Goals/`. Per course: `Unit N/0001-…html` lessons (1,067 total), `unit-test-a/b.html` (566), `course-exam.html`, `progress-report.html`, `reference/glossary.html` (40 each). |
| `public/assets/` (900 KB) | Shared browser JS + `style.css`, loaded by pages via `<script src>`. No bundler. |
| `pages/` | Next.js Pages Router: `[[...slug]].tsx` catch-all renders every `content/*.html` at build time; `pages/api/*` server routes. |
| `components/` | `Layout.tsx` (shell nav + account status), `LegacyContent.tsx` (re-executes page scripts in order), `ui/button.tsx` (unused). |
| `lib/` | `content.js`, `scripts.js` (page splitting / script extraction), `session.js`, `db.js`, `password.js`, `anthropic.js`, `plan-catalog.js`, `frq-questions.js`. |
| `scripts/` | 22 Node checks/tools; 10 run in `npm test`. |
| `docs/superpowers/` | Specs and plans for every feature since August. |

## 2. Frameworks and dependencies

Next.js 16 (Pages Router), React 19, TypeScript, Tailwind 4 (shell only), `@neondatabase/serverless` (Postgres), `lucide-react`, shadcn leftovers (`@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `shadcn`) mostly unused outside `cn()`. The Anthropic API is called with plain `fetch`. No analytics, search, or error-reporting dependency.

## 3. Rendering & page model

Each page is a static HTML fragment (`<title>`, `<link>`, `<script>`s, then `<div class="page">`). `getStaticProps` splits it into title/body/scripts; `LegacyContent` injects the body and re-creates scripts sequentially (the user's `c27c3ac` made this load-ordered and replays `DOMContentLoaded`). Interactive behavior is attribute-driven: `data-*` markers mounted by `assets/*.js` (e.g. `data-test`, `data-dashboard`, `data-pathway-roadmap`, `data-track-choice`).

## 4. Authentication

- `pages/api/auth/{signup,login,logout}.js` + `lib/password.js`; HMAC-signed `session` cookie (`lib/session.js`).
- Neon `users` table: email, password hash, name, `is_developer`, `last_plan_generated_at` (`scripts/migrate.js`). That is the only table.
- `proxy.ts` is **default-deny**: only `FREE_PATHS` are reachable signed out — `/`, `new.html`, `login.html`, `about.html`, the 5 subject hubs, 3 Goals pages, and 8 free math course directories. Everything else (most courses, Pathways, Projects, Applications, Problem Sets, Sandbox, Learning Record) redirects to login.
- `/api/*` routes check the session themselves. The homepage Dashboard is client-gated (locked preview when signed out).

## 5. Progress storage — entirely in the browser

All learning state is `localStorage` on the device; nothing syncs to the account.

| Key | Holds |
|---|---|
| `stemplus:results:v1` | Every unit test / course exam / pathway exam attempt: `{course, unit, kind, version, score, total, passed, topicBreakdown:[{topic, correct}], takenAt}` |
| `stemplus:problem-sets:v1:<slug>` | Per question ID: attempted / first-try correct |
| `stemplus:timed-mastery:v1` | Best + last Timed Mastery run per course |
| `stemplus:projects:v1` | Capstone reflections + "complete" checkbox |
| `stemplus:skipped-courses:v1`, `stemplus:track-pace:v1` | Honor-system course skips, target dates |
| `stemplus:custom-plan:v1`, `stemplus:active-track:v1` | AI-generated plan, followed track |
| `stemplus:{python,java,javascript,cpp,pandas}-sandbox:v1`, `stemplus:python-project:*`, `stemplus:guided-project:*` | Sandbox and guided-project progress |
| `stemplus:devmode:v1` | Developer-mode unlock |

**Not tracked at all:** lesson views, lesson-quiz answers (`quiz.js` is instant-feedback only; 4,872 lesson quizzes), Application completion.

## 6. Assessment model

- Unit tests (10 points, two-part partial credit) and course exams, 80% / 85% pass thresholds, gate the course exam behind unit tests (`tests.js`).
- Question types: multiple choice, fill-in (numeric/text with normalization in `answerMatches`), two-part items. Lessons use the same markup through `quiz.js`.
- Problem Sets: 4,800 parametric, auto-graded questions (20 courses × 6 topics × 40), every answer recomputed by `check-problem-banks.js`; Timed Mastery pools (2 × 500).
- Free response: 6 Applications use `frq.js` → `pages/api/grade-frq.js` (Claude-graded, sign-in required).
- Sandboxes: 4 languages × ~180 problems with unit tests + Pandas (190) + guided projects, each with its own audit script.

## 7. Course metadata format

There is no structured course metadata. A course is a directory of HTML; its title, unit list, lesson counts, and prerequisites live in prose on its `index.html` and hub cards. The richest machine-readable signal is `data-topic` on test items: 6,389 items carry it, but as 2,761 distinct free-text strings, not shared IDs (the same skill is named differently across courses). Lesson quizzes carry no topic at all.

## 8. Navigation architecture

The shell nav in `components/Layout.tsx` has four hand-maintained dropdowns (Subjects, Tracks, Problem Sets, Sandbox) plus About and the account. `check-nav-links.js` fails on dead links but cannot detect a page missing from a menu.

## 9. Hard-coded course relationships (the main structural debt)

The same course names act as join keys across about ten hand-maintained tables:

`tests.js`: `COURSE_PATHS`, `PATHWAYS`, `PROBLEM_SET_SLUGS`, `APPLICATION_BY_COURSE`, `PREREQUISITES`, `PASS_THRESHOLDS` · `lib/plan-catalog.js`: `PREREQUISITE_GRAPH` (+ `CATALOG` parsed from hub HTML) · `problem-banks.js` course registry · `timed-mastery.js` `BASE_SCALES` · `Layout.tsx` four menu tables · hub pages and `pathways.html` / `projects.html` / `applications.html` prose.

Some are cross-checked (`check-plan-catalog.js` ties `COURSE_PATHS` ↔ catalog ↔ prerequisite graph), most are not. A mismatch fails silently (a past example locked students out of a feature).

## 10. APIs and database usage

`me`, `auth/*`, `generate-plan` (Claude, forced tool use, 24 h atomic rate limit), `grade-frq` + `frq-sample` (Claude). The database stores accounts only.

## 11. Reusable modules already in place

- **Goal → roadmap:** `new.html` goal categories, 5 Goals pages, AI-generated plans (`plan-catalog.js` validation + prerequisite reorder), roadmap visual (`mountPathwayRoadmap`, `mountGeneratedPlan`), active track (Dashboard).
- **Prerequisites:** `PREREQUISITE_GRAPH` (course level, ~40 edges, topologically sorted).
- **Mastery signals:** `buildReport` / `courseMastery` (topic accuracy, weak/strong at 70%), progress reports, Recommended Practice, Learning Record, Timed Mastery mastery-scaled grading.
- **Applications ↔ courses:** `APPLICATION_BY_COURSE` and the course "Where this fits" box.
- **Projects:** 10 gated capstones with reflections.
- **Auto-graded item pool:** the 4,800 problem-bank questions are the obvious seed for a diagnostic — tagged by 120 course-topics, parametric, verified.

## 12. Technical debt and dead files

| Item | Severity | Note |
|---|---|---|
| `check-programming-packages-course.js` fails (`Cannot find module '../Programming with Packages/course.js'`, file now under `public/`) | medium | Silent because it's not in `npm test`. |
| 8 passing checks not in `npm test` (code editor, sandboxes, guided projects, syntax highlight) | medium | Regressions there go unnoticed. |
| `public/assets/tests.js` is 2,111 lines owning tests, gating, reports, Dashboard, AI-plan UI, tracks, dev mode | medium | Split by concern before adding mastery/diagnostics. |
| ~10 duplicated course tables (§9) | high for the revision | A skill graph needs one source of truth. |
| 2,761 free-text test topics, no lesson topics | high for the revision | Blocks per-skill mastery until normalized. |
| No lesson-progress tracking | medium | Blocks the "Learning" mastery state. |
| 14 empty, untracked root directories (`AI Developer/`, `AP STEM+/`, …) | low | Local leftovers from the content move; not in git. |
| `components/ui/button.tsx` + shadcn packages unused | low | Remove or adopt in a design-system pass. |
| Expired test session cookie committed in older plan docs | low | Expired 2026-09-16; avoid committing tokens going forward. |

## 13. Proposed architecture vs. what exists

| Spec area | Exists today | Gap |
|---|---|---|
| Goals as entry point (§6) | Goals page, AI plans, tracks | Readiness % vs. a target; goal ↔ skills |
| Diagnostic engine (§7) | Problem-bank pool, Timed Mastery engine | Item selection per goal, skill profile output |
| Skill graph & data model (§4, §29) | Course-level prerequisites, free-text topics | Skill IDs, topic → skill mapping |
| Mastery states (§8) | Topic accuracy, pass/fail, project complete | State machine; lesson tracking for "Learning" |
| Skip-by-mastery (§9) | Honor-system skip | Assessment-backed skip (the unit tests already exist) |
| Dashboard as recommender (§10) | Track card, weak topics, milestone | Readiness + next lesson-level action |
| Applications prominent (§12) | 9 Applications, course links | "Concepts used" + completion tracking |
| Projects with rubrics (§13) | 10 capstones, reflections | Rubric, difficulty, scope fields |
| STEM Profile / evidence (§14–15) | Learning Record (local) | Account-backed persistence to share |
| Guest access (§16) | Default-deny login wall | Opening exploration routes |
| Trust & reporting (§17–18) | Disclaimer in About | Review status, Report a Problem |
| Search, analytics (§23, §27) | None | New |

## 14. Decisions needed before implementation

The spec conflicts with choices made on 2026-10-05:

1. **Homepage:** the spec wants an outcome-led homepage ("Build your STEM future", Choose a Goal / Take a Diagnostic); today the homepage is the Dashboard, locked for signed-out visitors.
2. **Navigation:** the spec proposes Dashboard · Learn · Practice · Build · Goals · Profile; today it is Subjects · Tracks · Problem Sets · Sandbox · About (Dashboard removed).
3. **Account wall:** the spec says "accounts for persistence, not exploration"; today `proxy.ts` is default-deny.
4. **Where mastery lives:** the spec's data model keys mastery by `userId` (server); all progress today is browser-local, a deliberate earlier choice (a server backend was built once and reverted).
5. **Trust copy:** the spec asks to replace the current disclaimer with review status + reporting.

## 15. Proposed phasing (each item its own spec → plan → verified release)

- **Phase 1 — Foundation:** (a) housekeeping: fix the broken check, wire all checks into `npm test`; (b) guest access; (c) signed-out first impression / homepage message; (d) navigation regrouping; (e) Report a Problem + content status.
- **Phase 2 — Intelligence:** (a) skill catalog: normalize problem-bank topics into skill IDs, map test `data-topic`s for a pilot set of courses; (b) diagnostic built on the problem-bank pool for one or two goals; (c) mastery engine computing the six states from existing data.
- **Phase 3 — Personalization:** readiness % and next lesson-level action on the Dashboard; skip-by-mastery using existing unit tests; adaptive review.
- **Phase 4 — Application:** Applications show "concepts used" with the student's mastery and record completion; course-linked sandbox labs; project rubrics.
- **Phase 5 — Identity:** STEM Profile page, then shareable evidence (needs account-backed storage — decision 4).

Per the spec, every change will state files affected, reason, preserved functionality, new functionality, data-model changes, migration risks, and testing.
