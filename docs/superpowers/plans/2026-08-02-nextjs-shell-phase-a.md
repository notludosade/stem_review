# Next.js Shell Migration Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the shell-only Next.js migration technique end-to-end on one page (`index.html`): a persistent nav/header shell (Next.js + TypeScript + Tailwind v4 + shadcn) wraps the existing static homepage, unrewritten, served through a catch-all route; the existing auth API routes move over unchanged.

**Architecture:** Next.js (Pages Router) added to the existing repo alongside its current static-file structure. A catch-all route (`pages/[[...slug]].tsx`) reads the matching file from a relocated `content/` directory at build time, extracts its title and body, and renders it inside a shared `<Layout>` (Tailwind + shadcn, themed to the site's existing warm palette) via a client component that re-executes any embedded `<script>` tags (which don't run automatically when inserted via `dangerouslySetInnerHTML`). `api/*.js` moves to `pages/api/*.js` with only import-path depth changes — same `(req,res)` signature, same logic.

**Tech Stack:** Next.js 16 (Pages Router), TypeScript, Tailwind CSS v4, shadcn/ui. No App Router, no `next-themes` (the site has no live dark-mode toggle today — see Task 2 — so none is added here either; dark mode follows `prefers-color-scheme` only, exactly like every existing page).

## Global Constraints

