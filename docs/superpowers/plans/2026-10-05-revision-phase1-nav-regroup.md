# Revision Phase 1 (Release 3) Navigation Regroup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Top bar becomes STEM+ · Learn · Practice · Build · Goals · About · account, with every current nav link kept.

**Architecture:** Only the category arrays and the four `<NavMenu>` calls in `components/Layout.tsx` change; `NavMenu` and its styling stay. `scripts/check-nav-links.js` pins the menu labels and hub pages.

**Tech Stack:** Next.js 16 Pages Router, React, Node `assert` checks.

**Spec:** `docs/superpowers/specs/2026-10-05-revision-phase1-nav-regroup-design.md`

## Global Constraints

- The set of nav hrefs before and after is identical (only grouping changes).
- Menu order: Learn, Practice, Build, Goals; then About; then the account.
- No Dashboard or Profile menu item.
- Commit each task; push at the end; verify on a production build, then production.

---

### Task 1: Regroup the nav

**Files:** Modify `scripts/check-nav-links.js`, `components/Layout.tsx`, `content/about.html`.

- [ ] **Snapshot today's hrefs:**

```bash
node -e "const s=require('fs').readFileSync('components/Layout.tsx','utf8');console.log([...s.matchAll(/'(\/[^']*)'|href=\"(\/[^\"]*)\"/g)].map(m=>m[1]||m[2]).sort().join('\n'))" | sort -u > "$SCRATCH/nav-before.txt"
```

- [ ] **Failing check** — in `scripts/check-nav-links.js`, replace the `required` loop with:

```js
for (const required of ['/about.html', '/pathways.html', '/projects.html', '/applications.html', '/new.html', '/problem-sets.html', '/sandbox.html']) {
  assert.ok(hrefs.includes(required), `nav is missing ${required}`);
}
const menus = [...layout.matchAll(/<NavMenu label="([^"]+)"/g)].map((m) => m[1]);
assert.deepStrictEqual(menus, ['Learn', 'Practice', 'Build', 'Goals'], `nav menus are ${menus.join(', ')}`);
```

Run `node scripts/check-nav-links.js`: expect FAIL "nav menus are Subjects, Tracks, Problem Sets, Sandbox".

- [ ] **`Layout.tsx`:**
  - Rename `SUBJECT_CATEGORIES` → `LEARN_CATEGORIES` and `PROBLEM_SET_CATEGORIES` → `PRACTICE_CATEGORIES` (contents unchanged).
  - Replace `TRACK_CATEGORIES` and `SANDBOX_CATEGORIES` with:

```tsx
const BUILD_CATEGORIES: readonly NavCategory[] = [
  {
    label: 'Sandbox',
    href: '/sandbox.html',
    items: [
      ['Python Sandbox', '/python-sandbox.html'],
      ['Java Sandbox', '/java-sandbox.html'],
      ['JavaScript Sandbox', '/javascript-sandbox.html'],
      ['C++ Sandbox', '/cpp-sandbox.html'],
      ['Pandas Package Mastery', '/pandas-sandbox.html'],
      ['Guided Programming Projects', '/python-projects.html'],
    ],
  },
  // Applications category — moved verbatim from TRACK_CATEGORIES
  // Projects category — moved verbatim from TRACK_CATEGORIES
];

const GOAL_CATEGORIES: readonly NavCategory[] = [
  // Goals category — moved verbatim from TRACK_CATEGORIES
  // Pathways category — moved verbatim from TRACK_CATEGORIES
];
```

  - The header comment lists the hub pages each menu mirrors.
  - Nav:

```tsx
<NavMenu label="Learn" eyebrow="Courses by subject" categories={LEARN_CATEGORIES} />
<NavMenu label="Practice" eyebrow="Problem sets & timed drills" categories={PRACTICE_CATEGORIES} />
<NavMenu label="Build" eyebrow="Code, apply, create" categories={BUILD_CATEGORIES} />
<NavMenu label="Goals" eyebrow="Where you're headed" categories={GOAL_CATEGORIES} />
```

- [ ] **Hrefs unchanged:** rerun the snapshot command into `nav-after.txt`; `diff nav-before.txt nav-after.txt` prints nothing.
- [ ] **`about.html`:** new top patch entry (Oct 5, 2026): the menus are now Learn, Practice, Build, Goals; Tracks' Pathways and Goals are under Goals, Applications and Projects under Build next to the sandboxes.
- [ ] `node scripts/check-nav-links.js` passes; `npm test`; `npm run build`; commit "Regroup the nav into Learn, Practice, Build, and Goals".

### Task 2: Verify, push, verify live

- [ ] Production build (`npm run start`), via `scripts/verify-page.mjs`: the four top-level `summary` labels read Learn, Practice, Build, Goals; each menu's category labels match the spec table in order; no "Tracks"/"Subjects" summary; About sits between Goals and the account.
- [ ] Phone-width (390px) screenshot of the homepage: `document.documentElement.scrollWidth <= innerWidth`.
- [ ] Push; poll the deploy; repeat the menu check on https://stem-review.vercel.app.
