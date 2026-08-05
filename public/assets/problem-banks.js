(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.STEMProblemBanks = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const qNumber = (id, topic, prompt, answer, explanation, meta, tolerance = 0.001) => ({
    id, topic, prompt, type: 'number', answer, tolerance, explanation, meta
  });
  const qChoice = (id, topic, prompt, choices, answer, explanation, meta) => ({
    id, topic, prompt, type: 'choice', choices, answer, explanation, meta
  });
  const fmt = (value) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  const term = (coefficient, variable) => {
    const sign = coefficient < 0 ? '−' : '+';
    return `${sign} ${Math.abs(coefficient)}${variable}`;
  };
  const factorial = (n) => {
    let value = 1;
    for (let k = 2; k <= n; k += 1) value *= k;
    return value;
  };
  const choose = (n, r) => factorial(n) / (factorial(r) * factorial(n - r));

  function algebraGeometry() {
    const questions = [];
    for (let i = 0; i < 10; i += 1) {
      const a = 2 + (i % 4);
      const x = i - 4;
      const b = (i % 5) - 2;
      const c = a * x + b;
      questions.push(qNumber(
        `ag-linear-${i + 1}`, 'Linear equations',
        `Solve for x: ${a}x ${term(b, '')} = ${c}.`,
        x, `Move the constant, then divide: x = (${c} − (${b}))/${a} = ${x}.`,
        { kind: 'linear', a, b, c }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const x = i - 3;
      const y = (i % 5) - 2;
      const a = 1 + (i % 3);
      const b = 1 + (i % 2);
      const d = 2 + (i % 4);
      const e = -(1 + (i % 3));
      const c = a * x + b * y;
      const f = d * x + e * y;
      questions.push(qNumber(
        `ag-system-${i + 1}`, 'Systems',
        `Find x: ${a}x ${term(b, 'y')} = ${c} and ${d}x ${term(e, 'y')} = ${f}.`,
        x, `Elimination gives the solution (x, y) = (${x}, ${y}), so x = ${x}.`,
        { kind: 'system-x', a, b, c, d, e, f }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const r1 = i - 6;
      const r2 = i + 1;
      const sum = r1 + r2;
      const product = r1 * r2;
      questions.push(qNumber(
        `ag-quadratic-${i + 1}`, 'Quadratics',
        `What is the larger real solution of x² ${term(-sum, 'x')} ${term(product, '')} = 0?`,
        Math.max(r1, r2),
        `The expression factors as (x − ${r1})(x − ${r2}), giving roots ${r1} and ${r2}.`,
        { kind: 'quadratic-larger-root', sum, product }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const base = 2 + (i % 4);
      const m = 2 + (i % 3);
      const n = 1 + (i % 4);
      const p = 1 + (i % 2);
      const answer = base ** (m + n - p);
      questions.push(qNumber(
        `ag-exponent-${i + 1}`, 'Exponents',
        `Evaluate (${base}^${m} · ${base}^${n}) ÷ ${base}^${p}.`,
        answer,
        `Add exponents when multiplying and subtract when dividing: ${base}^${m + n - p} = ${answer}.`,
        { kind: 'exponent', base, m, n, p }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const width = 3 + i;
      const height = 2 + (i % 6);
      questions.push(qNumber(
        `ag-area-${i + 1}`, 'Area',
        `A rectangle is ${width} units wide and ${height} units tall. What is its area in square units?`,
        width * height, `Area = width × height = ${width} × ${height} = ${width * height}.`,
        { kind: 'rectangle-area', width, height }
      ));
    }
    const triples = [[3, 4], [5, 12], [8, 15], [7, 24], [9, 12], [12, 16], [15, 20], [10, 24], [18, 24], [20, 21]];
    triples.forEach(([a, b], i) => {
      const answer = Math.sqrt(a * a + b * b);
      questions.push(qNumber(
        `ag-pythagorean-${i + 1}`, 'Right triangles',
        `A right triangle has legs ${a} and ${b}. Find its hypotenuse.`,
        answer, `c = √(${a}² + ${b}²) = √${a * a + b * b} = ${answer}.`,
        { kind: 'pythagorean', a, b }
      ));
    });
    return questions;
  }

  function calculus() {
    const questions = [];
    for (let i = 0; i < 10; i += 1) {
      const a = i - 4;
      const b = (i % 5) - 2;
      const c = 3 - (i % 4);
      const answer = a * a + b * a + c;
      questions.push(qNumber(
        `calc-limit-${i + 1}`, 'Limits',
        `Evaluate lim x→${a} of (x² ${term(b, 'x')} ${term(c, '')}).`,
        answer, `Polynomials are continuous, so substitute x = ${a}. The limit is ${answer}.`,
        { kind: 'polynomial-limit', a, b, c }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const coefficient = 1 + (i % 3);
      const power = 2 + (i % 4);
      const linear = (i % 5) - 2;
      const x = (i % 4) - 1;
      const answer = coefficient * power * (x ** (power - 1)) + linear;
      questions.push(qNumber(
        `calc-derivative-${i + 1}`, 'Derivatives',
        `If f(x) = ${coefficient}x^${power} ${term(linear, 'x')}, find f′(${x}).`,
        answer,
        `f′(x) = ${coefficient * power}x^${power - 1} ${term(linear, '')}; substituting ${x} gives ${answer}.`,
        { kind: 'power-derivative', coefficient, power, linear, x }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const k = 1 + (i % 4);
      const c = 2 + (i % 3);
      const x = (i % 5) - 2;
      const answer = (x * x + c) + (x + k) * 2 * x;
      questions.push(qNumber(
        `calc-product-${i + 1}`, 'Derivative applications',
        `For f(x) = (x + ${k})(x² + ${c}), find the tangent-line slope at x = ${x}.`,
        answer,
        `Product rule: f′(x) = (x² + ${c}) + (x + ${k})(2x). At x = ${x}, f′ = ${answer}.`,
        { kind: 'product-derivative', k, c, x }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const m = 1 + (i % 4);
      const b = (i % 5) - 1;
      const upper = 1 + (i % 5);
      const answer = (m * upper * upper) / 2 + b * upper;
      questions.push(qNumber(
        `calc-integral-${i + 1}`, 'Integrals',
        `Evaluate ∫ from 0 to ${upper} of (${m}x ${term(b, '')}) dx.`,
        answer,
        `An antiderivative is (${m}/2)x² ${term(b, 'x')}. Evaluation from 0 to ${upper} gives ${fmt(answer)}.`,
        { kind: 'linear-integral', m, b, upper }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const k = (i % 4) - 1;
      const c = 2 + (i % 3);
      const x = (i % 5) - 2;
      const answer = x * x + k * x + c;
      questions.push(qNumber(
        `calc-ftc-${i + 1}`, 'Fundamental Theorem',
        `Let F(x) = ∫ from 0 to x of (t² ${term(k, 't')} ${term(c, '')}) dt. Find F′(${x}).`,
        answer,
        `By the Fundamental Theorem of Calculus, F′(x) equals the integrand at x. Result: ${answer}.`,
        { kind: 'ftc', k, c, x }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const first = 2 + i;
      const denominator = 2 + (i % 4);
      const ratio = 1 / denominator;
      const answer = first / (1 - ratio);
      questions.push(qNumber(
        `calc-series-${i + 1}`, 'Infinite series',
        `Find the sum of the infinite geometric series with first term ${first} and common ratio 1/${denominator}. Round only if needed.`,
        answer,
        `Because |r| < 1, S = a/(1 − r) = ${first}/(1 − 1/${denominator}) = ${fmt(answer)}.`,
        { kind: 'geometric-series', first, ratio }
      ));
    }
    return questions;
  }

  function programming() {
    const questions = [];
    const concepts = [
      ['Which course language is compiled ahead of time into a standalone executable?', ['C++', 'Python', 'JavaScript', 'Java'], 'C++', 'C++ is the course’s ahead-of-time compiled language.'],
      ['Which pair is dynamically typed?', ['Python and JavaScript', 'Java and C++', 'Python and Java', 'JavaScript and C++'], 'Python and JavaScript', 'Python and JavaScript check value types at runtime.'],
      ['What does Java compile source code into before the JVM runs it?', ['Bytecode', 'Python source', 'Raw HTML', 'A database'], 'Bytecode', 'javac produces JVM bytecode.'],
      ['Which Python keyword begins a function definition?', ['def', 'function', 'func', 'method'], 'def', 'Python uses def.'],
      ['What is the first valid index of an array or list in all four course languages?', ['0', '1', '−1', 'Depends on length'], '0', 'These languages use zero-based indexing.'],
      ['Which construct repeats while a condition remains true?', ['while loop', 'class', 'comment', 'return statement'], 'while loop', 'A while loop checks its condition before each repetition.'],
      ['What does a return statement do?', ['Sends a value back to the caller', 'Prints every variable', 'Repeats a loop', 'Creates a file'], 'Sends a value back to the caller', 'return ends the call and optionally provides a result.'],
      ['Which JavaScript declaration prevents reassignment?', ['const', 'let', 'var', 'static'], 'const', 'const bindings cannot be reassigned.'],
      ['What is an object created from a class called?', ['instance', 'compiler', 'parameter', 'operator'], 'instance', 'A class is the blueprint; an instance is a concrete object.'],
      ['Why close a file after reading it?', ['Release the operating-system resource', 'Sort its lines', 'Compile its text', 'Rename the file'], 'Release the operating-system resource', 'Closing releases the file handle and related resources.']
    ];
    concepts.forEach(([prompt, choices, answer, explanation], i) => {
      questions.push(qChoice(`cp-concept-${i + 1}`, 'Language fundamentals', prompt, choices, answer, explanation, { kind: 'concept', expected: answer }));
    });
    for (let i = 0; i < 10; i += 1) {
      const a = 2 + i;
      const b = 2 + (i % 4);
      const c = 1 + (i % 5);
      const answer = a + b * c;
      questions.push(qNumber(
        `cp-operator-${i + 1}`, 'Variables and operators',
        `What does this Python expression evaluate to?\n${a} + ${b} * ${c}`,
        answer, `Multiplication runs first: ${b} × ${c} = ${b * c}; then add ${a} to get ${answer}.`,
        { kind: 'operator-precedence', a, b, c }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const x = i + 3;
      const answer = x % 2 === 0 ? x / 2 : 3 * x + 1;
      questions.push(qNumber(
        `cp-branch-${i + 1}`, 'Control flow',
        `What value is printed?\nx = ${x}\nif x % 2 == 0:\n    x = x // 2\nelse:\n    x = 3 * x + 1\nprint(x)`,
        answer, `${x} is ${x % 2 === 0 ? 'even, so the if branch divides by 2' : 'odd, so the else branch computes 3x + 1'}. Output: ${answer}.`,
        { kind: 'branch', x }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const n = i + 3;
      const answer = n * (n + 1) / 2;
      questions.push(qNumber(
        `cp-loop-${i + 1}`, 'Loops',
        `What value is printed?\ntotal = 0\nfor n in range(1, ${n + 1}):\n    total += n\nprint(total)`,
        answer, `The loop adds 1 through ${n}: ${n}(${n + 1})/2 = ${answer}.`,
        { kind: 'loop-sum', n }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const a = 1 + (i % 4);
      const b = (i % 5) - 2;
      const x = i - 2;
      const answer = a * x + b;
      questions.push(qNumber(
        `cp-function-${i + 1}`, 'Functions',
        `What value is returned?\ndef transform(x):\n    return ${a} * x ${b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`}\n\ntransform(${x})`,
        answer, `Substitute x = ${x}: ${a}(${x}) ${term(b, '')} = ${answer}.`,
        { kind: 'function', a, b, x }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const values = [i + 2, i * 2 + 1, 12 - i, i + 7];
      const index = i % values.length;
      questions.push(qNumber(
        `cp-list-${i + 1}`, 'Collections',
        `What value is printed?\nvalues = [${values.join(', ')}]\nprint(values[${index}])`,
        values[index], `Indexing starts at 0, so index ${index} contains ${values[index]}.`,
        { kind: 'list-index', values, index }
      ));
    }
    return questions;
  }

  function discreteMath() {
    const questions = [];
    const logicCases = [
      [true, true, 'and'], [true, false, 'and'],
      [false, true, 'or'], [false, false, 'or'],
      [true, true, 'implies'], [true, false, 'implies'],
      [false, true, 'implies'], [false, false, 'implies'],
      [true, true, 'biconditional'], [true, false, 'biconditional']
    ];
    logicCases.forEach(([p, q, operation], i) => {
      const answer = operation === 'and' ? p && q
        : operation === 'or' ? p || q
          : operation === 'implies' ? !p || q
            : p === q;
      questions.push(qChoice(
        `dm-logic-${i + 1}`, 'Logic',
        `Let p be ${p ? 'true' : 'false'} and q be ${q ? 'true' : 'false'}. Is “p ${operation} q” true or false?`,
        ['True', 'False'], answer ? 'True' : 'False',
        `Using the truth table for ${operation}, the statement is ${answer ? 'true' : 'false'}.`,
        { kind: 'logic', p, q, operation }
      ));
    });
    for (let i = 0; i < 10; i += 1) {
      const universe = Array.from({ length: 8 }, (_, n) => n + i + 1);
      const a = universe.filter((n) => (n + i) % 2 === 0);
      const b = universe.filter((n) => n % (2 + (i % 3)) !== 0);
      const answer = a.filter((n) => b.includes(n)).length;
      questions.push(qNumber(
        `dm-set-${i + 1}`, 'Sets',
        `If A = {${a.join(', ')}} and B = {${b.join(', ')}}, find |A ∩ B|.`,
        answer, `A ∩ B contains elements appearing in both sets, so its cardinality is ${answer}.`,
        { kind: 'intersection-size', a, b }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const n = 5 + (i % 5);
      const r = 2 + (i % 3);
      const permutation = i % 2 === 0;
      const answer = permutation ? factorial(n) / factorial(n - r) : choose(n, r);
      questions.push(qNumber(
        `dm-count-${i + 1}`, 'Combinatorics',
        permutation
          ? `How many ordered ways can ${r} objects be selected from ${n} distinct objects?`
          : `How many unordered groups of ${r} can be selected from ${n} distinct objects?`,
        answer,
        permutation ? `Use P(${n}, ${r}) = ${n}!/(${n - r})! = ${answer}.` : `Use C(${n}, ${r}) = ${n}!/[${r}!(${n - r})!] = ${answer}.`,
        { kind: permutation ? 'permutation' : 'combination', n, r }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const favorable = 1 + (i % 6);
      const other = 3 + (i % 5);
      const answer = favorable / (favorable + other);
      questions.push(qNumber(
        `dm-probability-${i + 1}`, 'Probability',
        `A bag contains ${favorable} red and ${other} blue tokens. One token is drawn uniformly. What is P(red)? Enter a fraction or decimal.`,
        answer, `P(red) = red/total = ${favorable}/${favorable + other} = ${fmt(answer)}.`,
        { kind: 'simple-probability', favorable, total: favorable + other }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const vertices = 4 + i;
      questions.push(qNumber(
        `dm-tree-${i + 1}`, 'Graph theory',
        `A connected graph is a tree with ${vertices} vertices. How many edges does it have?`,
        vertices - 1, `Every tree with v vertices has v − 1 edges: ${vertices} − 1 = ${vertices - 1}.`,
        { kind: 'tree-edges', vertices }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const a = 7 + i * 3;
      const b = 2 + (i % 5);
      const c = 1 + (i % 4);
      const modulus = 5 + (i % 6);
      const answer = (a * b + c) % modulus;
      questions.push(qNumber(
        `dm-modular-${i + 1}`, 'Number theory',
        `Find the least nonnegative remainder of (${a} · ${b} + ${c}) modulo ${modulus}.`,
        answer, `${a} · ${b} + ${c} = ${a * b + c}; dividing by ${modulus} leaves remainder ${answer}.`,
        { kind: 'modular', a, b, c, modulus }
      ));
    }
    return questions;
  }

  function physics() {
    const questions = [];
    for (let i = 0; i < 10; i += 1) {
      const initialVelocity = 1 + (i % 5);
      const acceleration = 2 + (i % 4);
      const time = 2 + (i % 5);
      const answer = initialVelocity * time + 0.5 * acceleration * time * time;
      questions.push(qNumber(
        `physics-motion-${i + 1}`, 'Kinematics',
        `An object starts at x = 0 with v₀ = ${initialVelocity} m/s and constant a = ${acceleration} m/s². Find its position after ${time} s, in meters.`,
        answer, `x = v₀t + ½at² = ${initialVelocity}(${time}) + ½(${acceleration})(${time}²) = ${answer} m.`,
        { kind: 'kinematics', initialVelocity, acceleration, time }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const mass = 2 + (i % 4);
      const acceleration = 1 + (i % 5);
      const friction = 1 + (i % 3);
      const applied = mass * acceleration + friction;
      questions.push(qNumber(
        `physics-force-${i + 1}`, 'Forces',
        `A ${mass} kg block is pushed with ${applied} N while ${friction} N of friction opposes motion. Find its acceleration in m/s².`,
        acceleration, `Fnet = ${applied} − ${friction} = ${mass * acceleration} N, so a = Fnet/m = ${acceleration} m/s².`,
        { kind: 'newton-second', mass, applied, friction }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const mass = 2 + (i % 5);
      const velocity = 2 + (i % 6);
      const answer = 0.5 * mass * velocity * velocity;
      questions.push(qNumber(
        `physics-energy-${i + 1}`, 'Energy',
        `Find the kinetic energy of a ${mass} kg object moving at ${velocity} m/s, in joules.`,
        answer, `K = ½mv² = ½(${mass})(${velocity}²) = ${answer} J.`,
        { kind: 'kinetic-energy', mass, velocity }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const mass1 = 1 + (i % 4);
      const velocity1 = 2 + (i % 5);
      const mass2 = 2 + (i % 5);
      const velocity2 = i % 2 === 0 ? 0 : -1;
      const answer = (mass1 * velocity1 + mass2 * velocity2) / (mass1 + mass2);
      questions.push(qNumber(
        `physics-momentum-${i + 1}`, 'Momentum',
        `A ${mass1} kg cart at ${velocity1} m/s sticks to a ${mass2} kg cart at ${velocity2} m/s. Find their final velocity in m/s.`,
        answer,
        `Conserve momentum: vf = [${mass1}(${velocity1}) + ${mass2}(${velocity2})]/(${mass1 + mass2}) = ${fmt(answer)} m/s.`,
        { kind: 'inelastic-collision', mass1, velocity1, mass2, velocity2 }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const force = 3 + i;
      const radius = 0.5 + (i % 5) * 0.5;
      const answer = force * radius;
      questions.push(qNumber(
        `physics-torque-${i + 1}`, 'Rotation',
        `A ${force} N force acts perpendicular to a lever ${radius} m from its pivot. Find the torque magnitude in N·m.`,
        answer, `For a perpendicular force, τ = rF = ${radius}(${force}) = ${fmt(answer)} N·m.`,
        { kind: 'torque', force, radius }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const mass = 1 + (i % 4);
      const velocity = 2 + (i % 5);
      const radius = 1 + (i % 3);
      const answer = mass * velocity * velocity / radius;
      questions.push(qNumber(
        `physics-circle-${i + 1}`, 'Circular motion',
        `A ${mass} kg object moves in a circle at ${velocity} m/s with radius ${radius} m. Find the required centripetal force in newtons.`,
        answer, `Fc = mv²/r = ${mass}(${velocity}²)/${radius} = ${fmt(answer)} N.`,
        { kind: 'centripetal-force', mass, velocity, radius }
      ));
    }
    return questions;
  }

  function precalculus() {
    const questions = [];
    for (let i = 0; i < 10; i += 1) {
      const a = 1 + (i % 3);
      const b = (i % 5) - 2;
      const c = 3 - (i % 4);
      const x = i - 4;
      const answer = a * x * x + b * x + c;
      questions.push(qNumber(
        `precalc-function-${i + 1}`, 'Functions',
        `If f(x) = ${a}x² ${term(b, 'x')} ${term(c, '')}, find f(${x}).`,
        answer, `Substitute x = ${x}: f(${x}) = ${answer}.`,
        { kind: 'quadratic-eval', a, b, c, x }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const a = 2 + (i % 3);
      const b = (i % 4) - 1;
      const c = 1 + (i % 4);
      const d = 2 - (i % 5);
      const x = i - 3;
      const answer = a * (c * x + d) + b;
      questions.push(qNumber(
        `precalc-composition-${i + 1}`, 'Composition and inverses',
        `Let f(x) = ${a}x ${term(b, '')} and g(x) = ${c}x ${term(d, '')}. Find (f ∘ g)(${x}).`,
        answer, `First g(${x}) = ${c * x + d}; then f(${c * x + d}) = ${answer}.`,
        { kind: 'linear-composition', a, b, c, d, x }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const r1 = i - 5;
      const r2 = i + 2;
      const sum = r1 + r2;
      const product = r1 * r2;
      questions.push(qNumber(
        `precalc-polynomial-${i + 1}`, 'Polynomial functions',
        `What is the larger zero of x² ${term(-sum, 'x')} ${term(product, '')}?`,
        Math.max(r1, r2), `Factoring gives (x − ${r1})(x − ${r2}), so the larger zero is ${Math.max(r1, r2)}.`,
        { kind: 'quadratic-larger-root', sum, product }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const base = 2 + (i % 4);
      const exponent = 1 + (i % 6);
      const value = base ** exponent;
      questions.push(qNumber(
        `precalc-exponential-${i + 1}`, 'Exponential and logarithmic functions',
        `Solve for x: ${base}^x = ${value}.`,
        exponent, `Because ${value} = ${base}^${exponent}, x = ${exponent}.`,
        { kind: 'exponential-solve', base, value }
      ));
    }
    const triples = [[3, 4], [5, 12], [8, 15], [7, 24], [9, 12], [12, 16], [15, 20], [10, 24], [18, 24], [20, 21]];
    triples.forEach(([opposite, adjacent], i) => {
      const hypotenuse = Math.hypot(opposite, adjacent);
      questions.push(qNumber(
        `precalc-trig-${i + 1}`, 'Trigonometry',
        `In a right triangle, angle θ has opposite side ${opposite} and adjacent side ${adjacent}. Find sin θ.`,
        opposite / hypotenuse,
        `The hypotenuse is ${hypotenuse}, so sin θ = opposite/hypotenuse = ${opposite}/${hypotenuse} = ${fmt(opposite / hypotenuse)}.`,
        { kind: 'right-triangle-sine', opposite, adjacent }
      ));
    });
    for (let i = 0; i < 10; i += 1) {
      const n = 4 + i;
      if (i % 2 === 0) {
        const first = 2 + i;
        const difference = 1 + (i % 4);
        const answer = first + (n - 1) * difference;
        questions.push(qNumber(
          `precalc-sequence-${i + 1}`, 'Sequences',
          `An arithmetic sequence has a₁ = ${first} and common difference ${difference}. Find a_${n}.`,
          answer, `a_n = a₁ + (n − 1)d = ${first} + (${n} − 1)(${difference}) = ${answer}.`,
          { kind: 'arithmetic-term', first, difference, n }
        ));
      } else {
        const first = 1 + (i % 3);
        const ratio = 2 + (i % 2);
        const answer = first * ratio ** (n - 1);
        questions.push(qNumber(
          `precalc-sequence-${i + 1}`, 'Sequences',
          `A geometric sequence has a₁ = ${first} and common ratio ${ratio}. Find a_${n}.`,
          answer, `a_n = a₁r^(n−1) = ${first}(${ratio}^${n - 1}) = ${answer}.`,
          { kind: 'geometric-term', first, ratio, n }
        ));
      }
    }
    return questions;
  }

  function multivariableCalculus() {
    const questions = [];
    for (let i = 0; i < 10; i += 1) {
      const u = [i + 1, 2 - (i % 4), (i % 5) - 2];
      const v = [2 + (i % 3), i - 3, 1 + (i % 4)];
      const answer = u.reduce((sum, value, index) => sum + value * v[index], 0);
      questions.push(qNumber(
        `multi-dot-${i + 1}`, 'Vectors and dot products',
        `Find ⟨${u.join(', ')}⟩ · ⟨${v.join(', ')}⟩.`,
        answer, `Multiply matching components and add: the dot product is ${answer}.`,
        { kind: 'vector-dot', u, v }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const a = 1 + i;
      const b = 2 + (i % 4);
      const c = (i % 5) - 2;
      const d = 3 + (i % 3);
      const answer = a * d - b * c;
      questions.push(qNumber(
        `multi-cross-${i + 1}`, 'Cross products',
        `Find the z-component of ⟨${a}, ${b}, 0⟩ × ⟨${c}, ${d}, 0⟩.`,
        answer, `The z-component is ad − bc = ${a}(${d}) − ${b}(${c}) = ${answer}.`,
        { kind: 'cross-z', a, b, c, d }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const a = 1 + (i % 4);
      const b = (i % 5) - 2;
      const c = 1 + (i % 3);
      const x = (i % 5) - 2;
      const y = i - 3;
      const answer = 2 * a * x + b * y;
      questions.push(qNumber(
        `multi-partial-x-${i + 1}`, 'Partial derivatives',
        `For f(x,y) = ${a}x² ${term(b, 'xy')} ${term(c, 'y²')}, find f_x(${x}, ${y}).`,
        answer, `Holding y constant gives f_x = ${2 * a}x ${term(b, 'y')}. At (${x}, ${y}), this is ${answer}.`,
        { kind: 'partial-x', a, b, x, y }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const a = 1 + (i % 3);
      const b = (i % 5) - 2;
      const c = 2 + (i % 4);
      const x = i - 4;
      const y = (i % 5) - 1;
      const answer = b * x + 2 * c * y;
      questions.push(qNumber(
        `multi-gradient-${i + 1}`, 'Gradients',
        `For f(x,y) = ${a}x² ${term(b, 'xy')} ${term(c, 'y²')}, find the y-component of ∇f at (${x}, ${y}).`,
        answer, `The y-component is f_y = ${b}x ${term(2 * c, 'y')}. Substitution gives ${answer}.`,
        { kind: 'partial-y', b, c, x, y }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const a = 1 + (i % 3);
      const b = 1 + (i % 4);
      const width = 1 + (i % 5);
      const height = 2 + (i % 4);
      const answer = a * width ** 2 * height / 2 + b * width * height ** 2 / 2;
      questions.push(qNumber(
        `multi-double-integral-${i + 1}`, 'Multiple integrals',
        `Evaluate ∬_R (${a}x + ${b}y) dA over 0 ≤ x ≤ ${width}, 0 ≤ y ≤ ${height}.`,
        answer, `Integrating over the rectangle gives (${a}/2)(${width}²)(${height}) + (${b}/2)(${width})(${height}²) = ${fmt(answer)}.`,
        { kind: 'double-integral-linear', a, b, width, height }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const a = 1 + (i % 3);
      const b = 2 + (i % 4);
      const c = 1 + (i % 5);
      const x = (i % 4) - 1;
      const y = i - 3;
      const z = (i % 5) - 2;
      const answer = 2 * a * x + 2 * b * y + 2 * c * z;
      questions.push(qNumber(
        `multi-divergence-${i + 1}`, 'Vector fields',
        `For F = ⟨${a}x², ${b}y², ${c}z²⟩, find div F at (${x}, ${y}, ${z}).`,
        answer, `div F = ${2 * a}x + ${2 * b}y + ${2 * c}z. At the point, this equals ${answer}.`,
        { kind: 'divergence-quadratic', a, b, c, x, y, z }
      ));
    }
    return questions;
  }

  function programmingTwo() {
    const questions = [];
    const addConcepts = (prefix, topic, rows) => rows.forEach(([prompt, choices, answer, explanation], i) => {
      questions.push(qChoice(`${prefix}-${i + 1}`, topic, prompt, choices, answer, explanation, { kind: 'concept', expected: answer }));
    });
    addConcepts('cp2-oop', 'Object-oriented programming', [
      ['What relationship does inheritance model?', ['An “is-a” relationship', 'A file path', 'A loop condition', 'A database join'], 'An “is-a” relationship', 'A subclass is a specialized kind of its parent class.'],
      ['What does method overriding do?', ['Replaces inherited behavior in a subclass', 'Deletes every parent field', 'Runs two loops together', 'Catches an exception'], 'Replaces inherited behavior in a subclass', 'An override supplies subclass-specific behavior with the same method contract.'],
      ['What is polymorphism?', ['One interface with multiple implementations', 'One variable with no type', 'One loop with many counters', 'One file with many names'], 'One interface with multiple implementations', 'Polymorphism lets callers use a shared contract while runtime behavior varies by concrete type.'],
      ['What does an interface primarily define?', ['A behavior contract', 'Object storage size', 'A sorting order', 'A network address'], 'A behavior contract', 'An interface states which operations an implementation must provide.'],
      ['Why use an abstract class?', ['Share implementation while preventing direct instantiation', 'Make every method private', 'Avoid all inheritance', 'Store SQL rows'], 'Share implementation while preventing direct instantiation', 'Abstract classes can hold shared state and behavior but represent incomplete base types.'],
      ['What principle hides internal state behind methods?', ['Encapsulation', 'Recursion', 'Memoization', 'Serialization'], 'Encapsulation', 'Encapsulation protects invariants by controlling access to state.'],
      ['What is dynamic dispatch?', ['Choosing an overridden method at runtime', 'Allocating an array at compile time', 'Opening a dynamic file', 'Sorting by insertion'], 'Choosing an overridden method at runtime', 'Runtime type determines which overridden implementation runs.'],
      ['Which design usually favors composition?', ['Building behavior from contained objects', 'Extending every available class', 'Using only global variables', 'Replacing functions with comments'], 'Building behavior from contained objects', 'Composition combines focused objects without forcing an is-a hierarchy.'],
      ['What must a subclass constructor initialize?', ['Its own required state and the parent state', 'Only static methods', 'Every object in memory', 'The program entry point'], 'Its own required state and the parent state', 'A complete object includes both inherited and subclass state.'],
      ['What is a concrete class?', ['A class that can be instantiated', 'A class with no methods', 'A comment-only class', 'A database schema'], 'A class that can be instantiated', 'Concrete classes implement all required behavior and can create instances.']
    ]);
    addConcepts('cp2-exception', 'Exceptions', [
      ['What code belongs in a try block?', ['Code that may raise an expected exception', 'Every comment', 'Only variable declarations', 'Code that cannot fail'], 'Code that may raise an expected exception', 'The try block surrounds the operation whose failure you plan to handle.'],
      ['What does catch or except receive?', ['A thrown exception', 'A loop index', 'A class constructor', 'A file extension'], 'A thrown exception', 'The handler receives a matching exception from the try block.'],
      ['What does throw or raise do?', ['Signals an exceptional condition', 'Returns a normal value', 'Starts a thread', 'Sorts a list'], 'Signals an exceptional condition', 'Throwing transfers control to a matching handler.'],
      ['Why create a custom exception?', ['Represent a domain-specific failure clearly', 'Make arithmetic faster', 'Avoid all error messages', 'Replace input validation'], 'Represent a domain-specific failure clearly', 'A named domain exception communicates what failed and supports targeted handling.'],
      ['What is a finally block for?', ['Cleanup that must run whether failure occurs or not', 'Retrying forever', 'Declaring a subclass', 'Computing Big-O'], 'Cleanup that must run whether failure occurs or not', 'finally is suited to releasing resources on both success and failure paths.'],
      ['What is defensive handling?', ['Checking conditions before a risky operation', 'Ignoring exceptions', 'Catching every error at the top level', 'Deleting invalid data silently'], 'Checking conditions before a risky operation', 'Defensive code validates known preconditions first.'],
      ['What is corrective handling?', ['Attempting work and responding to a specific failure', 'Preventing functions from returning', 'Using only if statements', 'Converting every value to text'], 'Attempting work and responding to a specific failure', 'Corrective handling reacts after an operation reports failure.'],
      ['Why avoid an empty catch block?', ['It hides failures and leaves no recovery evidence', 'It uses too much memory', 'It makes code compile twice', 'It creates a subclass'], 'It hides failures and leaves no recovery evidence', 'Silently swallowed failures make incorrect state hard to detect.'],
      ['Which handler should come first?', ['The most specific matching exception', 'The broadest possible exception', 'A handler with no type', 'The finally block'], 'The most specific matching exception', 'A broad handler first can swallow failures meant for targeted recovery.'],
      ['What is exception propagation?', ['An unhandled exception moving up the call stack', 'Copying an array', 'Sending data over a network', 'Repeating a loop'], 'An unhandled exception moving up the call stack', 'If a function cannot handle an exception, its caller gets the chance.']
    ]);
    addConcepts('cp2-structure', 'Data structures', [
      ['Which order does a stack use?', ['Last in, first out', 'First in, first out', 'Sorted order only', 'Random order'], 'Last in, first out', 'The most recently pushed item is popped first.'],
      ['Which order does a queue use?', ['First in, first out', 'Last in, first out', 'Largest first', 'Random order'], 'First in, first out', 'The earliest enqueued item is removed first.'],
      ['What does each linked-list node store?', ['A value and link to another node', 'Every list value', 'A hash function only', 'A SQL query'], 'A value and link to another node', 'Links connect separately allocated nodes into a sequence.'],
      ['What is average hash-map lookup complexity?', ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], 'O(1)', 'A good hash function usually locates a bucket in constant time.'],
      ['Which operation is naturally O(1) on a singly linked list?', ['Insert at the head', 'Access index n/2', 'Binary search', 'Sort all nodes'], 'Insert at the head', 'Head insertion changes only a small fixed number of links.'],
      ['Which structure supports undo history naturally?', ['Stack', 'Queue', 'Hash set', 'Binary file'], 'Stack', 'Undo removes the most recent action first.'],
      ['Which structure supports first-come task processing?', ['Queue', 'Stack', 'Set', 'Tree leaf'], 'Queue', 'FIFO ordering preserves arrival order.'],
      ['What problem do hash collisions describe?', ['Different keys mapping to the same bucket', 'Two arrays sharing a length', 'A loop reaching zero', 'Two files sharing text'], 'Different keys mapping to the same bucket', 'Hash maps need collision handling because bucket ranges are finite.'],
      ['What does a set enforce?', ['Unique elements', 'Sorted elements in every implementation', 'Numeric elements only', 'Exactly two elements'], 'Unique elements', 'Sets represent membership without duplicates.'],
      ['Why choose an array over a linked list for indexed access?', ['Arrays provide direct index lookup', 'Arrays never use memory', 'Linked lists cannot store values', 'Arrays are always sorted'], 'Arrays provide direct index lookup', 'Contiguous array layout supports constant-time indexing.']
    ]);
    for (let i = 0; i < 10; i += 1) {
      const n = 3 + i;
      questions.push(qNumber(
        `cp2-recursion-${i + 1}`, 'Recursion',
        `A recursive factorial function uses fact(0) = 1 and fact(n) = n · fact(n−1). Find fact(${n}).`,
        factorial(n), `Expanding the recurrence gives ${n}! = ${factorial(n)}.`,
        { kind: 'factorial', n }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const halvings = i + 3;
      const size = 2 ** halvings;
      questions.push(qNumber(
        `cp2-complexity-${i + 1}`, 'Algorithms and complexity',
        `A binary-search interval contains ${size} elements. How many exact halvings reduce it to one element?`,
        halvings, `${size} = 2^${halvings}, so ${halvings} halvings leave one candidate.`,
        { kind: 'binary-halvings', size }
      ));
    }
    addConcepts('cp2-memory', 'Memory and concurrency', [
      ['Where do ordinary function call frames live?', ['Call stack', 'Database heap table', 'Network queue', 'Source file'], 'Call stack', 'Each active call owns a stack frame until it returns.'],
      ['Where do dynamically allocated objects generally live?', ['Heap', 'Instruction pointer', 'Comment block', 'Import list'], 'Heap', 'Heap allocation supports lifetimes independent of one function call.'],
      ['What does garbage collection reclaim?', ['Unreachable managed objects', 'Every local variable immediately', 'Source code comments', 'Network packets'], 'Unreachable managed objects', 'A collector finds managed allocations no live reference can reach.'],
      ['What is a memory leak?', ['Allocated memory that is no longer useful but remains retained', 'A syntax error', 'A sorted array', 'A successful exception handler'], 'Allocated memory that is no longer useful but remains retained', 'Leaks grow memory use because obsolete allocations are never released.'],
      ['What is a race condition?', ['Result depends on uncontrolled thread timing', 'Two loops have equal length', 'A function returns early', 'A file has duplicate lines'], 'Result depends on uncontrolled thread timing', 'Unsynchronized shared access can produce timing-dependent results.'],
      ['What does a mutex protect?', ['A critical section of shared state', 'Every function parameter', 'A compiler executable', 'A CSS selector'], 'A critical section of shared state', 'A mutex allows one holder at a time into protected code.'],
      ['How does a process differ from a thread?', ['A process has an isolated address space', 'A process cannot execute code', 'A thread owns a separate computer', 'They are always identical'], 'A process has an isolated address space', 'Threads usually share their process memory; separate processes do not.'],
      ['What is deadlock?', ['Tasks wait forever for resources held by each other', 'A loop reaches its base case', 'A map finds a key', 'A file closes normally'], 'Tasks wait forever for resources held by each other', 'Circular resource waits can prevent every participant from progressing.'],
      ['What is a dangling reference?', ['A reference to memory whose lifetime ended', 'A valid global constant', 'A recursive return value', 'A queue front'], 'A reference to memory whose lifetime ended', 'Using an object after its storage is released is unsafe.'],
      ['Why minimize shared mutable state?', ['It reduces synchronization bugs', 'It makes every algorithm O(1)', 'It prevents all exceptions', 'It removes the need for tests'], 'It reduces synchronization bugs', 'Less shared mutation means fewer timing-sensitive interactions.']
    ]);
    return questions;
  }

  function dataHandling() {
    const questions = [];
    const addConcepts = (prefix, topic, rows) => rows.forEach(([prompt, choices, answer, explanation], i) => {
      questions.push(qChoice(`${prefix}-${i + 1}`, topic, prompt, choices, answer, explanation, { kind: 'concept', expected: answer }));
    });
    for (let i = 0; i < 10; i += 1) {
      const values = [i + 2, i + 4, i + 6, i + 8];
      const answer = values.reduce((sum, value) => sum + value, 0) / values.length;
      questions.push(qNumber(
        `data-sheet-${i + 1}`, 'Spreadsheets',
        `A spreadsheet range contains ${values.join(', ')}. What does AVERAGE return?`,
        answer, `AVERAGE adds the four values and divides by 4, giving ${answer}.`,
        { kind: 'average', values }
      ));
    }
    addConcepts('data-sql', 'SQL and databases', [
      ['Which SQL clause chooses columns to return?', ['SELECT', 'WHERE', 'JOIN', 'GROUP BY'], 'SELECT', 'SELECT defines the output columns.'],
      ['Which SQL clause filters rows before aggregation?', ['WHERE', 'ORDER BY', 'SELECT', 'AS'], 'WHERE', 'WHERE keeps only rows satisfying its condition.'],
      ['Which join keeps only matching rows from both tables?', ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'FULL JOIN'], 'INNER JOIN', 'INNER JOIN returns rows with a match on both sides.'],
      ['Which join keeps every row from the left table?', ['LEFT JOIN', 'INNER JOIN', 'CROSS JOIN', 'SELF JOIN only'], 'LEFT JOIN', 'LEFT JOIN preserves left rows and fills missing right values with NULL.'],
      ['Which function counts rows?', ['COUNT', 'SUM', 'AVG', 'MAX'], 'COUNT', 'COUNT returns the number of qualifying rows or non-NULL values.'],
      ['What does GROUP BY do?', ['Forms groups for aggregate calculations', 'Deletes duplicate tables', 'Sorts text alphabetically only', 'Renames a database'], 'Forms groups for aggregate calculations', 'GROUP BY partitions rows before COUNT, SUM, AVG, and similar functions.'],
      ['What uniquely identifies a table row?', ['Primary key', 'Foreign key only', 'Column alias', 'WHERE clause'], 'Primary key', 'A primary key is unique and non-NULL for each row.'],
      ['What does a foreign key represent?', ['A relationship to another table’s key', 'A computed average', 'A file name', 'A chart axis'], 'A relationship to another table’s key', 'Foreign keys connect related records and support referential integrity.'],
      ['Which value represents missing or unknown SQL data?', ['NULL', '0', 'Empty table', 'FALSE always'], 'NULL', 'NULL is distinct from zero and empty text.'],
      ['Why use a CTE?', ['Name an intermediate query for clarity and reuse', 'Encrypt every row', 'Replace all indexes', 'Open a spreadsheet'], 'Name an intermediate query for clarity and reuse', 'WITH clauses make multi-step queries easier to read.']
    ]);
    for (let i = 0; i < 10; i += 1) {
      const values = [i, i + 2, i + 4, i + 8, i + 12];
      questions.push(qNumber(
        `data-stats-${i + 1}`, 'Descriptive statistics',
        `Find the median of ${values.join(', ')}.`,
        values[2], `The values are ordered, so the middle value is ${values[2]}.`,
        { kind: 'median', values }
      ));
    }
    addConcepts('data-cleaning', 'Data quality and cleaning', [
      ['What does completeness measure?', ['Whether required values are present', 'Whether values are sorted', 'Whether a chart has color', 'Whether SQL uses aliases'], 'Whether required values are present', 'Completeness tracks missing required data.'],
      ['What does validity measure?', ['Whether values follow allowed rules and formats', 'Whether every value is unique', 'Whether a mean is large', 'Whether a file is compressed'], 'Whether values follow allowed rules and formats', 'Validity compares data against its domain constraints.'],
      ['What should happen before deleting an outlier?', ['Investigate whether it is error or genuine', 'Delete it automatically', 'Replace it with zero', 'Hide the entire column'], 'Investigate whether it is error or genuine', 'Extreme values may carry real information rather than represent mistakes.'],
      ['What is deduplication?', ['Finding and resolving repeated records', 'Sorting rows by date', 'Calculating a median', 'Joining every table'], 'Finding and resolving repeated records', 'Deduplication prevents one entity from being counted multiple times.'],
      ['What does standardization fix?', ['Equivalent values stored in inconsistent forms', 'Every missing value', 'All sampling bias', 'Every SQL error'], 'Equivalent values stored in inconsistent forms', 'Standardization makes representations such as dates and categories consistent.'],
      ['What does MCAR mean?', ['Missingness unrelated to observed or missing values', 'Every value is present', 'Data is sorted randomly', 'Missingness caused by the missing value itself'], 'Missingness unrelated to observed or missing values', 'MCAR describes missingness with no systematic relationship to the data.'],
      ['Why keep a cleaning log?', ['Make transformations reproducible and reviewable', 'Increase chart colors', 'Avoid primary keys', 'Remove every outlier'], 'Make transformations reproducible and reviewable', 'A log records what changed and why.'],
      ['What is input validation?', ['Rejecting or constraining invalid values at entry', 'Drawing a histogram', 'Running a regression', 'Creating duplicate records'], 'Rejecting or constraining invalid values at entry', 'Preventing bad input is cheaper than repairing it later.'],
      ['What is a fuzzy duplicate?', ['A repeated entity with non-identical spelling or formatting', 'A row with a NULL value', 'A perfectly identical row', 'A chart without labels'], 'A repeated entity with non-identical spelling or formatting', 'Names and addresses often vary while referring to the same entity.'],
      ['Which action best preserves raw data?', ['Create a cleaned copy and leave source unchanged', 'Overwrite the source immediately', 'Delete rejected rows permanently', 'Round every number'], 'Create a cleaned copy and leave source unchanged', 'An immutable raw source supports auditing and recovery.']
    ]);
    for (let i = 0; i < 10; i += 1) {
      const x1 = i;
      const x2 = i + 2 + (i % 3);
      const slope = (i % 5) - 2 || 3;
      const y1 = 2 * i - 1;
      const y2 = y1 + slope * (x2 - x1);
      questions.push(qNumber(
        `data-regression-${i + 1}`, 'Correlation and regression',
        `A fitted line passes through (${x1}, ${y1}) and (${x2}, ${y2}). Find its slope.`,
        slope, `Slope = (${y2} − ${y1})/(${x2} − ${x1}) = ${slope}.`,
        { kind: 'two-point-slope', x1, y1, x2, y2 }
      ));
    }
    addConcepts('data-visual', 'Visualization and storytelling', [
      ['Best chart for change over time?', ['Line chart', 'Pie chart', 'Scatterplot only', 'Unlabeled table'], 'Line chart', 'Connected positions emphasize temporal movement.'],
      ['Best chart for two quantitative variables?', ['Scatterplot', 'Pie chart', 'Single bar', 'Flowchart'], 'Scatterplot', 'A scatterplot reveals association, clusters, and outliers between two numeric variables.'],
      ['Best chart for comparing category totals?', ['Bar chart', 'Line chart with dates missing', 'Pie chart with 30 slices', 'Map without geography'], 'Bar chart', 'Position and length make category comparisons clear.'],
      ['Why can a truncated bar-chart axis mislead?', ['It exaggerates visual differences', 'It changes stored values', 'It prevents labels', 'It sorts categories'], 'It exaggerates visual differences', 'Bars encode magnitude from a baseline, so truncation distorts relative lengths.'],
      ['What does correlation establish by itself?', ['Association, not causation', 'Causation', 'A randomized experiment', 'Perfect prediction'], 'Association, not causation', 'Confounding and reverse causality remain possible.'],
      ['What should a chart title communicate?', ['The main question or finding', 'Only the file name', 'Every raw row', 'The software version'], 'The main question or finding', 'A useful title helps the audience interpret the display.'],
      ['Why avoid unnecessary 3D effects?', ['They distort comparison and add clutter', 'They make values exact', 'They remove legends', 'They calculate averages'], 'They distort comparison and add clutter', 'Perspective effects add no data and can change perceived size.'],
      ['What does data-ink ratio encourage?', ['More informative marks and less decoration', 'More gradients', 'More chart borders', 'Removing all labels'], 'More informative marks and less decoration', 'Visual elements should carry information or support comprehension.'],
      ['What belongs in a data story after the finding?', ['Its implication or recommended action', 'An unrelated chart', 'Every discarded draft', 'A hidden axis'], 'Its implication or recommended action', 'Context, finding, and implication connect evidence to a decision.'],
      ['Why label units on axes?', ['Numbers need measurement context', 'Units increase sample size', 'Units remove outliers', 'Units imply causation'], 'Numbers need measurement context', 'A value is ambiguous without its scale or measurement unit.']
    ]);
    return questions;
  }

  function physicsTwo() {
    const questions = [];
    for (let i = 0; i < 10; i += 1) {
      const mass = 1 + (i % 5);
      const specificHeat = 2 + (i % 4);
      const temperatureChange = 3 + i;
      const answer = mass * specificHeat * temperatureChange;
      questions.push(qNumber(
        `physics2-thermal-${i + 1}`, 'Thermodynamics',
        `A ${mass} kg sample with specific heat ${specificHeat} J/(kg·°C) warms by ${temperatureChange}°C. How much heat is added, in joules?`,
        answer, `Q = mcΔT = ${mass}(${specificHeat})(${temperatureChange}) = ${answer} J.`,
        { kind: 'specific-heat', mass, specificHeat, temperatureChange }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const charge1 = 1 + (i % 5);
      const charge2 = 2 + (i % 4);
      const distance = 1 + (i % 3);
      const answer = 0.009 * charge1 * charge2 / distance ** 2;
      questions.push(qNumber(
        `physics2-electric-${i + 1}`, 'Electrostatics',
        `Charges ${charge1} μC and ${charge2} μC are ${distance} m apart. Find the Coulomb-force magnitude in newtons; use k = 9.0×10⁹.`,
        answer, `F = k|q₁q₂|/r² = ${fmt(answer)} N.`,
        { kind: 'coulomb-micro', charge1, charge2, distance }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const resistance = 2 + (i % 6);
      const current = 1 + (i % 5);
      const voltage = resistance * current;
      questions.push(qNumber(
        `physics2-circuit-${i + 1}`, 'Electric circuits',
        `A ${resistance} Ω resistor has ${voltage} V across it. Find the current in amperes.`,
        current, `Ohm’s law gives I = V/R = ${voltage}/${resistance} = ${current} A.`,
        { kind: 'ohms-law-current', voltage, resistance }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const charge = 1 + (i % 5);
      const velocity = 2 + (i % 6);
      const field = 0.5 + (i % 4) * 0.5;
      const answer = charge * velocity * field;
      questions.push(qNumber(
        `physics2-magnetic-${i + 1}`, 'Magnetism',
        `A ${charge} μC charge moves perpendicular to a ${field} T field at ${velocity} m/s. Find the magnetic-force magnitude in μN.`,
        answer, `F = qvB. With q in μC, the result is ${charge}(${velocity})(${field}) = ${fmt(answer)} μN.`,
        { kind: 'magnetic-force-micro', charge, velocity, field }
      ));
    }
    for (let i = 0; i < 10; i += 1) {
      const focalLength = 2 + i;
      const objectDistance = 2 * focalLength;
      questions.push(qNumber(
        `physics2-optics-${i + 1}`, 'Geometric optics',
        `A converging lens has focal length ${focalLength} cm. An object is ${objectDistance} cm away. Find the image distance in centimeters.`,
        objectDistance, `1/f = 1/dₒ + 1/dᵢ. With dₒ = 2f, dᵢ = 2f = ${objectDistance} cm.`,
        { kind: 'thin-lens-image', focalLength, objectDistance }
      ));
    }
    const wavelengths = [620, 496, 400, 310, 248, 200, 155, 124, 100, 80];
    wavelengths.forEach((wavelength, i) => {
      const answer = 1240 / wavelength;
      questions.push(qNumber(
        `physics2-quantum-${i + 1}`, 'Modern physics',
        `Using hc = 1240 eV·nm, find the energy in eV of a photon with wavelength ${wavelength} nm.`,
        answer, `E = hc/λ = 1240/${wavelength} = ${fmt(answer)} eV.`,
        { kind: 'photon-energy', wavelength }
      ));
    });
    return questions;
  }

  const generatedCourse = (prefix, topics) => {
    const questions = [];
    topics.forEach(([topic, build]) => {
      for (let i = 0; i < 10; i += 1) {
        const item = build(i);
        questions.push(qNumber(`${prefix}-${questions.length + 1}`, topic, item.prompt, item.answer, item.explanation, item.meta, item.tolerance));
      }
    });
    return questions;
  };

  function linearAlgebra() {
    return generatedCourse('la', [
      ['Vectors and dot products', (i) => { const u = [i + 1, i % 4 - 2], v = [i % 3 + 2, 3 - i]; const answer = u[0] * v[0] + u[1] * v[1]; return { prompt: `Find (${u.join(', ')}) · (${v.join(', ')}).`, answer, explanation: `Multiply aligned components and add: ${answer}.`, meta: { kind: 'vector-dot', u, v } }; }],
      ['Vector magnitude', (i) => { const a = i + 3, b = 2 * i + 4; const answer = Math.hypot(a, b); return { prompt: `Find the magnitude of vector (${a}, ${b}).`, answer, explanation: `The magnitude is √(${a}² + ${b}²) = ${fmt(answer)}.`, meta: { kind: 'pythagorean', a, b } }; }],
      ['Matrix determinants', (i) => { const a = i + 1, b = i % 4, c = 2 - i, d = i % 5 + 2, answer = a * d - b * c; return { prompt: `Find det([[${a}, ${b}], [${c}, ${d}]]).`, answer, explanation: `For a 2×2 matrix, det = ad − bc = ${answer}.`, meta: { kind: 'determinant-2', a, b, c, d } }; }],
      ['Matrix traces', (i) => { const diagonal = [i - 3, i + 2, 2 * i + 1], answer = diagonal.reduce((sum, value) => sum + value, 0); return { prompt: `Find the trace of a 3×3 matrix whose diagonal entries are ${diagonal.join(', ')}.`, answer, explanation: `The trace is the sum of diagonal entries: ${answer}.`, meta: { kind: 'sum-values', values: diagonal } }; }],
      ['Matrix multiplication', (i) => { const row = [i + 1, 2 - i], column = [i % 3 + 1, i + 2], answer = row[0] * column[0] + row[1] * column[1]; return { prompt: `A matrix row is [${row.join(', ')}] and the aligned column is [${column.join(', ')}]. Find their product entry.`, answer, explanation: `The entry is the row-column dot product: ${answer}.`, meta: { kind: 'vector-dot', u: row, v: column } }; }],
      ['Eigenvalues', (i) => { const values = [i - 2, 2 * i + 1, 5 - i], answer = Math.max(...values); return { prompt: `A diagonal matrix has diagonal entries ${values.join(', ')}. Find its largest eigenvalue.`, answer, explanation: `A diagonal matrix’s eigenvalues are its diagonal entries, so the largest is ${answer}.`, meta: { kind: 'max-values', values } }; }]
    ]);
  }

  function differentialEquations() {
    return generatedCourse('de', [
      ['Differential equations', (i) => { const coefficient = i + 2, rate = i % 5 - 2, answer = coefficient * rate; return { prompt: `If y = ${coefficient}e^(${rate}t), find y′(0).`, answer, explanation: `y′ = ${coefficient * rate}e^(${rate}t), so y′(0) = ${answer}.`, meta: { kind: 'exponential-derivative-zero', coefficient, rate } }; }],
      ['Growth and decay', (i) => { const initial = i + 3, ratio = i % 2 ? 0.5 : 2, time = i % 4 + 1, answer = initial * ratio ** time; return { prompt: `A model satisfies y(t) = ${initial}(${ratio})^t. Find y(${time}).`, answer, explanation: `Substitution gives ${initial}(${ratio})^${time} = ${fmt(answer)}.`, meta: { kind: 'geometric-term-zero', initial, ratio, time } }; }],
      ['Characteristic equations', (i) => { const r1 = i % 5 - 3, r2 = i + 1, sum = r1 + r2, product = r1 * r2; return { prompt: `Find the larger root of r² − ${sum}r + ${product} = 0.`, answer: Math.max(r1, r2), explanation: `The polynomial factors with roots ${r1} and ${r2}.`, meta: { kind: 'quadratic-larger-root', sum, product } }; }],
      ['Euler’s method', (i) => { const y = i + 1, h = 0.1 * (i % 4 + 1), a = i % 3 + 1, b = i - 2, answer = y + h * (a * y + b); return { prompt: `Use one Euler step for y′ = ${a}y ${term(b, '')}, starting at y = ${y} with h = ${fmt(h)}. Find the next y-value.`, answer, explanation: `y_next = y + h·f = ${fmt(answer)}.`, meta: { kind: 'euler-step-linear', y, h, a, b } }; }],
      ['Oscillations', (i) => { const mass = i % 4 + 1, omega = i % 5 + 1, spring = mass * omega ** 2; return { prompt: `A mass-spring system has m = ${mass} kg and k = ${spring} N/m. Find angular frequency ω in rad/s.`, answer: omega, explanation: `ω = √(k/m) = √(${spring}/${mass}) = ${omega}.`, meta: { kind: 'angular-frequency', mass, spring } }; }],
      ['Laplace transforms', (i) => { const power = i % 5, s = i % 4 + 1, answer = factorial(power) / s ** (power + 1); return { prompt: `For F(s) = L{t^${power}} = ${power}!/s^${power + 1}, find F(${s}).`, answer, explanation: `Evaluate ${power}!/${s}^${power + 1} = ${fmt(answer)}.`, meta: { kind: 'laplace-power', power, s } }; }]
    ]);
  }

  function mathematicalProofs() {
    const logicCases = [[true, true, 'and'], [true, false, 'and'], [false, true, 'or'], [false, false, 'or'], [true, true, 'implies'], [true, false, 'implies'], [false, true, 'implies'], [false, false, 'implies'], [true, true, 'biconditional'], [true, false, 'biconditional']];
    return generatedCourse('proof', [
      ['Statements and logic', (i) => { const [p, q, operation] = logicCases[i]; const truth = operation === 'and' ? p && q : operation === 'or' ? p || q : operation === 'implies' ? !p || q : p === q; return { prompt: `Encode true as 1 and false as 0. With p=${Number(p)} and q=${Number(q)}, evaluate p ${operation} q.`, answer: Number(truth), explanation: `The truth table gives ${Number(truth)}.`, meta: { kind: 'logic-number', p, q, operation } }; }],
      ['Parity and divisibility', (i) => { const a = 2 * i + 1, b = 3 * i + 2, answer = (a + b) % 2; return { prompt: `Encode even as 0 and odd as 1. What is the parity of ${a} + ${b}?`, answer, explanation: `${a + b} has parity ${answer}.`, meta: { kind: 'sum-parity', a, b } }; }],
      ['Direct proofs', (i) => { const divisor = i % 5 + 2, multiple = i + 3, value = divisor * multiple; return { prompt: `In a direct divisibility proof, ${value} = ${divisor}k. What integer value of k witnesses that ${divisor} divides ${value}?`, answer: multiple, explanation: `${value} = ${divisor}(${multiple}), so k = ${multiple}.`, meta: { kind: 'division', dividend: value, divisor } }; }],
      ['Proofs about sets', (i) => { const a = Array.from({ length: 6 }, (_, n) => n + i).filter((n) => n % 2 === 0), b = Array.from({ length: 7 }, (_, n) => n + i).filter((n) => n % 3 !== 0), answer = new Set(a.filter((value) => b.includes(value))).size; return { prompt: `Find |A ∩ B| for A={${a.join(', ')}} and B={${b.join(', ')}}.`, answer, explanation: `Counting the shared elements gives ${answer}.`, meta: { kind: 'intersection-size', a, b } }; }],
      ['Mathematical induction', (i) => { const n = i + 4, answer = n * (n + 1) / 2; return { prompt: `The induction formula is 1 + ··· + n = n(n+1)/2. Evaluate its right side for n=${n}.`, answer, explanation: `${n}(${n + 1})/2 = ${answer}.`, meta: { kind: 'loop-sum', n } }; }],
      ['Quantifiers and witnesses', (i) => { const limit = i + 8, divisor = i % 4 + 2, values = Array.from({ length: limit }, (_, n) => n + 1), answer = values.filter((value) => value % divisor === 0).length; return { prompt: `Over integers 1 through ${limit}, how many witnesses satisfy “${divisor} divides x”?`, answer, explanation: `The satisfying integers are the multiples of ${divisor}; there are ${answer}.`, meta: { kind: 'count-divisible', limit, divisor } }; }]
    ]);
  }

  function networking() {
    return generatedCourse('net', [
      ['Bandwidth and transmission', (i) => { const bits = (i + 2) * 1000, rate = (i % 5 + 1) * 1000, answer = bits / rate; return { prompt: `How many seconds transmit ${bits} bits over a ${rate} bit/s link?`, answer, explanation: `Transmission time = bits/rate = ${fmt(answer)} s.`, meta: { kind: 'division', dividend: bits, divisor: rate } }; }],
      ['Latency and propagation', (i) => { const distance = (i + 1) * 200, speed = 200, answer = distance / speed; return { prompt: `A signal travels ${distance} km through fiber at 200,000 km/s. Find propagation delay in milliseconds.`, answer, explanation: `(${distance}/200000)×1000 = ${answer} ms.`, meta: { kind: 'propagation-ms', distance, speedThousands: speed } }; }],
      ['IPv4 addressing', (i) => { const hostBits = i + 2, answer = 2 ** hostBits - 2; return { prompt: `A traditional IPv4 subnet has ${hostBits} host bits. How many usable host addresses does it provide?`, answer, explanation: `2^${hostBits} − 2 = ${answer} usable addresses.`, meta: { kind: 'subnet-hosts', hostBits } }; }],
      ['CIDR notation', (i) => { const prefix = 22 + i, answer = 2 ** (32 - prefix); return { prompt: `How many total IPv4 addresses are in a /${prefix} block?`, answer, explanation: `A /${prefix} leaves ${32 - prefix} bits, so the block has ${answer} addresses.`, meta: { kind: 'cidr-addresses', prefix } }; }],
      ['Bandwidth-delay product', (i) => { const rateMbps = i + 1, rttMs = (i % 5 + 1) * 10, answer = rateMbps * rttMs * 125; return { prompt: `Find the bandwidth-delay product in bytes for ${rateMbps} Mb/s and ${rttMs} ms RTT.`, answer, explanation: `Mb/s × ms converts to 1000 bits; divide by 8: ${answer} bytes.`, meta: { kind: 'bandwidth-delay-bytes', rateMbps, rttMs } }; }],
      ['Ports and multiplexing', (i) => { const low = 1000 + i * 100, high = low + 20 + i; return { prompt: `How many inclusive port numbers are in the range ${low}–${high}?`, answer: high - low + 1, explanation: `${high} − ${low} + 1 = ${high - low + 1}.`, meta: { kind: 'inclusive-count', low, high } }; }]
    ]);
  }

  function systemsProgramming() {
    return generatedCourse('sys', [
      ['Binary representation', (i) => { const value = i * 7 + 5, binary = value.toString(2); return { prompt: `Convert binary ${binary} to decimal.`, answer: value, explanation: `Summing its powers of two gives ${value}.`, meta: { kind: 'binary-value', binary } }; }],
      ['Hexadecimal', (i) => { const value = i * 19 + 16, hex = value.toString(16).toUpperCase(); return { prompt: `Convert hexadecimal 0x${hex} to decimal.`, answer: value, explanation: `Base-16 expansion gives ${value}.`, meta: { kind: 'hex-value', hex } }; }],
      ['Two’s complement', (i) => { const bits = 8, unsigned = 128 + i * 7; return { prompt: `Interpret 8-bit two’s-complement ${unsigned.toString(2).padStart(8, '0')} as a signed decimal integer.`, answer: unsigned - 256, explanation: `The sign bit is 1, so subtract 256: ${unsigned - 256}.`, meta: { kind: 'twos-complement', unsigned, bits } }; }],
      ['Memory addressing', (i) => { const base = 1024 + i * 64, index = i + 2, width = i % 4 + 1, answer = base + index * width; return { prompt: `An array begins at byte address ${base}; elements are ${width} bytes. Find the address of element ${index}.`, answer, explanation: `base + index×width = ${answer}.`, meta: { kind: 'array-address', base, index, width } }; }],
      ['Cache performance', (i) => { const hitRate = 0.8 + i * 0.01, hitTime = 1 + i % 3, missTime = 40 + i, answer = hitRate * hitTime + (1 - hitRate) * missTime; return { prompt: `A cache hits with probability ${fmt(hitRate)}, taking ${hitTime} ns; a miss takes ${missTime} ns. Find average access time in ns.`, answer, explanation: `Weighted average = ${fmt(answer)} ns.`, meta: { kind: 'cache-average', hitRate, hitTime, missTime } }; }],
      ['CPU scheduling', (i) => { const arrival = i, burst = i % 5 + 2, start = arrival + i % 3, answer = start + burst - arrival; return { prompt: `A process arrives at t=${arrival}, starts at t=${start}, and runs for ${burst} time units. Find turnaround time.`, answer, explanation: `Completion is ${start + burst}; turnaround = completion − arrival = ${answer}.`, meta: { kind: 'turnaround', arrival, start, burst } }; }]
    ]);
  }

  function engineeringOne() {
    return generatedCourse('eng', [
      ['Units and measurement', (i) => { const meters = i + 1.25, answer = meters * 1000; return { prompt: `Convert ${meters} meters to millimeters.`, answer, explanation: `Multiply by 1000: ${answer} mm.`, meta: { kind: 'meters-to-mm', meters } }; }],
      ['Vectors and resultants', (i) => { const a = i + 3, b = i * 2 + 4; return { prompt: `Perpendicular forces have magnitudes ${a} N and ${b} N. Find the resultant magnitude.`, answer: Math.hypot(a, b), explanation: `Use the Pythagorean theorem: ${fmt(Math.hypot(a, b))} N.`, meta: { kind: 'pythagorean', a, b } }; }],
      ['Statics and moments', (i) => { const force = i + 5, distance = i % 4 + 0.5, answer = force * distance; return { prompt: `A perpendicular ${force} N force acts ${distance} m from a pivot. Find its moment in N·m.`, answer, explanation: `Moment = Fd = ${fmt(answer)} N·m.`, meta: { kind: 'torque', force, radius: distance } }; }],
      ['Stress and strain', (i) => { const force = (i + 2) * 1000, area = (i % 5 + 1) * 100, answer = force / area; return { prompt: `A member carries ${force} N over ${area} mm². Find stress in N/mm².`, answer, explanation: `Stress = force/area = ${fmt(answer)} N/mm².`, meta: { kind: 'division', dividend: force, divisor: area } }; }],
      ['Work and power', (i) => { const work = (i + 2) * 120, time = i % 5 + 2, answer = work / time; return { prompt: `A system performs ${work} J of work in ${time} s. Find average power in watts.`, answer, explanation: `P = W/t = ${answer} W.`, meta: { kind: 'division', dividend: work, divisor: time } }; }],
      ['Electric circuits', (i) => { const resistance = i % 6 + 2, current = i + 1, voltage = resistance * current; return { prompt: `A ${resistance} Ω resistor has ${voltage} V across it. Find current in amperes.`, answer: current, explanation: `I = V/R = ${current} A.`, meta: { kind: 'ohms-law-current', voltage, resistance } }; }]
    ]);
  }

  function physicsCMechanics() {
    return generatedCourse('physc', [
      ['Calculus-based kinematics', (i) => { const a = i % 4 + 1, b = i - 2, t = i % 5 + 1, answer = 3 * a * t ** 2 + 2 * b * t; return { prompt: `Position is x(t)=${a}t³ ${term(b, 't²')}. Find velocity at t=${t}.`, answer, explanation: `v=3(${a})t²+2(${b})t, giving ${answer}.`, meta: { kind: 'cubic-position-velocity', a, b, t } }; }],
      ['Force and acceleration', (i) => { const mass = i % 5 + 1, force = (i + 2) * mass; return { prompt: `A ${mass} kg mass experiences net force ${force} N. Find acceleration in m/s².`, answer: force / mass, explanation: `a=F/m=${force / mass} m/s².`, meta: { kind: 'division', dividend: force, divisor: mass } }; }],
      ['Work by variable forces', (i) => { const k = i + 2, upper = i % 5 + 1, answer = k * upper ** 2 / 2; return { prompt: `Evaluate the work ∫₀^${upper} ${k}x dx, in joules.`, answer, explanation: `Work = (${k}/2)(${upper})² = ${fmt(answer)} J.`, meta: { kind: 'linear-integral', m: k, b: 0, upper } }; }],
      ['Impulse and momentum', (i) => { const force = i + 3, duration = i % 4 + 0.5, answer = force * duration; return { prompt: `A constant ${force} N force acts for ${duration} s. Find impulse in N·s.`, answer, explanation: `J=FΔt=${fmt(answer)} N·s.`, meta: { kind: 'product', a: force, b: duration } }; }],
      ['Rotational dynamics', (i) => { const torque = (i + 2) * (i % 4 + 1), inertia = i % 4 + 1; return { prompt: `Net torque is ${torque} N·m and moment of inertia is ${inertia} kg·m². Find angular acceleration.`, answer: torque / inertia, explanation: `α=τ/I=${torque / inertia} rad/s².`, meta: { kind: 'division', dividend: torque, divisor: inertia } }; }],
      ['Gravitation and orbits', (i) => { const radius = i % 5 + 1, speed = i + 2; return { prompt: `In scaled units, a circular orbit has speed ${speed} and radius ${radius}. Find centripetal acceleration v²/r.`, answer: speed ** 2 / radius, explanation: `a=v²/r=${fmt(speed ** 2 / radius)}.`, meta: { kind: 'square-over', value: speed, divisor: radius } }; }]
    ]);
  }

  function quantumPhysicsOptics() {
    return generatedCourse('quantum', [
      ['Wave optics', (i) => { const wavelength = i + 2, distance = i % 5 + 1, slit = i % 4 + 1, answer = wavelength * distance / slit; return { prompt: `In scaled units, double-slit spacing is Δy=λL/d. Find Δy for λ=${wavelength}, L=${distance}, d=${slit}.`, answer, explanation: `Δy=${wavelength}(${distance})/${slit}=${fmt(answer)}.`, meta: { kind: 'triple-product-division', a: wavelength, b: distance, divisor: slit } }; }],
      ['Diffraction', (i) => { const wavelength = i % 5 + 1, slit = wavelength * (i + 2); return { prompt: `For first-minimum diffraction, sin θ=λ/a. Find sin θ when λ=${wavelength} and a=${slit}.`, answer: wavelength / slit, explanation: `sin θ=λ/a=${fmt(wavelength / slit)}.`, meta: { kind: 'division', dividend: wavelength, divisor: slit } }; }],
      ['Photons', (i) => { const wavelength = 100 + i * 40, answer = 1240 / wavelength; return { prompt: `Using hc=1240 eV·nm, find photon energy for λ=${wavelength} nm.`, answer, explanation: `E=1240/${wavelength}=${fmt(answer)} eV.`, meta: { kind: 'photon-energy', wavelength } }; }],
      ['Photoelectric effect', (i) => { const photon = i + 4, workFunction = i % 3 + 1.5, answer = photon - workFunction; return { prompt: `A photon has energy ${photon} eV and the work function is ${workFunction} eV. Find maximum electron kinetic energy.`, answer, explanation: `Kmax=E−φ=${answer} eV.`, meta: { kind: 'difference', a: photon, b: workFunction } }; }],
      ['Matter waves', (i) => { const momentum = i + 2, answer = 1 / momentum; return { prompt: `In units where h=1, find de Broglie wavelength for momentum p=${momentum}.`, answer, explanation: `λ=h/p=1/${momentum}=${fmt(answer)}.`, meta: { kind: 'reciprocal', value: momentum } }; }],
      ['Particle in a box', (i) => { const n = i % 5 + 1, baseEnergy = i + 2, answer = n ** 2 * baseEnergy; return { prompt: `For a particle in a box, Eₙ=n²E₁. Find E_${n} when E₁=${baseEnergy}.`, answer, explanation: `E_${n}=${n}²(${baseEnergy})=${answer}.`, meta: { kind: 'square-times', value: n, factor: baseEnergy } }; }]
    ]);
  }

  function realAnalysisA() {
    return generatedCourse('real', [
      ['Absolute value and bounds', (i) => { const x = i - 6, center = i % 4 - 1; return { prompt: `Find the distance |${x}−(${center})| on the real line.`, answer: Math.abs(x - center), explanation: `Absolute value gives distance: ${Math.abs(x - center)}.`, meta: { kind: 'absolute-difference', a: x, b: center } }; }],
      ['Supremum and infimum', (i) => { const lower = i - 3, upper = lower + i % 5 + 1; return { prompt: `Find sup S for S=(${lower}, ${upper}).`, answer: upper, explanation: `The least upper bound is ${upper}, whether or not it belongs to S.`, meta: { kind: 'identity', value: upper } }; }],
      ['Sequences and limits', (i) => { const limit = i - 4, n = (i + 2) * 10, answer = limit + 1 / n; return { prompt: `For aₙ=${limit}+1/n, find a_${n}.`, answer, explanation: `Substitute n=${n}: ${fmt(answer)}.`, meta: { kind: 'limit-sequence-term', limit, n } }; }],
      ['Epsilon-N arguments', (i) => { const epsilon = 1 / (i + 2), answer = i + 3; return { prompt: `For aₙ=1/n, give the smallest positive integer N such that 1/n<${fmt(epsilon)} for every n≥N.`, answer, explanation: `n must exceed ${i + 2}, so the smallest N is ${answer}.`, meta: { kind: 'epsilon-n-reciprocal', epsilon } }; }],
      ['Topology of the real line', (i) => { const left = i - 5, right = left + i % 4 + 2, point = i % 2 ? left : (left + right) / 2, answer = Math.min(Math.abs(point - left), Math.abs(right - point)); return { prompt: `For interval (${left}, ${right}) and point x=${point}, find the distance from x to the nearer endpoint.`, answer, explanation: `The endpoint distances are ${fmt(Math.abs(point - left))} and ${fmt(Math.abs(right - point))}; minimum ${fmt(answer)}.`, meta: { kind: 'nearest-endpoint', left, right, point } }; }],
      ['Riemann integration', (i) => { const n = i + 2, width = 1 / n, sum = width * Array.from({ length: n }, (_, k) => (k + 1) / n).reduce((total, x) => total + x, 0); return { prompt: `Use ${n} equal subintervals and right endpoints to approximate ∫₀¹x dx.`, answer: sum, explanation: `The right sum is (1/${n})Σ(k/${n})=${fmt(sum)}.`, meta: { kind: 'right-riemann-x', n } }; }]
    ]);
  }

  function advancedAlgorithms() {
    return generatedCourse('algo', [
      ['Asymptotic analysis', (i) => { const exponent = i + 3, size = 2 ** exponent; return { prompt: `How many exact halvings reduce an input of size ${size} to 1?`, answer: exponent, explanation: `${size}=2^${exponent}, so ${exponent} halvings are required.`, meta: { kind: 'binary-halvings', size } }; }],
      ['Divide and conquer', (i) => { const exponent = i + 2, n = 2 ** exponent, answer = n * exponent; return { prompt: `A merge-style recurrence performs n log₂n units. Evaluate it for n=${n}.`, answer, explanation: `${n}·${exponent}=${answer}.`, meta: { kind: 'n-log2-n', n } }; }],
      ['Minimum spanning trees', (i) => { const vertices = i + 5; return { prompt: `Any spanning tree on ${vertices} vertices has how many edges?`, answer: vertices - 1, explanation: `Every tree on V vertices has V−1=${vertices - 1} edges.`, meta: { kind: 'tree-edges', vertices } }; }],
      ['Shortest paths', (i) => { const edges = [i + 2, i % 4 + 1, i + 5], answer = edges.reduce((sum, edge) => sum + edge, 0); return { prompt: `A path uses edge weights ${edges.join(', ')}. Find its total weight.`, answer, explanation: `Path length is the edge-weight sum: ${answer}.`, meta: { kind: 'sum-values', values: edges } }; }],
      ['Dynamic programming', (i) => { const n = i + 5, sequence = [0, 1]; for (let k = 2; k <= n; k += 1) sequence[k] = sequence[k - 1] + sequence[k - 2]; return { prompt: `Using F₀=0, F₁=1, and Fₙ=Fₙ₋₁+Fₙ₋₂, find F_${n}.`, answer: sequence[n], explanation: `Building the DP table gives F_${n}=${sequence[n]}.`, meta: { kind: 'fibonacci', n } }; }],
      ['Bitmask algorithms', (i) => { const bits = i + 1, answer = 2 ** bits; return { prompt: `How many subsets can a ${bits}-bit mask represent?`, answer, explanation: `Each bit has two states, so there are 2^${bits}=${answer} subsets.`, meta: { kind: 'power-two', exponent: bits } }; }]
    ]);
  }

  const courses = [
    {
      slug: 'algebra-geometry',
      title: 'Algebra & Geometry Fundamentals Review',
      tier: 'intro',
      summary: 'Linear equations, systems, quadratics, exponents, area, and right triangles.',
      questions: algebraGeometry()
    },
    {
      slug: 'ap-calculus-bc',
      title: 'AP Calculus BC',
      tier: 'core',
      summary: 'Limits, derivatives, applications, integrals, the Fundamental Theorem, and series.',
      questions: calculus()
    },
    {
      slug: 'computer-programming-1',
      title: 'Computer Programming 1',
      tier: 'intro',
      summary: 'Language fundamentals, operators, control flow, loops, functions, and collections.',
      questions: programming()
    },
    {
      slug: 'discrete-math',
      title: 'Discrete Math',
      tier: 'core',
      summary: 'Logic, sets, combinatorics, probability, graph theory, and modular arithmetic.',
      questions: discreteMath()
    },
    {
      slug: 'ap-physics-1',
      title: 'AP Physics 1',
      tier: 'intro',
      summary: 'Kinematics, forces, energy, momentum, rotation, and circular motion.',
      questions: physics()
    },
    {
      slug: 'precalculus',
      title: 'Precalculus',
      tier: 'core',
      summary: 'Functions, composition, polynomials, exponentials, trigonometry, and sequences.',
      questions: precalculus()
    },
    {
      slug: 'multivariable-calculus',
      title: 'Multivariable Calculus',
      tier: 'advanced',
      summary: 'Vectors, cross products, partial derivatives, gradients, multiple integrals, and vector fields.',
      questions: multivariableCalculus()
    },
    {
      slug: 'computer-programming-2',
      title: 'Computer Programming 2',
      tier: 'core',
      summary: 'OOP, exceptions, data structures, recursion, complexity, memory, and concurrency.',
      questions: programmingTwo()
    },
    {
      slug: 'data-handling-cb',
      title: 'Data Handling CB',
      tier: 'core',
      summary: 'Spreadsheets, SQL, descriptive statistics, cleaning, regression, and visualization.',
      questions: dataHandling()
    },
    {
      slug: 'ap-physics-2',
      title: 'AP Physics 2',
      tier: 'core',
      summary: 'Thermodynamics, electrostatics, circuits, magnetism, optics, and modern physics.',
      questions: physicsTwo()
    },
    {
      slug: 'linear-algebra-a', title: 'Linear Algebra A', tier: 'core',
      summary: 'Vectors, matrices, determinants, transformations, and eigenvalues.', questions: linearAlgebra()
    },
    {
      slug: 'differential-equations', title: 'Differential Equations', tier: 'core',
      summary: 'First-order models, characteristic equations, Euler’s method, oscillations, and Laplace transforms.', questions: differentialEquations()
    },
    {
      slug: 'mathematical-proofs', title: 'Mathematical Proofs', tier: 'core',
      summary: 'Logic, divisibility, sets, direct arguments, induction, and quantifiers.', questions: mathematicalProofs()
    },
    {
      slug: 'computer-networking-fundamentals', title: 'Computer Networking Fundamentals', tier: 'intro',
      summary: 'Bandwidth, latency, IPv4, CIDR, bandwidth-delay products, and ports.', questions: networking()
    },
    {
      slug: 'systems-programming-architecture', title: 'Systems Programming & Architecture', tier: 'core',
      summary: 'Binary, hexadecimal, two’s complement, memory, caches, and CPU scheduling.', questions: systemsProgramming()
    },
    {
      slug: 'engineering-1', title: 'Engineering 1', tier: 'intro',
      summary: 'Measurement, vectors, statics, stress, power, and circuits.', questions: engineeringOne()
    },
    {
      slug: 'ap-physics-c-mechanics', title: 'AP Physics C: Mechanics', tier: 'core',
      summary: 'Calculus-based motion, forces, work, impulse, rotation, and gravitation.', questions: physicsCMechanics()
    },
    {
      slug: 'quantum-physics-optics', title: 'Quantum Physics and Optics', tier: 'core',
      summary: 'Wave optics, diffraction, photons, photoelectricity, matter waves, and quantum energy.', questions: quantumPhysicsOptics()
    },
    {
      slug: 'real-analysis-a', title: 'Real Analysis A', tier: 'advanced',
      summary: 'Bounds, sequences, epsilon arguments, topology, continuity, and Riemann integration.', questions: realAnalysisA()
    },
    {
      slug: 'advanced-algorithms', title: 'Advanced Algorithms', tier: 'advanced',
      summary: 'Asymptotic analysis, divide and conquer, graph algorithms, dynamic programming, and bitmasks.', questions: advancedAlgorithms()
    }
  ];
  const courseBySlug = Object.fromEntries(courses.map((course) => [course.slug, course]));

  return {
    courses,
    getCourse(slug) {
      return courseBySlug[slug] || null;
    }
  };
}));