- Pages Router only, not App Router — `pages/api/*.js` keeps the exact `(req,res)` signature the existing `api/*.js` auth functions already use; App Router's Web Request/Response API would require rewriting them for no benefit here.
- TypeScript for new page/component code (`.tsx`/`.ts` under `pages/`, `components/`) — explicit choice, not default; nothing else in this repo uses TypeScript. Exception: `lib/content.js`/`lib/scripts.js` (Task 4) are plain JS, matching the existing `lib/db.js`/`lib/session.js`/`lib/password.js` convention (Node-testable via plain `node scripts/check-*.js`, no `ts-node`-style dependency needed) — `tsconfig.json`'s `allowJs: true` lets TypeScript code import them with no friction. Nothing under `content/`, `public/assets/`, or `scripts/` is type-checked.
- Tailwind + shadcn styling applies only to new shell components (`Layout`, nav). Existing content pages keep using `assets/style.css` unchanged — never mix Tailwind classes into injected legacy HTML.
- The shell's color tokens must match the site's existing palette (`assets/style.css`'s `:root` block: `--bg: #fdfcf9`/`#17150f`, `--text: #1c1a17`/`#e9e5da`, `--muted: #6b675f`/`#a39d8e`, `--border: #e2ddd2`/`#3a362c`, `--accent: #8a4f2b`/`#e0a56f`), not Tailwind/shadcn defaults.
- No `next-themes`, no dark-mode toggle UI — out of scope (none exists anywhere on the site today; see Task 2).
- `api/*.js` migration is a mechanical relocation — logic, request/response shape, and session behavior must not change.
- `npm test` (the existing `check-auth-session.js`/`check-password.js` checks) must keep passing throughout.
- No visual/browser verification is possible in this environment (no display, no headless browser) — `next build` (which runs the TypeScript compiler and, for this catch-all route, actually executes `getStaticProps`/`getStaticPaths` against the real `content/index.html`) is the strongest automated signal available; anything purely visual is a note for the user's own browser check.

---

### Task 1: Next.js + TypeScript scaffold, relocate static assets into `public/`

**Files:**
- Modify: `package.json` (add `next`, `react`, `react-dom` deps; add `dev`/`build`/`start` scripts)
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `pages/_app.tsx`
- Create: `pages/index.tsx` (temporary placeholder — replaced by the catch-all route in Task 6)
- Move: `assets/` → `public/assets/`
- Move: `favicon.ico` → `public/favicon.ico`

**Interfaces:**
- Produces: a working `next build`/`next dev` setup. `public/assets/*` and `public/favicon.ico` are served at the exact same URL paths (`/assets/*`, `/favicon.ico`) every existing page's relative references already expect — this relocation has to happen once, now, so it benefits every page migrated in this task and in the future Phase B, not just this one.

- [ ] **Step 1: Install Next.js, React, and TypeScript**

```bash
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/react @types/node @types/react-dom
```

- [ ] **Step 2: Add build scripts to package.json**

In `package.json`, replace the `"scripts"` block:

```json
  "scripts": {
    "test": "node scripts/check-auth-session.js && node scripts/check-password.js"
  },
```

with:

```json
  "scripts": {
    "test": "node scripts/check-auth-session.js && node scripts/check-password.js",
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "content", "assets", "scripts"]
}
```

- [ ] **Step 4: Write next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
```

- [ ] **Step 5: Move static assets into `public/`**

```bash
git mv assets public/assets
git mv favicon.ico public/favicon.ico
```

- [ ] **Step 6: Write a placeholder `_app.tsx`**

```tsx
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

- [ ] **Step 7: Write a temporary placeholder home page**

This gets replaced by the real catch-all route in Task 6 — it exists now only to give `next build` something to build, proving the scaffold works before any of the content-extraction logic exists.

```tsx
export default function Home() {
  return <p>STEM+ shell scaffold — placeholder, replaced in Task 6.</p>;
}
```

- [ ] **Step 8: Verify the scaffold builds**

```bash
npx next build
```

Expected: build succeeds (`Compiled successfully`), produces a `.next/` directory, no TypeScript errors.

- [ ] **Step 9: Add `.next/` to `.gitignore`**

Check the current `.gitignore` — it already has `node_modules` from the earlier auth feature. Add `.next/` as a new line if not already present:

```bash
grep -qxF '.next/' .gitignore || echo '.next/' >> .gitignore
```

- [ ] **Step 10: Verify existing tests still pass and commit**

```bash
npm test
git add package.json package-lock.json tsconfig.json next.config.js pages/_app.tsx pages/index.tsx public/assets public/favicon.ico .gitignore
git rm -r --cached assets favicon.ico 2>/dev/null || true
git commit -m "Scaffold Next.js + TypeScript, relocate static assets into public/"
```

---

### Task 2: Tailwind v4 setup with the existing warm palette

**Files:**
- Create: `postcss.config.mjs`
- Create: `styles/globals.css`
- Modify: `pages/_app.tsx:1-2` (import the new stylesheet)

**Interfaces:**
- Produces: Tailwind utility classes available in every component under `pages/`/`components/`, plus a duplicated (small, deliberate) copy of `assets/style.css`'s base `:root` color tokens, referenced by name (`var(--bg)` etc.) from Tailwind's `@theme` block — not Tailwind's own default color palette.

The site has no live dark-mode *toggle* anywhere today — `assets/style.css` has `:root[data-theme="dark"]`/`:root[data-theme="light"]` CSS rules, but nothing in any `assets/*.js` file ever sets a `data-theme` attribute (confirmed by grep — this is dormant/unused infrastructure, not a working feature). The only mechanism that actually functions today is the `@media (prefers-color-scheme: dark)` block. This task's `globals.css` mirrors that same pattern (default light values, a `prefers-color-scheme` override, and the same dormant `data-theme` selectors for consistency/future-proofing) — not because a toggle exists, but so nothing here has to change later if one gets built.

- [ ] **Step 1: Install Tailwind v4**

```bash
npm install -D tailwindcss @tailwindcss/postcss
```

- [ ] **Step 2: Write postcss.config.mjs**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 3: Write styles/globals.css**

These are the exact same values as `public/assets/style.css:3-60` (the site's base `:root` block, not the per-tier/per-category/per-pathway overrides, which are content-page-specific and irrelevant to the shell). Comment makes the duplication and its reason explicit:

```css
@import "tailwindcss";

/* Mirrors the base :root color tokens in public/assets/style.css (lines 3-60).
   Deliberately duplicated rather than imported — this file is a small, stable
   set of base tokens; the shell doesn't need style.css's hundreds of lines of
   content-page rules. Keep these values in sync if the base palette changes. */
:root {
  --bg: #fdfcf9;
  --text: #1c1a17;
  --muted: #6b675f;
  --border: #e2ddd2;
  --accent: #8a4f2b;
  --accent-soft: #f4e8dc;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17150f;
    --text: #e9e5da;
    --muted: #a39d8e;
    --border: #3a362c;
    --accent: #e0a56f;
    --accent-soft: #2c2419;
  }
}

:root[data-theme="dark"] {
  --bg: #17150f;
  --text: #e9e5da;
  --muted: #a39d8e;
  --border: #3a362c;
  --accent: #e0a56f;
  --accent-soft: #2c2419;
}

:root[data-theme="light"] {
  --bg: #fdfcf9;
  --text: #1c1a17;
  --muted: #6b675f;
  --border: #e2ddd2;
  --accent: #8a4f2b;
  --accent-soft: #f4e8dc;
}

@theme {
  --color-bg: var(--bg);
  --color-text: var(--text);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
}
```

- [ ] **Step 4: Import the stylesheet in `_app.tsx`**

Replace:

```tsx
import type { AppProps } from 'next/app';
```

with:

```tsx
import '../styles/globals.css';
import type { AppProps } from 'next/app';
```

- [ ] **Step 5: Verify the build**

```bash
npx next build
```

Expected: succeeds, no errors about the CSS import.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json postcss.config.mjs styles/globals.css pages/_app.tsx
git commit -m "Add Tailwind v4, themed to the site's existing warm palette"
```

---

### Task 3: shadcn/ui init, recolored to the warm palette

**Files:**
- Create: `components.json`
- Create: `lib/utils.ts`
- Modify: `styles/globals.css` (shadcn adds its own CSS variable block — this task recolors the values it generates)
- Modify: `tsconfig.json:already has the `@/*` alias from Task 1 — verify, don't re-add`

**Interfaces:**
- Produces: `lib/utils.ts` exports `cn(...)` (shadcn's standard class-merging helper — `clsx` + `tailwind-merge`), used by every shadcn component and by `Layout.tsx` in Task 5.

`shadcn init` auto-detects the framework from files already in place (Next.js + Tailwind + `pages/` directory all exist after Tasks 1-2), auto-installs its own dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, plus whichever Radix UI packages the components added in this task need), and generates its own `--background`/`--foreground`/`--primary`/etc. CSS variable block appended to `styles/globals.css` with a neutral gray default palette. Step 2 below re-colors those generated values to the site's palette — same names (so every shadcn component's `bg-background`/`text-foreground`/etc. classes keep working unchanged), different values.

- [ ] **Step 1: Run shadcn init non-interactively**

```bash
npx shadcn@latest init -d
```

Expected: creates `components.json`, creates `lib/utils.ts`, appends a shadcn CSS variable block to `styles/globals.css`, adds shadcn's dependencies to `package.json`.

- [ ] **Step 2: Verify and fix components.json for Pages Router**

Open `components.json`. shadcn's Next.js preset may set `"rsc": true` (React Server Components) by default — Pages Router has no RSC support, so this must be `false`. Check the file; if it reads `"rsc": true`, change it to `"rsc": false`. Every other field (`style`, `tailwind`, `aliases`) should already be correct from auto-detection — don't change anything else.

- [ ] **Step 3: Recolor the generated CSS variables**

Open `styles/globals.css`. shadcn's `init` appended a new block (after the block from Task 2) containing `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--border`, etc., inside a `:root { ... }` rule and a dark-mode variant. Replace the neutral/gray hex values in that generated block with the site's palette, reusing the CSS variables already defined in Task 2's `:root` block (`var(--bg)`, `var(--text)`, `var(--muted)`, `var(--border)`, `var(--accent)`, `var(--accent-soft)`) instead of new hardcoded hex values — this keeps one single source of truth for the actual color values:

- `--background` → `var(--bg)`
- `--foreground` → `var(--text)`
- `--muted` → `var(--accent-soft)`, `--muted-foreground` → `var(--muted)`
- `--accent` → `var(--accent-soft)`, `--accent-foreground` → `var(--text)`
- `--primary` → `var(--accent)`, `--primary-foreground` → `var(--bg)`
- `--border`, `--input` → `var(--border)`
- `--card`, `--popover` → `var(--bg)`; `--card-foreground`, `--popover-foreground` → `var(--text)`

If shadcn generated a separate dark-mode block (e.g. under a `.dark` class selector), delete that selector entirely — dark mode here is driven by Task 2's `prefers-color-scheme`/`data-theme` blocks on the underlying `--bg`/`--text`/etc. variables, which these shadcn variables now reference by `var(...)`, so they automatically pick up the correct value in dark mode with no separate `.dark`-scoped block needed.

- [ ] **Step 4: Verify the build**

```bash
npx next build
```

Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add components.json lib/utils.ts styles/globals.css package.json package-lock.json
git commit -m "Init shadcn/ui, recolored to the site's existing palette"
```

---

### Task 4: Content extraction + script re-execution (pure, testable logic)

**Files:**
- Create: `lib/content.js`
- Create: `lib/scripts.js`
- Test: `scripts/check-content.js`

**Interfaces:**
- Produces: `lib/content.js` exports `splitHtmlFragment(html)` returning `{ title, body }`. Every existing page file starts with a handful of head-worthy tags (`<meta>`, `<link>`, `<title>`) followed immediately by the page's `<div class="page">...</div>` body (confirmed against the real file — `index.html` lines 1-4 are head tags, line 5 onward is the body) — `splitHtmlFragment` finds the first `<div` and splits there, and regex-extracts the `<title>...</title>` text from the portion before it (falling back to `'STEM+'` if no title tag is found).
- Produces: `lib/scripts.js` exports `extractScripts(html)` returning an array of `{ src, content }` — finds every `<script ...>...</script>` tag in an HTML string and returns its `src` attribute (or `null` if none) and inline text content (or `null` if it's an external script). Regex-based, not DOM-based, so it's testable in plain Node without a browser.

These are plain JavaScript, not TypeScript, deliberately breaking from this plan's "TypeScript for new Next.js files" default — they're general-purpose utility modules in the same category as the existing `lib/db.js`/`lib/session.js`/`lib/password.js` (all plain JS, all tested via plain `node scripts/check-*.js`), not Next.js-specific page/component code. Keeping them JS avoids adding a `ts-node`-style dependency just to make a Node test script load a `.ts` file, and `tsconfig.json`'s `allowJs: true` (Task 1) already lets the TypeScript-based catch-all route (Task 6) `import` them with no friction.

- [ ] **Step 1: Write the failing test**

```js
'use strict';

const assert = require('assert');
const { splitHtmlFragment } = require('../lib/content');
const { extractScripts } = require('../lib/scripts');

const { title, body } = splitHtmlFragment(
  '<meta charset="UTF-8">\n<title>Example — STEM+</title>\n<div class="page">\n  <h1>Example</h1>\n</div>\n'
);
assert.strictEqual(title, 'Example — STEM+', 'should extract the title text');
assert.ok(body.startsWith('<div class="page">'), 'body should start at the first <div');
assert.ok(!body.includes('<meta'), 'body should not include head tags');

const { title: fallbackTitle } = splitHtmlFragment('<div class="page"><h1>No title tag</h1></div>');
assert.strictEqual(fallbackTitle, 'STEM+', 'should fall back to STEM+ when no <title> tag is present');

const scripts = extractScripts(
  '<div class="page"><script src="assets/foo.js" defer></script><script>console.log("inline");</script></div>'
);
assert.strictEqual(scripts.length, 2, 'should find both script tags');
assert.strictEqual(scripts[0].src, 'assets/foo.js', 'first script should have the src attribute');
assert.strictEqual(scripts[0].content, null, 'external script should have no inline content');
assert.strictEqual(scripts[1].src, null, 'inline script should have no src');
assert.strictEqual(scripts[1].content, 'console.log("inline");', 'inline script content should be captured');

console.log('check-content: OK');
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
node scripts/check-content.js
```

Expected: fails — `Cannot find module '../lib/content'`.

- [ ] **Step 3: Write the implementation**

`lib/content.js`:
```js
function splitHtmlFragment(html) {
  const divIndex = html.indexOf('<div');
  const head = divIndex === -1 ? html : html.slice(0, divIndex);
  const body = divIndex === -1 ? html : html.slice(divIndex);
  const titleMatch = head.match(/<title>([\s\S]*?)<\/title>/);
  const title = titleMatch ? titleMatch[1] : 'STEM+';
  return { title, body };
}

module.exports = { splitHtmlFragment };
```

`lib/scripts.js`:
```js
function extractScripts(html) {
  const scripts = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    const attrs = match[1];
    const inner = match[2].trim();
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/);
    scripts.push({
      src: srcMatch ? srcMatch[1] : null,
      content: srcMatch ? null : inner || null,
    });
  }
  return scripts;
}

