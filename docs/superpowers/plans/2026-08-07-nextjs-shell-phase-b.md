# Next.js Shell Migration — Phase B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every remaining page (~1,500 files) from `public/` to `content/` so it renders through the persistent Next.js shell, in three risk-staged waves with independent production checkpoints.

**Architecture:** Generalize the existing single-page catch-all route (`pages/[[...slug]].tsx`) to recursively enumerate nested content, fix a `DOMContentLoaded` incompatibility in the two most-used shared scripts, then move files wave by wave (`git mv`, no content rewriting — URLs and relative links are preserved by construction).

**Tech Stack:** Next.js 16 Pages Router (existing), Node's built-in `fs`/`path` (no new dependencies), the raw-CDP headless-Chrome verification approach already used in this environment (no Playwright/browser-automation framework).

## Global Constraints

- No new npm dependencies. No test framework introduction — every automated check in this plan is a plain `assert`-based Node script, matching every existing `scripts/check-*.js`.
- Every migrated page's URL path must exactly match its current path — this is what keeps every existing relative link (`assets/style.css`, `../Unit%202/...`, `../reference/glossary.html`) resolving correctly with zero content changes. Do not rewrite any HTML content as part of this plan.
- Each wave is its own commit. Never squash multiple waves into one commit.
- Pushing to `origin/main` auto-deploys to production (Vercel). Committing locally is fine and expected per task; **do not run `git push` without the user's explicit go-ahead at that wave's checkpoint.**
- `public/assets/` and `public/favicon.ico` never move — they stay exactly where they are for the entire plan and forever after.

---

### Task 1: Recursive content-file listing (`lib/content.js`)

**Files:**
- Modify: `lib/content.js`
- Test: `scripts/check-content.js`

**Interfaces:**
- Produces: `listContentFiles(dir)` — given an absolute directory path, returns an array of `.html` file paths relative to `dir`, using `/` as the separator regardless of OS, recursing into subdirectories. A file directly in `dir` named `index.html` is included as `"index.html"` (no special-casing here; the special-casing of the root index page into an empty slug array happens in the route, Task 3).

- [ ] **Step 1: Write the failing test**

Add to the end of `scripts/check-content.js` (before the final `console.log('check-content: OK');` line):

```js
const os = require('os');
const { listContentFiles } = require('../lib/content');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'listContentFiles-'));
fs.writeFileSync(path.join(tmpRoot, 'index.html'), 'x');
fs.writeFileSync(path.join(tmpRoot, 'math.html'), 'x');
fs.mkdirSync(path.join(tmpRoot, 'Course A', 'Unit 1'), { recursive: true });
fs.writeFileSync(path.join(tmpRoot, 'Course A', 'Unit 1', '0001-lesson.html'), 'x');
fs.writeFileSync(path.join(tmpRoot, 'Course A', 'Unit 1', 'unit-test-a.html'), 'x');
fs.writeFileSync(path.join(tmpRoot, 'Course A', 'notes.txt'), 'not html');
const found = listContentFiles(tmpRoot).sort();
assert.deepStrictEqual(
  found,
  [
    'Course A/Unit 1/0001-lesson.html',
    'Course A/Unit 1/unit-test-a.html',
    'index.html',
    'math.html',
  ],
  'listContentFiles should recursively find every .html file, using / separators, and skip non-html files'
);
fs.rmSync(tmpRoot, { recursive: true, force: true });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-content.js`
Expected: throws `TypeError: listContentFiles is not a function` (or similar), since it doesn't exist yet in `lib/content.js`.

- [ ] **Step 3: Write minimal implementation**

In `lib/content.js`, add above the existing `splitHtmlFragment` function (keep existing code unchanged):

```js
const fs = require('fs');
const path = require('path');

function listContentFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listContentFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.html')) {
      files.push(path.relative(baseDir, fullPath).split(path.sep).join('/'));
    }
  }
  return files;
}
```

Update the file's `module.exports` line to:

```js
module.exports = { splitHtmlFragment, listContentFiles };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-content.js`
Expected: prints `check-content: OK`

