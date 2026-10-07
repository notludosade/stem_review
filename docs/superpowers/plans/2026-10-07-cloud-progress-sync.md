# Cloud Progress Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync the six localStorage keys that define a student's real progress (test/exam results, project completion, diagnostics, Application completion, problem-set attempts, Fluency Training personal bests) to a DB-backed store, so a signed-in student sees the same progress on any device.

**Architecture:** One generic `progress_sync(user_id, key, value jsonb, updated_at)` table. One new dual-purpose file, `public/assets/progress-sync.js` (pure merge/allowlist functions usable from Node, plus a browser-only runtime that monkeypatches `localStorage.setItem` to push and hooks `account.ready` to pull-and-merge). One new API route, `pages/api/progress.js` (GET/PUT, session-gated). Zero edits to any of the five existing feature files that currently read/write these keys.

**Tech Stack:** Next.js (Pages Router) API routes, Neon Postgres via `@neondatabase/serverless` (`lib/db.js`), the existing HMAC session cookie (`lib/session.js`), plain Node `assert`-based tests (no framework), raw-CDP headless Chrome for manual browser verification (no npm packages).

## Global Constraints

- Every merge rule is additive — never pick a single winner, never let a merge result contain less data than either side held going in. (Full rules below are the authoritative spec for this.)
- No new UI anywhere. Sync is fully invisible — same silent gating pattern `canSave()`/`account.ready` already uses everywhere else on the site.
- Zero edits to `public/assets/tests.js`, `public/assets/mastery.js`, `public/assets/diagnostic.js`, `public/assets/problem-sets.js`, or `public/assets/timed-mastery.js`. All six keys keep being read and written by those files exactly as today.
- Synced keys, exactly these six (not the pathway/plan preference keys, not sandbox state, not `stemplus:lessons:v1` — that one has no writer in current code):
  - `stemplus:results:v1`
  - `stemplus:projects:v1`
  - `stemplus:diagnostics:v1`
  - `stemplus:applications:v1`
  - `stemplus:timed-mastery:v1`
  - `stemplus:problem-sets:v1:<course-slug>` for exactly these 20 slugs: `advanced-algorithms`, `algebra-geometry`, `ap-calculus-bc`, `ap-physics-1`, `ap-physics-2`, `ap-physics-c-mechanics`, `computer-networking-fundamentals`, `computer-programming-1`, `computer-programming-2`, `data-handling-cb`, `differential-equations`, `discrete-math`, `engineering-1`, `linear-algebra-a`, `mathematical-proofs`, `multivariable-calculus`, `precalculus`, `quantum-physics-optics`, `real-analysis-a`, `systems-programming-architecture`.
- `scripts/migrate.js` runs against the live production Neon database — there is no separate dev/staging DB. Run it with `node --env-file=.env.local scripts/migrate.js`.
- This site is built with `npm run build` (static export) and served with `npm run start -- -p 3200` for any manual verification that needs working API routes — `npm run dev` is not reliable for this (React Strict Mode double-invokes client scripts).
- Before starting any manual-verification server on port 3200, kill whatever is already listening there first: `lsof -i :3200 -P 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9`. A stale `next start` process from an earlier verification round will silently keep answering requests with an old build, and the symptom (a brand to a new static asset 404ing, or new API behavior not showing up) looks exactly like a code bug.
- `npm test` runs a specific ordered chain of `node scripts/check-*.js` calls defined in `package.json`'s `"test"` script — any new check script must be added into that exact chain, not just created standalone.

---

### Task 1: Merge and allowlist logic (`public/assets/progress-sync.js`, pure functions)

**Files:**
- Create: `public/assets/progress-sync.js` (pure-function portion only — the browser runtime is added in Task 3)
- Create: `scripts/check-progress-sync.js`
- Modify: `package.json` (add the new check to the `"test"` script chain, immediately after `check-content-review.js`)

**Interfaces:**
- Produces (used by Task 2's API route and Task 3's browser runtime):
  - `PROBLEM_SET_COURSES: string[]` — the 20 course slugs listed in Global Constraints.
  - `isSyncedKey(key: string): boolean` — true for exactly the six key shapes in Global Constraints.
  - `mergeForKey(key: string, local: any, remote: any): any` — dispatches to the correct merge rule for `key`; `local` or `remote` may be `undefined` (one side has no data yet).