module.exports = { extractScripts };
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
node scripts/check-content.js
```

Expected: `check-content: OK`

- [ ] **Step 5: Add this check to the npm test script**

In `package.json`, update `"test"`:

```json
    "test": "node scripts/check-auth-session.js && node scripts/check-password.js && node scripts/check-content.js",
```

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```

Expected: all three checks pass.

- [ ] **Step 7: Commit**

```bash
git add lib/content.js lib/scripts.js scripts/check-content.js package.json
git commit -m "Add content-extraction and script-detection logic, with tests"
```

---

### Task 5: Layout component (nav shell)

**Files:**
- Create: `components/Layout.tsx`

**Interfaces:**
- Consumes: `cn` from `lib/utils.ts` (Task 3).
- Produces: `Layout` — a React component taking `{ title: string; children: React.ReactNode }`, rendering `<Head><title>{title}</title></Head>` plus a persistent top nav (logo/home link, 4 top-level section links, auth status) and `{children}` below it. Used by the catch-all route in Task 6.

Per the design spec, Phase A's nav is intentionally minimal — logo, the 4 top-level links, auth status. No mega-menus/dropdowns (that's Phase B). Auth status calls `/api/me` (the endpoint doesn't exist under `pages/api/` until Task 7 — this component works and type-checks now regardless, since `fetch` isn't resolved at build time; it becomes functionally live once Task 7 lands).

