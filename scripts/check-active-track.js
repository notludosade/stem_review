'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const store = new Map();
global.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};
global.document = { addEventListener: () => {} };
require('../public/assets/tests.js');
const T = global.window.STEMPlusTests;

const results = () => JSON.parse(store.get('stemplus:results:v1') || '[]');
const addResult = (row) => store.set('stemplus:results:v1', JSON.stringify([...results(), { version: null, score: 1, total: 1, topicBreakdown: [], takenAt: '2026-10-05T00:00:00Z', ...row }]));
const passExam = (course) => addResult({ course, unit: null, kind: 'course_exam', passed: true });

assert.strictEqual(T.loadActiveTrack(), null, 'no track saved yet');
assert.strictEqual(T.resolveTrack(null), null);
assert.strictEqual(T.resolveTrack({ type: 'pathway', name: 'Not A Pathway' }), null, 'unknown pathway resolves to null');
assert.strictEqual(T.resolveTrack({ type: 'plan' }), null, 'plan track with no saved plan resolves to null');

const quantum = { type: 'pathway', name: 'Quantum Science' };
T.saveActiveTrack(quantum);
assert.deepStrictEqual(T.loadActiveTrack(), quantum);
const resolved = T.resolveTrack(quantum);
assert.strictEqual(resolved.href, 'Pathways/quantum-science.html');
assert.strictEqual(resolved.projectId, 'quantum-science-capstone');

let status = T.trackStatus(resolved);
assert.deepStrictEqual([status.passed, status.total, status.next, status.complete], [0, 4, 'AP Physics 2', false]);

passExam('AP Physics 2');
status = T.trackStatus(resolved);
assert.deepStrictEqual([status.passed, status.next], [1, 'AP Physics C: Electricity and Magnetism']);

store.set('stemplus:skipped-courses:v1', JSON.stringify(['AP Physics C: Electricity and Magnetism']));
status = T.trackStatus(resolved);
assert.deepStrictEqual([status.passed, status.next], [2, 'Quantum Physics & Optics'], 'a skipped course counts as passed');

addResult({ course: 'Quantum Physics & Optics', unit: 'Unit 1', kind: 'unit_test', passed: true });
addResult({ course: 'Quantum Physics & Optics', unit: 'Unit 3', kind: 'unit_test', passed: false });
addResult({ course: 'Quantum Physics & Optics', unit: 'Unit 2', kind: 'unit_test', passed: false });
assert.strictEqual(T.nextUnitFor('Quantum Physics & Optics'), 'Unit 2', 'next unit is the lowest-numbered attempted, uncleared unit');
assert.strictEqual(T.trackStatus(resolved).nextUnit, 'Unit 2');

passExam('Quantum Physics & Optics');
passExam('Quantum Computing');
status = T.trackStatus(resolved);
assert.deepStrictEqual([status.passed, status.next, status.projectDone, status.complete], [4, null, false, false], 'courses done, capstone not yet');

store.set('stemplus:projects:v1', JSON.stringify({ 'quantum-science-capstone': { answers: {}, complete: true } }));
assert.strictEqual(T.trackStatus(resolved).complete, true, 'capstone complete finishes the track');

store.set('stemplus:custom-plan:v1', JSON.stringify({ summary: 's', courses: [{ name: 'Precalculus', reason: 'r' }, { name: 'AP Calculus BC', reason: 'r' }], project: null, problemSets: [], applications: [] }));
const plan = T.resolveTrack({ type: 'plan' });
assert.deepStrictEqual([plan.label, plan.href, plan.projectId], ['My AI plan', 'my-plan.html', null]);
assert.deepStrictEqual(plan.courses, ['Precalculus', 'AP Calculus BC']);
assert.strictEqual(T.trackStatus(plan).next, 'Precalculus');
passExam('Precalculus');
passExam('AP Calculus BC');
assert.strictEqual(T.trackStatus(plan).complete, true, 'a plan with no project completes when its courses do');

T.saveActiveTrack(null);
assert.strictEqual(T.loadActiveTrack(), null, 'saving null clears the track');

// Dashboard hierarchy: one compact top row, Review second, broad history
// afterward. This prevents the old Continue/Practice/Path stack from pushing
// Review below the first viewport.
const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'content/index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'public/assets/tests.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/assets/style.css'), 'utf8');
assert.ok(home.includes('class="dashboard-layout"'));
assert.ok(home.indexOf('data-next-step') < home.indexOf('data-skill-review'));
assert.ok(source.includes('class="dashboard-track-panel"'));
assert.ok(source.includes('class="dashboard-secondary"'));
assert.match(styles, /\.dashboard-review\s*\{[^}]*grid-row:\s*2;/s);

console.log('check-active-track: OK');
