# STEM Lite + Desmos implementation plan

## Goal

Ship a separate, public **STEM Lite** static site from the existing STEM+ curriculum, and add reusable Desmos scientific/graphing calculators to both products. Lite must work on GitHub Pages under a project subpath and must not require accounts, APIs, databases, or server rendering.

## Audit findings

- Curriculum is already source-controlled as about 1,500 HTML fragments in `content/`; duplicating it would create two drifting curricula.
- Full STEM+ wraps those fragments in a Next.js shell and adds account, reporting, review-status, mastery, and AI-grading services. Those shell/API features are not GitHub Pages compatible.
- Most lessons are independently static-safe: relative links, `assets/style.css`, `interactive.js`, and `quiz.js` work without a backend.
- Problem sets are browser-only and can run statically from `problem-banks.js` + `problem-sets.js`; saved progress is optional and can be disabled in Lite.
- Application AI grading (`frq.js`), course/project gates (`tests.js`), mastery, account UI, and reporting must not ship in Lite.
- Official Desmos API v1.11 requires an API key in its script URL. Scientific Calculator access must be enabled separately for that key. The default calculator controls preserve Desmos accessibility features, so the integration will leave those controls enabled.

## Architecture

### One curriculum, two builds

`scripts/build-stem-lite.js` will generate `dist-lite/` from the authoritative `content/` and `public/assets/` trees. No lesson copy becomes a second editable source.

The generator will:

1. Select the initial Lite course/application/project/practice allowlist.
2. copy and rename selected fragments as complete HTML documents;
3. inject a small, accessible Lite header/footer and static global search;
4. omit account, mastery, test-gate, AI-grading, and reporting scripts;
5. make project briefs visible and label reflections as unsaved;
6. keep every internal URL relative so GitHub project-subdirectory hosting works;
7. copy only the shared browser assets those pages need.

`lib/global-search.js` remains the shared search implementation. It will expose the same API to CommonJS and the browser; the Lite build writes a generated catalog and uses the existing ranking, typo correction, aliases, and categorized results.

### Desmos

`public/assets/desmos.js` will be the single integration layer for both products. A page declares a calculator with `data-desmos="graphing"` or `data-desmos="scientific"`, optional JSON expressions, and a text fallback. The loader:

- reads a public client key from `<meta name="desmos-api-key">`;
- loads the official versioned HTTPS API once;
- checks `Desmos.enabledFeatures` before construction;
- keeps the settings/accessibility controls enabled;
- applies optional graph presets; and
- shows a useful standalone-calculator link if the key, feature, or network is unavailable.

The public key is supplied at build time through `NEXT_PUBLIC_DESMOS_API_KEY` for STEM+ or `DESMOS_API_KEY` for Lite; no credential is committed. The key is necessarily visible to browsers and must be a Desmos-issued client key, never a private server secret.

## Initial Lite release

- Math: Algebra/Geometry Fundamentals Review, Precalculus, AP Calculus BC, Linear Algebra A
- Science: AP Physics 1, AP Physics C: Mechanics
- Computing: Computer Programming 1, Computer Programming 2
- Practice: static banks for the selected courses that already have banks
- Applications: satellite orbit, roller coaster safety, GPS routing, recommendation engines
- Projects: Mathematics, Engineering & Physics, Software Engineer, AI & Data capstones
- Tools: scientific and graphing calculators

## Implementation order

1. Add the shared Desmos loader, calculator hub/pages, navigation/search entries, and one AP Calculus lesson preset.
2. Add the Lite generator, static shell/search behavior, CSS, and public-content transformations.
3. Add a GitHub Pages workflow that builds and uploads `dist-lite/`.
4. Add checks for output completeness, forbidden backend references, relative-link integrity, naming, and calculator fallback.
5. Run the focused checks, full test suite, full STEM+ build, and a Lite build with a project-style base path.

## Explicit non-goals

- No Lite accounts, cross-device progress, mastery dashboard, AI grading, or backend.
- No curriculum fork and no new framework/dependency.
- No undocumented Desmos key, self-hosted Desmos bundle, or hidden private credential.