- [ ] **Step 5: Commit**

```bash
git add lib/content.js scripts/check-content.js
git commit -m "Add recursive listContentFiles for nested course content"
```

---

### Task 2: Generalize the catch-all route to recurse `content/`

**Files:**
- Modify: `pages/[[...slug]].tsx`

**Interfaces:**
- Consumes: `listContentFiles(dir)` from Task 1 (`lib/content.js`).

- [ ] **Step 1: Replace the flat file listing in `getStaticPaths`**

In `pages/[[...slug]].tsx`, change:

```ts
import fs from 'fs';
import path from 'path';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { Layout } from '../components/Layout';
import { LegacyContent } from '../components/LegacyContent';
import { splitHtmlFragment } from '../lib/content';
import { extractScripts, stripScripts } from '../lib/scripts';
```

to:

```ts
import fs from 'fs';
import path from 'path';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { Layout } from '../components/Layout';
import { LegacyContent } from '../components/LegacyContent';
import { splitHtmlFragment, listContentFiles } from '../lib/content';
import { extractScripts, stripScripts } from '../lib/scripts';
```

Then change:

```ts
export const getStaticPaths: GetStaticPaths = async () => {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.html'));
  const paths = files.map((file) => {
    const slug = file === 'index.html' ? [] : [file];
    return { params: { slug } };
  });
  return { paths, fallback: false };
};
```

to:

```ts
export const getStaticPaths: GetStaticPaths = async () => {
  const files = listContentFiles(CONTENT_DIR);
  const paths = files.map((relPath) => {
    const slug = relPath === 'index.html' ? [] : relPath.split('/');
    return { params: { slug } };
  });
  return { paths, fallback: false };
};
```

`getStaticProps` below it already does `slugParts.join('/')` to reconstruct the path — no change needed there.

- [ ] **Step 2: Verify the build still succeeds with today's content (only the homepage in `content/`)**

Run: `npm run build`
Expected: build succeeds, exactly 1 static page generated for the catch-all route (the homepage), identical to before this change — confirms the refactor is behavior-preserving before any real content moves.

- [ ] **Step 3: Commit**

```bash
git add "pages/[[...slug]].tsx"
git commit -m "Generalize catch-all route to recurse nested content directories"
```

---

### Task 3: Fix the `DOMContentLoaded` incompatibility in `quiz.js`

**Files:**
- Modify: `public/assets/quiz.js`

- [ ] **Step 1: Locate and change the gate**

In `public/assets/quiz.js`, find (near the top of the file, wrapping the whole body):

```js
document.addEventListener('DOMContentLoaded', () => {
```

...with a matching closing `});` at the end of the file. Change the opening to run immediately if the DOM is already ready (as it will be once this script is re-created inside the Next.js shell), and unchanged if the script parses while the document is still loading (the current, still-correct case for every unmigrated static page):

```js
function initQuizzes() {
```

Change the final closing `});` (the one matching this function body, at the very end of the file) to `}`, and add after it:

```js

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQuizzes);
} else {
  initQuizzes();
}
```

- [ ] **Step 2: Manually verify no static page regresses**

Run: `python3 -m http.server 8123 --directory public` (from repo root), then open `http://localhost:8123/AP%20Physics%201/Unit%201/0001-....html` (any real lesson file — `find "public/AP Physics 1/Unit 1" -name "0*.html" | head -1` to get an exact name) in a browser or via the raw-CDP script from `env-headless-browser-testing`, click a quiz answer choice, and confirm it still shows correct/incorrect feedback exactly as before. This confirms the `readyState === 'loading'` branch still fires normally for a page loaded the ordinary static way.

- [ ] **Step 3: Commit**

```bash
git add public/assets/quiz.js
git commit -m "Fix quiz.js to run immediately when DOM is already ready, not just on DOMContentLoaded"
```

---

### Task 4: Fix the `DOMContentLoaded` incompatibility in `tests.js`

**Files:**
- Modify: `public/assets/tests.js`

- [ ] **Step 1: Locate and change the gate**

