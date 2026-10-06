# Revision Phase 1 — Releases 1 & 2: Housekeeping, Guest Access, Signed-out Homepage — Design

## Context

From the "STEM+ Product Review & Revision Specification" and the audit in `docs/revision/2026-10-05-architecture-report.md`. User decisions (2026-10-05): blend the spec with today's choices (signed-out visitors get an outcome-led homepage, signed-in users keep the Dashboard; open browsing; nav regroup later); progress stays in the browser; guests may **browse and try everything, but saving needs an account**; approach A (one shared client-side sign-in gate).

## Release 1 — Housekeeping

- `scripts/check-programming-packages-course.js`: point at the course data's current location under `public/Programming with Packages/` (it fails with `Cannot find module '../Programming with Packages/course.js'`).
- Add it and the 8 passing checks not yet in `npm test` (`check-code-editor`, `check-guided-language-projects`, `check-java-sandbox`, `check-javascript-cpp-sandboxes`, `check-pandas-sandbox`, `check-python-project`, `check-python-sandbox`, `check-syntax-highlight`) to `npm test`.

## Release 2 — Guest access + signed-out homepage

### Shared sign-in gate

- New `public/assets/account.js`, loaded synchronously by a new `pages/_document.tsx` on every page before any page script. Defines `window.STEMPlusAccount = { me, ready, signedIn(), signInHref(), showGuestNote(text) }`: one `/api/me` request per page; `signInHref()` = `/login.html?next=<current path+query>`; `showGuestNote` inserts one "not saved" note per page.
- `components/Layout.tsx` `AuthStatus` and `tests.js`'s developer check reuse `STEMPlusAccount.ready` (fallback to their own fetch where it's absent, e.g. Node checks).
- Storage functions stay unchanged; gating happens at the UI action, so existing Node checks keep calling them directly. Where `STEMPlusAccount` is absent, scripts behave as before (save).

### Page access

- Delete `proxy.ts`: every page becomes public. API routes keep their own session checks (AI plan generation, FRQ grading, `/api/me`).

### Save points (guest behavior)

| Save point | File | Guest behavior |
|---|---|---|
| Unit tests, course exams, pathway exams | `tests.js` `mountTest` | Graded, answers revealed, result shown with "This attempt wasn't saved — sign in to keep your results"; pass notes that claim progress ("This unit is cleared…") are replaced by that line |
| Project reflections | `tests.js` `mountReflection` | Save shows "Sign in to save your reflection" |
| Track choice | `tests.js` `mountTrackChoice` | Waits for sign-in state; guests see "Sign in to make this your track" |
| Course skips + target date | `tests.js` `mountTrackPlan` | Save shows a sign-in prompt |
| Problem Sets | `problem-sets.js` | Progress kept in memory only; guest note |
| Timed Mastery | `timed-mastery.js` | Run graded; "This run wasn't saved — sign in to keep your results" |
| Sandboxes + guided projects | `function-sandbox-ui.js`, `java-sandbox.js`, `python-sandbox.js`, `python-project.js`, `guided-language-project.js` | Code runs; writes skipped; guest note |
| AI plan, FRQ grading, developer mode | — | Unchanged |

Consequence (accepted): guests' unit-test passes aren't saved, so course/pathway exam gates and capstones stay locked for them. Progress already in a browser still displays.

### Homepage (`content/index.html`)

- `<section data-signed-out hidden>`: kicker STEM+, h1 "Build your STEM future.", subtitle "Tell STEM+ where you want to go. We'll help you see what you already know, what to learn next, and how to prove you've mastered it.", actions **Choose a Goal** (`new.html`), **Explore STEM+** (`about.html`), **Sign in to continue** (`login.html?next=%2F`), a six-step journey list (Goal → Roadmap → Learn → Practice → Master → Build, one line each), and an evidence line: "40 courses · 1,067 lessons · 4,800 practice problems · 10 pathways with capstone projects · 9 real-world Applications".
- `<section data-signed-in hidden>`: today's Dashboard header + `data-dashboard`.
- `tests.js` `mountAuthSections` reveals the right section once sign-in state is known (a short "Loading…" shows until then). `mountDashboard` renders only for signed-in visitors; the locked preview (`renderLockedDashboard` and its CSS) is removed.
- "Take a Diagnostic" is deferred to Phase 2.

### Copy

`content/about.html`: "Progress & accounts" now says guests can browse and try everything and signing in saves progress, results, plans, and the Dashboard; new patch-note entry.

## Testing

- `npm test` (now including the 9 sandbox/project/editor checks) and `npm run build`.
- Production build, signed out (invalid cookie): every page type returns 200 with no redirect (lesson, unit test, course exam, Pathway, Project, Application, Problem Set, Timed Mastery, sandbox, Learning Record); homepage shows the landing section; each save point shows its prompt and leaves localStorage unchanged; AI plan generation still requires sign-in.
- Signed in: homepage shows the Dashboard; a unit test, problem-set answer, Timed Mastery run, reflection, and track choice all save as before.
- Screenshots of the landing page (desktop + phone). Then the same on production.
