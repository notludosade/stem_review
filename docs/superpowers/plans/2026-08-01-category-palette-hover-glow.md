# Category Palette + Hover Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site's Track, Problem Sets, and Sandbox sections their own distinct accent colors, and add a subtle hover/focus glow to `.toc-item` cards site-wide.

**Architecture:** Pure CSS. A third `data-category` override axis is added to `assets/style.css` alongside the existing `data-tier` and `data-pathway` axes, following their exact existing pattern (unscoped default + `@media (prefers-color-scheme: dark)` + `:root[data-theme="dark"]` + `:root[data-theme="light"]`). The attribute is then added to the relevant `.toc-item` cards and hub-page `.page` divs. The existing `.toc-item:hover` rule is extended with a `box-shadow`/`transform` glow, mirrored onto `:focus-visible` for keyboard parity.

**Tech Stack:** Plain CSS/HTML. No build step, no JS, no new dependencies.

## Global Constraints

- No framework, no build tooling — this stays static HTML/CSS, per the site's existing architecture.
- Subject category gets no CSS rule (uses the site's default `--accent`/`--accent-soft`) — do not add `data-category="subject"` anywhere.
- Do not touch the ~1,023 existing `data-tier` locations on individual lesson pages, and do not add `data-category` to any Subject-area page.
- Cascade order in `style.css` must be: `data-tier` rules, then `data-category` rules, then `data-pathway` rules (category must outrank tier — see Task 1 for why; pathway still outranks category).
- Hover glow must also apply on `:focus-visible` (not hover-only) and must not apply to `.toc-item.is-soon` (inert "coming soon" cards).

---

### Task 1: Category color CSS + hover/focus glow

**Files:**
- Modify: `assets/style.css:74-75` (insert new category block between the existing tier block and pathway block)
- Modify: `assets/style.css:726-734` (extend `.toc-item` and `.toc-item:hover` for the glow)
- Modify: `assets/style.css:762` (suppress the glow on `.toc-item.is-soon`)

**Interfaces:**
- Produces: three new CSS attribute-selector values — `data-category="track"`, `data-category="problem-sets"`, `data-category="sandbox"` — each setting `--accent`/`--accent-soft` on `.page` or `.toc-item`. Later tasks apply these attributes to HTML files; this task only defines what they do.

- [ ] **Step 1: Insert the category color block**

In `assets/style.css`, immediately after line 74 (`:root[data-theme="light"] .page[data-tier="advanced"]...`) and before the blank line + pathway comment at line 76, insert:

```css

/* Section-category identity colors: Track/Problem Sets/Sandbox each get their own
   --accent/--accent-soft so the site's top-level sections read as visually distinct.
   Subject has no rule here — it keeps the default brown accent. Declared after the
   difficulty-tier block above so category outranks tier: the sandbox/project pages
   below carry a default data-tier="intro" (sandboxes aren't meaningfully "intro vs.
   advanced"), which would otherwise hide the sandbox category color entirely. Declared
   before the pathway block below so a specific pathway still outranks its parent
   category (not currently reachable — no page carries both — but keeps the priority
   order consistent: tier < category < pathway, most-specific wins). */
.page[data-category="track"], .toc-item[data-category="track"] { --accent: #2f4a7a; --accent-soft: #dde5f2; }
.page[data-category="problem-sets"], .toc-item[data-category="problem-sets"] { --accent: #8a3355; --accent-soft: #f5dde6; }
.page[data-category="sandbox"], .toc-item[data-category="sandbox"] { --accent: #1f6b3d; --accent-soft: #d9f0e0; }
@media (prefers-color-scheme: dark) {
  .page[data-category="track"], .toc-item[data-category="track"] { --accent: #7fa3d9; --accent-soft: #1f2d40; }
  .page[data-category="problem-sets"], .toc-item[data-category="problem-sets"] { --accent: #d97fa0; --accent-soft: #331420; }
  .page[data-category="sandbox"], .toc-item[data-category="sandbox"] { --accent: #6fc98f; --accent-soft: #16301f; }
}
:root[data-theme="dark"] .page[data-category="track"], :root[data-theme="dark"] .toc-item[data-category="track"] { --accent: #7fa3d9; --accent-soft: #1f2d40; }
:root[data-theme="dark"] .page[data-category="problem-sets"], :root[data-theme="dark"] .toc-item[data-category="problem-sets"] { --accent: #d97fa0; --accent-soft: #331420; }
:root[data-theme="dark"] .page[data-category="sandbox"], :root[data-theme="dark"] .toc-item[data-category="sandbox"] { --accent: #6fc98f; --accent-soft: #16301f; }
:root[data-theme="light"] .page[data-category="track"], :root[data-theme="light"] .toc-item[data-category="track"] { --accent: #2f4a7a; --accent-soft: #dde5f2; }
:root[data-theme="light"] .page[data-category="problem-sets"], :root[data-theme="light"] .toc-item[data-category="problem-sets"] { --accent: #8a3355; --accent-soft: #f5dde6; }
:root[data-theme="light"] .page[data-category="sandbox"], :root[data-theme="light"] .toc-item[data-category="sandbox"] { --accent: #1f6b3d; --accent-soft: #d9f0e0; }
```

- [ ] **Step 2: Verify the block landed in the right place**

```bash
grep -n "data-category=\"track\"\|data-category=\"problem-sets\"\|data-category=\"sandbox\"" assets/style.css | wc -l
```

Expected: `12` (3 categories × 4 scope blocks each). Also confirm ordering:

```bash
grep -Fn 'data-tier="advanced"' assets/style.css | tail -1
grep -Fn 'data-category="track"' assets/style.css | head -1
grep -Fn 'data-pathway="swe"' assets/style.css | head -1
```

Expected: the tier line number < the category line number < the pathway line number.

- [ ] **Step 3: Add the hover/focus glow**

Replace this line:

```css
.toc-item {
  display: block;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.7rem 1rem;
  text-decoration: none;
  color: inherit;
}
.toc-item:hover { border-color: var(--accent); background: var(--accent-soft); }
```

with:

```css
.toc-item {
  display: block;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.7rem 1rem;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease, background 180ms ease;
}
.toc-item:hover, .toc-item:focus-visible {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent), 0 6px 24px -8px color-mix(in srgb, var(--accent) 45%, transparent);
  transform: translateY(-1px);
}
```

- [ ] **Step 4: Suppress the glow on inert "coming soon" cards**

Replace this line:

```css
.toc-item.is-soon:hover { border-color: var(--border); background: none; }
```

with:

```css
.toc-item.is-soon:hover, .toc-item.is-soon:focus-visible {
  border-color: var(--border);
  background: none;
  box-shadow: none;
  transform: none;
}
```

- [ ] **Step 5: Verify the glow edits**

```bash
grep -n "focus-visible" assets/style.css
```

Expected: two matches — one in the `.toc-item:hover, .toc-item:focus-visible` rule, one in the `.toc-item.is-soon:hover, .toc-item.is-soon:focus-visible` rule.

- [ ] **Step 6: Commit**

```bash
git add assets/style.css
git commit -m "Add category color axis and hover/focus glow to toc-item cards"
```

---

### Task 2: Tag index.html's Track/Problem Sets/Sandbox cards

**Files:**
- Modify: `index.html:42,47,52,62,72`

**Interfaces:**
- Consumes: the `data-category` CSS rules from Task 1.

- [ ] **Step 1: Add `data-category="track"` to the 3 Track cards**

Replace:
```html
    <a class="toc-item" href="pathways.html">
      <span class="toc-num">Track</span>
```
with:
```html
    <a class="toc-item" href="pathways.html" data-category="track">
      <span class="toc-num">Track</span>
```

Replace:
```html
    <a class="toc-item" href="projects.html">
      <span class="toc-num">Track</span>
```
with:
```html
    <a class="toc-item" href="projects.html" data-category="track">
      <span class="toc-num">Track</span>
```

Replace:
```html
    <a class="toc-item" href="applications.html">
      <span class="toc-num">Track</span>
```
with:
```html
    <a class="toc-item" href="applications.html" data-category="track">
      <span class="toc-num">Track</span>
```

- [ ] **Step 2: Add `data-category="problem-sets"` to the Problem Sets card**

Replace:
```html
    <a class="toc-item" href="problem-sets.html">
      <span class="toc-num">Practice</span>
```
with:
```html
    <a class="toc-item" href="problem-sets.html" data-category="problem-sets">
      <span class="toc-num">Practice</span>
```

- [ ] **Step 3: Add `data-category="sandbox"` to the Sandbox card**

Replace:
```html
    <a class="toc-item" href="sandbox.html">
      <span class="toc-num">Languages + Packages + Projects</span>
```
with:
```html
    <a class="toc-item" href="sandbox.html" data-category="sandbox">
      <span class="toc-num">Languages + Packages + Projects</span>
```

- [ ] **Step 4: Verify**

```bash
grep -c 'data-category="track"' index.html
grep -c 'data-category="problem-sets"' index.html
grep -c 'data-category="sandbox"' index.html
```

Expected: `3`, `1`, `1`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Tag homepage Track/Problem Sets/Sandbox cards with data-category"
```

---

### Task 3: Tag the plain hub pages

**Files:**
- Modify: `pathways.html:5`, `projects.html:6`, `applications.html:5`, `problem-sets.html:6`, `problem-set.html:8`, `sandbox.html:6`

**Interfaces:**
- Consumes: the `data-category` CSS rules from Task 1.

- [ ] **Step 1: Tag the 3 Track hub pages**

In `pathways.html`, replace line 5:
```html
<div class="page">
```
with:
```html
<div class="page" data-category="track">
```

In `projects.html`, replace line 6:
```html
<div class="page">
```
with:
```html
<div class="page" data-category="track">
```

In `applications.html`, replace line 5:
```html
<div class="page">
```
with:
```html
<div class="page" data-category="track">
```

- [ ] **Step 2: Tag the 2 Problem Sets hub pages**

In `problem-sets.html`, replace line 6:
```html
<div class="page">
```
with:
```html
<div class="page" data-category="problem-sets">
```

In `problem-set.html`, replace line 8:
```html
<div class="page">
```
with:
```html
<div class="page" data-category="problem-sets">
```

- [ ] **Step 3: Tag the Sandbox hub page**

In `sandbox.html`, replace line 6:
```html
<div class="page">
```
with:
```html
<div class="page" data-category="sandbox">
```

- [ ] **Step 4: Verify**

```bash
for f in pathways.html projects.html applications.html; do grep -c 'data-category="track"' "$f"; done
for f in problem-sets.html problem-set.html; do grep -c 'data-category="problem-sets"' "$f"; done
grep -c 'data-category="sandbox"' sandbox.html
```

Expected: `1` for every line of output (6 total).

- [ ] **Step 5: Commit**

```bash
git add pathways.html projects.html applications.html problem-sets.html problem-set.html sandbox.html
git commit -m "Tag Track/Problem Sets/Sandbox hub pages with data-category"
```

---

### Task 4: Tag the sandbox/project pages (validates the cascade fix)

**Files:**
- Modify: `python-sandbox.html:9`, `java-sandbox.html:10`, `javascript-sandbox.html:11`, `cpp-sandbox.html:11`, `pandas-sandbox.html:10`, `python-project.html:9`, `python-projects.html:6`, `python-sensor-project.html:9`, `guided-language-project.html:9`

**Interfaces:**
- Consumes: the `data-category` CSS rules from Task 1, specifically relies on category outranking tier (Task 1 Step 1's ordering) since every file here already carries `data-tier="intro"` on the same element.

- [ ] **Step 1: Add `data-category="sandbox"` alongside the existing `data-tier="intro"`**

In `python-sandbox.html`, replace line 9:
```html
<div class="page sandbox-page" data-tier="intro">
```
with:
```html
<div class="page sandbox-page" data-tier="intro" data-category="sandbox">
```

In `java-sandbox.html`, replace line 10:
```html
<div class="page sandbox-page" data-tier="intro">
```
with:
```html
<div class="page sandbox-page" data-tier="intro" data-category="sandbox">
```

In `javascript-sandbox.html`, replace line 11:
```html
<div class="page sandbox-page" data-tier="intro" data-indent-size="2">
```
with:
```html
<div class="page sandbox-page" data-tier="intro" data-category="sandbox" data-indent-size="2">
```

In `cpp-sandbox.html`, replace line 11:
```html
<div class="page sandbox-page" data-tier="intro">
```
with:
```html
<div class="page sandbox-page" data-tier="intro" data-category="sandbox">
```

In `pandas-sandbox.html`, replace line 10:
```html
<div class="page sandbox-page" data-tier="intro">
```
with:
```html
<div class="page sandbox-page" data-tier="intro" data-category="sandbox">
```

In `python-project.html`, replace line 9:
```html
<div class="page sandbox-page" data-tier="intro">
```
with:
```html
<div class="page sandbox-page" data-tier="intro" data-category="sandbox">
```

In `python-projects.html`, replace line 6:
```html
<div class="page sandbox-page" data-tier="intro">
```
with:
```html
<div class="page sandbox-page" data-tier="intro" data-category="sandbox">
```

In `python-sensor-project.html`, replace line 9:
```html
<div class="page sandbox-page" data-tier="intro">
```
with:
```html
<div class="page sandbox-page" data-tier="intro" data-category="sandbox">
```

In `guided-language-project.html`, replace line 9:
```html
<div class="page sandbox-page" data-tier="intro">
```
with:
```html
<div class="page sandbox-page" data-tier="intro" data-category="sandbox">
```

- [ ] **Step 2: Verify all 9 files were tagged**

```bash
grep -l 'data-tier="intro" data-category="sandbox"' python-sandbox.html java-sandbox.html javascript-sandbox.html cpp-sandbox.html pandas-sandbox.html python-project.html python-projects.html python-sensor-project.html guided-language-project.html | wc -l
```

Expected: `9`.

- [ ] **Step 3: Open one page in a browser and confirm the cascade fix actually works**

```bash
open python-sandbox.html
```

Expected: the page's accent color (visible in the `.kicker` text and any `--accent`-colored borders/buttons) is **forest green** (`#1f6b3d` in light mode), not the intro-tier teal (`#1f7a63`) it would have shown before Task 1's ordering fix. This is the one step in this plan that needs an eyeball check — there's no automated way to verify computed CSS custom property values from the shell, and this is the exact scenario the ordering fix in Task 1 exists for.

- [ ] **Step 4: Commit**

```bash
git add python-sandbox.html java-sandbox.html javascript-sandbox.html cpp-sandbox.html pandas-sandbox.html python-project.html python-projects.html python-sensor-project.html guided-language-project.html
git commit -m "Tag sandbox/project pages with data-category, validating tier/category cascade"
```
