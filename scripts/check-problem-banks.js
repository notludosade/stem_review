'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { courses } = require('../assets/problem-banks.js');

const factorial = (n) => {
  let value = 1;
  for (let k = 2; k <= n; k += 1) value *= k;
  return value;
};
const choose = (n, r) => factorial(n) / (factorial(r) * factorial(n - r));
const expectedAnswer = ({ meta }) => {
  const m = meta;
  switch (m.kind) {
    case 'linear': return (m.c - m.b) / m.a;
    case 'system-x': return (m.c * m.e - m.b * m.f) / (m.a * m.e - m.b * m.d);
    case 'quadratic-larger-root': return (m.sum + Math.sqrt(m.sum ** 2 - 4 * m.product)) / 2;
    case 'exponent': return m.base ** (m.m + m.n - m.p);
    case 'rectangle-area': return m.width * m.height;
    case 'pythagorean': return Math.hypot(m.a, m.b);
    case 'polynomial-limit': return m.a ** 2 + m.b * m.a + m.c;
    case 'power-derivative': return m.coefficient * m.power * m.x ** (m.power - 1) + m.linear;
    case 'product-derivative': return m.x ** 2 + m.c + 2 * m.x * (m.x + m.k);
    case 'linear-integral': return m.m * m.upper ** 2 / 2 + m.b * m.upper;
    case 'ftc': return m.x ** 2 + m.k * m.x + m.c;
    case 'geometric-series': return m.first / (1 - m.ratio);
    case 'concept': return m.expected;
    case 'operator-precedence': return m.a + m.b * m.c;
    case 'branch': return m.x % 2 === 0 ? m.x / 2 : 3 * m.x + 1;
    case 'loop-sum': return Array.from({ length: m.n }, (_, i) => i + 1).reduce((sum, n) => sum + n, 0);
    case 'function': return m.a * m.x + m.b;
    case 'list-index': return m.values[m.index];
    case 'logic':
      if (m.operation === 'and') return m.p && m.q ? 'True' : 'False';
      if (m.operation === 'or') return m.p || m.q ? 'True' : 'False';
      if (m.operation === 'implies') return !m.p || m.q ? 'True' : 'False';
      return m.p === m.q ? 'True' : 'False';
    case 'intersection-size': return new Set(m.a.filter((value) => m.b.includes(value))).size;
    case 'permutation': return factorial(m.n) / factorial(m.n - m.r);
    case 'combination': return choose(m.n, m.r);
    case 'simple-probability': return m.favorable / m.total;
    case 'tree-edges': return m.vertices - 1;
    case 'modular': return ((m.a * m.b + m.c) % m.modulus + m.modulus) % m.modulus;
    case 'kinematics': return m.initialVelocity * m.time + m.acceleration * m.time ** 2 / 2;
    case 'newton-second': return (m.applied - m.friction) / m.mass;
    case 'kinetic-energy': return m.mass * m.velocity ** 2 / 2;
    case 'inelastic-collision': return (m.mass1 * m.velocity1 + m.mass2 * m.velocity2) / (m.mass1 + m.mass2);
    case 'torque': return m.force * m.radius;
    case 'centripetal-force': return m.mass * m.velocity ** 2 / m.radius;
    default: throw new Error(`Unknown audit kind: ${m.kind}`);
  }
};
const equal = (left, right) => typeof left === 'number'
  ? Number.isFinite(right) && Math.abs(left - right) < 1e-9
  : left === right;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(courses.length === 5, `Expected 5 courses, found ${courses.length}`);
const ids = new Set();
let total = 0;

courses.forEach((course) => {
  assert(course.questions.length === 60, `${course.title}: expected 60 questions`);
  const topics = new Map();
  const prompts = new Set();

  course.questions.forEach((question) => {
    assert(!ids.has(question.id), `Duplicate ID: ${question.id}`);
    ids.add(question.id);
    assert(question.prompt && question.explanation, `${question.id}: missing prompt or explanation`);
    assert(!prompts.has(question.prompt), `${question.id}: duplicate prompt within course`);
    prompts.add(question.prompt);
    assert(equal(question.answer, expectedAnswer(question)), `${question.id}: answer audit failed`);
    topics.set(question.topic, (topics.get(question.topic) || 0) + 1);

    if (question.type === 'choice') {
      assert(new Set(question.choices).size === question.choices.length, `${question.id}: duplicate choice`);
      assert(question.choices.includes(question.answer), `${question.id}: answer missing from choices`);
    } else {
      assert(question.type === 'number' && Number.isFinite(question.answer), `${question.id}: invalid numeric answer`);
      assert(question.tolerance > 0, `${question.id}: invalid tolerance`);
    }
  });

  assert(topics.size === 6, `${course.title}: expected 6 topics`);
  topics.forEach((count, topic) => assert(count === 10, `${course.title}/${topic}: expected 10 questions`));
  total += course.questions.length;
});

assert(total === 300, `Expected 300 total questions, found ${total}`);

const root = path.resolve(__dirname, '..');
const pages = ['index.html', 'problem-sets.html', 'problem-set.html', 'sandbox.html'];
let localLinks = 0;
pages.forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
    localLinks += 1;
  }
});

console.log(`Problem-bank audit passed: ${courses.length} courses, ${total} answers recomputed, ${localLinks} local references checked.`);
