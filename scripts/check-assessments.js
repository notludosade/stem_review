'use strict';
// Assessments: engine behavior + every question pool's structure and answer keys.
const assert = require('node:assert');
const A = require('../public/assets/assessments.js');

// Seeded RNG so draws are reproducible.
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const q = (unit, k, type, extra) => Object.assign({ id: `demo.u${unit}.q${k}`, unit, type, prompt: 'p', explanation: 'e' }, extra);
const demo = {
  course: 'Demo', slug: 'demo',
  questions: [
    q(1, 1, 'single', { choices: ['a', 'b', 'c'], answer: 'b' }),
    q(1, 2, 'truefalse', { answer: true }),
    q(1, 3, 'number', { answer: 0.75 }),
    q(2, 1, 'multi', { choices: ['a', 'b', 'c', 'd'], answers: ['a', 'c'] }),
    q(2, 2, 'order', { items: ['x', 'y', 'z'] }),
    q(2, 3, 'match', { pairs: [['1', 'one'], ['2', 'two'], ['3', 'three']] }),
  ],
};

// drawCourse: 2 per unit, distinct types, unit order.
for (let seed = 1; seed < 30; seed += 1) {
  const drawn = A.drawCourse(demo, seeded(seed));
  assert.strictEqual(drawn.length, 4, 'two per unit');
  assert.deepStrictEqual(drawn.map((x) => x.unit), [1, 1, 2, 2], 'unit order');
  assert.notStrictEqual(drawn[0].type, drawn[1].type, 'unit 1 types differ');
  assert.notStrictEqual(drawn[2].type, drawn[3].type, 'unit 2 types differ');
}
// drawSections: 1 per unit per pool, sections keep pool order.
const sections = A.drawSections([demo, Object.assign({}, demo, { course: 'Demo 2', slug: 'demo2' })], seeded(7));
assert.deepStrictEqual(sections.map((s) => s.slug), ['demo', 'demo2']);
sections.forEach((s) => assert.deepStrictEqual(s.questions.map((x) => x.unit), [1, 2], '1 per unit'));

// scramble never returns the original order.
for (let seed = 1; seed < 50; seed += 1) {
  assert.notDeepStrictEqual(A.scramble(['x', 'y', 'z'], seeded(seed)), ['x', 'y', 'z']);
}
assert.notDeepStrictEqual(A.scramble(['x', 'y'], () => 0.999), ['x', 'y'], 'constant rng still scrambles');

// grade: every type.
const [single, tf, num, multi, order, match] = demo.questions;
assert.strictEqual(A.grade(single, 'b'), 1);
assert.strictEqual(A.grade(single, 'a'), 0);
assert.strictEqual(A.grade(tf, true), 1);
assert.strictEqual(A.grade(tf, false), 0);
assert.strictEqual(A.grade(num, '3/4'), 1, 'fraction accepted');
assert.strictEqual(A.grade(num, '75%'), 1, 'percent accepted');
assert.strictEqual(A.grade(num, '0.8'), 0);
assert.strictEqual(A.grade(num, ''), 0);
assert.strictEqual(A.grade(multi, ['c', 'a']), 1, 'order of picks irrelevant');
assert.strictEqual(A.grade(multi, ['a']), 0, 'missing one');
assert.strictEqual(A.grade(multi, ['a', 'b', 'c']), 0, 'extra wrong pick');
assert.strictEqual(A.grade(order, ['x', 'y', 'z']), 1);
assert.strictEqual(A.grade(order, ['y', 'x', 'z']), 0);
assert.strictEqual(A.grade(match, { 1: 'one', 2: 'two', 3: 'one' }), 2 / 3, 'partial pairs');
const text = { type: 'text', answers: ['Big O', 'O notation'] };
assert.strictEqual(A.grade(text, '  big   o '), 1, 'case and spaces ignored');
assert.strictEqual(A.grade(text, 'theta'), 0);
const written = { type: 'written', rubric: ['a', 'b', 'c', 'd'], model: 'm' };
assert.strictEqual(A.grade(written, { text: 'x', rubric: [true, false, true, false] }), 0.5);
assert.strictEqual(A.grade(written, { text: 'x' }), 0, 'not self-scored yet');
const code = { type: 'code', tests: [1, 2, 3, 4], starter: 'def f(x):\n    pass' };
assert.strictEqual(A.grade(code, { code: 'x', passed: 3, total: 4 }), 0.75);
assert.strictEqual(A.grade(single, undefined), 0, 'unanswered');