In `public/assets/tests.js`, find (around line 831, inside the `window.STEMPlusTests = (function () { ... })();` IIFE):

```js
  document.addEventListener('DOMContentLoaded', () => {
```

Apply the identical fix pattern as Task 3: rename the callback to a named function (e.g. `initTests`), and replace the trailing registration with:

```js

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTests);
  } else {
    initTests();
  }
```

Keep everything inside the function body byte-for-byte unchanged — only the registration wrapper changes.

- [ ] **Step 2: Manually verify no static page regresses**

Run: `node scripts/check-content.js` (this file `require`s `public/assets/tests.js` directly, so a syntax error would be caught immediately). Then, with the same `http.server` from Task 3 still running, open any `unit-test-a.html` page, submit an answer, and confirm grading/feedback still works exactly as before.

- [ ] **Step 3: Commit**

```bash
git add public/assets/tests.js
git commit -m "Fix tests.js to run immediately when DOM is already ready, not just on DOMContentLoaded"
```

---

### Task 5: Wave 0 — local sanity check with 2 real files

**Files:**
- Move: 2 files from `public/Algebra Geometry Fundamentals Review/` into `content/Algebra Geometry Fundamentals Review/` (exact same relative path)

**Interfaces:**
- Consumes: Tasks 1-4 (recursive routing + both `DOMContentLoaded` fixes) must be committed before this task.

- [ ] **Step 1: Identify the first two files to move**

```bash
find "public/Algebra Geometry Fundamentals Review/Unit 1" -maxdepth 1 -type f | sort | head -2
```

Note the two filenames returned (a lesson `.html` and/or `unit-test-a.html`).

- [ ] **Step 2: Move them with `git mv`, preserving the exact relative path**

```bash
mkdir -p "content/Algebra Geometry Fundamentals Review/Unit 1"
git mv "public/Algebra Geometry Fundamentals Review/Unit 1/<file1>" "content/Algebra Geometry Fundamentals Review/Unit 1/<file1>"
git mv "public/Algebra Geometry Fundamentals Review/Unit 1/<file2>" "content/Algebra Geometry Fundamentals Review/Unit 1/<file2>"
```

(substitute the two real filenames from Step 1)

- [ ] **Step 3: Build and start locally**

```bash
npm run build && npm run start
```

Expected: build succeeds; the static-page count includes exactly 3 pages from the catch-all route (homepage + these 2 new files).

- [ ] **Step 4: Create a reusable CDP verification script**

This same technique is reused by Tasks 7, 9, and 12 against different URLs — write it once now as a small dev tool, matching this project's existing plain-Node-script convention (no dependencies: `fetch` and `WebSocket` are Node globals).

Create `scripts/verify-page.mjs`:

```js
#!/usr/bin/env node
// One-off browser verification helper for Phase B migration checks.
// Usage: node scripts/verify-page.mjs <url> <js-expression-to-evaluate>
// The JS expression runs in the page after load and must return a JSON-serializable
// value; a truthy `ok` field (or a plain truthy value) is treated as pass.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const [, , url, expression] = process.argv;
if (!url || !expression) {
  console.error('Usage: node scripts/verify-page.mjs <url> <js-expression>');
  process.exit(1);
}

const port = 9333;
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/phase-b-verify-profile', 'about:blank'],
  { stdio: 'ignore' }
);

try {
  await sleep(800); // let Chrome's debugging port come up
  const newTabRes = await fetch(`http://localhost:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  await sleep(1500); // let the page finish loading and hydrating

  const result = await new Promise((resolve, reject) => {
    const id = 1;
    ws.addEventListener('message', function handler(event) {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.result?.exceptionDetails) reject(new Error(JSON.stringify(msg.result.exceptionDetails)));
        else resolve(msg.result.result.value);
      }
    });
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
  });

  await fetch(`http://localhost:${port}/json/close/${tab.id}`);
  console.log('Result:', JSON.stringify(result));
  const pass = result && (result === true || result.ok === true);
  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
} finally {
  chrome.kill();
}
```

- [ ] **Step 5: Run it against the locally-moved lesson page**

```bash
node scripts/verify-page.mjs \
  "http://localhost:3000/Algebra%20Geometry%20Fundamentals%20Review/Unit%201/<file1 URL-encoded>" \
  "(() => { const kicker = document.querySelector('.kicker'); const choice = document.querySelector('.quiz-choice'); if (!kicker || !choice) return { ok: false, reason: 'shell or quiz not rendered' }; choice.click(); const feedback = document.querySelector('.quiz-feedback'); return { ok: feedback && !feedback.hidden, feedbackText: feedback && feedback.textContent }; })()"
