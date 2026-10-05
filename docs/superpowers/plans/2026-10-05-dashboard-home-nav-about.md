# Dashboard Homepage, Nav Dropdowns, About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/` becomes the Dashboard (blurred, locked preview when signed out), the nav gets Tracks / Problem Sets / Sandbox dropdowns plus an About tab, and a new About page holds the overview, patch notes, and disclaimer.

**Architecture:** Client-side gate in `public/assets/tests.js`: `mountDashboard` waits on the existing `/api/me` promise (now also recording the account) and renders either the real dashboard or a locked preview. `components/Layout.tsx`'s `SubjectsMenu` generalizes into `NavMenu` driven by four hard-coded data arrays, guarded by a new link check in `npm test`.

**Tech Stack:** Next.js 16 Pages Router shell (React 19, Tailwind 4) around static HTML in `content/`; plain browser JS in `public/assets/`.

**Spec:** `docs/superpowers/specs/2026-10-05-dashboard-home-nav-about-design.md`

## Global Constraints

- No `proxy.ts` logic change beyond adding `'/about.html'` to `FREE_PATHS`.
- Locked preview uses placeholder rows only — never this browser's real progress.
- Sign-in links return to `/`: `login.html?next=%2F`, `login.html?next=%2F#create-account`.
- Subjects menu contents and behavior unchanged; all top-level menus share `name="nav-menu"`.
- `/dashboard.html` → `/` permanent redirect; `content/dashboard.html` deleted.
- Verify against `npm run build && npm run start`, then production after push.

---

### Task 1: Nav dropdowns + About tab + nav link check

**Files:** Modify `components/Layout.tsx`, `package.json`; Create `scripts/check-nav-links.js`.

- [ ] **Step 1: Failing check** — create `scripts/check-nav-links.js`:

```js
'use strict';

// Every site link hard-coded in the shell nav must point at a real page —
// the dropdown lists are hand-maintained, so a renamed course or page would
// otherwise break the nav silently.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const layout = fs.readFileSync(path.join(root, 'components/Layout.tsx'), 'utf8');
const hrefs = [...layout.matchAll(/'(\/[^']*)'|href="(\/[^"]*)"/g)]
  .map((m) => m[1] || m[2])
  .filter((href) => !href.startsWith('/api/'));

assert.ok(hrefs.length > 80, `expected the nav to contain 80+ links, found ${hrefs.length}`);
for (const required of ['/about.html', '/pathways.html', '/problem-sets.html', '/sandbox.html']) {
  assert.ok(hrefs.includes(required), `nav is missing ${required}`);
}
assert.ok(!hrefs.includes('/dashboard.html'), 'nav still links /dashboard.html — the Dashboard is the homepage now');

hrefs.forEach((href) => {
  const pathname = decodeURIComponent(href.split(/[?#]/)[0]);
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const exists = fs.existsSync(path.join(root, 'content', rel)) || fs.existsSync(path.join(root, 'public', rel));
  assert.ok(exists, `nav link ${href} → ${rel} does not exist under content/ or public/`);
});

console.log(`check-nav-links: OK (${hrefs.length} nav links)`);
```

Run `node scripts/check-nav-links.js` → FAIL (`nav is missing /about.html`).

- [ ] **Step 2: Implement** — in `Layout.tsx`:
  - Replace `NAV_LINKS` with `TRACK_CATEGORIES`, `PROBLEM_SET_CATEGORIES`, `SANDBOX_CATEGORIES` (data extracted from `pathways.html`, `projects.html`, `applications.html`, `Goals/*`, `problem-sets.html`, `sandbox.html`), and rename `SUBJECT_CATEGORIES`' `courses` field to `items`.
  - Replace `SubjectsMenu` with `NavMenu({ label, eyebrow, categories })` — same markup; top-level `<details name="nav-menu">`; inner `<details name={`${label}-category`}>`; counts from `items.length`.
  - Nav: `<NavMenu label="Subjects" eyebrow="Course categories" …/>`, Tracks ("Guided routes"), Problem Sets ("Practice banks"), Sandbox ("Code practice"), `<a href="/about.html">About</a>`, `<AuthStatus />`. Remove the Dashboard link.
- [ ] **Step 3:** Add ` && node scripts/check-nav-links.js` to `package.json` `test`; `npm test` passes.
- [ ] **Step 4:** Commit "Add Tracks, Problem Sets, and Sandbox dropdowns and an About tab".

### Task 2: Dashboard homepage with locked preview

