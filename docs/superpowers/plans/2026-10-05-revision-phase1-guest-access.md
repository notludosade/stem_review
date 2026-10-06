# Revision Phase 1 (Releases 1–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every check runs in `npm test`; every page is public; guests can try everything but saving requires sign-in; signed-out visitors get an outcome-led homepage while signed-in users keep the Dashboard.

**Architecture:** A synchronous `public/assets/account.js` (loaded by a new `pages/_document.tsx`) owns the single `/api/me` request and exposes `window.STEMPlusAccount`. Save points check `STEMPlusAccount.canSave()` at the UI action; storage functions are untouched. `proxy.ts` is deleted.

**Tech Stack:** Next.js 16 Pages Router, plain browser JS in `public/assets/`, static HTML in `content/`.

**Spec:** `docs/superpowers/specs/2026-10-05-revision-phase1-guest-access-design.md`

## Global Constraints

- Where `window.STEMPlusAccount` is absent (Node checks), scripts behave exactly as before (save).
- Sign-in links: `STEMPlusAccount.signInHref()` = `/login.html?next=<encodeURIComponent(path+query)>`.
- No storage keys or formats change. Progress already in a browser still displays for guests.
- Commit each task; push at the end; verify on a production build, then production.

---

### Task 1: Housekeeping (release 1)

**Files:** Modify `scripts/check-programming-packages-course.js`, `package.json`.

- [ ] Point the check's `require`/paths at `public/Programming with Packages/` (currently `../Programming with Packages/course.js`); run it until it passes.
- [ ] Append to `npm test`: `check-code-editor`, `check-guided-language-projects`, `check-java-sandbox`, `check-javascript-cpp-sandboxes`, `check-pandas-sandbox`, `check-programming-packages-course`, `check-python-project`, `check-python-sandbox`, `check-syntax-highlight`.
- [ ] `npm test` passes; commit "Run every content and sandbox check in npm test".

### Task 2: Account gate + open pages + homepage (release 2)

**Files:** Create `public/assets/account.js`, `pages/_document.tsx`; Delete `proxy.ts`; Modify `components/Layout.tsx`, `public/assets/tests.js`, `public/assets/style.css`, `content/index.html`, `content/about.html`.

- [ ] **`public/assets/account.js`:**

```js
// Sign-in state for every page, loaded synchronously by pages/_document.tsx
// before any page script. Everything on STEM+ is open to guests; saving
// progress needs an account, so save points call canSave() at the moment
// of saving and show a sign-in note instead when it returns false.
(function () {
  if (window.STEMPlusAccount) return;
  var account = { me: undefined };
  account.ready = fetch('/api/me', { credentials: 'same-origin' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .catch(function () { return null; })
    .then(function (me) { account.me = me || null; return account.me; });
  account.signedIn = function () { return !!account.me; };
  account.canSave = account.signedIn;
  account.signInHref = function () {
    return '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
  };
  // One note per page, placed after the page's first nav-links row.
  account.noteIfGuest = function (text) {
    account.ready.then(function (me) {
      if (me || document.querySelector('[data-guest-note]')) return;
      var page = document.querySelector('.page');
      if (!page) return;
      var note = document.createElement('p');
      note.className = 'signin-prompt';
      note.setAttribute('data-guest-note', '');
      note.innerHTML = text + ' <a href="' + account.signInHref() + '">Sign in</a> to keep it.';
      var anchor = page.querySelector('.nav-links');
      if (anchor) anchor.insertAdjacentElement('afterend', note);
      else page.insertBefore(note, page.firstChild);
    });
  };
  window.STEMPlusAccount = account;
}());
```

- [ ] **`pages/_document.tsx`:** standard `Html`/`Head`/`Main`/`NextScript` with `<script src="/assets/account.js" />` in `Head` (synchronous by design; eslint `no-sync-scripts` disabled on that line with a comment).
- [ ] **Delete `proxy.ts`.**
- [ ] **`Layout.tsx` `AuthStatus`:** use `window.STEMPlusAccount.ready` when present, else its own fetch.
- [ ] **`tests.js`:**
  - developer check builds on `STEMPlusAccount.ready` when present;
  - helper `const canSave = () => !window.STEMPlusAccount || window.STEMPlusAccount.canSave();` and `signInLink(text)`;
  - `mountTest`: guests get scored via a new pure `scoreAttempt(kind, answers)` (shared with `recordAttempt`) and `renderResult(..., guest: true)` which shows "This attempt wasn't saved — sign in to keep your results." instead of progress-claiming notes;
  - `mountReflection`, `mountTrackPlan` save buttons: guests get a sign-in status line, nothing saved;
  - `mountTrackChoice`: waits on `STEMPlusAccount.ready`; guests see a "Sign in to make this your track" link;
  - new `mountAuthSections()` in `initTests`: after `ready`, unhide `[data-signed-in]` or `[data-signed-out]`, remove `[data-auth-pending]`;
  - `mountDashboard`: render only when signed in; delete `renderLockedDashboard` and the `.dashboard-locked/.dashboard-preview/.dashboard-lock-card` CSS.
- [ ] **`content/index.html`:** `data-auth-pending` loading line, `<section data-signed-out hidden>` landing (headline, subtitle, Choose a Goal / Explore STEM+ / Sign in to continue, six-step `.journey` list, evidence line), `<section data-signed-in hidden>` with today's Dashboard header + `data-dashboard`.
- [ ] **`style.css`:** `.signin-prompt`, `.journey` (grid of six steps; one column on phones).
- [ ] **`about.html`:** "Progress & accounts" copy + new patch-note entry.
- [ ] `npm test`, `npm run build`; commit "Open every page to guests; saving needs an account".

### Task 3: Remaining save points

**Files:** Modify `problem-sets.js`, `timed-mastery.js`, `function-sandbox-ui.js`, `java-sandbox.js`, `python-sandbox.js`, `python-project.js`, `guided-language-project.js`.

- [ ] Each save function begins `if (window.STEMPlusAccount && !window.STEMPlusAccount.canSave()) return;` (Timed Mastery's `saveRun` returns `false` and its result copy becomes "This run wasn't saved — sign in to keep your results." for guests).
- [ ] Each script calls `window.STEMPlusAccount && window.STEMPlusAccount.noteIfGuest('<what isn't saved>')` once at start.
- [ ] `npm test` (sandbox audits load these files in Node, where `STEMPlusAccount` is absent), `npm run build`; commit "Ask guests to sign in before saving Problem Set, Timed Mastery, and sandbox progress".

### Task 4: Verify, push, verify live

- [ ] Production build. Signed out (`session=signed-out` cookie): 200 for `/Precalculus/Unit 1/<lesson>`, a unit test, a course exam, a Pathway, a Project, an Application, `/problem-set.html?course=precalculus`, `/timed-mastery.html?course=precalculus`, `/python-sandbox.html`, `/learning-record.html`; homepage shows landing; submitting a unit test, answering a problem, a Timed Mastery run, saving a reflection, "Make this my track", and a sandbox solve leave `stemplus:*` storage unchanged and show prompts; `/api/generate-plan` still 401s.
- [ ] Signed in: Dashboard section visible; the same actions save.
- [ ] Screenshots: landing desktop + phone.
- [ ] Push; poll deploy; repeat checks on production.