This file follows the exact dual-export pattern already used by `public/assets/timed-mastery.js` and `public/assets/problem-sets.js`: a `module.exports` escape hatch at the very top (before anything that would break in a browser), so the same file is both a plain `<script>` and a `require()`-able Node module. `scripts/check-content-review.js` and `pages/api/content-review.js` already both `require()` files from `public/assets/`, so this is an established pattern, not a new one.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-progress-sync.js`:

```js
'use strict';

const assert = require('node:assert');
const { PROBLEM_SET_COURSES, isSyncedKey, mergeForKey } = require('../public/assets/progress-sync.js');

assert.strictEqual(PROBLEM_SET_COURSES.length, 20);

assert.strictEqual(isSyncedKey('stemplus:results:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:projects:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:diagnostics:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:applications:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:timed-mastery:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:problem-sets:v1:precalculus'), true);
assert.strictEqual(isSyncedKey('stemplus:problem-sets:v1:not-a-real-course'), false, 'unknown course slug must be rejected');
assert.strictEqual(isSyncedKey('stemplus:skipped-courses:v1'), false, 'pathway/plan prefs are out of scope for v1');
assert.strictEqual(isSyncedKey('stemplus:track-pace:v1'), false);
assert.strictEqual(isSyncedKey('stemplus:custom-plan:v1'), false);
assert.strictEqual(isSyncedKey('stemplus:active-track:v1'), false);
assert.strictEqual(isSyncedKey('stemplus:lessons:v1'), false, 'dead key with no current writer is never synced');

// Shape 1: append-only array, dedup by (course, unit, kind, version, takenAt)
const localResults = [{ course: 'Precalculus', unit: 'Unit 1', kind: 'unit_test', version: 'a', score: 8, total: 10, passed: true, takenAt: '2026-01-01T00:00:00.000Z' }];
const remoteResults = [{ course: 'Precalculus', unit: 'Unit 2', kind: 'unit_test', version: 'a', score: 9, total: 10, passed: true, takenAt: '2026-01-02T00:00:00.000Z' }];
assert.strictEqual(mergeForKey('stemplus:results:v1', localResults, remoteResults).length, 2, 'distinct attempts from both sides are both kept');
assert.strictEqual(mergeForKey('stemplus:results:v1', localResults, localResults).length, 1, 'an identical attempt on both sides is deduped, not doubled');
assert.strictEqual(mergeForKey('stemplus:results:v1', undefined, remoteResults).length, 1, 'remote-only data passes through untouched');
assert.strictEqual(mergeForKey('stemplus:results:v1', localResults, undefined).length, 1, 'local-only data passes through untouched');

// Shape 2: projects — union of keys, complete is OR'd
const mergedProjects = mergeForKey('stemplus:projects:v1', { 'proj-a': { complete: true } }, { 'proj-b': { complete: false } });
assert.deepStrictEqual(Object.keys(mergedProjects).sort(), ['proj-a', 'proj-b']);
const collidedProjects = mergeForKey('stemplus:projects:v1', { 'proj-a': { complete: true } }, { 'proj-a': { complete: false } });
assert.strictEqual(collidedProjects['proj-a'].complete, true, 'complete stays true once true on either side');

// Shape 2: problem-set attempted/correct sub-maps
const mergedSet = mergeForKey('stemplus:problem-sets:v1:precalculus',
  { attempted: { q1: true, q2: true }, correct: { q1: false } },
  { attempted: { q2: true, q3: true }, correct: { q2: true } });
assert.deepStrictEqual(Object.keys(mergedSet.attempted).sort(), ['q1', 'q2', 'q3'], 'attempted is a union of both sides');
assert.strictEqual(mergedSet.correct.q1, false);
assert.strictEqual(mergedSet.correct.q2, true);

// Shape 2: applications — union of keys (collision tie-break doesn't matter, both sides mean "completed")
assert.deepStrictEqual(
  Object.keys(mergeForKey('stemplus:applications:v1', { 'app-a': '2026-01-01T00:00:00.000Z' }, { 'app-b': '2026-01-02T00:00:00.000Z' })).sort(),
  ['app-a', 'app-b']
);

