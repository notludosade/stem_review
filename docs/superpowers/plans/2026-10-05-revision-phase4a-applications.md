# Revision Phase 4a Applications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applications show the concepts they use (with mastery for signed-in students), record completion, and make their skills Applied.

**Architecture:** Hand table in the catalog generator → `applications` in the catalog; `mastery.js` gains application evidence plus two mounts (Application page, hub).

**Tech Stack:** Node checks, plain browser JS, static HTML.

**Spec:** `docs/superpowers/specs/2026-10-05-revision-phase4a-applications-design.md`

## Global Constraints

- Completion only when every `[data-quiz]` is answered with no `.is-incorrect`; saved only when `canSave()`.
- Skill IDs unchanged; stage only own files.

---

### Task 1: Catalog `applications`
- [ ] Catalog check (every Applications page listed, skills exist, titles non-empty) → FAIL; generator `APPLICATION_SKILLS` + `applications`; regenerate; pass; commit.

### Task 2: Applied via Applications
- [ ] `check-mastery.js` cases → FAIL; `computeMastery` reads `completedApplications`; pass; commit.

### Task 3: Pages
- [ ] Mount + script on 9 Application pages; script on `applications.html`; `mastery.js` concepts box, completion listener, hub chips; `studentEvidence` reads `stemplus:applications:v1`; CSS; `npm test`; build; commit.

### Task 4: Verify, push, verify live
- [ ] Spec Testing browser checks (port 3100); push; live; restore storage.
