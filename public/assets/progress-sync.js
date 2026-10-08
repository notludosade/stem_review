// Cloud progress sync (ChatGPT's revision report flagged this as the
// platform's biggest remaining gap): mirrors the 8 localStorage keys that
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
    'stemplus:lessons:v1',
    'stemplus:custom-plan:v1',
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
    // Lesson views: same presence-map shape as applications (id -> timestamp),
    // written by components/Layout.tsx's useLessonViews.
    if (key === 'stemplus:lessons:v1') return mergeIdMap(local, remote, keepEither);
    if (key === 'stemplus:timed-mastery:v1') return mergeTimedMastery(local, remote);
    if (typeof key === 'string' && key.indexOf(PROBLEM_SET_PREFIX) === 0) return mergeProblemSet(local, remote);
    // stemplus:custom-plan:v1 falls through to here deliberately: it's a
    // single whole value (the AI-generated plan), replaced wholesale on
    // every regeneration, not merged piece-by-piece — "prefer the server's
    // copy, otherwise keep/push whatever's local" is exactly right for it.
    // pages/api/generate-plan.js writes the authoritative copy directly to
    // progress_sync at generation time, so remote is correct the instant a
    // plan exists; this path only pushes local up for a pre-existing,
    // not-yet-synced plan from before this key was added.
    return remote !== undefined ? remote : local;
  }

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
  // Patched on the Storage prototype, not the window.localStorage instance:
  // localStorage is a WebIDL legacy platform object, so assigning
  // window.localStorage.setItem = fn hits its named-property setter (storing
  // "setItem" as a stored item) rather than overriding the method on
  // spec-faithful implementations — Chrome's non-masking interceptor just
  // happens to paper over this. Patching the prototype works everywhere.
  const storage = Object.getPrototypeOf(window.localStorage);
  const nativeSetItem = storage.setItem;
  const writeNative = (key, value) => {
    try {
      nativeSetItem.call(window.localStorage, key, JSON.stringify(value));
    } catch (_) {
      // Sync just doesn't take effect when storage is unavailable.
    }
  };
  // Postgres normalizes jsonb object key order, so a value round-tripped
  // through the API comes back with its keys reshuffled. Compare canonical
  // (sorted-key) serializations or every pull re-pushes every key forever.
  const canon = (value) => JSON.stringify(value, (_, val) => (
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val).sort().reduce((sorted, k) => { sorted[k] = val[k]; return sorted; }, {})
      : val
  ));

  // Who the synced localStorage data belongs to. Deliberately NOT a synced key:
  // it is browser-local bookkeeping, never pushed to the server.
  const OWNER_KEY = 'stemplus:sync-owner:v1';

  let pendingKeys = new Set();
  let pushTimer = null;
  // Until a pull has succeeded we have no idea what the server already holds,
  // so pushing a local-only snapshot could overwrite a richer row.
  let pulledSuccessfully = false;
  const PUSH_DEBOUNCE_MS = 2000;

  function flushPush() {
    pushTimer = null;
    // Keys stay queued (not cleared) so the next write's debounce retries them;
    // if the pull never succeeds this page load they are simply never pushed —
    // nothing is lost, localStorage still has everything and the next page
    // load's pull re-uploads it (pushes are always full snapshots).
    if (!pulledSuccessfully) return;
    const keys = Array.from(pendingKeys);
    pendingKeys = new Set();
    if (!keys.length) return;
    const entries = {};
    keys.forEach((key) => { entries[key] = read(key); });
    const body = JSON.stringify({ entries });
    fetch('/api/progress', {
      method: 'PUT',
      credentials: 'same-origin',
      // Per the Fetch spec a keepalive request body over 64KB is a network
      // error before it is even sent, and the catch below would swallow it.
      keepalive: body.length < 60000,
      headers: { 'Content-Type': 'application/json' },
      body,
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
  // `this`, not a pre-bound localStorage: sessionStorage shares this same
  // prototype, so binding would silently redirect its writes to localStorage.
  storage.setItem = function (key, value) {
    nativeSetItem.call(this, key, value);
    if (this === window.localStorage && isSyncedKey(key) && account.canSave()) schedulePush(key);
  };

  // The full static set of synced keys, not just Object.keys(remote) — a
  // brand-new account (or any key the server has no row for yet) returns
  // {} for that key, so visiting only remote's own keys would skip exactly
  // the "guest progress made before sign-in" keys this pull exists to catch.
  const ALL_SYNCED_KEYS = Array.from(EXACT_KEYS).concat(
    PROBLEM_SET_COURSES.map((course) => PROBLEM_SET_PREFIX + course)
  );

  account.ready.then((me) => {
    if (!me) return;
    // Shared devices (school/library): data left in localStorage by whoever
    // signed in last is theirs, not this account's, and merges are additive
    // with no undo — so never fold it in. No marker at all means nobody has
    // ever signed in here, so genuine pre-sign-in guest progress still merges.
    let ownerMismatch = false;
    try {
      const owner = window.localStorage.getItem(OWNER_KEY);
      ownerMismatch = owner !== null && owner !== String(me.id);
    } catch (_) {
      // Storage unavailable — nothing local to misattribute anyway.
    }
    fetch('/api/progress', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((remote) => {
        if (!remote) return;
        const keys = new Set(Object.keys(remote).concat(ALL_SYNCED_KEYS));
        keys.forEach((key) => {
          // One malformed value must not abort the merge for every other key.
          try {
            if (!isSyncedKey(key)) return;
            let local = read(key);
            if (ownerMismatch && local !== undefined) {
              // Drop the previous user's leftovers so neither this merge nor a
              // later write (problem-sets.js unions against storage) can push
              // them into this account.
              window.localStorage.removeItem(key);
              local = undefined;
            }
            if (local === undefined && remote[key] === undefined) return;
            const merged = mergeForKey(key, local, remote[key]);
            writeNative(key, merged);
            // Local had something the server didn't (e.g. guest progress made
            // before sign-in) — push it now rather than waiting on an
            // unrelated future write to carry it up.
            if (local !== undefined && canon(merged) !== canon(remote[key])) schedulePush(key);
          } catch (_) {
            // Skip just this key.
          }
        });
        pulledSuccessfully = true;
        try {
          nativeSetItem.call(window.localStorage, OWNER_KEY, String(me.id));
        } catch (_) {
          // Owner marker is best-effort; a missing one only costs a re-merge.
        }
      })
      .catch(() => {
        // No cloud data yet, or offline — localStorage keeps working alone.
      });
  });
}());