// Shape 3: diagnostics — latest attempt per pathway wins, regardless of which side it's on
const mergedDiagnostics = mergeForKey('stemplus:diagnostics:v1',
  { mathematics: { takenAt: '2026-01-01T00:00:00.000Z', answers: ['local'] } },
  { mathematics: { takenAt: '2026-01-02T00:00:00.000Z', answers: ['remote'] } });
assert.deepStrictEqual(mergedDiagnostics.mathematics.answers, ['remote'], 'the later attempt wins, not the local one');

// Shape 3: timed-mastery — best by score, last by time, independently of each other
const mergedTimed = mergeForKey('stemplus:timed-mastery:v1',
  { precalculus: { best: { pct: 90, at: '2026-01-01T00:00:00.000Z' }, last: { pct: 70, at: '2026-01-03T00:00:00.000Z' } } },
  { precalculus: { best: { pct: 80, at: '2026-01-02T00:00:00.000Z' }, last: { pct: 60, at: '2026-01-01T00:00:00.000Z' } } });
assert.strictEqual(mergedTimed.precalculus.best.pct, 90, 'the higher-scoring best survives regardless of which side it came from');
assert.strictEqual(mergedTimed.precalculus.last.pct, 70, 'the more recent last survives regardless of which side it came from');

console.log('check-progress-sync: OK (allowlist and merge rules for all 6 synced-key shapes verified)');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-progress-sync.js`
Expected: `Error: Cannot find module '../public/assets/progress-sync.js'`

- [ ] **Step 3: Write minimal implementation**

Create `public/assets/progress-sync.js`:

```js
// Cloud progress sync (ChatGPT's revision report flagged this as the
// platform's biggest remaining gap): mirrors the 6 localStorage keys that
// define real progress to progress_sync via GET/PUT /api/progress, so a
// signed-in student sees the same progress on any device. Every merge rule
// here is additive — the goal is never to silently lose progress, not to
// pick a single winner. The browser-only runtime below is added in a later
// commit; this file is dual-exported (see the module.exports escape hatch)
// so its pure logic is directly require()-able from Node, the same pattern
// public/assets/timed-mastery.js and public/assets/problem-sets.js already use.
(function () {
  'use strict';

  const PROBLEM_SET_COURSES = [
    'advanced-algorithms', 'algebra-geometry', 'ap-calculus-bc', 'ap-physics-1',
    'ap-physics-2', 'ap-physics-c-mechanics', 'computer-networking-fundamentals',
    'computer-programming-1', 'computer-programming-2', 'data-handling-cb',
    'differential-equations', 'discrete-math', 'engineering-1', 'linear-algebra-a',
    'mathematical-proofs', 'multivariable-calculus', 'precalculus',
    'quantum-physics-optics', 'real-analysis-a', 'systems-programming-architecture',
  ];
  const EXACT_KEYS = new Set([
    'stemplus:results:v1',
    'stemplus:projects:v1',
    'stemplus:diagnostics:v1',
    'stemplus:applications:v1',
    'stemplus:timed-mastery:v1',
  ]);
  const PROBLEM_SET_PREFIX = 'stemplus:problem-sets:v1:';

  function isSyncedKey(key) {
    if (EXACT_KEYS.has(key)) return true;
    return typeof key === 'string' && key.indexOf(PROBLEM_SET_PREFIX) === 0
      && PROBLEM_SET_COURSES.indexOf(key.slice(PROBLEM_SET_PREFIX.length)) !== -1;
  }

  function mergeResultsArray(local, remote) {
    const seen = new Set();
    const out = [];
    (remote || []).concat(local || []).forEach((record) => {
      const dedupeKey = JSON.stringify([record.course, record.unit, record.kind, record.version, record.takenAt]);
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      out.push(record);
    });
    return out;
  }

  function mergeIdMap(local, remote, collide) {
    const out = Object.assign({}, remote || {});
    Object.keys(local || {}).forEach((id) => {
      out[id] = Object.prototype.hasOwnProperty.call(out, id) ? collide(out[id], local[id]) : local[id];
    });
    return out;
  }

  const keepEither = (a) => a;
  const orBoolean = (a, b) => !!(a || b);

  function mergeProjects(local, remote) {
    return mergeIdMap(local, remote, (a, b) => Object.assign({}, a, b, { complete: orBoolean(a && a.complete, b && b.complete) }));
  }

  function mergeProblemSet(local, remote) {
    return {
      attempted: mergeIdMap((local || {}).attempted, (remote || {}).attempted, orBoolean),
      correct: mergeIdMap((local || {}).correct, (remote || {}).correct, orBoolean),
    };
  }

  function mergeDiagnostics(local, remote) {
    return mergeIdMap(local, remote, (a, b) => (Date.parse(b.takenAt || 0) > Date.parse(a.takenAt || 0) ? b : a));
  }

  function mergeTimedMastery(local, remote) {
    return mergeIdMap(local, remote, (a, b) => ({
      best: (b.best && typeof b.best.pct === 'number' ? b.best.pct : -Infinity) > (a.best && typeof a.best.pct === 'number' ? a.best.pct : -Infinity) ? b.best : a.best,
      last: Date.parse((b.last && b.last.at) || 0) > Date.parse((a.last && a.last.at) || 0) ? b.last : a.last,
    }));
  }

  function mergeForKey(key, local, remote) {
    if (key === 'stemplus:results:v1') return mergeResultsArray(local, remote);
    if (key === 'stemplus:projects:v1') return mergeProjects(local, remote);
    if (key === 'stemplus:diagnostics:v1') return mergeDiagnostics(local, remote);
    if (key === 'stemplus:applications:v1') return mergeIdMap(local, remote, keepEither);
    if (key === 'stemplus:timed-mastery:v1') return mergeTimedMastery(local, remote);
    if (typeof key === 'string' && key.indexOf(PROBLEM_SET_PREFIX) === 0) return mergeProblemSet(local, remote);
    return remote !== undefined ? remote : local;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { PROBLEM_SET_COURSES, isSyncedKey, mergeForKey };
    return;
  }
}());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-progress-sync.js`
Expected: `check-progress-sync: OK (allowlist and merge rules for all 6 synced-key shapes verified)`

- [ ] **Step 5: Wire into the test chain**

Open `package.json`, find the `"test"` script. It is a chain of `node scripts/check-*.js &&` calls. Find this exact substring:

```
node scripts/check-content-review.js && node scripts/check-plan-catalog.js
```

Replace it with:

```
node scripts/check-content-review.js && node scripts/check-progress-sync.js && node scripts/check-plan-catalog.js
```

Run: `npm test`
Expected: the full chain runs to completion and prints `check-progress-sync: OK (allowlist and merge rules for all 6 synced-key shapes verified)` in the output, in position right after `check-content-review: OK (...)`.

- [ ] **Step 6: Commit**

```bash
git add public/assets/progress-sync.js scripts/check-progress-sync.js package.json
git commit -m "Add progress-sync merge rules and allowlist (pure functions)"
```

---

### Task 2: Database table and API route

**Files:**
- Modify: `scripts/migrate.js`
- Create: `pages/api/progress.js`

**Interfaces:**
- Consumes: `isSyncedKey` from `public/assets/progress-sync.js` (Task 1).
- Produces: `GET /api/progress` → `200 { [key]: value }` for the signed-in user, `401` if not signed in. `PUT /api/progress` with body `{ entries: { [key]: value, ... } }` → `200 { ok: true }` on success, `400` if `entries` is missing/malformed or contains any key `isSyncedKey` rejects, `401` if not signed in.

- [ ] **Step 1: Add the table to the migration script**

In `scripts/migrate.js`, after the existing `content_reviews` table block and before the `console.log` line, add:

```js
  // Signed-in students' progress, synced across devices
  // (public/assets/progress-sync.js, pages/api/progress.js). Generic
  // key/value shape — `key` is one of the 6 localStorage key patterns
  // progress-sync.js's isSyncedKey() recognizes. Adding a 7th synced key
  // later needs no schema change, only extending that allowlist.
  await sql`
    create table if not exists progress_sync (
      user_id integer not null references users(id) on delete cascade,
      key text not null,
      value jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, key)
    )
  `;