```

(substitute the real filename from Step 1, URL-encoded)

Expected: `PASS`, with `feedbackText` showing "Correct." or "Not quite." — proving both the routing change (Task 2) and the `DOMContentLoaded` fix (Task 3) work together end to end, not just individually. If this fails, stop — do not proceed to Task 6 until it's fixed, since every later wave depends on this exact mechanism.

- [ ] **Step 6: Commit the verification script**

```bash
git add scripts/verify-page.mjs
git commit -m "Add reusable CDP page-verification script for Phase B checkpoints"
```

- [ ] **Step 7: Stop the local server**

```bash
kill %1 2>/dev/null
```

(These 2 files stay moved — they're the first slice of Wave 1, continued in Task 6.)

---

### Task 6: Wave 1 — migrate the rest of the Math subject

**Files:**
- Move: all remaining files under the 8 Math courses, plus `public/math.html`, into the matching path under `content/`

**Interfaces:**
- Consumes: Task 5's local verification must have passed.

- [ ] **Step 1: Finish moving the partially-migrated first course**

Task 5 already moved 2 files out of `public/Algebra Geometry Fundamentals Review/`. List what's left, then move each remaining file to the matching path under `content/`:

```bash
cd "/Users/notludosade/Documents/Project V2/STEM+"
find "public/Algebra Geometry Fundamentals Review" -type f
```

For every path this prints, run `git mv "public/Algebra Geometry Fundamentals Review/<relative path>" "content/Algebra Geometry Fundamentals Review/<same relative path>"` (creating any needed `Unit N/` or `reference/` subdirectory under `content/` first with `mkdir -p`). Confirm with the same `find` command again — it should print nothing once done.

- [ ] **Step 2: Move the other 7 Math courses whole, and the hub page**

```bash
git mv "public/Precalculus" "content/Precalculus"
git mv "public/Discrete Math" "content/Discrete Math"
git mv "public/Mathematical Proofs" "content/Mathematical Proofs"
git mv "public/AP STEM+/AP_CALC" "content/AP STEM+/AP_CALC"
git mv "public/Linear Algebra A" "content/Linear Algebra A"
git mv "public/Multivariable Calculus" "content/Multivariable Calculus"
git mv "public/Differential Equations" "content/Differential Equations"
git mv "public/math.html" "content/math.html"
```

(Note: `AP Calculus BC`'s real path is `AP STEM+/AP_CALC`, not a flat `AP Calculus BC` directory — confirmed by reading `math.html`'s actual href. `git mv` a nested path like this may need `mkdir -p "content/AP STEM+"` first if the parent doesn't exist yet.)

- [ ] **Step 3: Confirm nothing Math-related remains under `public/`**

```bash
ls public/ | grep -iE "^(Algebra|Precalculus|Discrete Math|Mathematical Proofs|Linear Algebra A|Multivariable Calculus|Differential Equations|math\.html)$"
ls "public/AP STEM+" 2>/dev/null
```

Expected: no output from the first command; either no `AP STEM+` directory or an empty one from the second (if empty, `git rm -r --cached` or leave the empty directory — git doesn't track empty directories, so it will simply not appear in `git status`).

- [ ] **Step 4: Build locally**

```bash
npm run build
```

Expected: succeeds, static page count increases by the full Math subject's page count (lessons + unit tests + course exams + progress reports + glossaries + `math.html`, across all 8 courses).

- [ ] **Step 5: Commit (do not push yet)**

```bash
git add -A
git commit -m "Migrate Math subject to the Next.js shell (Wave 1 of Phase B)"
```

- [ ] **Step 6: Stop and ask the user for explicit confirmation before pushing**

Per Global Constraints, pushing auto-deploys to production. Present the commit and ask the user to confirm before running `git push origin main`.

---

### Task 7: Wave 1 — production verification

**Files:** none (verification only)

**Interfaces:**
- Consumes: Task 6's push must have completed and Vercel's deploy must have finished.

- [ ] **Step 1: Verify with `scripts/verify-page.mjs` against the real production URL**

Reuse the script from Task 5, pointed at the deployed domain (substitute `<PROD_DOMAIN>` with the real production URL) instead of `localhost:3000`. Run it at least 3 times against lessons from different Math courses at different unit depths, e.g.:

```bash
node scripts/verify-page.mjs \
  "https://<PROD_DOMAIN>/Precalculus/Unit%201/<a real lesson filename>" \
  "(() => { const kicker = document.querySelector('.kicker'); const choice = document.querySelector('.quiz-choice'); if (!kicker || !choice) return { ok: false }; choice.click(); const feedback = document.querySelector('.quiz-feedback'); return { ok: feedback && !feedback.hidden }; })()"