- [ ] **Step 1: Write the component**

```tsx
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';

interface LayoutProps {
  title: string;
  children: React.ReactNode;
}

interface Me {
  id: number;
  email: string;
  name: string | null;
}

const NAV_LINKS = [
  { href: '/math.html', label: 'Subjects' },
  { href: '/pathways.html', label: 'Tracks' },
  { href: '/problem-sets.html', label: 'Problem Sets' },
  { href: '/sandbox.html', label: 'Sandbox' },
];

function AuthStatus() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return null;
  if (me === null) {
    return (
      <a href="/login.html" className="text-sm text-[var(--accent)] hover:underline">
        Sign in
      </a>
    );
  }
  return (
    <span className="text-sm text-[var(--muted)]">
      {me.name || me.email} ·{' '}
      <a href="/api/auth/logout" className="text-[var(--accent)] hover:underline">
        Sign out
      </a>
    </span>
  );
}

export function Layout({ title, children }: LayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <header
        className={cn(
          'sticky top-0 z-10 flex items-center justify-between',
          'border-b border-[var(--border)] bg-[var(--bg)] px-6 py-3'
        )}
      >
        <Link href="/" className="font-semibold text-[var(--text)]">
          STEM+
        </Link>
        <nav className="flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--text)] hover:text-[var(--accent)]"
            >
              {link.label}
            </a>
          ))}
          <AuthStatus />
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}
```