// isAnswered.
assert.strictEqual(A.isAnswered(num, '  '), false);
assert.strictEqual(A.isAnswered(multi, []), false);
assert.strictEqual(A.isAnswered(order, ['x', 'y', 'z']), true);
assert.strictEqual(A.isAnswered(code, { code: 'def f(x):\n    pass' }), false, 'untouched starter');
assert.strictEqual(A.isAnswered(code, { code: 'def f(x):\n    return x' }), true);
assert.strictEqual(A.isAnswered(tf, false), true, 'false is an answer');

// scoreAttempt + label.
const score = A.scoreAttempt([
  { question: single, slug: 'demo', response: 'b' },
  { question: tf, slug: 'demo', response: false },
  { question: match, slug: 'demo', response: { 1: 'one', 2: 'two', 3: 'one' } },
]);
assert.strictEqual(score.total, 3);
assert.ok(Math.abs(score.points - (1 + 0 + 2 / 3)) < 1e-9);
assert.deepStrictEqual(score.units['demo.u1'], { points: 1, total: 2 });
assert.strictEqual(score.courses.demo.total, 3);
assert.strictEqual(A.label(0.85), 'Strong');
assert.strictEqual(A.label(0.6), 'Developing');
assert.strictEqual(A.label(0.59), 'Review');

// ---------------- Content ----------------
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const catalog = require('../public/assets/skill-catalog.json');

const POOL_DIR = path.join(__dirname, '..', 'public', 'assets', 'assessments');
const CODE_COURSES = new Set([
  'computer-programming-1', 'computer-programming-2', 'computer-programming-2-plus', 'software-engineering',
  'data-handling-cb', 'ai-developer', 'applied-machine-deep-learning', 'programming-with-packages',
  'advanced-algorithms', 'game-engine-architecture',
]);
const courseNames = [...new Set(catalog.skills.map((skill) => skill.course))];
const slugOf = (name) => catalog.skills.find((skill) => skill.course === name).id.split('.')[0];
const unitNumbers = (name) => catalog.skills.filter((skill) => skill.course === name).map((skill) => Number(skill.id.split('.u')[1]));

// Subjects, tracks, goals all point at real catalog courses.
courseNames.forEach((name) => assert.ok(A.SUBJECTS.includes(A.SUBJECT_OF[name]), `SUBJECT_OF is missing ${name}`));
Object.keys(A.SUBJECT_OF).forEach((name) => assert.ok(courseNames.includes(name), `SUBJECT_OF has unknown course ${name}`));
catalog.pathways.forEach((track) => track.courses.forEach((name) => assert.ok(courseNames.includes(name), `track ${track.slug}: unknown course ${name}`)));
A.GOALS.filter((goal) => goal.courses).forEach((goal) => goal.courses.forEach((name) => assert.ok(courseNames.includes(name), `goal ${goal.slug}: unknown course ${name}`)));

const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const uniqueStrings = (list, min, max) => Array.isArray(list) && list.length >= min && list.length <= max
  && list.every(nonEmpty) && new Set(list).size === list.length;