```

Then check a unit test submits and grades (point at a real `unit-test-a.html` under one of the migrated courses):

```bash
node scripts/verify-page.mjs \
  "https://<PROD_DOMAIN>/Precalculus/Unit%201/unit-test-a.html" \
  "(() => { document.querySelectorAll('.quiz-choice[data-correct=\"true\"]').forEach(b => b.click()); document.querySelectorAll('.quiz-fill-input').forEach(i => i.value = 'x'); document.querySelector('[data-test-submit]').click(); const result = document.querySelector('[data-test-result]'); return { ok: result && !result.hidden, text: result && result.textContent }; })()"
```

And check a course exam's gate reports its state without throwing (proves `tests.js`'s localStorage-gating path, not just quiz-answering, survived the fix):

```bash
node scripts/verify-page.mjs \
  "https://<PROD_DOMAIN>/Precalculus/course-exam.html" \
  "(() => { const gate = document.querySelector('[data-exam-gate]'); return { ok: !!gate }; })()"
```

For each, also check for double-execution: a duplicated feedback string, or a script-tag count via `document.querySelectorAll('script[src*=\"quiz.js\"]').length` returning more than 1, would indicate the shell re-created a script that was also left behind by `stripScripts` — expected value is exactly 1.

- [ ] **Step 2: Report results to the user**

If anything fails, do not proceed to Wave 2 — fix and re-verify Wave 1 first, since Wave 2 assumes the underlying mechanism is fully proven.

---

### Task 8: Wave 2 — migrate every remaining low-risk page

**Files:**
- Move: every remaining top-level entry under `public/` except `assets/`, `favicon.ico`, and the 9 Wave-3 files listed below, into the matching path under `content/`

**Interfaces:**
- Consumes: Task 7's production verification must have passed.

- [ ] **Step 1: Run the sweep**

```bash
cd "/Users/notludosade/Documents/Project V2/STEM+"
WAVE3_FILES=("python-sandbox.html" "java-sandbox.html" "javascript-sandbox.html" "cpp-sandbox.html" "pandas-sandbox.html" "python-project.html" "python-projects.html" "python-sensor-project.html" "guided-language-project.html")
for entry in public/*; do
  name=$(basename "$entry")
  [ "$name" = "assets" ] && continue
  [ "$name" = "favicon.ico" ] && continue
  skip=false
  for w3 in "${WAVE3_FILES[@]}"; do
    [ "$name" = "$w3" ] && skip=true
  done
  [ "$skip" = true ] && continue
  git mv "$entry" "content/$name"
done
```

This naturally skips Math's courses and `math.html` (already moved in Wave 1, so no longer present under `public/`) and the 9 Wave-3 files (explicitly excluded) — everything else (Technology, Science, Engineering & Physics, Advanced+ subjects; Pathways/Projects/Applications; Problem Sets; `login.html`, `developer.html`, `sandbox.html` hub, and the 4 remaining subject hub pages) moves in one sweep.

- [ ] **Step 2: Confirm the sweep's completeness**

```bash
ls public/
```

Expected output: only `assets` and `favicon.ico`, plus the 9 Wave-3 filenames — nothing else.

- [ ] **Step 3: Build locally**

```bash
npm run build
```

Expected: succeeds, static page count now covers essentially the entire site except the 9 Wave-3 pages.

- [ ] **Step 4: Commit (do not push yet)**

```bash
git add -A
git commit -m "Migrate all remaining low-risk pages to the Next.js shell (Wave 2 of Phase B)"
```

- [ ] **Step 5: Stop and ask the user for explicit confirmation before pushing**

---

### Task 9: Wave 2 — production verification

**Files:** none (verification only)

- [ ] **Step 1: Spot-check one page from each subject/section in production**

Reuse `scripts/verify-page.mjs` (from Task 5) against one lesson from Technology, one from Science, one from Engineering & Physics, one from Advanced+ — same `.kicker`/`.quiz-choice` expression pattern as Task 7. Then check the gated/special pages specifically:

```bash
node scripts/verify-page.mjs "https://<PROD_DOMAIN>/Projects/<a real project file>" \
  "(() => { const gate = document.querySelector('[data-project-gate]'); return { ok: !!gate }; })()"

node scripts/verify-page.mjs "https://<PROD_DOMAIN>/Pathways/<a real pathway file>" \
  "(() => { return { ok: !!document.querySelector('[data-route-lock]') || !!document.querySelector('[data-pathway-exam-gate]') }; })()"

node scripts/verify-page.mjs "https://<PROD_DOMAIN>/login.html" \
  "(() => { return { ok: !!document.getElementById('login-form') && !!document.getElementById('signup-form') }; })()"

node scripts/verify-page.mjs "https://<PROD_DOMAIN>/sandbox.html" \
  "(() => { const links = document.querySelectorAll('a.toc-item'); return { ok: links.length > 0, count: links.length }; })()"
```

- [ ] **Step 2: Report results to the user**

If anything fails, fix and re-verify before Wave 3.

---

### Task 10: Wave 3 — migrate the 9 interactive subsystem pages

**Files:**
- Move: `public/python-sandbox.html`, `public/java-sandbox.html`, `public/javascript-sandbox.html`, `public/cpp-sandbox.html`, `public/pandas-sandbox.html`, `public/python-project.html`, `public/python-projects.html`, `public/python-sensor-project.html`, `public/guided-language-project.html` into `content/`

**Interfaces:**
- Consumes: Task 9's production verification must have passed.

- [ ] **Step 1: Move all 9 files**

```bash
cd "/Users/notludosade/Documents/Project V2/STEM+"
for f in python-sandbox.html java-sandbox.html javascript-sandbox.html cpp-sandbox.html pandas-sandbox.html python-project.html python-projects.html python-sensor-project.html guided-language-project.html; do
  git mv "public/$f" "content/$f"
done
```

- [ ] **Step 2: Confirm `public/` now contains only `assets/` and `favicon.ico`**

```bash
ls public/
```

Expected: `assets` and `favicon.ico` only.

- [ ] **Step 3: Build locally**

```bash
npm run build
```

Expected: succeeds, static page count now covers the entire site.

- [ ] **Step 4: Commit (do not push yet)**

```bash
git add -A
git commit -m "Migrate the 9 interactive sandbox/project pages to the Next.js shell (Wave 3 of Phase B)"
```

---

### Task 11: Fix the check scripts broken by the migration

**Files:**
- Modify: `scripts/check-content.js`
- Modify: `scripts/check-java-sandbox.js`
- Modify: `scripts/check-javascript-cpp-sandboxes.js`
- Modify: `scripts/check-pandas-sandbox.js`
- Modify: `scripts/check-python-sandbox.js`
- Modify: `scripts/check-python-project.js`
- Modify: `scripts/check-guided-language-projects.js`
- Modify: `scripts/check-problem-banks.js`

**Interfaces:**
- Consumes: Task 10 (all 9 sandbox pages, plus every page these scripts reference, must already be moved into `content/`).

This task fixes 8 scripts: `check-content.js` is wired into `npm test` and needs to keep working correctly at every point (its `htmlFiles()` walk needs to cover both `public/` and `content/`, since `public/assets/*.js` itself is still read directly and never moves). The other 7 are manually-run dev tools (not in `npm test`) whose specific referenced pages will all be under `content/` by the time this task runs, so a direct path flip is correct and simplest. Note: `scripts/check-programming-packages-course.js` currently fails for an unrelated, pre-existing reason (`require('../Programming with Packages/course.js')` was never correct even before this migration) — that is explicitly **not** part of this task; leave it as-is.

- [ ] **Step 1: Fix `check-content.js`'s directory walk to cover both `public/` and `content/`**

In `scripts/check-content.js`, change:

```js
htmlFiles(path.resolve(__dirname, '../public')).forEach((file) => {
```

to:

```js
[
  ...htmlFiles(path.resolve(__dirname, '../public')),
  ...htmlFiles(path.resolve(__dirname, '../content')),
].forEach((file) => {
```

- [ ] **Step 2: Fix the 4 sandbox-checker scripts' `root`**

In each of `scripts/check-java-sandbox.js`, `scripts/check-javascript-cpp-sandboxes.js`, `scripts/check-pandas-sandbox.js`, `scripts/check-python-sandbox.js`, change:

```js
const root = path.resolve(__dirname, '..');
```

to:

```js
const root = path.resolve(__dirname, '..', 'content');
```

- [ ] **Step 3: Fix the remaining 3 scripts' `root`**

In each of `scripts/check-python-project.js`, `scripts/check-guided-language-projects.js`, `scripts/check-problem-banks.js`, change:

```js
const root = path.resolve(__dirname, '../public');
```

to:

```js
const root = path.resolve(__dirname, '../content');
```

- [ ] **Step 4: Run every fixed script and confirm all pass**

```bash
node scripts/check-content.js
node scripts/check-java-sandbox.js
node scripts/check-javascript-cpp-sandboxes.js
node scripts/check-pandas-sandbox.js
node scripts/check-python-sandbox.js
node scripts/check-python-project.js
node scripts/check-guided-language-projects.js
node scripts/check-problem-banks.js
```

Expected: every one prints its own `... audit passed` (or `check-content: OK`) message and exits 0. If any still fails, read its specific error — it's most likely a page name in that script's own page-array that was renamed or a link target the migration didn't preserve; fix the specific reference, not the general pattern.

- [ ] **Step 5: Run the full `npm test` suite**

```bash
npm test
```

Expected: passes (this now includes the fixed `check-content.js`).

- [ ] **Step 6: Commit**

```bash
git add scripts/check-content.js scripts/check-java-sandbox.js scripts/check-javascript-cpp-sandboxes.js scripts/check-pandas-sandbox.js scripts/check-python-sandbox.js scripts/check-python-project.js scripts/check-guided-language-projects.js scripts/check-problem-banks.js
git commit -m "Fix check-*.js scripts' hardcoded paths after Phase B migration"
```

- [ ] **Step 7: Stop and ask the user for explicit confirmation before pushing** (this can be pushed together with Task 10's commit, or separately — either way, confirm with the user first)

---

### Task 12: Wave 3 — production verification

**Files:** none (verification only)

- [ ] **Step 1: Verify the Python sandbox's free-code Web Worker round-trip**

`python-sandbox.html` has a "free code" editor independent of any graded problem (`#python-free-code`, pre-filled with `name = "STEM+"`), a `[data-python-free-run]` button, and a `[data-python-free-status]` status line that starts as "Python runtime loads on first run." — this is the right target because it doesn't depend on knowing which specific graded problem happens to be loaded, only that the Worker actually starts, runs, and reports back:

```bash
node scripts/verify-page.mjs "https://<PROD_DOMAIN>/python-sandbox.html" \
  "(() => { const editor = document.getElementById('python-free-code'); const btn = document.querySelector('[data-python-free-run]'); const status = document.querySelector('[data-python-free-status]'); if (!editor || !btn || !status) return { ok: false, reason: 'missing elements' }; editor.value = 'print(\"phase-b-check\")'; editor.dispatchEvent(new Event('input', { bubbles: true })); btn.click(); return new Promise(resolve => setTimeout(() => { const output = document.querySelector('.sandbox-output'); resolve({ ok: output && output.textContent.includes('phase-b-check'), statusText: status.textContent, outputText: output && output.textContent }); }, 4000)); })()"
```

Expected: `ok: true`, `outputText` containing `phase-b-check` — proving the editor accepted programmatic input, the Run button triggered the worker, and the worker's stdout came back and rendered, all inside the migrated shell.

- [ ] **Step 2: Adapt the same technique to the other 3 language sandboxes**

`java-sandbox.html`, `javascript-sandbox.html`, `cpp-sandbox.html` likely follow an analogous free-code pattern under different data-attribute prefixes (`data-java-free-run`, etc.) or may only offer graded-problem editors, not a free-code mode — check each file's actual markup first (`grep -n "free-run\|free-code\|free-status" content/<file>.html`) before writing that page's verification expression, mirroring Step 1's structure once the real selectors are known. Do not assume they match Python's exact attribute names.

- [ ] **Step 3: Verify the pandas sandbox**

`pandas-sandbox.html` uses `pandas-worker.js`, a separate worker from `python-worker.js` — check its markup the same way (`grep -n "free-run\|free-code\|free-status" content/pandas-sandbox.html`) and verify with the same pattern as Step 1, since pandas problems specifically exercise DataFrame operations inside the worker, a meaningfully different code path than plain Python execution.

- [ ] **Step 4: Check browser console for errors on all 5**

For each of the 5 sandbox pages, also run:

```bash
node scripts/verify-page.mjs "https://<PROD_DOMAIN>/<page>.html" \
  "(() => { return { ok: true, scriptCount: document.querySelectorAll('script[src*=\"sandbox.js\"], script[src*=\"code-editor.js\"]').length }; })()"
```

`scriptCount` should be exactly 1 for each matching script pattern present on that page — more than 1 indicates the double-execution class of bug from Phase A recurred.

- [ ] **Step 5: Verify the 4 guided-project pages**

Open `python-project.html`, `python-projects.html`, `python-sensor-project.html`, `guided-language-project.html` with `scripts/verify-page.mjs`; confirm the project picker/task list renders and a task's "Show Answer" button reveals the reference answer:

```bash
node scripts/verify-page.mjs "https://<PROD_DOMAIN>/python-project.html" \
  "(() => { const btn = document.querySelector('[data-project-answer-button]'); const panel = document.querySelector('[data-project-answer-code]'); if (!btn) return { ok: false, reason: 'no answer button found' }; btn.click(); return { ok: panel && !panel.hidden }; })()"
```

Repeat for the other 3 pages (their exact answer-reveal markup should match this same `data-project-answer-button`/`data-project-answer-code` contract, per `check-python-project.js`'s and `check-guided-language-projects.js`'s own assertions — confirmed in Task 11).

- [ ] **Step 6: Report results to the user**

If anything fails here, this is the highest-risk wave per the design spec — investigate thoroughly (worker instantiation timing relative to the shell's script re-creation is the most likely failure mode) before considering Phase B complete.

---

## After all waves land

Update `public/AP_CALC`-style leftover empty directories if any remain (git doesn't track them, so `git status` will simply not show them — no action needed). Update `docs/superpowers/plans/2026-08-02-nextjs-shell-phase-a.md`'s own "Known follow-up debt" note (the 7-script claim) to point at this plan instead, since it's now resolved here. Consider a final homepage patch-notes entry summarizing the full-site migration, matching the pattern used for every other user-facing change on this site.
