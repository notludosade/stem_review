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
