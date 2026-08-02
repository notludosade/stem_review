# Next.js Shell Migration — Phase A — Design

## Context

STEM+ is a 100+ page static HTML/CSS/vanilla-JS site (no build step until an `/api` directory was added for email+password auth — the frontend has never had one). There is no persistent navigation today: every page is a standalone HTML fragment (not even wrapped in `<html>`/`<body>` — browsers auto-imply those) with just a per-page `.kicker`/`h1`/`.subtitle` header, styled by a shared `assets/style.css` design-token system (CSS custom properties: `--bg`, `--text`, `--muted`, `--border`, `--accent`, `--accent-soft`, `--code-bg`, `--correct`, `--incorrect`, light/dark mode via `prefers-color-scheme` + a `data-theme` override).

This is the first sub-project of a larger, previously-decomposed UI revamp:
1. Category palette + hover glow — done, merged.
2. **Next.js shell migration** — this spec, split into Phase A (this one: prove the technique on one page) and Phase B (roll out to all 100+ pages, a separate future spec).
3. Nav restructure — folded into #2, since a persistent global nav *is* the shell.

The decision to migrate to Next.js at all, and to do it "shell-only" (existing course content, quizzes, and the ~15 hand-built interactive subsystems — 4 language sandboxes with a custom code editor and syntax highlighter, a quiz engine, a test engine, worker-thread-based project runners — stay as their existing static HTML/vanilla JS, unrewritten) rather than a full React rewrite, was made in an earlier brainstorming session and is not revisited here.

## Goals (Phase A)

- Prove, end to end, that an existing static page can be served through a real Next.js app with a persistent nav/header shell wrapped around its *unchanged* HTML/CSS/JS.
- Migrate the existing `api/*.js` auth endpoints (signup/login/logout/me) to Next.js API routes with no logic changes.
- Establish the styling approach for the shell (Tailwind + shadcn, themed to match the site's existing palette) without touching how any existing content page is styled.
- Deploy the result on Vercel and confirm it actually works in production.

## Non-goals (Phase A)

- Migrating any page other than `index.html`.
- Full nav content (mega-menus for the 5 Subject / 3 Track items) — Phase A's nav is functional but minimal: logo, the 4 top-level section links, auth status.
- Rewriting any sandbox/quiz/test/project JS subsystem.
- Changing the auth endpoints' behavior, request/response shape, or session model — this is a mechanical relocation.

## Approach: serving existing pages through the shell

Two ways to get a static page inside a Next.js-rendered shell without rewriting the page itself:

**Rejected: `<iframe>` per page.** Nav lives in the Next.js "outside," the original page loads unchanged "inside" an iframe. Sidesteps script-execution concerns entirely, but creates a permanently separate document: harder deep-linking to in-page anchors from outside the frame, nested scroll containers, SEO/indexing complications, and it reads as a static site bolted onto a shell rather than genuine integration.

**Chosen: catch-all route with server-side content extraction + client-side script re-execution.** A `pages/[...slug].tsx` catch-all route uses `getStaticProps`/`getStaticPaths` to read the matching file from a relocated `content/` directory (existing `.html` files can't stay at repo root — Next.js needs that space for `pages/`/`public/`), strips the leading `<meta>`/`<link>` tags (Next's own `<Head>` owns those instead), and passes the remaining `<div class="page">...</div>` body through as a prop. A client component renders that body via `dangerouslySetInnerHTML` inside the shared `<Layout>`, then in a `useEffect` finds any `<script>` tags in the injected content and manually re-creates + appends them as real DOM script elements — the standard, well-known workaround for the fact that scripts inserted via `innerHTML` don't execute automatically. Each page's own `<link rel="stylesheet" href="assets/style.css">` keeps loading normally (via the extracted `<head>` content Next's `<Head>` renders), so `index.html` looks exactly as it does today, just now wrapped in a persistent nav.

## Styling

Tailwind + shadcn for the shell (`<Layout>`, nav, header) only — this was an explicit user choice over the alternative (styling the shell in the site's existing plain-CSS token system), made after the trade-off (a second parallel styling system, new dependency, new build-time CSS processing, vs. one consistent design language) was surfaced. Tailwind's theme config gets the *existing* palette values (`--accent`, `--bg`, `--muted`, `--border`, etc., both light and dark) rather than Tailwind's defaults, so the new shell chrome is visually consistent with every page it wraps, even though the two live in different styling systems. shadcn's own theming is CSS-variable-based, which composes reasonably with what already exists — exact variable-naming/mapping is a plan-level detail, not a design-level one.

Existing content pages are completely unaffected: Tailwind utility classes appear only in the new `Layout`/nav component's own JSX, never in the injected legacy HTML.

## Language

All new Next.js files (`.tsx`/`.ts`) are TypeScript — an explicit choice, not a default. Nothing else in this codebase uses TypeScript (the 100+ HTML pages, every `assets/*.js` file, the existing `api/*.js` auth functions are all plain JS), so this does introduce a second convention alongside the untouched legacy code. Chosen anyway because shadcn's CLI and generated components are TypeScript-first, and it's the ecosystem default for new Next.js work — consistent with treating the shell as a deliberately more "modern stack" layer distinct from the legacy content it wraps. `tsconfig.json` is scoped to what Next.js needs (its own `create-next-app`-equivalent defaults); nothing under `content/`, `assets/`, or `scripts/` is affected or type-checked.

## Components

- `pages/_app.tsx` — global wrapper (Tailwind CSS import, wraps every page in `<Layout>`).
- `pages/[[...slug]].tsx` — the catch-all (double-bracket, so it also matches the root `/` with an empty slug array, rather than needing a separate hand-written `pages/index.tsx`). Handling `/` through the same general mechanism as every other page is the point of Phase A — a special-cased homepage would prove less.
- `components/Layout.tsx` — the persistent shell: logo/home link, the 4 top-level section links (Subjects, Tracks, Problem Sets, Sandbox), auth status (replacing today's per-page `.auth-slot` JS injection with shell-level state).
- `lib/content.ts` (or similar) — pure function: given a file path in `content/`, returns `{ head: string, body: string }` (extracted `<head>`-worthy tags vs. the page body) — this is the one piece of Phase A logic that's headlessly testable.
- `components/LegacyContent.tsx` — client component: `dangerouslySetInnerHTML` for the body, `useEffect` script re-execution.
- `pages/api/{signup,login,logout,me}.js` — relocated from `api/auth/*.js` / `api/me.js`, logic unchanged.
- `content/index.html` — the existing homepage, moved (not rewritten) from repo root.

## Testing

No framework fits "does the shell render correctly in a browser" — consistent with every other feature built this session, that needs the user's own eyes; there is no display or headless browser in this environment. What *is* testable headlessly, following this project's existing plain-assert-script convention (`scripts/check-*.js`): the content-extraction function (given a known HTML fragment, correctly splits head-worthy tags from body) and the script-detection logic the re-execution `useEffect` relies on (given an HTML string, correctly identifies `<script>` tags and their `src`/inline content) — both pure functions, both testable without a DOM.

## Deployment

Vercel already hosts this project (`stem-review`) and auto-detects Next.js — this changes the project from zero-config static+serverless-functions to a real `next build`, which is exactly what Vercel's Next.js integration is built for. `DATABASE_URL`/`SESSION_SECRET` env vars (already set on Vercel from the auth feature) carry over unchanged since `pages/api/*.js` reads `process.env` identically to today's `api/*.js`.