const plain = (value) => value === null || ['number', 'string', 'boolean'].includes(typeof value) || (Array.isArray(value) && value.every(plain));
const JS_BLOCKED = /\b(?:import|export)\b|\brequire\s*\(|\b(?:self|globalThis|indexedDB|caches)\b/;
const PY_BLOCKED = /^\s*(?:import|from)\s|\b(?:open|input)\s*\(/m;

const CHECKS = {
  single: (x) => [
    !uniqueStrings(x.choices, 3, 5) && 'choices: 3–5 unique non-empty strings',
    !x.choices?.includes(x.answer) && 'answer must be one of choices',
  ],
  multi: (x) => [
    !uniqueStrings(x.choices, 4, 6) && 'choices: 4–6 unique non-empty strings',
    !(uniqueStrings(x.answers, 2, (x.choices?.length || 1) - 1) && x.answers.every((a) => x.choices.includes(a))) && 'answers: ≥2 choices, not all of them',
  ],
  truefalse: (x) => [typeof x.answer !== 'boolean' && 'answer must be true or false'],
  number: (x) => [
    !Number.isFinite(x.answer) && 'answer must be a finite number',
    x.tolerance !== undefined && !(x.tolerance > 0) && 'tolerance must be > 0',
    Number.isFinite(x.answer) && A.grade(x, String(x.answer)) !== 1 && 'answer does not grade as correct',
  ],
  text: (x) => [!uniqueStrings(x.answers, 1, 8) && 'answers: 1–8 unique non-empty strings'],
  order: (x) => [!uniqueStrings(x.items, 3, 6) && 'items: 3–6 unique non-empty strings'],
  match: (x) => [
    !(Array.isArray(x.pairs) && x.pairs.length >= 3 && x.pairs.length <= 6 && x.pairs.every((p) => Array.isArray(p) && p.length === 2 && p.every(nonEmpty))) && 'pairs: 3–6 [left, right] string pairs',
    Array.isArray(x.pairs) && (new Set(x.pairs.map((p) => p[0])).size !== x.pairs.length || new Set(x.pairs.map((p) => p[1])).size !== x.pairs.length) && 'pair sides must be unique',
  ],
  written: (x) => [
    !uniqueStrings(x.rubric, 3, 4) && 'rubric: 3–4 unique points',
    !nonEmpty(x.model) && 'model answer required',
  ],
  code: (x) => [
    !['python', 'javascript'].includes(x.language) && 'language must be python or javascript',
    !/^[A-Za-z_]\w*$/.test(x.functionName || '') && 'functionName must be an identifier',
    !(nonEmpty(x.starter) && x.starter.includes(x.functionName)) && 'starter must define functionName',
    !nonEmpty(x.reference) && 'reference solution required',
    !(Array.isArray(x.tests) && x.tests.length >= 3 && x.tests.every((t) => Array.isArray(t.args) && t.args.every(plain) && 'expected' in t && plain(t.expected))) && 'tests: ≥3 { args: [...], expected } with only numbers/strings/booleans/null/arrays',
    x.language === 'javascript' && JS_BLOCKED.test(`${x.starter}\n${x.reference}`) && 'JS may not use modules or worker globals',
    x.language === 'python' && PY_BLOCKED.test(`${x.starter}\n${x.reference}`) && 'Python may not import, open, or input',
  ],
};

function validatePool(file, pool) {
  const errors = [];
  const fail = (message) => errors.push(`${path.basename(file)}: ${message}`);
  if (!courseNames.includes(pool.course)) { fail(`unknown course "${pool.course}"`); return errors; }
  if (pool.slug !== slugOf(pool.course)) fail(`slug must be ${slugOf(pool.course)}`);
  if (path.basename(file, '.json') !== pool.slug) fail('file name must equal slug');
  if (!Array.isArray(pool.questions)) { fail('questions must be an array'); return errors; }
  const units = unitNumbers(pool.course);
  units.forEach((unit) => {
    const inUnit = pool.questions.filter((x) => x.unit === unit);
    if (inUnit.length !== 3) fail(`unit ${unit} has ${inUnit.length} questions, needs 3`);
    if (new Set(inUnit.map((x) => x.type)).size !== inUnit.length) fail(`unit ${unit} repeats a question type`);
  });
  const ids = new Set();
  const types = new Set();
  pool.questions.forEach((x) => {
    const where = x.id || '(missing id)';
    if (!units.includes(x.unit)) fail(`${where}: unit ${x.unit} is not in the catalog`);
    if (![1, 2, 3].map((k) => `${pool.slug}.u${x.unit}.q${k}`).includes(x.id)) fail(`${where}: id must be ${pool.slug}.u${x.unit}.q1-3`);
    if (ids.has(x.id)) fail(`${where}: duplicate id`);
    ids.add(x.id);
    if (!A.TYPES[x.type]) { fail(`${where}: unknown type "${x.type}"`); return; }
    types.add(x.type);
    if (!nonEmpty(x.prompt) || !nonEmpty(x.explanation)) fail(`${where}: prompt and explanation required`);
    if (x.code !== undefined && !nonEmpty(x.code)) fail(`${where}: code block must be a non-empty string`);
    CHECKS[x.type](x).filter(Boolean).forEach((message) => fail(`${where}: ${message}`));
  });
  if (types.size < 5) fail(`uses ${types.size} question types, needs ≥5`);
  const codeCount = pool.questions.filter((x) => x.type === 'code').length;
  if (CODE_COURSES.has(pool.slug) && codeCount < 2) fail(`programming course needs ≥2 code questions (has ${codeCount})`);
  if (!CODE_COURSES.has(pool.slug) && codeCount) fail('code questions are only allowed in CODE_COURSES');
  return errors;
}

// Same equality rule as the browser JS worker in javascript-sandbox.js.
const equal = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => equal(value, b[i]));
  return a === b;
};
function passedJs(code, functionName, tests) {
  try {
    const context = vm.createContext({});
    vm.runInContext(`"use strict";\n${code}\n;globalThis.__fn = typeof ${functionName} === 'function' ? ${functionName} : null;`, context, { timeout: 2000 });
    if (!context.__fn) return 0;
    return tests.filter((t) => { try { return equal(context.__fn(...structuredClone(t.args)), t.expected); } catch (err) { return false; } }).length;
  } catch (err) { return 0; }
}
// Same rules as public/assets/python-worker.js: blocked imports, same equality.
const PY_HARNESS = String.raw`
import builtins, json, math, sys
def _eq(actual, expected):
    if isinstance(actual, bool) or isinstance(expected, bool):
        return actual is expected
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(actual, list) and isinstance(expected, list):
        return len(actual) == len(expected) and all(_eq(a, b) for a, b in zip(actual, expected))
    return actual == expected
def _blocked(*a, **k):
    raise ImportError('blocked')
out = []
for job in json.load(sys.stdin):
    safe = dict(vars(builtins)); safe['__import__'] = _blocked
    ns = {'__builtins__': safe, '__name__': '__main__'}
    passed = 0
    try:
        exec(job['code'], ns)
        fn = ns.get(job['fn'])
        for t in job['tests']:
            try:
                if _eq(fn(*t['args']), t['expected']): passed += 1
            except Exception:
                pass
    except Exception:
        pass
    out.append(passed)
print(json.dumps(out))
`;
function passedPythonBatch(jobs) {
  if (!jobs.length) return [];
  const run = spawnSync('python3', ['-I', '-c', PY_HARNESS], { input: JSON.stringify(jobs), encoding: 'utf8', timeout: 60000 });
  assert.strictEqual(run.status, 0, `python3 harness failed: ${run.stderr}`);
  return JSON.parse(run.stdout);
}

