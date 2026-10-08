'use strict';

const assert = require('node:assert');
const { PROBLEM_SET_COURSES, isSyncedKey, mergeForKey } = require('../public/assets/progress-sync.js');
const { courses } = require('../public/assets/problem-banks.js');

assert.strictEqual(PROBLEM_SET_COURSES.length, 20);
// The allowlist is hardcoded, so a 21st problem bank would otherwise sync
// silently never — cross-check it against the real source of truth.
assert.deepStrictEqual(
  PROBLEM_SET_COURSES.slice().sort(),
  courses.map((c) => c.slug).sort(),
  'synced problem-set courses must match the real problem banks'
);

assert.strictEqual(isSyncedKey('stemplus:results:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:projects:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:diagnostics:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:applications:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:timed-mastery:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:problem-sets:v1:precalculus'), true);
assert.strictEqual(isSyncedKey('stemplus:problem-sets:v1:not-a-real-course'), false, 'unknown course slug must be rejected');
assert.strictEqual(isSyncedKey('stemplus:skipped-courses:v1'), false, 'pathway/plan prefs are out of scope for v1');
assert.strictEqual(isSyncedKey('stemplus:track-pace:v1'), false);
assert.strictEqual(isSyncedKey('stemplus:active-track:v1'), false);
// Written by components/Layout.tsx's useLessonViews on every lesson page a
// signed-in student opens, and mastery.js's studentEvidence() reads it as the
// sole driver of the "Learning" state — synced like applications.
assert.strictEqual(isSyncedKey('stemplus:lessons:v1'), true);
// pages/api/generate-plan.js writes the authoritative copy directly to
// progress_sync at generation time — synced so a plan reaches every device.
assert.strictEqual(isSyncedKey('stemplus:custom-plan:v1'), true);
assert.strictEqual(isSyncedKey('stemplus:sync-owner:v1'), false, 'the shared-device owner marker is browser-local, never pushed');

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

// Shape 2: lesson views — union of keys, same presence-map shape as applications
assert.deepStrictEqual(
  Object.keys(mergeForKey('stemplus:lessons:v1',
    { '/Precalculus/Unit 1/0001-intro.html': '2026-01-01T00:00:00.000Z' },
    { '/Precalculus/Unit 2/0002-limits.html': '2026-01-02T00:00:00.000Z' })).sort(),
  ['/Precalculus/Unit 1/0001-intro.html', '/Precalculus/Unit 2/0002-limits.html']
);

// custom-plan: a single whole value, replaced wholesale on regeneration —
// the server's copy wins whenever it exists (generate-plan.js writes it
// directly, so remote is authoritative the instant a plan exists); a
// pre-existing local-only plan passes through untouched until pushed up.
assert.deepStrictEqual(mergeForKey('stemplus:custom-plan:v1', { summary: 'old local' }, { summary: 'new remote' }), { summary: 'new remote' }, 'the server copy wins when both sides have a plan');
assert.deepStrictEqual(mergeForKey('stemplus:custom-plan:v1', { summary: 'local only' }, undefined), { summary: 'local only' }, 'a local-only plan passes through untouched');
assert.deepStrictEqual(mergeForKey('stemplus:custom-plan:v1', undefined, { summary: 'remote only' }), { summary: 'remote only' }, 'a remote-only plan passes through untouched');

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

console.log('check-progress-sync: OK (allowlist and merge rules for all 8 synced-key shapes verified)');
