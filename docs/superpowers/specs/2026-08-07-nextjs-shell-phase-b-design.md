# Next.js Shell Migration — Phase B — Design

## Context

Phase A (merged 2026-08-03) proved the shell-wrapping technique on exactly one page: `content/index.html`, the homepage. Every other page — now roughly **1,500 HTML files** (course lessons, unit tests, course exams, glossaries, progress reports, sandboxes, pathways, projects, problem sets, hub pages, auth pages) — still lives under `public/` as flat static files, served with no persistent nav and no shell.

Phase A's own spec explicitly deferred this: "Phase B (roll out to all 100+ pages, a separate future spec)." The page count has grown substantially since (four courses finished, four built from scratch) but the mechanism Phase A validated — catch-all route reads a file from `content/`, strips/extracts `<script>` tags, `LegacyContent` re-creates them client-side inside `<Layout>` — is unchanged and, per this design, needs only one structural extension (recursion) plus one compatibility fix to scale to the whole site.

Phase A shipped with two real production incidents (Vercel framework preset stuck on "Other"; a duplicate-execution bug from `auth.js` firing via both native parse and the deliberate re-creation) — both caught only by looking at the deployed site with real eyes, not by code review. Phase B is ~15x the page count and spans much more varied JS, so the rollout plan here is built around catching problems in production early and cheaply, not around avoiding all risk in one perfect shot (not realistic at this scale).

## Goals

- Migrate every remaining page from `public/` to `content/` so it renders through the persistent shell (`<Layout>`), matching the homepage.
- Preserve every page's URL exactly (same path, same nesting) — this is what keeps every existing relative link (`../assets/style.css`, `../Unit%202/...`, `../reference/glossary.html`, etc.) working with zero content rewriting.
- Fix a genuine site-breaking bug in the shared `quiz.js`/`tests.js` scripts (below) before any content page migrates, since the bug would otherwise silently disable every quiz and every test on every migrated page.
- Ship in three ordered waves with independent production checkpoints, so a problem in one wave never risks work already verified in an earlier wave.
- Fix the 7 `scripts/check-*.js` regression scripts already broken by Phase A's `index.html` relocation (tracked as known debt), timed to land alongside Wave 3 since that's when their subsystems get touched again anyway.

## Non-goals

- Rewriting any interactive subsystem (sandboxes, code editor, quiz/test engine, worker-based project runners) into React. Everything stays exactly the vanilla-JS/HTML it is today — Phase B only changes *where* the file lives and *how* it's routed, never its contents.
- Any URL restructuring, redesign, or content changes. This is a mechanical relocation (`git mv`), not a rewrite.
- Full automated end-to-end test coverage. This codebase has no browser-automation framework and none is being introduced (matches every prior feature on this site) — verification is real-browser-driven per wave, either against a local `next start` or against the deployed preview.

## The critical prerequisite: `DOMContentLoaded` in `quiz.js` and `tests.js`

Both files gate their *entire* logic behind a single top-level call:

```js
document.addEventListener('DOMContentLoaded', () => { /* everything */ });
```

`DOMContentLoaded` fires exactly once, when the browser finishes parsing the *initial* document. `LegacyContent`'s `useEffect` (which re-creates `<script>` tags client-side) runs after React commits — which is after hydration, which is after the initial parse, which is after `DOMContentLoaded` has already fired and gone. Registering a listener for an event that already fired means the callback never runs. On every migrated lesson, quiz, unit test, course exam, and progress report, this means: no error, no console warning — the quiz buttons and test-submit logic would just silently do nothing.

Phase A never exercised this because its only script, `auth.js`, is a self-running IIFE with no such gate. Grepped every file in `public/assets/` for `DOMContentLoaded` and `window.onload`: only `quiz.js` and `tests.js` use this pattern; nothing else needs this fix.

**Fix** (standard, backward-compatible):

