# Dashboard Homepage, Nav Dropdowns, About Page — Design

## Context

Today `/` (`content/index.html`) is a catalog of cards (Subjects, Tracks, Problem Sets, Sandbox) followed by an About section (summary, Patch Notes) and a disclaimer footer. The Dashboard lives at `content/dashboard.html` (login-gated by `proxy.ts`). The shell nav (`components/Layout.tsx`) has Dashboard, a Subjects dropdown (`SubjectsMenu`, added by the user in `c27c3ac`), and plain Tracks / Problem Sets / Sandbox links, then the account status.

## User decisions (brainstorm, 2026-10-05)

- The homepage **is** the Dashboard; the catalog cards leave the homepage (nav dropdowns cover them).
- Signed-out visitors see a **blurred preview behind a lock** with sign-in / create-account actions.
- Tracks, Problem Sets, and Sandbox get dropdowns like Subjects.
- Remove Dashboard from the nav; add **About** right before the account; new About page gathers all "about" content.
- Approach A: client-side auth check on a static homepage (no `proxy.ts` change).

## Design

### Homepage = Dashboard (`content/index.html`)

- Heading "Your Dashboard", subtitle, links to Learning Record and Choose a goal (`new.html`), then `<div data-dashboard>` (existing `mountDashboard`), footer "STEM+ · progress lives in this browser · About".
- Loads `assets/tests.js` (no longer `assets/auth.js`, whose `.auth-slot` the shell already filters).
- `mountDashboard` waits for the signed-in check before rendering:
  - **Pending:** "Loading your dashboard…" (so signed-in users never see the lock flash).
  - **Signed in:** today's dashboard, unchanged.
  - **Signed out:** a locked preview — the Dashboard's section headings (Continue Learning, Review, Practice, Next Milestone, Your Path) with **placeholder** rows (never the device's real progress), blurred/dimmed and non-interactive (`aria-hidden`, `inert`), under a lock card: "Sign in to see your Dashboard", one-line pitch, buttons **Sign in** (`login.html?next=%2F`) and **Create account** (`login.html?next=%2F#create-account`), and an "About STEM+" link.
- The signed-in check reuses the `/api/me` request `tests.js` already makes for developer status: that block also records `window.STEMPlusDev.me` (the account or `null`), so no extra request.
- The lock is a sign-in gate for the homepage view, not data protection (progress is in this browser's storage).

### `/dashboard.html` → `/`

- Permanent redirect in `next.config.js` (same as `/index.html`); `content/dashboard.html` is deleted.
- In-repo links to `dashboard.html` (pathways, my-plan, 5 Goals pages, problem-sets, learning-record) point to the homepage instead (`index.html` / `../index.html`, which already redirects to `/`).
- `content/login.html`: the create-account panel gets `id="create-account"`.

### Nav (`components/Layout.tsx`)

- `SubjectsMenu` generalizes into `NavMenu({ label, eyebrow, categories })` — identical markup/behavior for Subjects; top-level menus share `name="nav-menu"` so opening one closes the others; inner categories keep per-menu `name`s.
- Data (hard-coded, mirroring each hub page):
  - **Subjects:** unchanged.
  - **Tracks:** Pathways (8 + General Programmer, AI Developer: CB/RWA → `/pathways.html`), Projects (10 capstones → `/projects.html`), Applications (9 → `/applications.html`), Goals (Get Ahead, Prepare for College, Stronger at Math, Challenge Myself, Review & Test, Describe your own goal → `/new.html#explore`, My plan → `/my-plan.html`; browse → `/new.html`).
  - **Problem Sets:** Timed Mastery (2), Mathematics (8), Technology & CS (5), Science, Engineering & Physics (5), Advanced+ (2) → `/problem-sets.html`.
  - **Sandbox:** Core languages (Python, Java, JavaScript, C++), Packages (Pandas), Guided projects (Guided Programming Projects) → `/sandbox.html`.
- Order: Subjects · Tracks · Problem Sets · Sandbox · About (`/about.html`) · account. Dashboard link removed (logo → `/`).

### About page (`content/about.html`, added to `proxy.ts` `FREE_PATHS`)

1. What STEM+ is — the current About summary.
2. What's inside — compact versions of the homepage catalog cards (Subjects, Tracks incl. Pathways/Projects/Applications, Problem Sets incl. Timed Mastery, Sandbox) with counts and links.
3. Progress & accounts — progress is stored in this browser; signing in unlocks the Dashboard and AI-generated plans; developer mode link.
4. Patch Notes — moved verbatim, plus a new Oct 5 entry for this change.
5. The disclaimer and Developer link (moved from the homepage footer).

## Testing

- New `scripts/check-nav-links.js` (in `npm test`): every `href` in `components/Layout.tsx` (path part, URL-decoded, `/` = `content/index.html`) resolves to a file under `content/`.
- `npm run build`; production-build browser checks: signed out → locked preview with both buttons pointing back to `/` and no real progress rendered; signed in → real dashboard; `/dashboard.html` → `/`; `/about.html` loads signed out; every dropdown opens with the expected items and opening one closes another; screenshots at desktop and phone width.
- Same checks against production after push.