function validateCode(pools) {
  const errors = [];
  const python = [];
  pools.forEach(({ file, pool }) => pool.questions.filter((x) => x.type === 'code' && Array.isArray(x.tests)).forEach((x) => {
    if (x.language === 'javascript') {
      if (passedJs(x.reference, x.functionName, x.tests) !== x.tests.length) errors.push(`${path.basename(file)}: ${x.id}: reference fails its tests`);
      if (passedJs(x.starter, x.functionName, x.tests) === x.tests.length) errors.push(`${path.basename(file)}: ${x.id}: starter already passes every test`);
    }
    if (x.language === 'python') {
      python.push({ file, x, kind: 'reference', job: { code: x.reference, fn: x.functionName, tests: x.tests } });
      python.push({ file, x, kind: 'starter', job: { code: x.starter, fn: x.functionName, tests: x.tests } });
    }
  }));
  passedPythonBatch(python.map((p) => p.job)).forEach((passed, i) => {
    const { file, x, kind } = python[i];
    if (kind === 'reference' && passed !== x.tests.length) errors.push(`${path.basename(file)}: ${x.id}: reference fails its tests`);
    if (kind === 'starter' && passed === x.tests.length) errors.push(`${path.basename(file)}: ${x.id}: starter already passes every test`);
  });
  return errors;
}

// The validator catches bad pools (self-test with a deliberately broken pool).
const broken = { course: 'Computer Programming 1', slug: 'computer-programming-1', questions: [
  { id: 'computer-programming-1.u1.q1', unit: 1, type: 'single', prompt: 'p', explanation: 'e', choices: ['a', 'b', 'c'], answer: 'z' },
] };
const brokenErrors = validatePool('computer-programming-1.json', broken);
assert.ok(brokenErrors.some((e) => e.includes('answer must be one of choices')), 'validator flags a bad single answer');
assert.ok(brokenErrors.some((e) => e.includes('unit 2 has 0 questions')), 'validator flags a missing unit');
assert.ok(validateCode([{ file: 'x.json', pool: { questions: [
  { id: 'x.u1.q1', type: 'code', language: 'python', functionName: 'f', starter: 'def f(x):\n    pass', reference: 'def f(x):\n    return x + 2', tests: [{ args: [1], expected: 2 }, { args: [2], expected: 3 }, { args: [3], expected: 4 }] },
  { id: 'x.u1.q2', type: 'code', language: 'javascript', functionName: 'g', starter: 'function g(x) {}', reference: 'function g(x) { return x * 2; }', tests: [{ args: [1], expected: 2 }, { args: [2], expected: 4 }, { args: [3], expected: 6 }] },
] } }]).some((e) => e.includes('x.u1.q1: reference fails')), 'code check flags a wrong Python reference');

// Validate every pool that exists.
const poolFiles = fs.existsSync(POOL_DIR) ? fs.readdirSync(POOL_DIR).filter((name) => name.endsWith('.json')) : [];
const pools = poolFiles.map((name) => {
  const file = path.join(POOL_DIR, name);
  let pool;
  try { pool = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { throw new Error(`${name}: invalid JSON: ${err.message}`); }
  return { file, pool };
});
const problems = pools.flatMap(({ file, pool }) => validatePool(file, pool)).concat(validateCode(pools));
assert.ok(!problems.length, `assessment pool problems:\n  ${problems.join('\n  ')}`);

console.log(`check-assessments: engine OK, ${pools.length} pools / ${pools.reduce((n, p) => n + p.pool.questions.length, 0)} questions OK`);