```

Update the `console.log` line immediately below from:

```js
  console.log('migrate: users, reports, and content_reviews tables ready');
```

to:

```js
  console.log('migrate: users, reports, content_reviews, and progress_sync tables ready');
```

- [ ] **Step 2: Run the migration against the live database**

Run: `node --env-file=.env.local scripts/migrate.js`
Expected: `migrate: users, reports, content_reviews, and progress_sync tables ready`

This hits the live production Neon database — there is no separate dev/staging DB for this project. That is expected and matches every prior migration.

- [ ] **Step 3: Write the API route**

Create `pages/api/progress.js`:

```js
const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isSyncedKey } = require('../../public/assets/progress-sync.js');

module.exports = async (req, res) => {
  const payload = verify(req.cookies?.session, process.env.SESSION_SECRET);
  if (!payload) {
    res.statusCode = 401;
    return res.json({ error: 'sign in required' });
  }

  try {
    const sql = getDb();

    if (req.method === 'GET') {
      const rows = await sql`select key, value from progress_sync where user_id = ${payload.userId}`;
      const byKey = {};
      rows.forEach((row) => {
        byKey[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      });
      res.statusCode = 200;
      return res.json(byKey);
    }

    if (req.method !== 'PUT') {
      res.statusCode = 405;
      return res.json({ error: 'GET or PUT only' });
    }

    const entries = req.body && req.body.entries;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      res.statusCode = 400;
      return res.json({ error: 'entries object is required' });
    }
    const keys = Object.keys(entries);
    if (!keys.length || !keys.every(isSyncedKey)) {
      res.statusCode = 400;
      return res.json({ error: 'entries contains an unrecognized key' });
    }

    for (const key of keys) {
      await sql`
        insert into progress_sync (user_id, key, value, updated_at)
        values (${payload.userId}, ${key}, ${JSON.stringify(entries[key])}::jsonb, now())
        on conflict (user_id, key) do update set value = excluded.value, updated_at = now()
      `;
    }
    res.statusCode = 200;
    return res.json({ ok: true });
  } catch (err) {
    console.error('progress endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load or save progress.' });
  }
};
```

- [ ] **Step 4: Manual verification against the live DB**

First, clear port 3200 of any stale server from an earlier session, then build and start:

```bash
lsof -i :3200 -P 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9
npm run build
npm run start -- -p 3200 &
sleep 4
```

Then, in the same shell (or a second terminal against the same server):

```bash
EMAIL="progress-sync-test-$(date +%s)@example.com"
curl -s -c /tmp/progress-test-cookies.txt -X POST http://localhost:3200/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpassword123\",\"name\":\"Progress Sync Test\"}"
# Expected: {"ok":true}