```js
function init() { /* existing logic, unchanged */ }
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

On a still-unmigrated static page, `readyState` is `'loading'` when this script parses (normal case), so behavior is identical to today. On a migrated page, the DOM is already fully present (inserted via `dangerouslySetInnerHTML` before `LegacyContent`'s `useEffect` runs), so `init()` just runs immediately — exactly the semantics both contexts need. This must ship and be verified *before* Wave 1, since Wave 1 depends on it.

## Architecture change: recursive content routing

`pages/[[...slug]].tsx`'s `getStaticPaths` currently does:

```js
const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.html'));
```

— flat, top-level only. It needs to recursively walk `content/` and generate one `params.slug` array per nested `.html` file (e.g. `content/Math/Precalculus/Unit 1/0001-....html` → `slug: ['Math', 'Precalculus', 'Unit 1', '0001-....html']`).

`getStaticProps` needs **no change** — it already does `slugParts.join('/')` to reconstruct a path and read the file, which works correctly for any nesting depth once `getStaticPaths` supplies the right slug arrays.

Because `public/assets/` stays exactly where it is (top-level, never moves) and every migrated page's route depth will exactly match its original file depth, every relative link already in every page's HTML continues resolving correctly with **zero content changes** — confirmed by tracing how relative URLs resolve against the current document URL, which is unaffected by whether that URL is served from a literal static file or a Next.js dynamic route.

## Rollout: three waves

**Wave 0 — prerequisite (ships alone, before any page moves):**
1. Apply the `readyState` fix to `quiz.js` and `tests.js`.
2. Generalize `getStaticPaths` to recurse `content/`.
3. Manually move 1-2 sample lesson files into `content/` locally, run `next build && next start`, and verify in a real browser (via the raw-CDP approach already established for this environment — see the `env-headless-browser-testing` pattern) that a quiz answers correctly and a unit test submits and grades correctly. Do not proceed to Wave 1 until this passes.

**Wave 1 — canary: Math subject.** 8 courses (Algebra/Geometry Fundamentals Review, AP Calculus BC, Precalculus, Discrete Math, Mathematical Proofs, Linear Algebra A, Multivariable Calculus, Differential Equations), 229 lessons, plus `math.html`. Chosen as the canary because it's the largest homogeneous non-interactive subject — no sandboxes, no auth-gating beyond the site nav — the cleanest stress test of the recursive routing and the `DOMContentLoaded` fix across real course-depth nesting. `git mv` each course directory from `public/<Course>` to `content/<Course>`, one commit, deploy, then verify in production: load several lessons at different unit depths, answer a quiz, submit a unit test, check a course-exam gate, check browser console for errors or duplicate execution.

**Wave 2 — remaining low-risk pages (~1,220 pages).** The other 4 subjects (Technology & Computer Science, Science, Engineering & Physics, Advanced+), Pathways/Projects/Applications, Problem Sets, and the remaining root pages (`login.html`, `developer.html`, `sandbox.html` hub, the 5 subject hub pages). None of these depend on anything beyond what Wave 0 already fixed. Can ship as one commit/deploy given Wave 1 already validated the mechanism at scale; spot-check a sample from each subject plus the gated pages (a Project page's course-exam gate, a Pathway's route-lock) in production after deploy.

**Wave 3 — interactive subsystems (~9 pages), last.** `python-sandbox.html`, `java-sandbox.html`, `javascript-sandbox.html`, `cpp-sandbox.html`, `pandas-sandbox.html`, `python-project.html`, `python-projects.html`, `python-sensor-project.html`, `guided-language-project.html`. These use Web Workers and the most complex stateful DOM/lifecycle assumptions (code editor, syntax highlighting, worker message-passing) — highest chance of a repeat of Phase A's double-execution class of bug. Verify by actually *running code* in each sandbox post-migration (not just loading the page and looking at it). Bundle in the fix for `scripts/check-java-sandbox.js`, `check-javascript-cpp-sandboxes.js`, `check-pandas-sandbox.js`, `check-python-project.js`, `check-python-sandbox.js`, `check-guided-language-projects.js`, and `check-problem-banks.js` (all currently `ENOENT` on a hardcoded root-level `index.html` path from before Phase A moved it to `content/index.html`) — point them at the new location, since this wave is exactly when these subsystems' pages get touched again.

## Error handling / rollback

Each wave is its own commit and its own push — never squashed together — so a bad wave reverts independently (via `git revert` or Vercel's instant rollback to the previous deployment) without touching or re-risking an already-verified earlier wave.

## Testing

No browser-automation framework exists or is being introduced (consistent with every prior feature on this site). Verification is real-browser-driven, per wave, using the raw-CDP approach already established for this sandboxed dev environment (headless Chrome + CDP over `fetch`/`WebSocket`, no Playwright): load a representative sample of migrated pages, exercise their actual interactivity (answer a quiz, submit a test, run sandbox code), and check the browser console for errors. Wave 0's local check and each wave's post-deploy production check are both required steps, not optional — this is what would have caught both of Phase A's incidents.

## Deployment

Unchanged from Phase A: Vercel auto-deploys on push to `main`. `vercel.json`'s `{"framework": "nextjs"}` override (added to fix Phase A's incident) already handles the dashboard Framework Preset issue for all future deploys, so that specific failure mode shouldn't recur.
