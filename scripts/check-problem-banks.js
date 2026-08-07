'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { courses } = require('../public/assets/problem-banks.js');
const { parseNumber, answersClose } = require('../public/assets/problem-sets.js');

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
    case 'quadratic-eval': return m.a * m.x ** 2 + m.b * m.x + m.c;
    case 'linear-composition': return m.a * (m.c * m.x + m.d) + m.b;
    case 'exponential-solve': return Math.log(m.value) / Math.log(m.base);
    case 'right-triangle-sine': return m.opposite / Math.hypot(m.opposite, m.adjacent);
    case 'arithmetic-term': return m.first + (m.n - 1) * m.difference;
    case 'geometric-term': return m.first * m.ratio ** (m.n - 1);
    case 'vector-dot': return m.u.reduce((sum, value, index) => sum + value * m.v[index], 0);
    case 'cross-z': return m.a * m.d - m.b * m.c;
    case 'partial-x': return 2 * m.a * m.x + m.b * m.y;
    case 'partial-y': return m.b * m.x + 2 * m.c * m.y;
    case 'double-integral-linear': return m.a * m.width ** 2 * m.height / 2 + m.b * m.width * m.height ** 2 / 2;
    case 'divergence-quadratic': return 2 * m.a * m.x + 2 * m.b * m.y + 2 * m.c * m.z;
    case 'factorial': return factorial(m.n);
    case 'binary-halvings': return Math.log2(m.size);
    case 'average': return m.values.reduce((sum, value) => sum + value, 0) / m.values.length;
    case 'median': return m.values.slice().sort((a, b) => a - b)[Math.floor(m.values.length / 2)];
    case 'two-point-slope': return (m.y2 - m.y1) / (m.x2 - m.x1);
    case 'specific-heat': return m.mass * m.specificHeat * m.temperatureChange;
    case 'coulomb-micro': return 9e9 * (m.charge1 * 1e-6) * (m.charge2 * 1e-6) / m.distance ** 2;
    case 'ohms-law-current': return m.voltage / m.resistance;
    case 'magnetic-force-micro': return m.charge * m.velocity * m.field;
    case 'thin-lens-image': return 1 / (1 / m.focalLength - 1 / m.objectDistance);
    case 'photon-energy': return 1240 / m.wavelength;
    case 'determinant-2': return m.a * m.d - m.b * m.c;
    case 'sum-values': return m.values.reduce((sum, value) => sum + value, 0);
    case 'max-values': return Math.max(...m.values);
    case 'exponential-derivative-zero': return m.coefficient * m.rate;
    case 'geometric-term-zero': return m.initial * m.ratio ** m.time;
    case 'euler-step-linear': return m.y + m.h * (m.a * m.y + m.b);
    case 'angular-frequency': return Math.sqrt(m.spring / m.mass);
    case 'laplace-power': return factorial(m.power) / m.s ** (m.power + 1);
    case 'logic-number':
      if (m.operation === 'and') return Number(m.p && m.q);
      if (m.operation === 'or') return Number(m.p || m.q);
      if (m.operation === 'implies') return Number(!m.p || m.q);
      return Number(m.p === m.q);
    case 'sum-parity': return (m.a + m.b) % 2;
    case 'division': return m.dividend / m.divisor;
    case 'count-divisible': return Math.floor(m.limit / m.divisor);
    case 'propagation-ms': return m.distance / m.speedThousands;
    case 'subnet-hosts': return 2 ** m.hostBits - 2;
    case 'cidr-addresses': return 2 ** (32 - m.prefix);
    case 'bandwidth-delay-bytes': return m.rateMbps * m.rttMs * 125;
    case 'inclusive-count': return m.high - m.low + 1;
    case 'binary-value': return Number.parseInt(m.binary, 2);
    case 'hex-value': return Number.parseInt(m.hex, 16);
    case 'twos-complement': return m.unsigned >= 2 ** (m.bits - 1) ? m.unsigned - 2 ** m.bits : m.unsigned;
    case 'array-address': return m.base + m.index * m.width;
    case 'cache-average': return m.hitRate * m.hitTime + (1 - m.hitRate) * m.missTime;
    case 'turnaround': return m.start + m.burst - m.arrival;
    case 'meters-to-mm': return m.meters * 1000;
    case 'cubic-position-velocity': return 3 * m.a * m.t ** 2 + 2 * m.b * m.t;
    case 'product': return m.a * m.b;
    case 'square-over': return m.value ** 2 / m.divisor;
    case 'triple-product-division': return m.a * m.b / m.divisor;
    case 'difference': return m.a - m.b;
    case 'reciprocal': return 1 / m.value;
    case 'square-times': return m.value ** 2 * m.factor;
    case 'absolute-difference': return Math.abs(m.a - m.b);
    case 'identity': return m.value;
    case 'limit-sequence-term': return m.limit + 1 / m.n;
    case 'epsilon-n-reciprocal': return Math.floor(1 / m.epsilon) + 1;
    case 'nearest-endpoint': return Math.min(Math.abs(m.point - m.left), Math.abs(m.right - m.point));
    case 'right-riemann-x': return (m.n + 1) / (2 * m.n);
    case 'n-log2-n': return m.n * Math.log2(m.n);
    case 'fibonacci': { let a = 0, b = 1; for (let i = 0; i < m.n; i += 1) [a, b] = [b, a + b]; return a; }
    case 'power-two': return 2 ** m.exponent;
    default: throw new Error(`Unknown audit kind: ${m.kind}`);
  }
};
const equal = (left, right) => typeof left === 'number'
  ? Number.isFinite(right) && Math.abs(left - right) < 1e-9
  : left === right;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(parseNumber('1/3') === 1 / 3, 'Fraction input parsing failed');
assert(parseNumber('25%') === 0.25, 'Percent input parsing failed');
assert(parseNumber('−2.5') === -2.5, 'Unicode-minus input parsing failed');
assert(answersClose(3.14, Math.PI, 0.001), 'Rounded decimal should be accepted');
assert(!answersClose(99, 100, 0.001), 'Different whole-number answer should be rejected');

assert(courses.length === 20, `Expected 20 courses, found ${courses.length}`);
['real-analysis-a', 'advanced-algorithms'].forEach((slug) => assert(courses.some((course) => course.slug === slug && course.tier === 'advanced'), `Missing Advanced+ problem set: ${slug}`));
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

assert(total === 1200, `Expected 1200 total questions, found ${total}`);

const root = path.resolve(__dirname, '../public');
const pages = ['problem-sets.html', 'problem-set.html', 'sandbox.html'];
let localLinks = 0;
pages.forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || target === 'index.html' || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
    localLinks += 1;
  }
});
const catalog = fs.readFileSync(path.join(root, 'problem-sets.html'), 'utf8');
courses.forEach((course) => assert(catalog.includes(`problem-set.html?course=${course.slug}`), `Catalog missing ${course.slug}`));
assert((catalog.match(/problem-set\.html\?course=/g) || []).length === courses.length, 'Catalog course count does not match bank data');

console.log(`Problem-bank audit passed: ${courses.length} courses, ${total} answers recomputed, ${localLinks} local references checked.`);