curl -s -b /tmp/progress-test-cookies.txt http://localhost:3200/api/progress
# Expected: {}

curl -s -b /tmp/progress-test-cookies.txt -X PUT http://localhost:3200/api/progress \
  -H 'Content-Type: application/json' \
  -d '{"entries":{"stemplus:projects:v1":{"demo-project":{"complete":true}}}}'
# Expected: {"ok":true}

curl -s -b /tmp/progress-test-cookies.txt http://localhost:3200/api/progress
# Expected: {"stemplus:projects:v1":{"demo-project":{"complete":true}}}

curl -s -b /tmp/progress-test-cookies.txt -X PUT http://localhost:3200/api/progress \
  -H 'Content-Type: application/json' \
  -d '{"entries":{"stemplus:not-a-real-key:v1":{}}}'
# Expected: {"error":"entries contains an unrecognized key"} with a 400 status
# (add -w '\n%{http_code}\n' to the curl call above to see the status code)

curl -s -w '\n%{http_code}\n' http://localhost:3200/api/progress
# Expected: {"error":"sign in required"} followed by 401
```

If any of these don't match, stop and fix before continuing — this is the only task touching the DB schema and the only server-side validation gate.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate.js pages/api/progress.js
git commit -m "Add progress_sync table and GET/PUT /api/progress route"
```

---

### Task 3: Client sync runtime

**Files:**
- Modify: `public/assets/progress-sync.js` (add the browser-only runtime after the `module.exports` escape hatch from Task 1)
- Modify: `pages/_document.tsx`