**Files:** Modify `public/assets/tests.js`, `public/assets/style.css`, `content/index.html`, `content/login.html`, `next.config.js`, 9 pages linking `dashboard.html`; Delete `content/dashboard.html`.

- [ ] **Step 1:** `tests.js` — the `/api/me` block records the account:

```js
  if (typeof window !== 'undefined' && !window.STEMPlusDevReady) {
    window.STEMPlusDev = { isDeveloper: false, me: null };
    window.STEMPlusDevReady = fetch('/api/me')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (me) {
        window.STEMPlusDev.me = me || null;
        window.STEMPlusDev.isDeveloper = !!(me && me.isDeveloper);
        return window.STEMPlusDev.isDeveloper;
      })
      .catch(function () { return false; });
  }
```

- [ ] **Step 2:** `tests.js` — `mountDashboard(el)` keeps its mount guard, shows "Loading your dashboard…", then `(window.STEMPlusDevReady || Promise.resolve(false)).then(() => (window.STEMPlusDev && window.STEMPlusDev.me ? renderDashboard(el) : renderLockedDashboard(el)))`. Today's body moves verbatim into `renderDashboard(el)`. New `renderLockedDashboard(el)` builds `.dashboard-locked` → `.dashboard-preview[aria-hidden=true][inert]` (placeholder sections Continue Learning / Review / Next Milestone / Your Path) + `.dashboard-lock-card` ("Dashboard locked", "Sign in to see your Dashboard", pitch, Sign in + Create account buttons, About link).
- [ ] **Step 3:** `style.css` — after the `.page-home` block:

```css
/* Signed-out homepage: the Dashboard's layout with placeholder rows,
   blurred under a lock card (public/assets/tests.js renderLockedDashboard). */
.dashboard-locked { position: relative; }
.dashboard-preview { filter: blur(5px); opacity: 0.55; pointer-events: none; user-select: none; }
.dashboard-lock-card {
  position: absolute;
  top: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  width: min(26rem, calc(100% - 2rem));
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  text-align: center;
}
.dashboard-lock-card h2 { margin-top: 0.25rem; }
.dashboard-lock-card .nav-links { justify-content: center; margin-bottom: 1rem; }
```

- [ ] **Step 4:** `content/index.html` → Dashboard page (kicker "STEM+ · Dashboard", h1 "Your Dashboard", subtitle, links to `new.html` / `learning-record.html`, `<div data-dashboard>`, footer "STEM+ · progress lives in this browser · About STEM+"), loads `assets/tests.js`, keeps `class="page page-home"`.
- [ ] **Step 5:** `next.config.js` adds `{ source: '/dashboard.html', destination: '/', permanent: true }`; delete `content/dashboard.html`; `content/login.html` create-account panel gets `id="create-account"`.
- [ ] **Step 6:** Links: `pathways.html` and `problem-sets.html` drop their `<a href="dashboard.html" class="nav-toc">Dashboard →</a>` (they already link "← STEM+ Home"); `my-plan.html`, `learning-record.html`, and the 5 `Goals/*.html` repoint `dashboard.html` → `index.html` (`../index.html` in Goals).
- [ ] **Step 7:** `npm test` + `npm run build` pass; commit "Make the Dashboard the homepage, locked until signed in".

### Task 3: About page

**Files:** Create `content/about.html`; Modify `proxy.ts` (`FREE_PATHS`).

- [ ] **Step 1:** `content/about.html` (`class="page page-home"`): "About STEM+" h1 + the existing summary; "What's inside" (Subjects, Tracks, Problem Sets, Sandbox cards with the homepage counts); "Progress & accounts"; "Patch Notes" (verbatim + Oct 5 entry); disclaimer + Developer link footer.
- [ ] **Step 2:** `proxy.ts` `FREE_PATHS` gets `'/about.html'` (comment: public overview, like the subject hubs).
- [ ] **Step 3:** `npm test`, `npm run build`; commit "Add an About page with the site overview, patch notes, and disclaimer".

### Task 4: Verify, push, verify live

- [ ] Production build + fresh test-account cookie. Checks: signed out `/` → `.dashboard-locked`, both buttons' hrefs, preview has no real course names from seeded progress; signed in `/` → real dashboard panels; `/dashboard.html` → 308 to `/`; `/about.html` 200 signed out; nav has Subjects/Tracks/Problem Sets/Sandbox/About in order and no Dashboard; each menu opens and opening another closes it. Screenshots desktop + phone (signed out and signed in, one menu open).
- [ ] Push; poll deploy; repeat checks on production.
