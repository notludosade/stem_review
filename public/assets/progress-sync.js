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