**Interfaces:**
- Consumes: `isSyncedKey`, `mergeForKey` (same file, Task 1) and `window.STEMPlusAccount.ready` / `window.STEMPlusAccount.canSave()` (existing, `public/assets/account.js`).
- Produces: nothing new consumed by other files — this is the runtime that makes Task 1's pure functions actually run in the browser.

- [ ] **Step 1: Add the browser runtime**

In `public/assets/progress-sync.js`, replace this:

```js
  if (typeof module === 'object' && module.exports) {
    module.exports = { PROBLEM_SET_COURSES, isSyncedKey, mergeForKey };
    return;
  }
}());
```

with:

```js
  if (typeof module === 'object' && module.exports) {
    module.exports = { PROBLEM_SET_COURSES, isSyncedKey, mergeForKey };
    return;
  }

  const account = window.STEMPlusAccount;
  if (!account) return;

  const read = (key) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch (_) {
      return undefined;
    }
  };
  const nativeSetItem = window.localStorage.setItem.bind(window.localStorage);
  const writeNative = (key, value) => {
    try {
      nativeSetItem(key, JSON.stringify(value));
    } catch (_) {
      // Sync just doesn't take effect when storage is unavailable.
    }
  };

  let pendingKeys = new Set();
  let pushTimer = null;
  const PUSH_DEBOUNCE_MS = 2000;

  function flushPush() {
    pushTimer = null;
    const keys = Array.from(pendingKeys);
    pendingKeys = new Set();
    if (!keys.length) return;
    const entries = {};
    keys.forEach((key) => { entries[key] = read(key); });
    fetch('/api/progress', {
      method: 'PUT',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    }).catch(() => {
      // Best-effort — the next write, or the next page's pull, retries.
    });
  }

  function schedulePush(key) {
    pendingKeys.add(key);
    if (pushTimer) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(flushPush, PUSH_DEBOUNCE_MS);
  }

  // Every existing feature file (tests.js, mastery.js, diagnostic.js,
  // problem-sets.js, timed-mastery.js) keeps calling localStorage.setItem
  // exactly as it does today — this patch is the only thing that changes.
  window.localStorage.setItem = function (key, value) {
    nativeSetItem(key, value);
    if (isSyncedKey(key) && account.canSave()) schedulePush(key);
  };

  account.ready.then((me) => {
    if (!me) return;
    fetch('/api/progress', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((remote) => {
        if (!remote) return;
        Object.keys(remote).forEach((key) => {
          if (!isSyncedKey(key)) return;
          const local = read(key);
          const merged = mergeForKey(key, local, remote[key]);
          writeNative(key, merged);
          // Local had something the server didn't (e.g. guest progress made
          // before sign-in) — push it now rather than waiting on an
          // unrelated future write to carry it up.
          if (JSON.stringify(merged) !== JSON.stringify(remote[key])) schedulePush(key);
        });
      })
      .catch(() => {
        // No cloud data yet, or offline — localStorage keeps working alone.
      });
  });
}());
```

- [ ] **Step 2: Load it sitewide**

In `pages/_document.tsx`, find:

```tsx
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/assets/account.js" />
```

Replace with:

```tsx
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/assets/account.js" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/assets/progress-sync.js" />
```

- [ ] **Step 3: Confirm the pure-function test still passes**

Run: `node scripts/check-progress-sync.js`
Expected: `check-progress-sync: OK (allowlist and merge rules for all 6 synced-key shapes verified)` — the Task 1 test imports via the `module.exports` escape hatch, which still returns before any of the browser-only code added in Step 1, so this must be unaffected.

- [ ] **Step 4: Manual single-profile verification**

Clear port 3200, rebuild, and restart (the new script tag needs a fresh build to appear in the static export):

```bash
lsof -i :3200 -P 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9
npm run build
npm run start -- -p 3200 &
sleep 4
```

