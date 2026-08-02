# Category Palette System + Hover Glow — Design

## Context

STEM+ is a 100+ page static HTML/CSS/vanilla-JS site with an established warm cream/brown design-token system (`assets/style.css`: `--bg`, `--text`, `--muted`, `--border`, `--accent`, `--accent-soft`, light/dark mode variants). Two override axes already exist on top of these tokens:

- `data-tier="intro"|"advanced"` — used 1,023 times across the site, mostly on individual lesson pages.
- `data-pathway="swe"|"ai-data"|"math"|"engineering"|"algorithms"|"cloud-devops"|"general-programmer"|"ai-cbrwa"` — 8 pathway-specific accent colors, used on `.page` and individual `.toc-item` cards.

This is the first sub-project of a larger UI-revamp request. The full request also asked for a Next.js migration and a navigation restructure — those are separate, larger sub-projects (see decomposition below) and are explicitly out of scope here.

## Decomposition (for context, not built here)

1. **This spec**: category palette system + subtle hover glow (pure CSS, no framework dependency).
2. *(Future, separate spec)*: Next.js shell migration — scoped to "shell-only": real global nav/header, file-based routing, existing course pages/quizzes/sandboxes untouched, loaded inside the new shell as-is. Full rewrite of interactive subsystems (quizzes, 4 language sandboxes, worker-based project runners) was explicitly rejected as too large/risky for one project.
3. *(Folded into #2 when it happens)*: navigation/IA restructure — a persistent global nav is itself the restructure; no separate spec needed.

This spec covers #1 only, and is intentionally sequenced *before* #2: since the Next.js shell migration won't change existing page markup/content, the color tokens designed here carry over unchanged regardless of framework.

## Goals

- Give the site's 4 top-level sections — **Subject**, **Track**, **Problem Sets**, **Sandbox** (the groupings already visible on `index.html` via each `.toc-item`'s `.toc-num` label) — each a distinct, recognizable color identity.
- Improve the existing intro/advanced tier color differentiation (previously asked for as "easy/medium/hard," resolved to keep the existing 2-tier system with clearer color treatment rather than introducing a new "medium" tier, which would require reclassifying content across 1,023 existing locations — a separate, much larger project not requested here).
- Add a subtle hover/focus glow to `.toc-item` cards site-wide.
- Stay visually consistent with the site's existing muted, desaturated "editorial textbook" aesthetic — no new fonts, no new component patterns, no vibrant/SaaS-style colors.

## Non-goals

- No reclassification of intro/advanced content into a third "medium" tier.
- No changes to the 8 existing pathway colors.
- No markup/layout restructuring beyond adding a `data-category` attribute.
- No framework introduction (this stays pure CSS/HTML, per the existing site-wide constraint).

## Color architecture

A third override axis, `data-category`, is added alongside the existing `data-tier` and `data-pathway` axes, following the exact same CSS pattern (`.page[data-category="X"], .toc-item[data-category="X"] { --accent: ...; --accent-soft: ...; }` for light mode, plus `:root[data-theme="dark"]`-scoped equivalents for dark mode, matching how `data-tier`/`data-pathway` are already implemented).

**Cascade priority** (declared in this order in `style.css`, later rules win on equal specificity — same mechanism the site already relies on for tier vs. pathway): `data-category` (base/coarsest) → `data-tier` (overrides category on lesson pages) → `data-pathway` (overrides both, most specific). Rationale: a plain lesson page shows its difficulty tier (most relevant to a student mid-lesson); a pathway page shows its pathway color (most specific classification); a hub/index page with only a category shows the category color.

**The 4 category colors** — chosen to avoid hue collision with the 8 existing pathway colors, staying within the site's existing lightness/saturation range (muted jewel tones, ~35–45% lightness in light mode):

| Category | Light `--accent` | Light `--accent-soft` | Dark `--accent` | Dark `--accent-soft` |
|---|---|---|---|---|
| Subject | `#8a4f2b` (site default, no override) | `#f4e8dc` (site default) | `#e0a56f` (site default) | `#2c2419` (site default) |
| Track | `#2f4a7a` | `#dde5f2` | `#7fa3d9` | `#1f2d40` |
| Problem Sets | `#8a3355` | `#f5dde6` | `#d97fa0` | `#331420` |
| Sandbox | `#1f6b3d` | `#d9f0e0` | `#6fc98f` | `#16301f` |

Subject intentionally has no override — it's the site's core content and already owns the default accent identity, so no new rule is needed for it (only Track/Problem Sets/Sandbox get explicit `data-category` CSS rules).

## Hover / focus glow

Applied to `.toc-item` (all card links site-wide, in every category):

```css
.toc-item {
  transition: box-shadow 180ms ease, transform 180ms ease;
}
.toc-item:hover,
.toc-item:focus-visible {
  box-shadow: 0 0 0 1px var(--accent), 0 6px 24px -8px color-mix(in srgb, var(--accent) 45%, transparent);
  transform: translateY(-1px);
}
```

- Applied on both `:hover` and `:focus-visible` — keyboard users get the same feedback, not a hover-only affordance (existing site accessibility bar).
- Tinted by whichever `--accent` is active on that card (category, tier, or pathway color), so the glow automatically matches each section's identity with zero extra rules.
- Subtle: soft halo via `color-mix()`-based shadow, 1px lift, ~180ms transition — no scale/rotate, no saturated glow.

## Scope of application

`data-category` gets added to Track/Problem Sets/Sandbox only — Subject has no CSS rule (it uses the site default), so tagging Subject cards/pages would add markup with zero visual effect and is skipped:

- **`index.html`**: each `.toc-item` card gets `data-category` matching its section — the 3 Track cards (`data-category="track"`), the Problem Sets card (`data-category="problem-sets"`), the Sandbox card (`data-category="sandbox"`). The 5 Subject cards are left untouched.
- **Section hub pages**: the top-level `.page` div gets the matching `data-category` —
  - Track: `pathways.html`, `projects.html`, `applications.html`
  - Problem Sets: `problem-sets.html`, `problem-set.html`
  - Sandbox: `sandbox.html`, `python-sandbox.html`, `java-sandbox.html`, `javascript-sandbox.html`, `cpp-sandbox.html`, `pandas-sandbox.html`, `python-project.html`, `python-projects.html`, `python-sensor-project.html`, `guided-language-project.html`

This does not touch the ~1,023 existing `data-tier` locations or any course-lesson-page markup beyond adding one attribute to hub-level pages listed above.

## Testing

No test framework applies to static CSS/markup changes. Verification is visual: load `index.html` and one hub page per category in a browser (light and dark mode) and confirm each section's cards show a distinct, correctly-paired accent/accent-soft combination, and that hover/focus glow appears correctly tinted on cards in each category, tier, and pathway context. No automated check is meaningful here — this follows the project's existing pattern of visual-only verification for pure CSS changes.