Note: nav links use plain `<a>` (not `next/link`) except the logo, because they point at not-yet-migrated static pages that Next.js's router doesn't know about until Phase B — a `next/link` there would attempt client-side navigation to a route Next.js can't resolve. The logo link to `/` uses `next/link` since `/` is itself now a Next.js route (Task 6).

- [ ] **Step 2: Verify the build**

```bash
npx next build
```

Expected: succeeds (this component isn't used by any page yet, but must at least compile/type-check cleanly).

- [ ] **Step 3: Commit**

```bash
git add components/Layout.tsx
git commit -m "Add the shell's Layout component (nav, header, auth status)"
```

---

### Task 6: LegacyContent component + catch-all route

**Files:**
- Create: `components/LegacyContent.tsx`
- Create: `pages/[[...slug]].tsx`
- Delete: `pages/index.tsx` (Task 1's placeholder)
- Move: `index.html` → `content/index.html`

**Interfaces:**
- Consumes: `splitHtmlFragment` (Task 4), `extractScripts` (Task 4), `Layout` (Task 5).
- Produces: the actual working end-to-end proof — visiting `/` renders `index.html`'s real content inside the new shell, with its embedded scripts (if any) executing.

`index.html` itself has no `<script>` tags (confirmed by reading the file — it's a pure links/content page), so this specific page doesn't exercise the script-re-execution path at runtime, but the mechanism is built and unit-tested (Task 4) since Phase B's pages do have scripts.

- [ ] **Step 1: Move index.html into content/**

```bash
mkdir -p content
git mv index.html content/index.html
```

- [ ] **Step 2: Write the LegacyContent client component**

```tsx
import { useEffect, useRef } from 'react';
import { extractScripts } from '../lib/scripts';

interface LegacyContentProps {
  html: string;
}

export function LegacyContent({ html }: LegacyContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scripts = extractScripts(html);
    const created: HTMLScriptElement[] = [];
    for (const script of scripts) {
      const el = document.createElement('script');
      if (script.src) {
        el.src = script.src;
        el.defer = true;
      } else if (script.content) {
        el.textContent = script.content;
      }
      document.body.appendChild(el);
      created.push(el);
    }
    return () => {
      created.forEach((el) => el.remove());
    };
  }, [html]);

  // eslint-disable-next-line react/no-danger
  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
}
```

- [ ] **Step 3: Write the catch-all route**

```tsx
import fs from 'fs';
import path from 'path';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { Layout } from '../components/Layout';
import { LegacyContent } from '../components/LegacyContent';
import { splitHtmlFragment } from '../lib/content';

const CONTENT_DIR = path.join(process.cwd(), 'content');

interface PageProps {
  title: string;
  body: string;
}

export default function CatchAllPage({ title, body }: PageProps) {
  return (
    <Layout title={title}>
      <LegacyContent html={body} />
    </Layout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.html'));
  const paths = files.map((file) => {
    const slug = file === 'index.html' ? [] : [file];
    return { params: { slug } };
  });
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<PageProps> = async ({ params }) => {
  const slugParts = (params?.slug as string[] | undefined) || [];
  const fileName = slugParts.length === 0 ? 'index.html' : slugParts.join('/');
  const filePath = path.join(CONTENT_DIR, fileName);
  const html = fs.readFileSync(filePath, 'utf8');
  const { title, body } = splitHtmlFragment(html);
  return { props: { title, body } };
};
```

- [ ] **Step 4: Delete the Task 1 placeholder home page**

```bash
git rm pages/index.tsx
```

- [ ] **Step 5: Verify the build actually renders the real page**

```bash
npx next build
```

Expected: succeeds. This runs `getStaticPaths`/`getStaticProps` for real against `content/index.html`, so a successful build means the content-extraction pipeline genuinely works against the real file, not just against the Task 4 test's small inline example.

- [ ] **Step 6: Spot-check the generated HTML output**

```bash
grep -o '<title>[^<]*</title>' .next/server/pages/index.html
grep -c 'class="toc-item"' .next/server/pages/index.html
```

Expected: the title line shows `<title>STEM+</title>` (matching `content/index.html`'s original `<title>STEM+</title>`), and the toc-item count matches how many `.toc-item` links exist in the source file (`grep -c 'class="toc-item"' content/index.html` should return the same number) — confirming the real homepage content made it through the extraction/render pipeline intact.

- [ ] **Step 7: Commit**

```bash
git add components/LegacyContent.tsx pages/[[...slug]].tsx content/index.html
git commit -m "Add catch-all route serving content/index.html through the shell"
```

---

### Task 7: Migrate auth API routes

**Files:**
- Create: `pages/api/me.js`
- Create: `pages/api/auth/login.js`
- Create: `pages/api/auth/signup.js`
- Create: `pages/api/auth/logout.js`
- Delete: `api/me.js`, `api/auth/login.js`, `api/auth/signup.js`, `api/auth/logout.js`

**Interfaces:**
- Produces: the exact same 4 endpoints at the exact same URL paths (`/api/me`, `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`) — Next.js's Pages Router file-based API routing maps `pages/api/auth/login.js` to `/api/auth/login` automatically, identical to how Vercel's own `api/auth/login.js` mapped to the same URL. Only the relative import paths change, since `pages/api/*` sits one directory level deeper than `api/*` did.

- [ ] **Step 1: Move me.js (depth changes from `api/` to `pages/api/` — one extra `../`)**

```bash
mkdir -p pages/api/auth
git mv api/me.js pages/api/me.js
```

In `pages/api/me.js`, replace line 1-2:

```js
const { getDb } = require('../lib/db');
const { verify } = require('../lib/session');
```

with:

```js
const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
```

Nothing else in the file changes.

- [ ] **Step 2: Move login.js (depth changes from `api/auth/` to `pages/api/auth/` — one extra `../`)**

```bash
git mv api/auth/login.js pages/api/auth/login.js
```

In `pages/api/auth/login.js`, replace lines 1-3:

```js
const { getDb } = require('../../lib/db');
const { verifyPassword, hashPassword } = require('../../lib/password');
const { sign } = require('../../lib/session');
```

with:

```js
const { getDb } = require('../../../lib/db');
const { verifyPassword, hashPassword } = require('../../../lib/password');
const { sign } = require('../../../lib/session');
```

Nothing else in the file changes.

- [ ] **Step 3: Move signup.js (same depth change as login.js)**

```bash
git mv api/auth/signup.js pages/api/auth/signup.js
```

In `pages/api/auth/signup.js`, replace lines 1-3:

```js
const { getDb } = require('../../lib/db');
const { hashPassword } = require('../../lib/password');
const { sign } = require('../../lib/session');
```

with:

```js
const { getDb } = require('../../../lib/db');
const { hashPassword } = require('../../../lib/password');
const { sign } = require('../../../lib/session');
```

Nothing else in the file changes.

- [ ] **Step 4: Move logout.js (no imports to fix — content is identical)**

```bash
git mv api/auth/logout.js pages/api/auth/logout.js
```

- [ ] **Step 5: Remove the now-empty api/ directory**

```bash
rmdir api/auth api 2>/dev/null || true
```

- [ ] **Step 6: Verify the build and existing tests**

```bash
npx next build
npm test
```

Expected: build succeeds (Next.js picks up the 4 new `pages/api/*.js` routes automatically); `npm test` still passes (those checks test `lib/session.js`/`lib/password.js` directly, unaffected by where the API route files that import them live).

- [ ] **Step 7: Commit**

```bash
git add pages/api
git commit -m "Migrate auth API routes from api/ to pages/api/ (Next.js file-based routing)"
```

---

### Task 8: Final verification

**Files:**
- None (verification only).

**Interfaces:**
- None.

- [ ] **Step 1: Full clean build**

```bash
rm -rf .next
npx next build
```

Expected: succeeds with no errors or warnings about missing files.

- [ ] **Step 2: Run the complete test suite**

```bash
npm test
```

Expected: all checks (`check-auth-session`, `check-password`, `check-content`) pass.

- [ ] **Step 3: Confirm no stray references to the old `api/`/`assets/` paths remain**

```bash
grep -rl "require('\.\./lib" pages/api/ 2>&1
ls api 2>&1
ls assets 2>&1
```

Expected: the first command shows nothing (all `pages/api/**` requires now use the corrected `../../` or `../../../` depth from Task 7); the second and third both report "No such file or directory" (confirming the old `api/` and root-level `assets/` directories are fully gone, not just partially migrated).

- [ ] **Step 4: Note for manual verification**

This plan cannot verify the actual rendered result — no display or headless browser is available in this environment. Before considering Phase A done: run `npm run dev`, open `http://localhost:3000/` in a real browser, and confirm: the homepage's real content renders (subject/track/problem-set/sandbox cards, same as before), the new nav bar appears above it with working links, the page looks correct in both light and dark mode (OS-level `prefers-color-scheme`, since there's no toggle), and `/assets/style.css` and other asset URLs referenced by the injected legacy content actually load (check the browser's network tab — this is the one thing that's easy to silently get wrong, since a 404 there wouldn't fail the build, just make the page look unstyled).

Deployment note: this changes the Vercel project from zero-config static+serverless-functions to a `next build`, which Vercel auto-detects — no `vercel.json` changes should be needed, but the next deploy should be watched once pushed, since this is the first time this repo has had a framework build step.