Confirm the new script is actually served:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3200/assets/progress-sync.js
# Expected: 200
```

Launch headless Chrome with a fresh scratch profile and drive it over raw CDP (no npm packages) — write this to a scratch file (e.g. `/tmp/progress-sync-verify.mjs`), not committed to the repo:

```js
const PORT = 9333;
async function newTab(url) {
  const res = await fetch(`http://localhost:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return res.json();
}
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', reject);
  });
}
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function evaluate(ws, expression) {
  return send(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
}
async function main() {
  const email = `progress-sync-chrome-${Date.now()}@example.com`;
  // Sign up via a plain fetch from inside the page itself, so the browser
  // stores the Set-Cookie session cookie exactly as a real visit would.
  const tab = await newTab('http://localhost:3200/');
  const ws = await connect(tab.webSocketDebuggerUrl);
  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');
  await new Promise((r) => setTimeout(r, 2000));

  const signup = await evaluate(ws, `
    fetch('/api/auth/signup', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '${email}', password: 'testpassword123', name: 'CDP Test' }),
    }).then((res) => res.json())
  `);
  console.log('Signup:', JSON.stringify(signup.result.value));

  await evaluate(ws, `location.reload()`);
  await new Promise((r) => setTimeout(r, 2500));

  // Write to a synced key the same way problem-sets.js does, then wait past
  // the 2s push debounce.
  await evaluate(ws, `localStorage.setItem('stemplus:projects:v1', JSON.stringify({ 'demo-project': { complete: true } }))`);
  await new Promise((r) => setTimeout(r, 3000));

  const serverState = await evaluate(ws, `fetch('/api/progress', { credentials: 'same-origin' }).then((res) => res.json())`);
  console.log('Server state after push:', JSON.stringify(serverState.result.value));
  const ok = serverState.result.value && serverState.result.value['stemplus:projects:v1'] && serverState.result.value['stemplus:projects:v1']['demo-project'].complete === true;
  console.log(ok ? 'PASS' : 'FAIL');

  await send(ws, 'Target.closeTarget', { targetId: tab.id });
  ws.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run it:

```bash
pkill -f "remote-debugging-port=9333" 2>/dev/null
rm -rf /tmp/progress-sync-chrome-profile
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9333 --user-data-dir=/tmp/progress-sync-chrome-profile &
sleep 2
node /tmp/progress-sync-verify.mjs
```

Expected: `Signup: {"ok":true}`, then `Server state after push: {"stemplus:projects:v1":{"demo-project":{"complete":true}}}`, then `PASS`.

Clean up: `pkill -f "remote-debugging-port=9333" 2>/dev/null; lsof -i :3200 -P 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9`

- [ ] **Step 5: Commit**

```bash
git add public/assets/progress-sync.js pages/_document.tsx
git commit -m "Add client sync runtime: push on write, pull-and-merge on sign-in"
```

---

### Task 4: Cross-device integration verification and final gate

**Files:** none (verification-only task; no source changes expected)

**Interfaces:** none — this task exercises Tasks 1–3 together.

- [ ] **Step 1: Two-profile cross-device convergence test**

This is the scenario the whole feature exists for: progress made on one device shows up on another. Clear port 3200, rebuild, and restart:

```bash
lsof -i :3200 -P 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9
npm run build
npm run start -- -p 3200 &
sleep 4
```

Write this to a scratch file (e.g. `/tmp/progress-sync-cross-device.mjs`), not committed to the repo:

```js
const PORT_A = 9333;
const PORT_B = 9334;
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', reject);
  });
}
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function evaluate(ws, expression) {
  return send(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
}
async function openProfile(port) {
  const newTabRes = await fetch(`http://localhost:${port}/json/new?${encodeURIComponent('http://localhost:3200/')}`, { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = await connect(tab.webSocketDebuggerUrl);
  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');
  await new Promise((r) => setTimeout(r, 2000));
  return { tab, ws };
}
async function main() {
  const email = `progress-sync-cross-${Date.now()}@example.com`;
  const a = await openProfile(PORT_A);

  const signup = await evaluate(a.ws, `
    fetch('/api/auth/signup', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '${email}', password: 'testpassword123', name: 'Cross Device Test' }),
    }).then((res) => res.json())
  `);
  console.log('Signup on device A:', JSON.stringify(signup.result.value));
  await evaluate(a.ws, `location.reload()`);
  await new Promise((r) => setTimeout(r, 2500));

  // Device A makes some progress: a test result and a problem-set attempt.
  await evaluate(a.ws, `localStorage.setItem('stemplus:results:v1', JSON.stringify([{ course: 'Precalculus', unit: 'Unit 1', kind: 'unit_test', version: 'a', score: 8, total: 10, passed: true, takenAt: '2026-01-01T00:00:00.000Z' }]))`);
  await evaluate(a.ws, `localStorage.setItem('stemplus:problem-sets:v1:precalculus', JSON.stringify({ attempted: { 'q1': true }, correct: { 'q1': true } }))`);
  await new Promise((r) => setTimeout(r, 3000)); // past the push debounce

  // Device B: a second, separate Chrome profile, same account. Sign in
  // (not sign up — the account already exists from device A), make its
  // own distinct progress, and confirm the pull-and-merge on load sees A's.
  const b = await openProfile(PORT_B);
  const login = await evaluate(b.ws, `
    fetch('/api/auth/login', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '${email}', password: 'testpassword123' }),
    }).then((res) => res.json())
  `);
  console.log('Login on device B:', JSON.stringify(login.result.value));
  await evaluate(b.ws, `location.reload()`);
  await new Promise((r) => setTimeout(r, 2500)); // past account.ready + the pull-and-merge

  const bSeesA = await evaluate(b.ws, `JSON.parse(localStorage.getItem('stemplus:results:v1') || '[]')`);
  console.log('Device B sees device A\\'s result:', JSON.stringify(bSeesA.result.value));
  const bHasResult = Array.isArray(bSeesA.result.value) && bSeesA.result.value.some((r) => r.course === 'Precalculus' && r.takenAt === '2026-01-01T00:00:00.000Z');

  // Device B adds its own, distinct progress on a different course.
  await evaluate(b.ws, `localStorage.setItem('stemplus:problem-sets:v1:ap-calculus-bc', JSON.stringify({ attempted: { 'q9': true }, correct: { 'q9': false } }))`);
  await new Promise((r) => setTimeout(r, 3000));

  // Back on device A: reload and confirm it now also sees device B's
  // AP Calculus BC progress, while keeping its own Precalculus progress.
  await evaluate(a.ws, `location.reload()`);
  await new Promise((r) => setTimeout(r, 2500));
  const aAfterReload = await evaluate(a.ws, `({
    ownPrecalc: JSON.parse(localStorage.getItem('stemplus:problem-sets:v1:precalculus') || '{}'),
    bCalcBc: JSON.parse(localStorage.getItem('stemplus:problem-sets:v1:ap-calculus-bc') || '{}'),
  })`);
  console.log('Device A after reload:', JSON.stringify(aAfterReload.result.value));
  const aHasBoth = aAfterReload.result.value.ownPrecalc.correct && aAfterReload.result.value.ownPrecalc.correct.q1 === true
    && aAfterReload.result.value.bCalcBc.attempted && aAfterReload.result.value.bCalcBc.attempted.q9 === true;

  console.log(bHasResult && aHasBoth ? 'PASS' : 'FAIL');

  await send(a.ws, 'Target.closeTarget', { targetId: a.tab.id });
  await send(b.ws, 'Target.closeTarget', { targetId: b.tab.id });
  a.ws.close();
  b.ws.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run it with two separate Chrome profiles on two separate debugging ports:

```bash
pkill -f "remote-debugging-port=933" 2>/dev/null
rm -rf /tmp/progress-sync-profile-a /tmp/progress-sync-profile-b
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9333 --user-data-dir=/tmp/progress-sync-profile-a &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9334 --user-data-dir=/tmp/progress-sync-profile-b &
sleep 2
node /tmp/progress-sync-cross-device.mjs
```

Expected final line: `PASS`. If `FAIL`, the printed intermediate state (device B's view after first reload, device A's view after second reload) tells you which direction of the sync broke.

Clean up: `pkill -f "remote-debugging-port=933" 2>/dev/null; lsof -i :3200 -P 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9`

- [ ] **Step 2: Full test suite and build**

```bash
npm test
```

Expected: every check in the chain prints `OK` (or its equivalent success line), including `check-progress-sync: OK (...)` right after `check-content-review: OK (...)`.

```bash
npm run build
```

Expected: build completes with no errors, same as every other build this session.

- [ ] **Step 3: No commit for this task**

This task is verification-only. If Step 1 or Step 2 reveals a bug, fix it in the relevant Task's file, re-run that task's own test, then re-run this task's Step 1 and Step 2 from the top before considering the plan done.
