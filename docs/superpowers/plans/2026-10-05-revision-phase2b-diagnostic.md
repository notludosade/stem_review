# Revision Phase 2b Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An auto-built diagnostic for every Pathway that reports readiness and raises unit mastery up to Proficient.

**Architecture:** Catalog gains `pathways`; `public/assets/diagnostic.js` has a pure `buildDiagnostic` (Node-tested) plus the page UI; `mastery.js` gains diagnostic evidence, `readiness()`, and a `window.STEMPlusMastery` API.

**Tech Stack:** Node checks, plain browser JS, static HTML.

**Spec:** `docs/superpowers/specs/2026-10-05-revision-phase2b-diagnostic-design.md`

## Global Constraints

- ≤ 30 questions; 2 per skill when ≤ 15 testable skills, else 1; evenly spread when > 30.
- Diagnostics never award Mastered or Applied.
- Saving only when `STEMPlusAccount.canSave()`; skill and question IDs unchanged.

---

### Task 1: Catalog pathways + diagnostic builder

**Files:** Modify `scripts/build-skill-catalog.js`, `scripts/check-skill-catalog.js`, `public/assets/skill-catalog.json`, `package.json`; Create `public/assets/diagnostic.js` (pure part), `scripts/check-diagnostic.js`.

- [ ] Catalog check: `pathways` has 10 entries, each slug has `content/Pathways/<slug>.html`, every course is a catalog course; run → FAIL; add `pathways` to the generator; regenerate; pass.
- [ ] `scripts/check-diagnostic.js` per spec Testing; run → FAIL (module missing).
- [ ] `diagnostic.js` pure part: `buildDiagnostic`, `testableSkills`; `module.exports` then return; check passes; add to `npm test`; commit "Add Pathway diagnostics to the skill catalog and a diagnostic builder".

### Task 2: Mastery evidence + readiness

**Files:** Modify `public/assets/mastery.js`, `scripts/check-mastery.js`.

- [ ] Extend `check-mastery.js` with the spec's diagnostic and readiness cases; run → FAIL.
- [ ] `computeMastery`: diagnostic evidence (latest saved diagnostic per skill); `readiness(catalog, mastery, pathway)`; browser `studentMastery` reads `stemplus:diagnostics:v1`; export `window.STEMPlusMastery`. Pass; commit "Count diagnostic answers toward mastery and add Pathway readiness".

### Task 3: Diagnostic page + entry points

**Files:** Create `content/diagnostic.html`; Modify `public/assets/diagnostic.js` (UI), `public/assets/style.css`, the 10 Pathway pages, `content/index.html`, `components/Layout.tsx`, `content/about.html`.

- [ ] Page loads `problem-banks.js`, `problem-sets.js`, `mastery.js`, `diagnostic.js`; UI per spec (picker, intro / saved results, one-at-a-time questions, I don't know, results with readiness, coverage, course bars, Start here, save or guest note).
- [ ] Entry points and patch note; `npm test`; `npm run build`; commit "Add the Pathway diagnostic page".

### Task 4: Verify, push, verify live

- [ ] Production build checks from the spec; push; live member run; restore storage.
