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
  const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  const nonZero = (lo, hi) => range(lo, hi).filter((value) => value !== 0);
  // Cartesian product, last range varying fastest. Fills each tuple by
  // index arithmetic instead of copying every intermediate level.
  const grid = (...ranges) => {
    const total = ranges.reduce((count, values) => count * values.length, 1);
    const tuples = new Array(total);
    for (let k = 0; k < total; k += 1) {
      const tuple = new Array(ranges.length);
      let rest = k;
      for (let d = ranges.length - 1; d >= 0; d -= 1) {
        tuple[d] = ranges[d][rest % ranges[d].length];
        rest = Math.floor(rest / ranges[d].length);
      }
      tuples[k] = tuple;
    }
    return tuples;
  };
  // Evenly spaced picks across a whole parameter grid, so a timed pool covers
  // the full grid instead of only its first rows. Deterministic, so question
  // IDs stay stable between page loads.
  const spread = (items, count) => {
    if (items.length < count) throw new Error(`Grid has ${items.length} tuples, needs ${count}`);
    return Array.from({ length: count }, (_, j) => items[Math.floor(j * items.length / count)]);
  };
  const addFromGrid = (questions, idPrefix, count, tuples, make) => spread(tuples, count).forEach((tuple, j) => {
    questions.push(make(`${idPrefix}-${j + 1}`, ...tuple));
  });
  const regular10 = (tupleAt) => Array.from({ length: 10 }, (_, i) => tupleAt(i));
  // A topic's 40 parameter tuples: the original 10 (unchanged, so their
  // questions and saved-progress IDs never move) + `extra` drawn evenly
  // from a bounded grid, skipping any tuple whose prompt is already in the
  // topic. `build(...tuple)` only needs to return an object with `prompt`.
  // Deterministic pseudo-random order over a grid: a lazy Fisher–Yates
  // shuffle driven by mulberry32, seeded from the grid's size and end tuples.
  // Picks land across every grid dimension (an evenly spaced pick on a
  // nested grid can freeze a whole parameter), the same tuples, so the same
  // IDs, come out on every page load, and only the positions actually
  // consumed get shuffled — no hashing or sorting the whole grid.
  function* seededOrder(tuples) {
    let seed = tuples.length ^ 0x9e3779b9;
    for (const ch of JSON.stringify([tuples[0], tuples[tuples.length - 1]])) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
    const next = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const index = Array.from(tuples.keys());
    for (let k = 0; k < index.length; k += 1) {
      const j = k + Math.floor(next() * (index.length - k));
      [index[k], index[j]] = [index[j], index[k]];
      yield tuples[index[k]];
    }
  }
  const takeOrdered = (tuples, count) => {
    const out = [];
    for (const tuple of seededOrder(tuples)) {
      if (out.length === count) break;
      out.push(tuple);
    }
    return out;
  };
  // A topic's 40 questions: the original 10 parameter tuples (unchanged, so
  // their questions and saved-progress IDs never move) + `extra` drawn from
  // a bounded grid, skipping any tuple whose prompt is already in the topic.
  // `buildAt(index, tuple)` builds the question at its final position, so
  // each question is built exactly once.
  const topicQuestions = (regular, gridTuples, buildAt, extra = 30) => {
    const built = regular.map((tuple, i) => buildAt(i, tuple));
    const seen = new Set(built.map((item) => item.prompt));
    for (const tuple of gridTuples.interleaved ? gridTuples : seededOrder(gridTuples)) {
      if (built.length === regular.length + extra) break;
      const item = buildAt(built.length, tuple);
      if (seen.has(item.prompt)) continue;
      seen.add(item.prompt);
      built.push(item);
    }
    if (built.length < regular.length + extra) throw new Error(`Only ${built.length - regular.length} fresh tuples for "${built[0].prompt}"`);
    return built;
  };
  // Older courses (per-topic IDs): all 40 of a topic through its template.
  const addTopic = (questions, idPrefix, regular, gridTuples, make) => {
    questions.push(...topicQuestions(regular, gridTuples, (i, tuple) => make(`${idPrefix}-${i + 1}`, ...tuple)));
  };
  // Balanced mix of several question shapes (e.g. arithmetic + geometric
  // sequences): each grid in seeded order, then interleaved one at a time, and
  // flagged so topicQuestions keeps that order instead of re-shuffling it.
  const mixGrids = (each, ...grids) => {
    const ordered = grids.map((g) => takeOrdered(g, each));
    const mixed = range(0, each - 1).flatMap((k) => ordered.filter((g) => k < g.length).map((g) => g[k]));
    mixed.interleaved = true;
    return mixed;
  };
  const TF = [true, false];
  const LOGIC_OPS = ['and', 'or', 'implies', 'biconditional'];
  const evalLogic = (p, q, operation) => (operation === 'and' ? p && q : operation === 'or' ? p || q : operation === 'implies' ? !p || q : p === q);
  // Integer-hypotenuse right triangles with legs ≤ 75 — built once, shared by
  // Algebra & Geometry, Precalculus, and the Timed Mastery pool.
  const RIGHT_TRIANGLE_LEGS = grid(range(1, 75), range(1, 75)).filter(([a, b]) => Number.isInteger(Math.hypot(a, b)));

  const agLinearQ = (id, a, x, b) => {
    const c = a * x + b;
    return qNumber(
      id, 'Linear equations',
      `Solve for x: ${a}x ${term(b, '')} = ${c}.`,
      x, `Move the constant, then divide: x = (${c} − (${b}))/${a} = ${x}.`,
      { kind: 'linear', a, b, c }
    );
  };
  const agSystemQ = (id, x, y, a, b, d, e) => {
    const c = a * x + b * y;
    const f = d * x + e * y;
    return qNumber(
      id, 'Systems',
      `Find x: ${a}x ${term(b, 'y')} = ${c} and ${d}x ${term(e, 'y')} = ${f}.`,
      x, `Elimination gives the solution (x, y) = (${x}, ${y}), so x = ${x}.`,
      { kind: 'system-x', a, b, c, d, e, f }
    );
  };
  const agQuadraticQ = (id, r1, r2) => {
    const sum = r1 + r2;
    const product = r1 * r2;
    return qNumber(
      id, 'Quadratics',
      `What is the larger real solution of x² ${term(-sum, 'x')} ${term(product, '')} = 0?`,
      Math.max(r1, r2),
      `The expression factors as (x − ${r1})(x − ${r2}), giving roots ${r1} and ${r2}.`,
      { kind: 'quadratic-larger-root', sum, product }
    );
  };
  const agExponentQ = (id, base, m, n, p) => {
    const answer = base ** (m + n - p);
    return qNumber(
      id, 'Exponents',
      `Evaluate (${base}^${m} · ${base}^${n}) ÷ ${base}^${p}.`,
      answer,
      `Add exponents when multiplying and subtract when dividing: ${base}^${m + n - p} = ${answer}.`,
      { kind: 'exponent', base, m, n, p }
    );
  };
  const agAreaQ = (id, width, height) => qNumber(
    id, 'Area',
    `A rectangle is ${width} units wide and ${height} units tall. What is its area in square units?`,
    width * height, `Area = width × height = ${width} × ${height} = ${width * height}.`,
    { kind: 'rectangle-area', width, height }
  );
  const agPythagoreanQ = (id, a, b) => {
    const answer = Math.sqrt(a * a + b * b);
    return qNumber(
      id, 'Right triangles',
      `A right triangle has legs ${a} and ${b}. Find its hypotenuse.`,
      answer, `c = √(${a}² + ${b}²) = √${a * a + b * b} = ${answer}.`,
      { kind: 'pythagorean', a, b }
    );
  };

  function algebraGeometry() {
    const questions = [];
    addTopic(questions, 'ag-linear', regular10((i) => [2 + (i % 4), i - 4, (i % 5) - 2]),
      grid(range(2, 6), range(-6, 8), nonZero(-5, 5)), agLinearQ);
    addTopic(questions, 'ag-system', regular10((i) => [i - 3, (i % 5) - 2, 1 + (i % 3), 1 + (i % 2), 2 + (i % 4), -(1 + (i % 3))]),
      grid(range(-4, 5), range(-3, 3), range(1, 3), [1, 2], [2, 4], [-1, -3]), agSystemQ);
    addTopic(questions, 'ag-quadratic', regular10((i) => [i - 6, i + 1]),
      grid(nonZero(-9, 9), nonZero(-9, 9)).filter(([r1, r2]) => r1 < r2 && r1 + r2 !== 0), agQuadraticQ);
    addTopic(questions, 'ag-exponent', regular10((i) => [2 + (i % 4), 2 + (i % 3), 1 + (i % 4), 1 + (i % 2)]),
      grid(range(2, 5), range(1, 4), range(1, 4), range(1, 3)).filter(([base, m, n, p]) => m + n - p >= 1 && base ** (m + n - p) <= 15625), agExponentQ);
    addTopic(questions, 'ag-area', regular10((i) => [3 + i, 2 + (i % 6)]),
      grid(range(3, 15), range(2, 12)), agAreaQ);
    const triples = [[3, 4], [5, 12], [8, 15], [7, 24], [9, 12], [12, 16], [15, 20], [10, 24], [18, 24], [20, 21]];
    addTopic(questions, 'ag-pythagorean', triples, RIGHT_TRIANGLE_LEGS, agPythagoreanQ);
    return questions;
  }

  // One template per topic, shared by the regular 60-question loops and the
  // 500-question Timed Mastery grids, so both pools word every question the
  // same way and the audit recomputes both through the same meta kinds.
  const calcLimitQ = (id, a, b, c) => {
    const answer = a * a + b * a + c;
    return qNumber(
      id, 'Limits',
      `Evaluate lim x→${a} of (x² ${term(b, 'x')} ${term(c, '')}).`,
      answer, `Polynomials are continuous, so substitute x = ${a}. The limit is ${answer}.`,
      { kind: 'polynomial-limit', a, b, c }
    );
  };
  const calcDerivativeQ = (id, coefficient, power, linear, x) => {
    const answer = coefficient * power * (x ** (power - 1)) + linear;
    return qNumber(
      id, 'Derivatives',
      `If f(x) = ${coefficient}x^${power} ${term(linear, 'x')}, find f′(${x}).`,
      answer,
      `f′(x) = ${coefficient * power}x^${power - 1} ${term(linear, '')}; substituting ${x} gives ${answer}.`,
      { kind: 'power-derivative', coefficient, power, linear, x }
    );
  };
  const calcProductQ = (id, k, c, x) => {
    const answer = (x * x + c) + (x + k) * 2 * x;
    return qNumber(
      id, 'Derivative applications',
      `For f(x) = (x + ${k})(x² + ${c}), find the tangent-line slope at x = ${x}.`,
      answer,
      `Product rule: f′(x) = (x² + ${c}) + (x + ${k})(2x). At x = ${x}, f′ = ${answer}.`,
      { kind: 'product-derivative', k, c, x }
    );
  };
  const calcIntegralQ = (id, m, b, upper) => {
    const answer = (m * upper * upper) / 2 + b * upper;
    return qNumber(
      id, 'Integrals',
      `Evaluate ∫ from 0 to ${upper} of (${m}x ${term(b, '')}) dx.`,
      answer,
      `An antiderivative is (${m}/2)x² ${term(b, 'x')}. Evaluation from 0 to ${upper} gives ${fmt(answer)}.`,
      { kind: 'linear-integral', m, b, upper }
    );
  };
  const calcFtcQ = (id, k, c, x) => {
    const answer = x * x + k * x + c;
    return qNumber(
      id, 'Fundamental Theorem',
      `Let F(x) = ∫ from 0 to x of (t² ${term(k, 't')} ${term(c, '')}) dt. Find F′(${x}).`,
      answer,
      `By the Fundamental Theorem of Calculus, F′(x) equals the integrand at x. Result: ${answer}.`,
      { kind: 'ftc', k, c, x }
    );
  };
  const calcSeriesQ = (id, first, denominator) => {
    const ratio = 1 / denominator;
    const answer = first / (1 - ratio);
    return qNumber(
      id, 'Infinite series',
      `Find the sum of the infinite geometric series with first term ${first} and common ratio 1/${denominator}. Round only if needed.`,
      answer,
      `Because |r| < 1, S = a/(1 − r) = ${first}/(1 − 1/${denominator}) = ${fmt(answer)}.`,
      { kind: 'geometric-series', first, ratio }
    );
  };

  // Parameter grids shared by the regular AP Calculus BC set and its Timed
  // Mastery pool — built once, not once per pool.
  const CALC_GRIDS = {
    limit: grid(range(-5, 5), nonZero(-3, 3), nonZero(-4, 4)),
    derivative: grid(range(1, 4), range(2, 5), nonZero(-3, 3), range(-2, 2)),
    product: grid(range(1, 5), range(1, 5), range(-3, 3)),
    integral: grid(range(1, 6), nonZero(-3, 3), range(1, 5)),
    ftc: grid(nonZero(-3, 3), range(1, 5), range(-3, 3)),
    series: grid(range(1, 20), range(2, 6)),
  };

  function calculus() {
    const questions = [];
    addTopic(questions, 'calc-limit', regular10((i) => [i - 4, (i % 5) - 2, 3 - (i % 4)]),
      CALC_GRIDS.limit, calcLimitQ);
    addTopic(questions, 'calc-derivative', regular10((i) => [1 + (i % 3), 2 + (i % 4), (i % 5) - 2, (i % 4) - 1]),
      CALC_GRIDS.derivative, calcDerivativeQ);
    addTopic(questions, 'calc-product', regular10((i) => [1 + (i % 4), 2 + (i % 3), (i % 5) - 2]),
      CALC_GRIDS.product, calcProductQ);
    addTopic(questions, 'calc-integral', regular10((i) => [1 + (i % 4), (i % 5) - 1, 1 + (i % 5)]),
      CALC_GRIDS.integral, calcIntegralQ);
    addTopic(questions, 'calc-ftc', regular10((i) => [(i % 4) - 1, 2 + (i % 3), (i % 5) - 2]),
      CALC_GRIDS.ftc, calcFtcQ);
    addTopic(questions, 'calc-series', regular10((i) => [2 + i, 2 + (i % 4)]),
      CALC_GRIDS.series, calcSeriesQ);
    return questions;
  }

  // Timed Mastery pool (timed-mastery.html): 500 questions over the same 6
  // topics, from bounded parameter grids instead of the regular loops'
  // i % k cycles, which repeat long before 84. Zero coefficients are left
  // out so prompts never print "+ 0x".
  function timedCalculus() {
    const questions = [];
    addFromGrid(questions, 'tm-calc-limit', 84, CALC_GRIDS.limit, calcLimitQ);
    addFromGrid(questions, 'tm-calc-derivative', 84, CALC_GRIDS.derivative, calcDerivativeQ);
    addFromGrid(questions, 'tm-calc-product', 83, CALC_GRIDS.product, calcProductQ);
    addFromGrid(questions, 'tm-calc-integral', 83, CALC_GRIDS.integral, calcIntegralQ);
    addFromGrid(questions, 'tm-calc-ftc', 83, CALC_GRIDS.ftc, calcFtcQ);
    addFromGrid(questions, 'tm-calc-series', 83, CALC_GRIDS.series, calcSeriesQ);
    return questions;
  }

  const cpOperatorQ = (id, a, b, c) => {
    const answer = a + b * c;
    return qNumber(
      id, 'Variables and operators',
      `What does this Python expression evaluate to?\n${a} + ${b} * ${c}`,
      answer, `Multiplication runs first: ${b} × ${c} = ${b * c}; then add ${a} to get ${answer}.`,
      { kind: 'operator-precedence', a, b, c }
    );
  };
  const cpBranchQ = (id, x) => {
    const answer = x % 2 === 0 ? x / 2 : 3 * x + 1;
    return qNumber(
      id, 'Control flow',
      `What value is printed?\nx = ${x}\nif x % 2 == 0:\n    x = x // 2\nelse:\n    x = 3 * x + 1\nprint(x)`,
      answer, `${x} is ${x % 2 === 0 ? 'even, so the if branch divides by 2' : 'odd, so the else branch computes 3x + 1'}. Output: ${answer}.`,
      { kind: 'branch', x }
    );
  };
  const cpLoopQ = (id, n) => {
    const answer = n * (n + 1) / 2;
    return qNumber(
      id, 'Loops',
      `What value is printed?\ntotal = 0\nfor n in range(1, ${n + 1}):\n    total += n\nprint(total)`,
      answer, `The loop adds 1 through ${n}: ${n}(${n + 1})/2 = ${answer}.`,
      { kind: 'loop-sum', n }
    );
  };
  const cpFunctionQ = (id, a, b, x) => {
    const answer = a * x + b;
    return qNumber(
      id, 'Functions',
      `What value is returned?\ndef transform(x):\n    return ${a} * x ${b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`}\n\ntransform(${x})`,
      answer, `Substitute x = ${x}: ${a}(${x}) ${term(b, '')} = ${answer}.`,
      { kind: 'function', a, b, x }
    );
  };
  const cpListQ = (id, values, index) => qNumber(
    id, 'Collections',
    `What value is printed?\nvalues = [${values.join(', ')}]\nprint(values[${index}])`,
    values[index], `Indexing starts at 0, so index ${index} contains ${values[index]}.`,
    { kind: 'list-index', values, index }
  );

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
      ['Why close a file after reading it?', ['Release the operating-system resource', 'Sort its lines', 'Compile its text', 'Rename the file'], 'Release the operating-system resource', 'Closing releases the file handle and related resources.'],
      ['What does a JIT (just-in-time) compiler do?', ['Compiles code to machine code while the program runs', 'Translates code only after the program finishes', 'Removes every comment before printing', 'Converts machine code back into source code'], 'Compiles code to machine code while the program runs', 'Just-in-time compilation turns frequently run code into machine code during execution.'],
      ['Which course language prints with print("Hello, World") and needs no class or main function?', ['Python', 'Java', 'C++', 'JavaScript'], 'Python', 'Python’s Hello World is a single print call; JavaScript uses console.log, and Java and C++ need a main function.'],
      ['In Java, which method does the JVM call to start a program?', ['main', 'start', 'run', 'init'], 'main', 'A Java program begins in public static void main(String[] args).'],
      ['What does a constructor do?', ['Initializes a new object', 'Deletes an object', 'Prints the class name', 'Compiles the class'], 'Initializes a new object', 'A constructor sets up a new instance’s starting state.'],
      ['Which symbol starts a single-line comment in JavaScript, Java, and C++?', ['//', '#', '<!--', '%'], '//', 'All three C-family languages use // for single-line comments; Python uses #.'],
      ['What should a good comment usually explain?', ['Why the code does something', 'Every keyword on the line', 'The name of the file', 'How fast the computer is'], 'Why the code does something', 'The code already shows what happens; a comment adds the intent and reasons.'],
      ['In a statically typed language like Java, when are most type errors caught?', ['At compile time', 'Only when the program crashes', 'When the user types input', 'Never'], 'At compile time', 'Static typing lets the compiler check types before the program runs.'],
      ['In Python, what happens after x = 5 followed by x = "five"?', ['x now refers to a string', 'A compile error stops the program', 'x keeps the value 5', 'Python converts "five" to 5'], 'x now refers to a string', 'Python is dynamically typed, so a name can be rebound to a value of another type.'],
      ['Which declaration makes a constant in Java?', ['final int MAX = 10;', 'const int MAX = 10;', 'let MAX = 10;', 'static MAX = 10;'], 'final int MAX = 10;', 'Java uses final for variables that cannot be reassigned; const is reserved but unused.'],
      ['What does the % operator return?', ['The remainder of a division', 'A percentage', 'The quotient rounded up', 'The larger operand'], 'The remainder of a division', '% is the modulo operator: 7 % 3 is 1.'],
      ['In Java or C++, what is 7 / 2 when both operands are int?', ['3', '3.5', '4', '3.0'], '3', 'Integer division discards the fractional part.'],
      ['In Python 3, what is 7 / 2?', ['3.5', '3', '4', '2'], '3.5', 'Python 3’s / always performs true division; // performs floor division.'],
      ['What does the logical AND operator require to produce true?', ['Both operands are true', 'At least one operand is true', 'Exactly one operand is true', 'Neither operand is true'], 'Both operands are true', 'AND is true only when both sides are true.'],
      ['Which operator compares two values for equality in Python, Java, and C++?', ['==', '=', '=>', '!='], '==', 'A single = assigns; == compares.'],
      ['Why do JavaScript developers usually prefer === over ==?', ['=== also requires the types to match', '=== runs faster only inside loops', '== cannot compare numbers', '=== assigns a value'], '=== also requires the types to match', 'Strict equality avoids == type coercion, such as 0 == "0" being true.'],
      ['When does an else branch run?', ['When the if condition is false', 'Always, after the if branch', 'Only when the if condition is true', 'Before the if condition is checked'], 'When the if condition is false', 'else handles the case the if condition rejected.'],
      ['How does basic encapsulation protect an object’s data?', ['Fields are private and changed only through methods', 'All fields are public so anyone can fix them', 'The data is copied into a comment', 'The class has no constructor'], 'Fields are private and changed only through methods', 'Methods can check every change, so outside code cannot put the object into an invalid state.'],
      ['What is an infinite loop?', ['A loop whose condition never becomes false', 'A loop that runs exactly once', 'A loop over an empty list', 'A loop containing a break statement'], 'A loop whose condition never becomes false', 'If nothing ever changes the condition, the loop never stops.'],
      ['What does a break statement do inside a loop?', ['Exits the loop immediately', 'Skips to the next iteration', 'Restarts the loop from the beginning', 'Pauses the program for input'], 'Exits the loop immediately', 'break ends the loop; continue skips to the next iteration.'],
      ['How many times does the body of for i in range(5) run in Python?', ['5', '4', '6', '0'], '5', 'range(5) produces 0, 1, 2, 3, 4 — five values.'],
      ['What is a parameter?', ['A named input listed in a function definition', 'The value a function returns', 'A comment above a function', 'A loop counter'], 'A named input listed in a function definition', 'Parameters receive the arguments passed in a call.'],
      ['What does void mean as a Java or C++ return type?', ['The function returns no value', 'The function returns zero', 'The function can return any type', 'The function cannot take parameters'], 'The function returns no value', 'void marks a function that does its work without returning a result.'],
      ['What is the scope of a variable declared inside a function?', ['Only that function (local scope)', 'The whole program', 'Every file in the project', 'Only the next line'], 'Only that function (local scope)', 'Local variables exist only inside the function that declares them.'],
      ['What does string concatenation do?', ['Joins strings end to end', 'Splits a string into words', 'Counts the characters', 'Converts a string to a number'], 'Joins strings end to end', '"Hello, " + "World" produces "Hello, World".'],
      ['What does len("code") return in Python?', ['4', '3', '5', '"code"'], '4', 'len counts the characters c, o, d, e.'],
      ['Which is an example of string interpolation?', ['f"Total: {total}" in Python', '"Total: " * total', 'print("Total")', 'int("total")'], 'f"Total: {total}" in Python', 'An f-string inserts the value of total into the text.'],
      ['What is the key difference between a Java array and a Java ArrayList?', ['An array has a fixed size; an ArrayList can grow', 'An array can hold only strings', 'An ArrayList cannot be indexed', 'Arrays exist only in Python'], 'An array has a fixed size; an ArrayList can grow', 'Java arrays are fixed-length; an ArrayList resizes as you add items.'],
      ['What is the index of the last element in a list of length n?', ['n − 1', 'n', '1', 'n + 1'], 'n − 1', 'Zero-based indexing puts the last element at n − 1.'],
      ['What type does Python’s input() return?', ['A string of what the user typed', 'An integer', 'Nothing', 'A list of words'], 'A string of what the user typed', 'input always returns a string; convert it with int() or float() when you need a number.'],
      ['What does the \\n escape sequence produce in output?', ['A newline', 'A tab', 'The letter n', 'A space'], 'A newline', '\\n moves the output to the start of the next line.']
    ];
    concepts.forEach(([prompt, choices, answer, explanation], i) => {
      questions.push(qChoice(`cp-concept-${i + 1}`, 'Language fundamentals', prompt, choices, answer, explanation, { kind: 'concept', expected: answer }));
    });
    addTopic(questions, 'cp-operator', regular10((i) => [2 + i, 2 + (i % 4), 1 + (i % 5)]),
      grid(range(1, 15), range(2, 6), range(1, 6)), cpOperatorQ);
    addTopic(questions, 'cp-branch', regular10((i) => [i + 3]), range(13, 60).map((x) => [x]), cpBranchQ);
    addTopic(questions, 'cp-loop', regular10((i) => [i + 3]), range(13, 50).map((n) => [n]), cpLoopQ);
    addTopic(questions, 'cp-function', regular10((i) => [1 + (i % 4), (i % 5) - 2, i - 2]),
      grid(range(1, 6), nonZero(-5, 5), range(-5, 8)), cpFunctionQ);
    addTopic(questions, 'cp-list', regular10((i) => [[i + 2, i * 2 + 1, 12 - i, i + 7], i % 4]),
      grid(range(10, 30), range(0, 3)).map(([s, index]) => [[s + 3, 2 * s - 7, 40 - s, (s % 7) + 1], index]), cpListQ);
    return questions;
  }

  const tf = (value) => (value ? 'true' : 'false');
  // Two-variable cases are the original 10; three-variable "(p op₁ q) op₂ r"
  // forms extend the topic past the 16 two-variable truth-table rows.
  const dmLogicQ = (id, shape, ...params) => {
    if (shape === '2') {
      const [p, q, operation] = params;
      const answer = evalLogic(p, q, operation);
      return qChoice(
        id, 'Logic',
        `Let p be ${tf(p)} and q be ${tf(q)}. Is “p ${operation} q” true or false?`,
        ['True', 'False'], answer ? 'True' : 'False',
        `Using the truth table for ${operation}, the statement is ${tf(answer)}.`,
        { kind: 'logic', p, q, operation }
      );
    }
    const [p, q, r, op1, op2] = params;
    const inner = evalLogic(p, q, op1);
    const answer = evalLogic(inner, r, op2);
    return qChoice(
      id, 'Logic',
      `Let p be ${tf(p)}, q be ${tf(q)}, and r be ${tf(r)}. Is “(p ${op1} q) ${op2} r” true or false?`,
      ['True', 'False'], answer ? 'True' : 'False',
      `First, p ${op1} q is ${tf(inner)}. Then (${tf(inner)}) ${op2} r is ${tf(answer)}.`,
      { kind: 'logic3', p, q, r, op1, op2 }
    );
  };
  const dmSetQ = (id, start, aParity, bMod) => {
    const universe = Array.from({ length: 8 }, (_, n) => n + start);
    const a = universe.filter((n) => (n + aParity) % 2 === 0);
    const b = universe.filter((n) => n % bMod !== 0);
    const answer = a.filter((n) => b.includes(n)).length;
    return qNumber(
      id, 'Sets',
      `If A = {${a.join(', ')}} and B = {${b.join(', ')}}, find |A ∩ B|.`,
      answer, `A ∩ B contains elements appearing in both sets, so its cardinality is ${answer}.`,
      { kind: 'intersection-size', a, b }
    );
  };
  const dmCountQ = (id, n, r, permutation) => {
    const answer = permutation ? factorial(n) / factorial(n - r) : choose(n, r);
    return qNumber(
      id, 'Combinatorics',
      permutation
        ? `How many ordered ways can ${r} objects be selected from ${n} distinct objects?`
        : `How many unordered groups of ${r} can be selected from ${n} distinct objects?`,
      answer,
      permutation ? `Use P(${n}, ${r}) = ${n}!/(${n - r})! = ${answer}.` : `Use C(${n}, ${r}) = ${n}!/[${r}!(${n - r})!] = ${answer}.`,
      { kind: permutation ? 'permutation' : 'combination', n, r }
    );
  };
  const dmProbabilityQ = (id, favorable, other) => {
    const answer = favorable / (favorable + other);
    return qNumber(
      id, 'Probability',
      `A bag contains ${favorable} red and ${other} blue tokens. One token is drawn uniformly. What is P(red)? Enter a fraction or decimal.`,
      answer, `P(red) = red/total = ${favorable}/${favorable + other} = ${fmt(answer)}.`,
      { kind: 'simple-probability', favorable, total: favorable + other }
    );
  };
  const dmTreeQ = (id, vertices) => qNumber(
    id, 'Graph theory',
    `A connected graph is a tree with ${vertices} vertices. How many edges does it have?`,
    vertices - 1, `Every tree with v vertices has v − 1 edges: ${vertices} − 1 = ${vertices - 1}.`,
    { kind: 'tree-edges', vertices }
  );
  const dmModularQ = (id, a, b, c, modulus) => {
    const answer = (a * b + c) % modulus;
    return qNumber(
      id, 'Number theory',
      `Find the least nonnegative remainder of (${a} · ${b} + ${c}) modulo ${modulus}.`,
      answer, `${a} · ${b} + ${c} = ${a * b + c}; dividing by ${modulus} leaves remainder ${answer}.`,
      { kind: 'modular', a, b, c, modulus }
    );
  };

  function discreteMath() {
    const questions = [];
    const logicCases = [
      [true, true, 'and'], [true, false, 'and'],
      [false, true, 'or'], [false, false, 'or'],
      [true, true, 'implies'], [true, false, 'implies'],
      [false, true, 'implies'], [false, false, 'implies'],
      [true, true, 'biconditional'], [true, false, 'biconditional']
    ];
    addTopic(questions, 'dm-logic', logicCases.map((c) => ['2', ...c]),
      grid(TF, TF, TF, LOGIC_OPS, LOGIC_OPS).map((t) => ['3', ...t]), dmLogicQ);
    addTopic(questions, 'dm-set', regular10((i) => [i + 1, i, 2 + (i % 3)]),
      grid(range(1, 30), [0, 1], range(2, 5)), dmSetQ);
    addTopic(questions, 'dm-count', regular10((i) => [5 + (i % 5), 2 + (i % 3), i % 2 === 0]),
      grid(range(4, 11), range(2, 4), [true, false]).filter(([n, r]) => r < n), dmCountQ);
    addTopic(questions, 'dm-probability', regular10((i) => [1 + (i % 6), 3 + (i % 5)]),
      grid(range(1, 9), range(1, 9)), dmProbabilityQ);
    addTopic(questions, 'dm-tree', regular10((i) => [4 + i]), range(14, 60).map((v) => [v]), dmTreeQ);
    addTopic(questions, 'dm-modular', regular10((i) => [7 + i * 3, 2 + (i % 5), 1 + (i % 4), 5 + (i % 6)]),
      grid(range(7, 40).filter((a) => a % 3 === 1), range(2, 6), range(1, 4), range(5, 12)), dmModularQ);
    return questions;
  }

  const physicsMotionQ = (id, initialVelocity, acceleration, time) => {
    const answer = initialVelocity * time + 0.5 * acceleration * time * time;
    return qNumber(
      id, 'Kinematics',
      `An object starts at x = 0 with v₀ = ${initialVelocity} m/s and constant a = ${acceleration} m/s². Find its position after ${time} s, in meters.`,
      answer, `x = v₀t + ½at² = ${initialVelocity}(${time}) + ½(${acceleration})(${time}²) = ${answer} m.`,
      { kind: 'kinematics', initialVelocity, acceleration, time }
    );
  };
  const physicsForceQ = (id, mass, acceleration, friction) => {
    const applied = mass * acceleration + friction;
    return qNumber(
      id, 'Forces',
      `A ${mass} kg block is pushed with ${applied} N while ${friction} N of friction opposes motion. Find its acceleration in m/s².`,
      acceleration, `Fnet = ${applied} − ${friction} = ${mass * acceleration} N, so a = Fnet/m = ${acceleration} m/s².`,
      { kind: 'newton-second', mass, applied, friction }
    );
  };
  const physicsEnergyQ = (id, mass, velocity) => {
    const answer = 0.5 * mass * velocity * velocity;
    return qNumber(
      id, 'Energy',
      `Find the kinetic energy of a ${mass} kg object moving at ${velocity} m/s, in joules.`,
      answer, `K = ½mv² = ½(${mass})(${velocity}²) = ${answer} J.`,
      { kind: 'kinetic-energy', mass, velocity }
    );
  };
  const physicsMomentumQ = (id, mass1, velocity1, mass2, velocity2) => {
    const answer = (mass1 * velocity1 + mass2 * velocity2) / (mass1 + mass2);
    return qNumber(
      id, 'Momentum',
      `A ${mass1} kg cart at ${velocity1} m/s sticks to a ${mass2} kg cart at ${velocity2} m/s. Find their final velocity in m/s.`,
      answer,
      `Conserve momentum: vf = [${mass1}(${velocity1}) + ${mass2}(${velocity2})]/(${mass1 + mass2}) = ${fmt(answer)} m/s.`,
      { kind: 'inelastic-collision', mass1, velocity1, mass2, velocity2 }
    );
  };
  const physicsTorqueQ = (id, force, radius) => {
    const answer = force * radius;
    return qNumber(
      id, 'Rotation',
      `A ${force} N force acts perpendicular to a lever ${radius} m from its pivot. Find the torque magnitude in N·m.`,
      answer, `For a perpendicular force, τ = rF = ${radius}(${force}) = ${fmt(answer)} N·m.`,
      { kind: 'torque', force, radius }
    );
  };
  const physicsCircleQ = (id, mass, velocity, radius) => {
    const answer = mass * velocity * velocity / radius;
    return qNumber(
      id, 'Circular motion',
      `A ${mass} kg object moves in a circle at ${velocity} m/s with radius ${radius} m. Find the required centripetal force in newtons.`,
      answer, `Fc = mv²/r = ${mass}(${velocity}²)/${radius} = ${fmt(answer)} N.`,
      { kind: 'centripetal-force', mass, velocity, radius }
    );
  };

  function physics() {
    const questions = [];
    addTopic(questions, 'physics-motion', regular10((i) => [1 + (i % 5), 2 + (i % 4), 2 + (i % 5)]),
      grid(range(0, 8), range(1, 6), range(1, 8)), physicsMotionQ);
    addTopic(questions, 'physics-force', regular10((i) => [2 + (i % 4), 1 + (i % 5), 1 + (i % 3)]),
      grid(range(1, 10), range(1, 6), range(1, 6)), physicsForceQ);
    addTopic(questions, 'physics-energy', regular10((i) => [2 + (i % 5), 2 + (i % 6)]),
      grid(range(1, 10), range(1, 12)), physicsEnergyQ);
    addTopic(questions, 'physics-momentum', regular10((i) => [1 + (i % 4), 2 + (i % 5), 2 + (i % 5), i % 2 === 0 ? 0 : -1]),
      grid(range(1, 6), range(1, 8), range(1, 6), range(-3, 0)), physicsMomentumQ);
    addTopic(questions, 'physics-torque', regular10((i) => [3 + i, 0.5 + (i % 5) * 0.5]),
      grid(range(2, 30), [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]), physicsTorqueQ);
    addTopic(questions, 'physics-circle', regular10((i) => [1 + (i % 4), 2 + (i % 5), 1 + (i % 3)]),
      grid(range(1, 6), range(1, 10), range(1, 5)), physicsCircleQ);
    return questions;
  }

  const precalcFunctionQ = (id, a, b, c, x) => {
    const answer = a * x * x + b * x + c;
    return qNumber(
      id, 'Functions',
      `If f(x) = ${a}x² ${term(b, 'x')} ${term(c, '')}, find f(${x}).`,
      answer, `Substitute x = ${x}: f(${x}) = ${answer}.`,
      { kind: 'quadratic-eval', a, b, c, x }
    );
  };
  const precalcCompositionQ = (id, a, b, c, d, x) => {
    const answer = a * (c * x + d) + b;
    return qNumber(
      id, 'Composition and inverses',
      `Let f(x) = ${a}x ${term(b, '')} and g(x) = ${c}x ${term(d, '')}. Find (f ∘ g)(${x}).`,
      answer, `First g(${x}) = ${c * x + d}; then f(${c * x + d}) = ${answer}.`,
      { kind: 'linear-composition', a, b, c, d, x }
    );
  };
  const precalcPolynomialQ = (id, r1, r2) => {
    const sum = r1 + r2;
    const product = r1 * r2;
    return qNumber(
      id, 'Polynomial functions',
      `What is the larger zero of x² ${term(-sum, 'x')} ${term(product, '')}?`,
      Math.max(r1, r2), `Factoring gives (x − ${r1})(x − ${r2}), so the larger zero is ${Math.max(r1, r2)}.`,
      { kind: 'quadratic-larger-root', sum, product }
    );
  };
  // Negative exponents show the value as a fraction (2^x = 1/8) — the real
  // notation, not a decimal like 0.125.
  const precalcExponentialQ = (id, base, exponent) => {
    const value = base ** exponent;
    const shown = exponent < 0 ? `1/${base ** -exponent}` : value;
    return qNumber(
      id, 'Exponential and logarithmic functions',
      `Solve for x: ${base}^x = ${shown}.`,
      exponent, `Because ${shown} = ${base}^${exponent}, x = ${exponent}.`,
      { kind: 'exponential-solve', base, value }
    );
  };
  const precalcTrigQ = (id, opposite, adjacent) => {
    const hypotenuse = Math.hypot(opposite, adjacent);
    return qNumber(
      id, 'Trigonometry',
      `In a right triangle, angle θ has opposite side ${opposite} and adjacent side ${adjacent}. Find sin θ.`,
      opposite / hypotenuse,
      `The hypotenuse is ${hypotenuse}, so sin θ = opposite/hypotenuse = ${opposite}/${hypotenuse} = ${fmt(opposite / hypotenuse)}.`,
      { kind: 'right-triangle-sine', opposite, adjacent }
    );
  };
  const precalcArithmeticQ = (id, first, difference, n) => {
    const answer = first + (n - 1) * difference;
    return qNumber(
      id, 'Sequences',
      `An arithmetic sequence has a₁ = ${first} and common difference ${difference}. Find a_${n}.`,
      answer, `a_n = a₁ + (n − 1)d = ${first} + (${n} − 1)(${difference}) = ${answer}.`,
      { kind: 'arithmetic-term', first, difference, n }
    );
  };
  const precalcGeometricQ = (id, first, ratio, n) => {
    const answer = first * ratio ** (n - 1);
    return qNumber(
      id, 'Sequences',
      `A geometric sequence has a₁ = ${first} and common ratio ${ratio}. Find a_${n}.`,
      answer, `a_n = a₁r^(n−1) = ${first}(${ratio}^${n - 1}) = ${answer}.`,
      { kind: 'geometric-term', first, ratio, n }
    );
  };

  // Shared by the regular Precalculus set and its Timed Mastery pool.
  const PRECALC_GRIDS = {
    function: grid(range(1, 3), nonZero(-3, 3), nonZero(-4, 4), range(-3, 3)),
    composition: grid(range(2, 4), nonZero(-3, 3), range(1, 4), nonZero(-3, 3), range(-3, 3)),
    polynomial: grid(nonZero(-8, 8), nonZero(-8, 8)).filter(([r1, r2]) => r1 < r2 && r1 + r2 !== 0),
    exponential: grid(range(2, 10), range(-3, 6)).filter(([base, exponent]) => base ** Math.abs(exponent) <= 100000),
  };

  // Sequences mix two templates; a leading tag picks which one.
  const precalcSequenceQ = (id, shape, ...params) => (shape === 'a' ? precalcArithmeticQ(id, ...params) : precalcGeometricQ(id, ...params));

  function precalculus() {
    const questions = [];
    addTopic(questions, 'precalc-function', regular10((i) => [1 + (i % 3), (i % 5) - 2, 3 - (i % 4), i - 4]),
      PRECALC_GRIDS.function, precalcFunctionQ);
    addTopic(questions, 'precalc-composition', regular10((i) => [2 + (i % 3), (i % 4) - 1, 1 + (i % 4), 2 - (i % 5), i - 3]),
      PRECALC_GRIDS.composition, precalcCompositionQ);
    addTopic(questions, 'precalc-polynomial', regular10((i) => [i - 5, i + 2]),
      PRECALC_GRIDS.polynomial, precalcPolynomialQ);
    addTopic(questions, 'precalc-exponential', regular10((i) => [2 + (i % 4), 1 + (i % 6)]),
      PRECALC_GRIDS.exponential, precalcExponentialQ);
    const triples = [[3, 4], [5, 12], [8, 15], [7, 24], [9, 12], [12, 16], [15, 20], [10, 24], [18, 24], [20, 21]];
    addTopic(questions, 'precalc-trig', triples, RIGHT_TRIANGLE_LEGS, precalcTrigQ);
    addTopic(questions, 'precalc-sequence', regular10((i) => (i % 2 === 0 ? ['a', 2 + i, 1 + (i % 4), 4 + i] : ['g', 1 + (i % 3), 2 + (i % 2), 4 + i])),
      mixGrids(40,
        grid(range(1, 9), nonZero(-5, 5), range(5, 15)).map((t) => ['a', ...t]),
        grid(range(1, 5), range(2, 4), range(3, 8)).filter(([first, ratio, n]) => first * ratio ** (n - 1) <= 50000).map((t) => ['g', ...t])),
      precalcSequenceQ);
    return questions;
  }

  // Timed Mastery pool — see timedCalculus() above.
  function timedPrecalculus() {
    const questions = [];
    addFromGrid(questions, 'tm-precalc-function', 84, PRECALC_GRIDS.function, precalcFunctionQ);
    addFromGrid(questions, 'tm-precalc-composition', 84, PRECALC_GRIDS.composition, precalcCompositionQ);
    addFromGrid(questions, 'tm-precalc-polynomial', 83,
      PRECALC_GRIDS.polynomial, precalcPolynomialQ);
    addFromGrid(questions, 'tm-precalc-exponential', 83,
      PRECALC_GRIDS.exponential, precalcExponentialQ);
    addFromGrid(questions, 'tm-precalc-trig', 83, RIGHT_TRIANGLE_LEGS, precalcTrigQ);
    addFromGrid(questions, 'tm-precalc-arithmetic', 42, grid(range(1, 9), nonZero(-5, 5), range(5, 15)), precalcArithmeticQ);
    addFromGrid(questions, 'tm-precalc-geometric', 41,
      grid(range(1, 5), range(2, 4), range(3, 8)).filter(([first, ratio, n]) => first * ratio ** (n - 1) <= 50000), precalcGeometricQ);
    return questions;
  }

  const multiDotQ = (id, u, v) => {
    const answer = u.reduce((sum, value, index) => sum + value * v[index], 0);
    return qNumber(
      id, 'Vectors and dot products',
      `Find ⟨${u.join(', ')}⟩ · ⟨${v.join(', ')}⟩.`,
      answer, `Multiply matching components and add: the dot product is ${answer}.`,
      { kind: 'vector-dot', u, v }
    );
  };
  const multiCrossQ = (id, a, b, c, d) => {
    const answer = a * d - b * c;
    return qNumber(
      id, 'Cross products',
      `Find the z-component of ⟨${a}, ${b}, 0⟩ × ⟨${c}, ${d}, 0⟩.`,
      answer, `The z-component is ad − bc = ${a}(${d}) − ${b}(${c}) = ${answer}.`,
      { kind: 'cross-z', a, b, c, d }
    );
  };
  const multiPartialXQ = (id, a, b, c, x, y) => {
    const answer = 2 * a * x + b * y;
    return qNumber(
      id, 'Partial derivatives',
      `For f(x,y) = ${a}x² ${term(b, 'xy')} ${term(c, 'y²')}, find f_x(${x}, ${y}).`,
      answer, `Holding y constant gives f_x = ${2 * a}x ${term(b, 'y')}. At (${x}, ${y}), this is ${answer}.`,
      { kind: 'partial-x', a, b, x, y }
    );
  };
  const multiGradientQ = (id, a, b, c, x, y) => {
    const answer = b * x + 2 * c * y;
    return qNumber(
      id, 'Gradients',
      `For f(x,y) = ${a}x² ${term(b, 'xy')} ${term(c, 'y²')}, find the y-component of ∇f at (${x}, ${y}).`,
      answer, `The y-component is f_y = ${b}x ${term(2 * c, 'y')}. Substitution gives ${answer}.`,
      { kind: 'partial-y', b, c, x, y }
    );
  };
  const multiDoubleIntegralQ = (id, a, b, width, height) => {
    const answer = a * width ** 2 * height / 2 + b * width * height ** 2 / 2;
    return qNumber(
      id, 'Multiple integrals',
      `Evaluate ∬_R (${a}x + ${b}y) dA over 0 ≤ x ≤ ${width}, 0 ≤ y ≤ ${height}.`,
      answer, `Integrating over the rectangle gives (${a}/2)(${width}²)(${height}) + (${b}/2)(${width})(${height}²) = ${fmt(answer)}.`,
      { kind: 'double-integral-linear', a, b, width, height }
    );
  };
  const multiDivergenceQ = (id, a, b, c, x, y, z) => {
    const answer = 2 * a * x + 2 * b * y + 2 * c * z;
    return qNumber(
      id, 'Vector fields',
      `For F = ⟨${a}x², ${b}y², ${c}z²⟩, find div F at (${x}, ${y}, ${z}).`,
      answer, `div F = ${2 * a}x + ${2 * b}y + ${2 * c}z. At the point, this equals ${answer}.`,
      { kind: 'divergence-quadratic', a, b, c, x, y, z }
    );
  };

  function multivariableCalculus() {
    const questions = [];
    addTopic(questions, 'multi-dot', regular10((i) => [[i + 1, 2 - (i % 4), (i % 5) - 2], [2 + (i % 3), i - 3, 1 + (i % 4)]]),
      grid(range(1, 6), range(-3, 3), range(-2, 4)).map(([a, b, c]) => [[a, b, c], [b + 4, c - a, (a % 3) + 1]]), multiDotQ);
    addTopic(questions, 'multi-cross', regular10((i) => [1 + i, 2 + (i % 4), (i % 5) - 2, 3 + (i % 3)]),
      grid(range(1, 8), range(1, 5), range(-4, 4), range(1, 4)), multiCrossQ);
    addTopic(questions, 'multi-partial-x', regular10((i) => [1 + (i % 4), (i % 5) - 2, 1 + (i % 3), (i % 5) - 2, i - 3]),
      grid(range(1, 3), nonZero(-3, 3), [1, 2], range(-3, 3), range(-2, 3)), multiPartialXQ);
    addTopic(questions, 'multi-gradient', regular10((i) => [1 + (i % 3), (i % 5) - 2, 2 + (i % 4), i - 4, (i % 5) - 1]),
      grid([1, 2], nonZero(-3, 3), range(1, 4), range(-3, 3), range(-2, 2)), multiGradientQ);
    addTopic(questions, 'multi-double-integral', regular10((i) => [1 + (i % 3), 1 + (i % 4), 1 + (i % 5), 2 + (i % 4)]),
      grid(range(1, 4), range(1, 4), range(1, 5), range(1, 5)), multiDoubleIntegralQ);
    addTopic(questions, 'multi-divergence', regular10((i) => [1 + (i % 3), 2 + (i % 4), 1 + (i % 5), (i % 4) - 1, i - 3, (i % 5) - 2]),
      grid(range(1, 3), range(2, 4), range(1, 3), [-2, -1, 1, 2], [-3, -1, 2], [-2, 0, 1]), multiDivergenceQ);
    return questions;
  }

  const fibonacci = (n) => {
    let a = 0;
    let b = 1;
    for (let k = 0; k < n; k += 1) [a, b] = [b, a + b];
    return a;
  };
  // Recursion mixes four classic recurrences; the original 10 are factorial.
  const cp2RecursionQ = (id, shape, n) => {
    if (shape === 'fact') {
      return qNumber(
        id, 'Recursion',
        `A recursive factorial function uses fact(0) = 1 and fact(n) = n · fact(n−1). Find fact(${n}).`,
        factorial(n), `Expanding the recurrence gives ${n}! = ${factorial(n)}.`,
        { kind: 'factorial', n }
      );
    }
    if (shape === 'sum') {
      const answer = n * (n + 1) / 2;
      return qNumber(id, 'Recursion', `A recursive function uses sum(0) = 0 and sum(n) = n + sum(n−1). Find sum(${n}).`,
        answer, `The recursion adds ${n} + (${n} − 1) + ··· + 1 = ${n}(${n + 1})/2 = ${answer}.`, { kind: 'loop-sum', n });
    }
    if (shape === 'fib') {
      return qNumber(id, 'Recursion', `A recursive function uses fib(0) = 0, fib(1) = 1, and fib(n) = fib(n−1) + fib(n−2). Find fib(${n}).`,
        fibonacci(n), `Unwinding the two recursive calls gives fib(${n}) = ${fibonacci(n)}.`, { kind: 'fibonacci', n });
    }
    return qNumber(id, 'Recursion', `A recursive function uses p(0) = 1 and p(n) = 2 · p(n−1). Find p(${n}).`,
      2 ** n, `Each call doubles the result, so p(${n}) = 2^${n} = ${2 ** n}.`, { kind: 'power-two', exponent: n });
  };
  // Complexity mixes counting questions; the original 10 are binary-search halvings.
  const cp2ComplexityQ = (id, shape, a, b) => {
    if (shape === 'halve') {
      const size = 2 ** a;
      return qNumber(
        id, 'Algorithms and complexity',
        `A binary-search interval contains ${size} elements. How many exact halvings reduce it to one element?`,
        a, `${size} = 2^${a}, so ${a} halvings leave one candidate.`,
        { kind: 'binary-halvings', size }
      );
    }
    if (shape === 'nlogn') {
      const n = 2 ** a;
      return qNumber(id, 'Algorithms and complexity', `Merge sort does about n log₂n work. Evaluate n log₂n for n = ${n}.`,
        n * a, `${n} · log₂${n} = ${n} · ${a} = ${n * a}.`, { kind: 'n-log2-n', n });
    }
    if (shape === 'triangle') {
      const answer = (a - 1) * a / 2;
      return qNumber(id, 'Algorithms and complexity', `Selection sort on ${a} items makes (n − 1) + (n − 2) + ··· + 1 comparisons. How many is that for n = ${a}?`,
        answer, `That sum is ${a - 1}(${a})/2 = ${answer}.`, { kind: 'loop-sum', n: a - 1 });
    }
    return qNumber(id, 'Algorithms and complexity', `A nested loop runs its outer loop ${a} times and its inner loop ${b} times per pass. How many times does the inner body run?`,
      a * b, `Nested loops multiply: ${a} × ${b} = ${a * b}.`, { kind: 'product', a, b });
  };

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
      ['What is a concrete class?', ['A class that can be instantiated', 'A class with no methods', 'A comment-only class', 'A database schema'], 'A class that can be instantiated', 'Concrete classes implement all required behavior and can create instances.'],
      ['Which keyword makes a Java class inherit from another class?', ['extends', 'implements', 'inherits', 'super'], 'extends', 'class Dog extends Animal declares Dog as a subclass of Animal.'],
      ['Which keyword does a Java class use to adopt an interface?', ['implements', 'extends', 'uses', 'interface'], 'implements', 'A class implements an interface by providing its required methods.'],
      ['What does super(...) do inside a subclass constructor?', ['Calls the parent class constructor', 'Creates a second object', 'Deletes the parent class', 'Overrides every parent method'], 'Calls the parent class constructor', 'super(...) runs the parent’s constructor so inherited state is set up.'],
      ['How does Python declare that Dog inherits from Animal?', ['class Dog(Animal):', 'class Dog extends Animal:', 'class Dog implements Animal:', 'class Dog -> Animal:'], 'class Dog(Animal):', 'Python lists the parent class in parentheses after the class name.'],
      ['What is method overloading?', ['Several methods share a name but take different parameters', 'A subclass replaces a parent method', 'A method calls itself', 'A method runs on multiple threads'], 'Several methods share a name but take different parameters', 'Java and C++ choose an overload by the argument types at compile time.'],
      ['Which Java access modifier lets subclasses use a member without making it fully public?', ['protected', 'public', 'private', 'static'], 'protected', 'protected members are visible to subclasses (and the same package), not to all code.'],
      ['What must a concrete subclass of an abstract class do?', ['Implement every abstract method it inherits', 'Delete the parent’s fields', 'Declare itself abstract too', 'Avoid calling super'], 'Implement every abstract method it inherits', 'A class can only be instantiated once no abstract methods remain unimplemented.'],
      ['What does structural typing (a Python Protocol, or “duck typing”) rely on?', ['Objects having the right methods, not a declared parent type', 'Every class explicitly inheriting a shared base', 'Only compile-time checks', 'Objects being immutable'], 'Objects having the right methods, not a declared parent type', 'If it has the needed methods, it can be used — no inheritance required.'],
      ['If Dog extends Animal, which Java statement compiles?', ['Animal a = new Dog();', 'Dog d = new Animal();', 'Animal a = Dog;', 'Dog d = Animal();'], 'Animal a = new Dog();', 'A parent-type variable can hold a subclass object — the basis of polymorphism.'],
      ['Animal a = new Dog(); and Dog overrides speak(). What does a.speak() run?', ['Dog’s speak()', 'Animal’s speak()', 'Both, in order', 'Neither — it is a compile error'], 'Dog’s speak()', 'Dynamic dispatch picks the override for the object’s runtime type.'],
      ['What does the @Override annotation do in Java?', ['Asks the compiler to verify the method really overrides a parent method', 'Makes the method run faster', 'Hides the parent method permanently', 'Turns the method into a constructor'], 'Asks the compiler to verify the method really overrides a parent method', 'A typo in the method name becomes a compile error instead of a silent new method.'],
      ['What is a getter method?', ['A method that returns a field’s value', 'A method that deletes an object', 'A loop over all fields', 'A constructor with no parameters'], 'A method that returns a field’s value', 'Getters expose data without exposing the field itself.'],
      ['Why validate inside a setter instead of making the field public?', ['The class can reject invalid values and keep its rules true', 'Setters make code run faster', 'Public fields cannot be read', 'Setters remove the need for constructors'], 'The class can reject invalid values and keep its rules true', 'Every change passes through code the class controls.'],
      ['What is a class invariant?', ['A condition that must stay true for every valid object of the class', 'A variable that never changes anywhere', 'A method with no parameters', 'A class with only static methods'], 'A condition that must stay true for every valid object of the class', 'For example, a BankAccount’s balance never dropping below zero.'],
      ['What does “favor composition over inheritance” warn against?', ['Building deep class hierarchies just to reuse code', 'Using objects at all', 'Writing small classes', 'Calling methods on fields'], 'Building deep class hierarchies just to reuse code', 'Inheriting only to borrow code ties classes together more tightly than containing a helper object.'],
      ['Which relationship is best modeled with composition rather than inheritance?', ['A Car has an Engine', 'A Dog is an Animal', 'A Square is a Shape', 'A Manager is an Employee'], 'A Car has an Engine', '“Has-a” relationships are composition; “is-a” relationships suit inheritance.'],
      ['What is a static method?', ['A method that belongs to the class rather than any one instance', 'A method that can never be called', 'A method that changes every object at once', 'A method only subclasses can see'], 'A method that belongs to the class rather than any one instance', 'It is called on the class itself and has no this/self object.'],
      ['Inside a method, what does this (Java/C++/JavaScript) or self (Python) refer to?', ['The object the method was called on', 'The class’s parent', 'The most recently created object', 'The program’s main function'], 'The object the method was called on', 'It is how a method reaches its own object’s fields.'],
      ['What is the main benefit of programming to an interface?', ['Code depends on a contract, so implementations can be swapped', 'Interfaces store more data', 'Interfaces remove the need for classes', 'Interface methods always run faster'], 'Code depends on a contract, so implementations can be swapped', 'Callers don’t care which class fulfills the contract.'],
      ['A Shape interface declares area(). What do Circle and Square each provide?', ['Their own implementation of area()', 'A copy of Shape’s fields', 'Nothing — Shape computes the area itself', 'A new interface'], 'Their own implementation of area()', 'The interface states what; each class decides how.'],
      ['What happens when a subclass does not override an inherited method?', ['It uses the parent’s implementation', 'The program fails to compile', 'The method is deleted', 'It must call super on every use'], 'It uses the parent’s implementation', 'Inherited behavior is kept unless the subclass replaces it.'],
      ['Why should an overriding method keep the parent method’s contract?', ['Code using the parent type must still get correct behavior', 'The compiler requires identical code', 'It makes the parent method private', 'Overrides may not change any behavior'], 'Code using the parent type must still get correct behavior', 'A subclass should be usable anywhere its parent is expected.'],
      ['What is an abstract method?', ['A method declared without an implementation', 'A method with a very long body', 'A method that returns nothing', 'A method only the constructor may call'], 'A method declared without an implementation', 'Subclasses must supply the body.'],
      ['What does marking a C++ member function virtual enable?', ['Calls through a base-class pointer or reference reach the derived override', 'The function runs at compile time', 'The function can never be overridden', 'The function is hidden from subclasses'], 'Calls through a base-class pointer or reference reach the derived override', 'Without virtual, C++ calls the base version based on the pointer’s static type.'],
      ['What is an object’s state?', ['The current values of its fields', 'The list of its methods', 'The name of its class', 'The file it was written in'], 'The current values of its fields', 'Two objects of the same class can be in different states.'],
      ['What is upcasting?', ['Treating a subclass object as its parent type', 'Converting a string to a number', 'Moving a method into a parent class', 'Creating an object from an interface'], 'Treating a subclass object as its parent type', 'Animal a = new Dog(); upcasts a Dog to Animal — always safe.'],
      ['Can a Java class implement more than one interface?', ['Yes, it can implement several interfaces', 'No, only one', 'Only if it extends no class', 'Only abstract classes can'], 'Yes, it can implement several interfaces', 'Java allows many interfaces but only one parent class.'],
      ['How many classes can a Java class directly extend?', ['One', 'Two', 'Unlimited', 'None'], 'One', 'Java supports single inheritance of classes.'],
      ['What is another name for a subclass?', ['Derived (or child) class', 'Base class', 'Interface', 'Abstract method'], 'Derived (or child) class', 'The class it extends is called the base, parent, or superclass.'],
      ['What does marking a Java method final do?', ['Prevents subclasses from overriding it', 'Makes it run last', 'Stops it from taking parameters', 'Makes it static'], 'Prevents subclasses from overriding it', 'final on a method locks its behavior for all subclasses.']
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
      ['What is exception propagation?', ['An unhandled exception moving up the call stack', 'Copying an array', 'Sending data over a network', 'Repeating a loop'], 'An unhandled exception moving up the call stack', 'If a function cannot handle an exception, its caller gets the chance.'],
      ['Which keyword catches an exception in Python?', ['except', 'catch', 'rescue', 'handle'], 'except', 'Python uses try/except; Java, C++, and JavaScript use try/catch.'],
      ['In Java, what kind of exception must a method either catch or declare with throws?', ['A checked exception', 'An unchecked exception', 'Any RuntimeException', 'An Error'], 'A checked exception', 'The compiler forces callers to deal with checked exceptions.'],
      ['Which of these is an unchecked exception in Java?', ['NullPointerException', 'IOException', 'FileNotFoundException', 'SQLException'], 'NullPointerException', 'RuntimeException subclasses such as NullPointerException are unchecked.'],
      ['What happens to the remaining code in a block after a throw statement runs?', ['It is skipped; control jumps to a matching handler', 'It runs after the handler finishes', 'It runs twice', 'It runs only if the handler fails'], 'It is skipped; control jumps to a matching handler', 'Throwing transfers control immediately.'],
      ['What does an exception that is never caught usually do?', ['Ends the program with an error and stack trace', 'Silently fixes itself', 'Restarts the function', 'Turns into a warning'], 'Ends the program with an error and stack trace', 'With no handler anywhere up the call stack, the runtime stops the program.'],
      ['What is a stack trace?', ['The list of calls that were active when the exception occurred', 'A log of every variable', 'A sorted list of exceptions', 'A diagram of the heap'], 'The list of calls that were active when the exception occurred', 'It shows exactly where the failure happened and how execution got there.'],
      ['Why include a descriptive message when raising an exception?', ['It tells whoever handles or debugs it what went wrong', 'Messages make exceptions faster', 'It stops the exception from propagating', 'The code will not compile without one'], 'It tells whoever handles or debugs it what went wrong', 'A good message names the bad value and the rule it broke.'],
      ['What does the else clause of a Python try statement run?', ['Code that should run only if the try block raised no exception', 'Code that runs only after an exception', 'Code that always runs', 'Code that replaces finally'], 'Code that should run only if the try block raised no exception', 'else keeps success-only code out of the try block.'],
      ['Which Python statement guarantees a file is closed even if an error occurs?', ['with open(path) as f:', 'f = open(path)', 'f.read()', 'print(f)'], 'with open(path) as f:', 'The with block closes the file on exit, whether or not an error occurred.'],
      ['When should a function catch an exception rather than let it propagate?', ['When it can actually recover or add useful context', 'Always, at every level', 'Never, under any circumstances', 'Only when the exception has no message'], 'When it can actually recover or add useful context', 'Otherwise, let a caller that can handle it do so.'],
      ['Why is catching a very broad type (like Exception) risky?', ['It can hide unexpected bugs you did not plan to handle', 'Broad handlers never run', 'It makes the program use more memory', 'It disables finally blocks'], 'It can hide unexpected bugs you did not plan to handle', 'Catch the specific failures you know how to handle.'],
      ['A function receives a negative age. Which response is usually best?', ['Raise a ValueError (or IllegalArgumentException) with a clear message', 'Silently change it to 0', 'Print a warning and continue', 'Return a random age'], 'Raise a ValueError (or IllegalArgumentException) with a clear message', 'Reject invalid input loudly instead of guessing.'],
      ['Checking whether a key exists before reading a dictionary is which style?', ['Defensive handling', 'Corrective handling', 'Exception chaining', 'Garbage collection'], 'Defensive handling', 'Defensive code checks preconditions before the risky step.'],
      ['Wrapping int(text) in try/except ValueError is which style?', ['Corrective handling', 'Defensive handling', 'Static typing', 'Polymorphism'], 'Corrective handling', 'Corrective code attempts the work and responds if it fails.'],
      ['What should a custom exception class usually inherit from?', ['An existing exception base class', 'The main program class', 'A string type', 'A collection type'], 'An existing exception base class', 'For example, class PaymentError(Exception) in Python or extends Exception in Java.'],
      ['Which is the clearest name for a custom exception about a declined payment?', ['PaymentDeclinedError', 'Error1', 'Oops', 'Handler'], 'PaymentDeclinedError', 'A specific name tells readers and handlers exactly what failed.'],
      ['If a try block executes return, when does its finally block run?', ['Before the function actually returns', 'Never', 'Only if an exception was raised', 'After the caller finishes'], 'Before the function actually returns', 'finally runs on every way out of the try block.'],
      ['What does re-raising the caught exception inside a handler do?', ['Passes the same exception on to outer handlers', 'Clears the exception', 'Restarts the try block', 'Converts it into a return value'], 'Passes the same exception on to outer handlers', 'Useful after logging when this level cannot recover.'],
      ['Why log an exception before recovering from it?', ['To keep evidence for debugging even after recovery', 'Logging fixes the error', 'The handler cannot run otherwise', 'It turns the exception into a warning'], 'To keep evidence for debugging even after recovery', 'Recovered failures can still point to real problems.'],
      ['How does an exception differ from returning an error code?', ['A caller can ignore an error code; an exception transfers control until handled', 'Error codes are always easier to debug', 'Exceptions can only carry numbers', 'There is no difference'], 'A caller can ignore an error code; an exception transfers control until handled', 'Exceptions cannot be silently ignored by forgetting a check.'],
      ['Which situation is a good fit for an exception rather than ordinary control flow?', ['A required config file is missing', 'Looping through a list', 'Choosing between two menu options', 'Adding two numbers'], 'A required config file is missing', 'Exceptions are for exceptional failures, not normal decisions.'],
      ['Integer division by zero in Java throws which exception?', ['ArithmeticException', 'NullPointerException', 'IOException', 'IndexOutOfBoundsException'], 'ArithmeticException', 'Java raises ArithmeticException for / by zero with ints.'],
      ['Reading index 10 of a 5-element Python list raises which exception?', ['IndexError', 'KeyError', 'ValueError', 'TypeError'], 'IndexError', 'Sequence indexes outside the valid range raise IndexError.'],
      ['Reading a missing key with d["x"] in Python raises which exception?', ['KeyError', 'IndexError', 'NameError', 'ValueError'], 'KeyError', 'Dictionaries raise KeyError for absent keys; d.get("x") returns None instead.'],
      ['int("abc") in Python raises which exception?', ['ValueError', 'TypeError', 'KeyError', 'SyntaxError'], 'ValueError', 'The type is right (a string) but its value cannot be converted.'],
      ['"5" + 3 in Python raises which exception?', ['TypeError', 'ValueError', 'IndexError', 'NameError'], 'TypeError', 'Python will not add a str and an int without an explicit conversion.'],
      ['Why should a handler leave the program in a consistent state?', ['Later code assumes data is valid after recovery', 'Handlers must always exit the program', 'Consistency makes exceptions propagate', 'It is only required in Python'], 'Later code assumes data is valid after recovery', 'Half-finished updates must be rolled back or completed.'],
      ['In C++, what does RAII use to release resources automatically?', ['Destructors that run when objects go out of scope', 'A garbage collector', 'The finally keyword', 'Global variables'], 'Destructors that run when objects go out of scope', 'C++ has no finally; RAII ties cleanup to object lifetime.'],
      ['What does an assertion check?', ['A condition the programmer believes must always be true', 'Only the formatting of user input', 'Network availability', 'How long a function takes'], 'A condition the programmer believes must always be true', 'A failed assertion signals a bug in the program itself.'],
      ['Should assertions be used to validate user input in production code?', ['No — they can be disabled, so use real checks and exceptions', 'Yes, always', 'Only for numbers', 'Only inside finally blocks'], 'No — they can be disabled, so use real checks and exceptions', 'Python’s -O flag and Java’s default settings skip assertions.']
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
      ['Why choose an array over a linked list for indexed access?', ['Arrays provide direct index lookup', 'Arrays never use memory', 'Linked lists cannot store values', 'Arrays are always sorted'], 'Arrays provide direct index lookup', 'Contiguous array layout supports constant-time indexing.'],
      ['What does push do on a stack?', ['Adds an item to the top', 'Removes the bottom item', 'Sorts the stack', 'Reads the middle item'], 'Adds an item to the top', 'The newest item always sits on top.'],
      ['What does pop do on a stack?', ['Removes and returns the top item', 'Adds an item to the bottom', 'Empties the whole stack', 'Returns the size'], 'Removes and returns the top item', 'pop takes away the most recently pushed item.'],
      ['What does peek (or top) return on a stack?', ['The top item without removing it', 'The bottom item', 'The number of items', 'A sorted copy'], 'The top item without removing it', 'peek lets you look before deciding to pop.'],
      ['What does enqueue do?', ['Adds an item to the back of a queue', 'Removes the front item', 'Reverses the queue', 'Adds an item to the front'], 'Adds an item to the back of a queue', 'Items join at the back and leave from the front.'],
      ['You push 1, 2, 3 onto an empty stack, then pop once. What comes out?', ['3', '1', '2', 'Nothing'], '3', 'Last in, first out.'],
      ['You enqueue 1, 2, 3 into an empty queue, then dequeue once. What comes out?', ['1', '3', '2', 'Nothing'], '1', 'First in, first out.'],
      ['What is the cost of reaching the k-th element of a singly linked list?', ['O(k)', 'O(1)', 'O(log k)', 'O(k²)'], 'O(k)', 'You must follow k links from the head.'],
      ['What does a doubly linked list node store that a singly linked node does not?', ['A link to the previous node', 'A second value', 'An index number', 'A hash code'], 'A link to the previous node', 'Two links let you walk the list in both directions.'],
      ['What does the last node of a singly linked list point to?', ['Null (nothing)', 'The head', 'Itself', 'The middle node'], 'Null (nothing)', 'A null next-link marks the end of the list.'],
      ['What is a hash function’s job in a hash map?', ['Turn a key into a bucket index', 'Sort the keys alphabetically', 'Encrypt the stored values', 'Count the entries'], 'Turn a key into a bucket index', 'The bucket index tells the map where to look.'],
      ['What is chaining in a hash map?', ['Storing colliding entries together in a list at one bucket', 'Linking every bucket into one list', 'Sorting keys before insertion', 'Copying the whole map'], 'Storing colliding entries together in a list at one bucket', 'Each bucket holds every entry that hashed to it.'],
      ['Why does a hash map grow its bucket array as it fills?', ['To keep buckets short so lookups stay fast', 'To sort its keys', 'To delete old entries', 'To save memory when full'], 'To keep buckets short so lookups stay fast', 'Resizing spreads entries over more buckets.'],
      ['What is the worst-case lookup time in a hash map where every key collides?', ['O(n)', 'O(1)', 'O(log n)', 'O(n²)'], 'O(n)', 'All entries land in one bucket, which must be searched linearly.'],
      ['Which structure maps keys to values?', ['A dictionary / hash map', 'A stack', 'A queue', 'A linked list'], 'A dictionary / hash map', 'Each key leads directly to its value.'],
      ['Which structure answers “have I seen this item before?” fastest on average?', ['A hash set', 'An unsorted list', 'A stack', 'A queue'], 'A hash set', 'Membership checks are O(1) on average.'],
      ['What is the average cost of appending to a dynamic array (ArrayList / Python list)?', ['O(1) amortized', 'O(n) every time', 'O(log n)', 'O(n²)'], 'O(1) amortized', 'Occasional resizes are spread across many cheap appends.'],
      ['Why is inserting at the front of an array O(n)?', ['Every existing element must shift over', 'Arrays cannot grow', 'The array must be sorted first', 'Each element is rehashed'], 'Every existing element must shift over', 'Making room at index 0 moves all n items.'],
      ['Which structure tracks active function calls behind the scenes during recursion?', ['A stack (the call stack)', 'A queue', 'A hash map', 'A set'], 'A stack (the call stack)', 'Each call pushes a frame; each return pops one.'],
      ['Which Python built-in type is a dynamic array?', ['list', 'tuple', 'dict', 'set'], 'list', 'A list grows and supports indexing; a tuple is fixed.'],
      ['Which Python built-in type is a hash map?', ['dict', 'list', 'tuple', 'str'], 'dict', 'dict maps hashable keys to values.'],
      ['Which Java class is the standard hash map implementation?', ['HashMap', 'ArrayList', 'LinkedList', 'TreeSet'], 'HashMap', 'HashMap<K, V> stores key-value pairs by hash.'],
      ['What must hash map keys provide to work correctly?', ['Consistent hashing and equality', 'A numeric value', 'Alphabetical order', 'A fixed length'], 'Consistent hashing and equality', 'Equal keys must always hash to the same bucket.'],
      ['Why can’t a Python list be used as a dict key?', ['It is unhashable because its contents can change', 'Lists are too slow to compare', 'dict keys must be strings', 'Lists cannot hold numbers'], 'It is unhashable because its contents can change', 'A key’s hash must never change; use a tuple instead.'],
      ['Given the node before it, what does removing a node from a linked list cost?', ['O(1) — just relink the neighbors', 'O(n) to shift elements', 'O(log n)', 'O(n²)'], 'O(1) — just relink the neighbors', 'No other nodes move.'],
      ['What is stack underflow?', ['Popping from an empty stack', 'Pushing onto a full stack', 'A stack with duplicate items', 'Sorting a stack'], 'Popping from an empty stack', 'There is no item to return.'],
      ['What does a deque (double-ended queue) allow?', ['Adding and removing at both ends', 'Only adding at the back', 'Only removing at the front', 'Random access by key'], 'Adding and removing at both ends', 'It can act as both a stack and a queue.'],
      ['How does a linked list’s memory use compare with an array of the same values?', ['Higher — each node also stores a link', 'Lower — links take no space', 'Exactly the same', 'Zero for linked lists'], 'Higher — each node also stores a link', 'Every element carries pointer overhead.'],
      ['What does keeping an array sorted make possible?', ['Binary search in O(log n)', 'O(1) insertion anywhere', 'Automatic removal of duplicates', 'Unlimited size'], 'Binary search in O(log n)', 'Sorted order lets you halve the search range each step.'],
      ['What is a hash map’s load factor?', ['Entries divided by the number of buckets', 'The size of the largest key', 'Collisions per second', 'Bytes per entry'], 'Entries divided by the number of buckets', 'A rising load factor triggers a resize.'],
      ['Which structure would you use to count how many times each word appears?', ['A hash map from word to count', 'A stack of words', 'A queue of counts', 'A linked list of letters'], 'A hash map from word to count', 'Look up each word in O(1) and increment its count.']
    ]);
    addTopic(questions, 'cp2-recursion', regular10((i) => ['fact', 3 + i]),
      mixGrids(12, range(5, 40).map((n) => ['sum', n]), range(5, 25).map((n) => ['fib', n]), range(3, 19).map((n) => ['pow2', n])), cp2RecursionQ);
    addTopic(questions, 'cp2-complexity', regular10((i) => ['halve', i + 3]),
      mixGrids(10, range(13, 20).map((k) => ['halve', k]), range(2, 10).map((k) => ['nlogn', k]), range(5, 30).map((n) => ['triangle', n]),
        grid(range(3, 12), range(3, 12)).map(([a, b]) => ['nested', a, b])), cp2ComplexityQ);
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
      ['Why minimize shared mutable state?', ['It reduces synchronization bugs', 'It makes every algorithm O(1)', 'It prevents all exceptions', 'It removes the need for tests'], 'It reduces synchronization bugs', 'Less shared mutation means fewer timing-sensitive interactions.'],
      ['What happens to a function’s local variables when it returns?', ['Its stack frame is popped and they go away', 'They move to the heap', 'They become global', 'They stay until the program ends'], 'Its stack frame is popped and they go away', 'Stack memory is reclaimed automatically on return.'],
      ['What usually causes a stack overflow error?', ['Too many nested calls, often unbounded recursion', 'Too many heap objects', 'A full hard drive', 'A slow network'], 'Too many nested calls, often unbounded recursion', 'Each call adds a frame until the stack runs out of space.'],
      ['In C++, what does new do?', ['Allocates an object on the heap', 'Creates a local stack variable', 'Starts a new thread', 'Copies a file'], 'Allocates an object on the heap', 'new returns a pointer to heap memory that someone must later release.'],
      ['In C++, what must eventually pair with each new?', ['delete', 'malloc', 'return', 'another new'], 'delete', 'Every new needs exactly one delete (or a smart pointer that does it).'],
      ['What is a double free?', ['Releasing the same memory twice', 'Allocating two objects at once', 'Freeing two objects correctly', 'Copying a pointer'], 'Releasing the same memory twice', 'It corrupts the allocator and can crash or be exploited.'],
      ['What does a pointer store?', ['A memory address', 'A copy of the whole object', 'A file name', 'A thread ID'], 'A memory address', 'The pointer refers to where the object lives.'],
      ['What does dereferencing a pointer do?', ['Accesses the value at the stored address', 'Deletes the pointer', 'Increments the address', 'Copies the pointer'], 'Accesses the value at the stored address', 'In C++, *p reads or writes the pointed-to object.'],
      ['What is a null pointer?', ['A pointer that refers to no object', 'A pointer to address zero that is always safe to read', 'A pointer to the stack', 'A deleted variable name'], 'A pointer that refers to no object', 'Dereferencing a null pointer is a bug.'],
      ['How does a C++ reference differ from a pointer?', ['It must refer to an object and cannot be reseated', 'It can be null and reassigned freely', 'It always lives on the heap', 'It copies the object'], 'It must refer to an object and cannot be reseated', 'A reference is bound once, at initialization.'],
      ['What does std::unique_ptr provide?', ['Single ownership that deletes the object automatically', 'Shared ownership counted across owners', 'A raw address with no cleanup', 'A thread lock'], 'Single ownership that deletes the object automatically', 'When the unique_ptr goes out of scope, the object is deleted.'],
      ['What does std::shared_ptr do?', ['Keeps an object alive until its last owner releases it', 'Allows only one owner', 'Copies the object for each owner', 'Prevents the object from ever being freed'], 'Keeps an object alive until its last owner releases it', 'It counts owners and deletes the object when the count reaches zero.'],
      ['What can two shared_ptrs that point at each other cause?', ['A reference cycle that is never freed', 'An immediate crash', 'A double free', 'Faster deletion'], 'A reference cycle that is never freed', 'Each keeps the other’s count above zero.'],
      ['What does std::make_unique create?', ['An object owned by a new unique_ptr', 'A copy of a shared_ptr', 'A raw pointer you must delete', 'A lock on the object'], 'An object owned by a new unique_ptr', 'It allocates and hands ownership to a unique_ptr in one step.'],
      ['Why is garbage collection convenient?', ['Programmers do not manually free most memory', 'It makes every program faster', 'It removes the need for variables', 'It prevents all bugs'], 'Programmers do not manually free most memory', 'The runtime finds and reclaims unreachable objects.'],
      ['What is a trade-off of garbage collection?', ['Occasional pauses and less control over when memory is freed', 'Programs cannot allocate objects', 'It requires manual delete calls', 'It disables the heap'], 'Occasional pauses and less control over when memory is freed', 'The collector decides when to run.'],
      ['Can a garbage-collected program still leak memory?', ['Yes — by keeping references to objects it no longer needs', 'No, never', 'Only in C++', 'Only when it uses threads'], 'Yes — by keeping references to objects it no longer needs', 'Reachable objects are never collected, even if they are useless.'],
      ['What does reference counting track?', ['How many references point to an object', 'How many times a function ran', 'The number of threads', 'The size of the stack'], 'How many references point to an object', 'At zero references, the object can be freed immediately.'],
      ['What does a smart pointer add over a raw pointer?', ['Automatic cleanup tied to ownership', 'Faster arithmetic', 'Access to private fields', 'Thread scheduling'], 'Automatic cleanup tied to ownership', 'It releases memory when its owner goes away.'],
      ['What do two threads in the same process share?', ['The heap (the process’s memory)', 'Their call stacks', 'Nothing at all', 'Only their program counters'], 'The heap (the process’s memory)', 'Threads share memory, but each has its own stack.'],
      ['When a unique_ptr is moved to another variable, what happens to the original?', ['It becomes empty and no longer owns the object', 'Both now own the object', 'The object is copied', 'The object is deleted'], 'It becomes empty and no longer owns the object', 'Ownership transfers; there is still exactly one owner.'],
      ['Two threads each run count += 1 a thousand times with no lock. Why can the result end up below 2000?', ['Their read-modify-write steps interleave and lose updates', 'Integers cannot exceed 1000', 'Threads always run one after another', 'The garbage collector deletes updates'], 'Their read-modify-write steps interleave and lose updates', 'This is a race condition on shared state.'],
      ['What is heap fragmentation?', ['Free memory split into small gaps that are hard to reuse', 'A stack that grows too tall', 'A pointer to the wrong type', 'A thread that stops early'], 'Free memory split into small gaps that are hard to reuse', 'Large requests can fail even when total free memory is enough.'],
      ['In C++, what runs automatically when a stack object goes out of scope?', ['Its destructor', 'Its constructor', 'The garbage collector', 'Nothing'], 'Its destructor', 'Destructors are how RAII releases resources.'],
      ['What does a garbage collector start from to decide what is reachable?', ['Roots such as stack variables and globals', 'The newest object', 'The largest object', 'Every file on disk'], 'Roots such as stack variables and globals', 'Anything not reachable from a root is garbage.'],
      ['Why is passing by const reference common in C++?', ['It avoids a copy and stops the function from modifying the argument', 'It makes the value global', 'It moves the object to the heap', 'It deletes the argument afterwards'], 'It avoids a copy and stops the function from modifying the argument', 'Efficient and safe for large read-only arguments.'],
      ['What does Python’s del x do?', ['Removes the name x; the object is freed once nothing else refers to it', 'Immediately erases the object everywhere', 'Deletes a file named x', 'Clears the whole heap'], 'Removes the name x; the object is freed once nothing else refers to it', 'del drops one reference, not the object itself.'],
      ['Which tools help catch C++ memory errors such as leaks and use-after-free?', ['Memory checkers like AddressSanitizer or Valgrind', 'More comments', 'Larger integer types', 'Renaming variables'], 'Memory checkers like AddressSanitizer or Valgrind', 'They detect invalid reads, writes, and leaks while the program runs.'],
      ['Which is generally faster to allocate?', ['A stack variable', 'A heap object', 'They always cost the same', 'A file on disk'], 'A stack variable', 'Stack allocation just moves the stack pointer.'],
      ['Why must a C++ function never return a pointer to one of its local variables?', ['The local’s storage ends when the function returns', 'Pointers cannot be returned at all', 'Local variables live on the heap', 'It doubles memory use'], 'The local’s storage ends when the function returns', 'The caller would receive a dangling pointer.'],
      ['In Java, can you explicitly free an object with delete?', ['No — the garbage collector reclaims unreachable objects', 'Yes, with delete', 'Yes, with free()', 'Only for strings'], 'No — the garbage collector reclaims unreachable objects', 'Java has no delete; dropping references is enough.']
    ]);
    return questions;
  }

  // Spreadsheet functions: the original 10 are AVERAGE; new ones add SUM and MAX.
  const dataSheetQ = (id, fn, values) => {
    if (fn === 'AVERAGE') {
      const answer = values.reduce((sum, value) => sum + value, 0) / values.length;
      return qNumber(id, 'Spreadsheets', `A spreadsheet range contains ${values.join(', ')}. What does AVERAGE return?`,
        answer, `AVERAGE adds the four values and divides by 4, giving ${answer}.`, { kind: 'average', values });
    }
    if (fn === 'SUM') {
      const answer = values.reduce((sum, value) => sum + value, 0);
      return qNumber(id, 'Spreadsheets', `A spreadsheet range contains ${values.join(', ')}. What does SUM return?`,
        answer, `SUM adds the four values: ${answer}.`, { kind: 'sum-values', values });
    }
    const answer = Math.max(...values);
    return qNumber(id, 'Spreadsheets', `A spreadsheet range contains ${values.join(', ')}. What does MAX return?`,
      answer, `MAX returns the largest value in the range: ${answer}.`, { kind: 'max-values', values });
  };
  const dataStatsQ = (id, values) => qNumber(
    id, 'Descriptive statistics',
    `Find the median of ${values.join(', ')}.`,
    values[2], `The values are ordered, so the middle value is ${values[2]}.`,
    { kind: 'median', values }
  );
  const dataRegressionQ = (id, x1, x2, y1, slope) => {
    const y2 = y1 + slope * (x2 - x1);
    return qNumber(
      id, 'Correlation and regression',
      `A fitted line passes through (${x1}, ${y1}) and (${x2}, ${y2}). Find its slope.`,
      slope, `Slope = (${y2} − ${y1})/(${x2} − ${x1}) = ${slope}.`,
      { kind: 'two-point-slope', x1, y1, x2, y2 }
    );
  };

  function dataHandling() {
    const questions = [];
    const addConcepts = (prefix, topic, rows) => rows.forEach(([prompt, choices, answer, explanation], i) => {
      questions.push(qChoice(`${prefix}-${i + 1}`, topic, prompt, choices, answer, explanation, { kind: 'concept', expected: answer }));
    });
    addTopic(questions, 'data-sheet', regular10((i) => ['AVERAGE', [i + 2, i + 4, i + 6, i + 8]]),
      grid(['AVERAGE', 'SUM', 'MAX'], range(1, 30), range(1, 6)).map(([fn, s, d]) => [fn, [s + d, s + 4 * d, s, s + 3 * d]]), dataSheetQ);
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
      ['Why use a CTE?', ['Name an intermediate query for clarity and reuse', 'Encrypt every row', 'Replace all indexes', 'Open a spreadsheet'], 'Name an intermediate query for clarity and reuse', 'WITH clauses make multi-step queries easier to read.'],
      ['Which clause filters groups after aggregation?', ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], 'HAVING', 'WHERE filters rows before grouping; HAVING filters the groups afterwards.'],
      ['Which clause sorts query results?', ['ORDER BY', 'GROUP BY', 'SORT', 'ARRANGE'], 'ORDER BY', 'ORDER BY sorts the final rows by one or more columns.'],
      ['What does ORDER BY price DESC do?', ['Sorts rows from highest price to lowest', 'Sorts rows from lowest price to highest', 'Removes duplicate prices', 'Groups rows by price'], 'Sorts rows from highest price to lowest', 'DESC means descending; ASC (the default) means ascending.'],
      ['Which keyword removes duplicate rows from a result?', ['DISTINCT', 'UNIQUE ROWS', 'ONLY', 'SINGLE'], 'DISTINCT', 'SELECT DISTINCT returns each distinct combination of the selected columns once.'],
      ['Which aggregate function returns the average of a column?', ['AVG', 'MEAN', 'MIDDLE', 'TOTAL'], 'AVG', 'AVG(column) is the standard SQL average.'],
      ['Which aggregate function adds up a column?', ['SUM', 'ADD', 'COUNT', 'PLUS'], 'SUM', 'SUM(column) totals the values; COUNT counts rows.'],
      ['How do you keep only rows where a column has no value?', ['WHERE col IS NULL', 'WHERE col = NULL', 'WHERE col == NULL', 'WHERE NULL(col)'], 'WHERE col IS NULL', 'A comparison with = NULL is never true; NULL needs IS NULL.'],
      ['How does COUNT(*) differ from COUNT(column)?', ['COUNT(*) counts every row; COUNT(column) skips rows where column is NULL', 'COUNT(*) counts columns, not rows', 'COUNT(*) counts only distinct rows', 'They always return the same number'], 'COUNT(*) counts every row; COUNT(column) skips rows where column is NULL', 'Aggregates over a column ignore NULLs.'],
      ['Which operator matches a text pattern, such as names starting with A?', ['LIKE', 'MATCH', 'IN', 'BETWEEN'], 'LIKE', 'WHERE name LIKE \'A%\' matches any name beginning with A.'],
      ['What does WHERE age BETWEEN 18 AND 25 include?', ['Ages 18 through 25, inclusive', 'Ages 19 through 24 only', 'Only 18 and 25', 'Ages under 18 or over 25'], 'Ages 18 through 25, inclusive', 'BETWEEN includes both endpoints.'],
      ['What does WHERE country IN (\'US\', \'CA\') keep?', ['Rows whose country is US or CA', 'Rows with both countries at once', 'Every row except US and CA', 'A new table for each country'], 'Rows whose country is US or CA', 'IN is shorthand for several OR comparisons.'],
      ['A LEFT JOIN finds no match in the right table for a row. What fills the right-side columns?', ['NULL', '0', 'An empty string', 'The left table’s values'], 'NULL', 'Unmatched rows are kept, with NULL for the missing side.'],
      ['Which join returns every row from both tables, matching them where possible?', ['FULL OUTER JOIN', 'INNER JOIN', 'LEFT JOIN', 'CROSS JOIN'], 'FULL OUTER JOIN', 'It keeps unmatched rows from both sides, filled with NULLs.'],
      ['What does a CROSS JOIN produce?', ['Every combination of rows from both tables', 'Only matching rows', 'Only unmatched rows', 'One summary row'], 'Every combination of rows from both tables', '3 rows × 4 rows gives 12 result rows.'],
      ['Which query gives each customer’s number of orders?', ['SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id', 'SELECT COUNT(customer_id) FROM orders', 'SELECT * FROM orders ORDER BY customer_id', 'SELECT DISTINCT customer_id FROM orders'], 'SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id', 'GROUP BY makes one group per customer; COUNT(*) counts each group’s rows.'],
      ['What is a subquery?', ['A query nested inside another query', 'A query that deletes rows', 'A backup of a table', 'A stored password'], 'A query nested inside another query', 'For example, WHERE price > (SELECT AVG(price) FROM products).'],
      ['In the relational model, how is data organized?', ['In tables of rows and columns', 'In nested folders', 'As plain-text paragraphs', 'As one big list of key-value pairs'], 'In tables of rows and columns', 'Each table is a relation; rows are records and columns are attributes.'],
      ['What is normalization mainly meant to reduce?', ['Redundant, duplicated data', 'The number of queries', 'The number of primary keys', 'Column name length'], 'Redundant, duplicated data', 'Each fact is stored once, so it can’t drift out of sync.'],
      ['Why store customers and orders in separate tables linked by a key?', ['Customer details are stored once instead of repeated on every order', 'A table can hold only two columns', 'Duplicating data is always faster', 'Keys are optional decoration'], 'Customer details are stored once instead of repeated on every order', 'A join brings them back together when needed.'],
      ['What does an index on a column mainly speed up?', ['Lookups and filtering on that column', 'Inserting new rows', 'Dropping the table', 'Renaming columns'], 'Lookups and filtering on that column', 'Indexes speed reads but add a little cost to writes.'],
      ['Which statement adds a new row to a table?', ['INSERT INTO', 'ADD ROW', 'UPDATE', 'CREATE ROW'], 'INSERT INTO', 'INSERT INTO table (cols) VALUES (...) adds a row.'],
      ['Which statement changes values in existing rows?', ['UPDATE', 'INSERT INTO', 'ALTER ROW', 'MODIFY'], 'UPDATE', 'UPDATE table SET col = value WHERE ... edits matching rows.'],
      ['What happens if you run DELETE FROM orders; with no WHERE clause?', ['Every row in orders is deleted', 'Nothing happens', 'Only the first row is deleted', 'The table definition is dropped'], 'Every row in orders is deleted', 'Without WHERE, the delete applies to the whole table (the empty table still exists).'],
      ['Which query returns the 5 most expensive products in PostgreSQL, MySQL, or SQLite?', ['SELECT * FROM products ORDER BY price DESC LIMIT 5', 'SELECT * FROM products LIMIT 5', 'SELECT MAX(price) FROM products LIMIT 5', 'SELECT * FROM products ORDER BY price LIMIT 5'], 'SELECT * FROM products ORDER BY price DESC LIMIT 5', 'Sort highest first, then keep 5; LIMIT alone returns an arbitrary 5.'],
      ['What does SELECT price * qty AS total do?', ['Names the computed column total in the result', 'Adds a permanent column to the table', 'Multiplies every table', 'Renames the table'], 'Names the computed column total in the result', 'AS creates an alias for the output column only.'],
      ['Why can’t SUM(amount) > 100 go in a WHERE clause?', ['WHERE filters individual rows before any groups are aggregated', 'SUM only works in ORDER BY', 'WHERE cannot compare numbers', 'Aggregates are not valid SQL'], 'WHERE filters individual rows before any groups are aggregated', 'Conditions on aggregates belong in HAVING.'],
      ['In standard SQL, what is wrong with SELECT name, COUNT(*) FROM people GROUP BY city?', ['name is neither grouped nor aggregated', 'COUNT(*) needs a column name', 'GROUP BY must come before FROM', 'Nothing is wrong'], 'name is neither grouped nor aggregated', 'Each group has many names, so standard SQL rejects picking one.'],
      ['What is a composite primary key?', ['A key made of two or more columns together', 'A single auto-numbered column', 'A foreign key used as an index', 'A key that may be NULL'], 'A key made of two or more columns together', 'For example, (student_id, course_id) in an enrollments table.'],
      ['What is a one-to-many relationship?', ['One row in a table relates to many rows in another, like one customer to many orders', 'Every row relates to every other row', 'Two tables holding identical data', 'A table with only one column'], 'One row in a table relates to many rows in another, like one customer to many orders', 'The “many” side stores a foreign key pointing to the “one” side.'],
      ['Why might a query use COALESCE(discount, 0)?', ['To treat NULL discounts as 0 so arithmetic works', 'To sort by discount', 'To count discounts', 'To delete rows with NULL'], 'To treat NULL discounts as 0 so arithmetic works', 'COALESCE returns its first non-NULL argument.']
    ]);
    addTopic(questions, 'data-stats', regular10((i) => [[i, i + 2, i + 4, i + 8, i + 12]]),
      grid(range(0, 20), range(1, 4), range(1, 5)).map(([s, g, h]) => [[s, s + g, s + 2 * g, s + 2 * g + h, s + 2 * g + 2 * h]]), dataStatsQ);
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
      ['Which action best preserves raw data?', ['Create a cleaned copy and leave source unchanged', 'Overwrite the source immediately', 'Delete rejected rows permanently', 'Round every number'], 'Create a cleaned copy and leave source unchanged', 'An immutable raw source supports auditing and recovery.'],
      ['What does accuracy measure in data quality?', ['Whether values match the real-world truth', 'Whether every field is filled in', 'Whether data loads quickly', 'Whether columns are sorted'], 'Whether values match the real-world truth', 'A complete, well-formatted value can still be wrong.'],
      ['What does consistency measure?', ['Whether the same fact agrees across records and systems', 'Whether values are numbers', 'How recent the data is', 'How many rows exist'], 'Whether the same fact agrees across records and systems', 'A customer listed with two different birth dates is inconsistent.'],
      ['What does timeliness measure?', ['Whether data is current enough for its use', 'How fast a query runs', 'How many columns exist', 'Whether names are spelled correctly'], 'Whether data is current enough for its use', 'Last year’s inventory counts fail timeliness for today’s restock.'],
      ['What does uniqueness measure?', ['Whether each real-world entity appears only once', 'Whether every value differs from the mean', 'Whether keys are long enough', 'Whether data is encrypted'], 'Whether each real-world entity appears only once', 'Duplicate records break uniqueness.'],
      ['What does MAR (missing at random) mean?', ['Missingness depends on other observed variables, not on the missing value itself', 'Missingness is completely unrelated to any data', 'Missingness depends on the missing value itself', 'No values are missing'], 'Missingness depends on other observed variables, not on the missing value itself', 'For example, older respondents skipping a question more often, where age is recorded.'],
      ['What does MNAR (missing not at random) mean?', ['Missingness depends on the unobserved value itself', 'Missingness is unrelated to all data', 'Missingness depends only on observed variables', 'Missing values were deleted on purpose'], 'Missingness depends on the unobserved value itself', 'The hardest case, because the data can’t reveal the pattern on its own.'],
      ['High earners skip an income question more often than others. Which type of missingness is this?', ['MNAR', 'MCAR', 'MAR', 'Not missing'], 'MNAR', 'The chance of a value being missing depends on the income itself.'],
      ['What is listwise deletion?', ['Dropping every row that has any missing value', 'Deleting one column', 'Replacing missing values with the mean', 'Removing duplicate rows'], 'Dropping every row that has any missing value', 'Simple, but it can throw away a lot of data and bias results.'],
      ['What is a risk of filling missing values with the column mean?', ['It shrinks the variance and can distort relationships', 'It always makes the data more accurate', 'It deletes rows', 'It changes column names'], 'It shrinks the variance and can distort relationships', 'Many identical filled values pull the spread toward zero.'],
      ['Why add a was_missing indicator column when imputing?', ['So later analysis can still see which values were filled in', 'To delete those rows automatically later', 'Because imputation will not run without it', 'To sort the table'], 'So later analysis can still see which values were filled in', 'Imputation shouldn’t erase the fact that data was missing.'],
      ['Which rule flags outliers using quartiles?', ['Values more than 1.5 × IQR below Q1 or above Q3', 'Values equal to the median', 'Any negative value', 'The first and last rows'], 'Values more than 1.5 × IQR below Q1 or above Q3', 'IQR = Q3 − Q1; the 1.5 × IQR fences mark unusually far values.'],
      ['A height of 250 cm appears in a student survey. What is it most likely?', ['A data-entry error worth checking', 'A typical value', 'A missing value', 'A duplicate'], 'A data-entry error worth checking', 'It is far outside plausible human heights — investigate before using it.'],
      ['Which summary statistic is least affected by a few extreme values?', ['Median', 'Mean', 'Range', 'Sum'], 'Median', 'The median depends on order, not on how extreme the tails are.'],
      ['A column contains "NY", "New York", and "new york". What does it need?', ['Standardizing to one canonical value', 'Deleting the column', 'Averaging the values', 'Converting to numbers'], 'Standardizing to one canonical value', 'Otherwise one state counts as three categories.'],
      ['Two customer rows share an email address but differ only in name capitalization. What are they likely to be?', ['Duplicates of the same customer', 'Two unrelated customers', 'Missing data', 'Outliers'], 'Duplicates of the same customer', 'A shared unique identifier plus near-identical names signals one person.'],
      ['What is a key step before merging duplicate records?', ['Decide which value wins for each conflicting field', 'Delete both records', 'Sort the table alphabetically', 'Convert every field to text'], 'Decide which value wins for each conflicting field', 'For example, keep the most recently updated address.'],
      ['Dates stored as both 03/04/2024 and 2024-04-03 cause what problem?', ['Ambiguous, inconsistent formats that must be standardized', 'Too many rows', 'Duplicate primary keys', 'Encrypted values'], 'Ambiguous, inconsistent formats that must be standardized', '03/04 could mean March 4 or April 3 — pick one unambiguous format such as ISO 8601.'],
      ['Why trim leading and trailing spaces from text fields?', ['So " Alice" and "Alice" match as the same value', 'It makes text uppercase', 'It removes duplicate rows', 'It converts text to numbers'], 'So " Alice" and "Alice" match as the same value', 'Invisible spaces break joins, grouping, and deduplication.'],
      ['A numeric column contains "N/A", "-", and blank cells. What should you do first?', ['Convert these placeholders to one proper missing value', 'Treat them as zeros', 'Delete the whole column', 'Leave them as text'], 'Convert these placeholders to one proper missing value', 'Then the column can be typed as numeric and missingness handled deliberately.'],
      ['What does analysis-ready data mean?', ['Clean, consistent, documented, and shaped for the analysis', 'Data that has never been touched', 'Data with every outlier deleted', 'Data stored only in spreadsheets'], 'Clean, consistent, documented, and shaped for the analysis', 'It is the end state of the raw-to-ready pipeline.'],
      ['What is tidy data?', ['Each variable is a column, each observation a row, and each value a cell', 'Data with no numbers', 'Data sorted alphabetically', 'All data stored in one cell'], 'Each variable is a column, each observation a row, and each value a cell', 'This shape works directly with most analysis tools.'],
      ['Why check data types after importing a CSV?', ['Numbers and dates can load as text and break calculations', 'CSV files cannot store text', 'Importing deletes columns', 'Types only matter for charts'], 'Numbers and dates can load as text and break calculations', 'A single stray character can make a whole column text.'],
      ['A drop-down list on a spreadsheet input cell is an example of what?', ['Input validation that prevents bad entries', 'Deduplication', 'Imputation', 'Outlier detection'], 'Input validation that prevents bad entries', 'It restricts entries to allowed values at the source.'],
      ['What is a range check?', ['Confirming a value falls within allowed limits, like an age from 0 to 120', 'Counting the rows in a range', 'Sorting values', 'Checking spelling'], 'Confirming a value falls within allowed limits, like an age from 0 to 120', 'It catches impossible values early.'],
      ['What is a referential-integrity problem?', ['An order refers to a customer ID that does not exist', 'A column has a long name', 'Two columns are sorted differently', 'A table has too many rows'], 'An order refers to a customer ID that does not exist', 'Foreign keys should always point at real rows.'],
      ['What does profiling a dataset mean?', ['Summarizing each column’s types, counts, missing values, and ranges to spot problems', 'Building a chart for the audience', 'Encrypting personal data', 'Deleting the first row'], 'Summarizing each column’s types, counts, missing values, and ranges to spot problems', 'Profiling comes before cleaning decisions.'],
      ['Survey answers recorded on both 1–5 and 1–10 scales share one column. What do they need?', ['Rescaling or separating so values are comparable', 'Averaging as they are', 'Deleting the higher values', 'Sorting'], 'Rescaling or separating so values are comparable', 'A 5 means different things on the two scales.'],
      ['Why is dropping rows with missing values risky when the missingness is MNAR?', ['The remaining data becomes biased', 'It never has any effect', 'It creates duplicates', 'It adds outliers'], 'The remaining data becomes biased', 'The dropped rows differ systematically from the kept ones.'],
      ['Why keep units consistent, such as all kilograms instead of a mix of kg and lb?', ['Mixed units make comparisons and totals wrong', 'Units only matter for labels', 'Databases reject units', 'It speeds up loading'], 'Mixed units make comparisons and totals wrong', '10 lb and 10 kg are very different weights.'],
      ['What should you do with an exact duplicate row created by importing the same file twice?', ['Remove the extra copy', 'Keep both and double the totals', 'Average them', 'Mark it as an outlier'], 'Remove the extra copy', 'Exact duplicates from a double import add no information.']
    ]);
    addTopic(questions, 'data-regression', regular10((i) => [i, i + 2 + (i % 3), 2 * i - 1, (i % 5) - 2 || 3]),
      grid(range(0, 6), range(1, 4), range(-3, 8), nonZero(-3, 3)).map(([x1, dx, y1, slope]) => [x1, x1 + dx, y1, slope]), dataRegressionQ);
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
      ['Why label units on axes?', ['Numbers need measurement context', 'Units increase sample size', 'Units remove outliers', 'Units imply causation'], 'Numbers need measurement context', 'A value is ambiguous without its scale or measurement unit.'],
      ['Which chart best shows the distribution of one numeric variable?', ['Histogram', 'Pie chart', 'Line chart', 'Map'], 'Histogram', 'Bars of binned counts show the shape, center, and spread.'],
      ['When is a pie chart reasonable?', ['Showing a few parts of one whole', 'Comparing 20 categories precisely', 'Showing change over many years', 'Plotting two numeric variables'], 'Showing a few parts of one whole', 'With more than a handful of slices, angles become hard to compare.'],
      ['Why are bar charts usually easier to compare than pie charts?', ['People judge lengths more accurately than angles', 'Bars use more colors', 'Pie charts cannot show percentages', 'Bars always start at the mean'], 'People judge lengths more accurately than angles', 'Aligned lengths are one of the easiest visual comparisons.'],
      ['Which chart compares the median and spread of a variable across groups?', ['Box plot', 'Pie chart', 'A single bar', 'Word cloud'], 'Box plot', 'Each box shows the quartiles and median for one group.'],
      ['Which chart shows how totals split into parts across several categories?', ['Stacked bar chart', 'Scatterplot', 'Histogram', 'A single line chart'], 'Stacked bar chart', 'Each bar is a total; its segments are the parts.'],
      ['How can a dual-axis chart mislead?', ['Choosing the two scales can make unrelated series look linked', 'It always shows too little data', 'It cannot show time', 'It hides the title'], 'Choosing the two scales can make unrelated series look linked', 'Rescaling one axis can line up almost any two trends.'],
      ['What is cherry-picking a time range?', ['Choosing start and end dates that exaggerate a trend', 'Showing the full history', 'Labeling the axes clearly', 'Using one consistent scale'], 'Choosing start and end dates that exaggerate a trend', 'A different window can tell the opposite story.'],
      ['Why may a line chart’s value axis start somewhere other than zero?', ['Its message is change over time, not bar-length magnitude', 'Line charts can never mislead', 'Zero is not allowed on line charts', 'Lines always show percentages'], 'Its message is change over time, not bar-length magnitude', 'Bars encode value as length, so they need zero; lines encode change as slope.'],
      ['What does sorting the bars in a bar chart help the reader do?', ['Quickly rank the categories', 'See exact timestamps', 'Read the raw table', 'Ignore small values'], 'Quickly rank the categories', 'Order turns the chart into a ranking at a glance.'],
      ['Why limit a chart to a few highlight colors?', ['So color draws attention to what matters', 'More colors always break printers', 'Readers cannot see color', 'Charts must be grayscale'], 'So color draws attention to what matters', 'Gray for context, one accent color for the point.'],
      ['Why is a red–green color pair a poor choice for distinguishing series?', ['Many readers have red–green color-vision deficiency', 'Red and green print too darkly', 'They cannot be used in bar charts', 'They are reserved for maps'], 'Many readers have red–green color-vision deficiency', 'Use color-blind-safe palettes, or add labels and patterns.'],
      ['What should decide how much detail a chart shows?', ['The intended audience and the decision they face', 'The charting tool’s defaults', 'The size of the dataset', 'The analyst’s favorite chart type'], 'The intended audience and the decision they face', 'Executives and analysts need different levels of detail.'],
      ['What should a chart for an executive summary emphasize?', ['The one key takeaway and its impact', 'Every column in the dataset', 'The raw SQL query', 'Decorative backgrounds'], 'The one key takeaway and its impact', 'Busy decision-makers need the point immediately.'],
      ['What is an annotation on a chart?', ['A short note pointing out a key point or event', 'The chart’s file name', 'A hidden data column', 'A random color'], 'A short note pointing out a key point or event', 'For example, “Price change” marked where a line drops.'],
      ['Why open a data story with context?', ['The audience needs to know why the question matters', 'Context replaces the data', 'Charts can’t be understood with context', 'It hides the finding'], 'The audience needs to know why the question matters', 'Context frames the finding that follows.'],
      ['What is a risk of a chart with many categories in many different colors?', ['Readers cannot match colors to categories or find the point', 'It loads too slowly', 'It cannot be printed', 'It forces a 3D view'], 'Readers cannot match colors to categories or find the point', 'Group minor categories or highlight only the ones that matter.'],
      ['Why show uncertainty, such as error bars or a margin of error?', ['So readers do not over-trust small differences', 'To make charts look technical', 'Because every chart requires it', 'To hide the data points'], 'So readers do not over-trust small differences', 'Overlapping intervals warn that a gap may be noise.'],
      ['Ice-cream sales and drownings rise together. What is the likely explanation?', ['A third factor, such as hot weather, drives both', 'Ice cream causes drowning', 'Drowning causes ice-cream sales', 'The data must be fake'], 'A third factor, such as hot weather, drives both', 'A confounding variable creates the association.'],
      ['What does a trend line on a scatterplot summarize?', ['The overall direction of the relationship', 'Every individual point exactly', 'The data’s categories', 'The median of one variable'], 'The overall direction of the relationship', 'Points scatter around it; it shows the general tendency.'],
      ['When should you use a table instead of a chart?', ['When readers need to look up exact values', 'When showing a trend', 'When comparing the shapes of distributions', 'Never'], 'When readers need to look up exact values', 'Charts show patterns; tables show precise numbers.'],
      ['Why label lines directly instead of using a legend when you can?', ['Readers do not have to match colors back and forth', 'Legends are not allowed', 'Labels make lines thicker', 'Legends hide the data'], 'Readers do not have to match colors back and forth', 'Direct labels reduce effort and errors.'],
      ['What is a misleading use of icon or bubble size?', ['Scaling both width and height so a doubled value looks four times larger', 'Using bars of equal width', 'Labeling the icons', 'Using a single color'], 'Scaling both width and height so a doubled value looks four times larger', 'Area grows with the square of the scale factor.'],
      ['Why use the same scale across small-multiple panels?', ['Different scales make panels look comparable when they are not', 'Same scales only save ink', 'Scales must change for each panel', 'It hides outliers'], 'Different scales make panels look comparable when they are not', 'Shared axes let readers compare panels honestly.'],
      ['What is a heatmap good for?', ['Showing patterns across two categorical dimensions with color intensity', 'Showing exact values precisely', 'Showing a single total', 'Plotting one variable over time'], 'Showing patterns across two categorical dimensions with color intensity', 'For example, activity by day of week and hour.'],
      ['Which chart best shows how a value differs between geographic regions?', ['A choropleth map', 'A pie chart', 'A histogram', 'A box plot'], 'A choropleth map', 'Regions are shaded by their value.'],
      ['What does it mean to lead with the insight?', ['State the main finding first, then show the evidence', 'Show every chart before speaking', 'Begin with the methodology', 'Hide the conclusion until the end'], 'State the main finding first, then show the evidence', 'The audience knows what to look for in each chart.'],
      ['Why round 47.38291% to 47% in a presentation?', ['The extra precision adds noise without changing the message', 'Rounding is required by law', 'Decimals cannot be charted', 'It makes the value more accurate'], 'The extra precision adds noise without changing the message', 'Match precision to what the decision needs.'],
      ['A chart compares total sales between regions with very different numbers of stores. What is the issue?', ['Totals mislead; a per-store rate would compare fairly', 'There is no issue', 'Sales cannot be charted', 'It needs a pie chart'], 'Totals mislead; a per-store rate would compare fairly', 'Normalize by size before comparing.'],
      ['What is a good final check before sharing a chart?', ['Can someone new state its point in one sentence?', 'Have you added more colors?', 'Have you removed the axis labels?', 'Have you made it 3D?'], 'Can someone new state its point in one sentence?', 'If not, simplify or retitle it.'],
      ['Why cite the data source on a chart?', ['Readers can judge credibility and find the original data', 'It is decoration', 'A source replaces the title', 'It makes the chart smaller'], 'Readers can judge credibility and find the original data', 'Transparency builds trust in the finding.']
    ]);
    return questions;
  }

  const physics2ThermalQ = (id, mass, specificHeat, temperatureChange) => {
    const answer = mass * specificHeat * temperatureChange;
    return qNumber(
      id, 'Thermodynamics',
      `A ${mass} kg sample with specific heat ${specificHeat} J/(kg·°C) warms by ${temperatureChange}°C. How much heat is added, in joules?`,
      answer, `Q = mcΔT = ${mass}(${specificHeat})(${temperatureChange}) = ${answer} J.`,
      { kind: 'specific-heat', mass, specificHeat, temperatureChange }
    );
  };
  const physics2ElectricQ = (id, charge1, charge2, distance) => {
    const answer = 0.009 * charge1 * charge2 / distance ** 2;
    return qNumber(
      id, 'Electrostatics',
      `Charges ${charge1} μC and ${charge2} μC are ${distance} m apart. Find the Coulomb-force magnitude in newtons; use k = 9.0×10⁹.`,
      answer, `F = k|q₁q₂|/r² = ${fmt(answer)} N.`,
      { kind: 'coulomb-micro', charge1, charge2, distance }
    );
  };
  const physics2CircuitQ = (id, resistance, current) => {
    const voltage = resistance * current;
    return qNumber(
      id, 'Electric circuits',
      `A ${resistance} Ω resistor has ${voltage} V across it. Find the current in amperes.`,
      current, `Ohm’s law gives I = V/R = ${voltage}/${resistance} = ${current} A.`,
      { kind: 'ohms-law-current', voltage, resistance }
    );
  };
  const physics2MagneticQ = (id, charge, velocity, field) => {
    const answer = charge * velocity * field;
    return qNumber(
      id, 'Magnetism',
      `A ${charge} μC charge moves perpendicular to a ${field} T field at ${velocity} m/s. Find the magnetic-force magnitude in μN.`,
      answer, `F = qvB. With q in μC, the result is ${charge}(${velocity})(${field}) = ${fmt(answer)} μN.`,
      { kind: 'magnetic-force-micro', charge, velocity, field }
    );
  };
  // The original 10 place the object at exactly 2f; the extras use other
  // object distances, so they get the general thin-lens explanation.
  const physics2OpticsQ = (id, focalLength, objectDistance) => {
    const imageDistance = focalLength * objectDistance / (objectDistance - focalLength);
    return qNumber(
      id, 'Geometric optics',
      `A converging lens has focal length ${focalLength} cm. An object is ${objectDistance} cm away. Find the image distance in centimeters.`,
      imageDistance,
      objectDistance === 2 * focalLength
        ? `1/f = 1/dₒ + 1/dᵢ. With dₒ = 2f, dᵢ = 2f = ${objectDistance} cm.`
        : `1/f = 1/dₒ + 1/dᵢ, so dᵢ = f·dₒ/(dₒ − f) = ${focalLength}(${objectDistance})/${objectDistance - focalLength} = ${imageDistance} cm.`,
      { kind: 'thin-lens-image', focalLength, objectDistance }
    );
  };
  const physics2QuantumQ = (id, wavelength) => {
    const answer = 1240 / wavelength;
    return qNumber(
      id, 'Modern physics',
      `Using hc = 1240 eV·nm, find the energy in eV of a photon with wavelength ${wavelength} nm.`,
      answer, `E = hc/λ = 1240/${wavelength} = ${fmt(answer)} eV.`,
      { kind: 'photon-energy', wavelength }
    );
  };

  function physicsTwo() {
    const questions = [];
    addTopic(questions, 'physics2-thermal', regular10((i) => [1 + (i % 5), 2 + (i % 4), 3 + i]),
      grid(range(1, 8), range(1, 6), range(2, 30)), physics2ThermalQ);
    addTopic(questions, 'physics2-electric', regular10((i) => [1 + (i % 5), 2 + (i % 4), 1 + (i % 3)]),
      grid(range(1, 9), range(1, 9), range(1, 5)), physics2ElectricQ);
    addTopic(questions, 'physics2-circuit', regular10((i) => [2 + (i % 6), 1 + (i % 5)]),
      grid(range(1, 20), range(1, 10)), physics2CircuitQ);
    addTopic(questions, 'physics2-magnetic', regular10((i) => [1 + (i % 5), 2 + (i % 6), 0.5 + (i % 4) * 0.5]),
      grid(range(1, 9), range(1, 12), [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3]), physics2MagneticQ);
    addTopic(questions, 'physics2-optics', regular10((i) => [2 + i, 2 * (2 + i)]),
      range(2, 30).flatMap((f) => range(f + 1, 4 * f).map((d) => [f, d]))
        .filter(([f, d]) => Number.isInteger(f * d / (d - f)) && f * d / (d - f) <= 200),
      physics2OpticsQ);
    addTopic(questions, 'physics2-quantum', [620, 496, 400, 310, 248, 200, 155, 124, 100, 80].map((w) => [w]),
      range(5, 50).map((k) => [k * 20]), physics2QuantumQ);
    return questions;
  }

  // Each topic: [name, make(...params) → { prompt, answer, explanation, meta, tolerance },
  // regular(i) → params (the original 10, unchanged), new-question grid].
  // The original 60 come first with today's sequential IDs (<prefix>-1…60);
  // the 180 new ones follow as <prefix>-61…240, topic by topic.
  const generatedCourse = (prefix, topics) => {
    const questions = [];
    const push = (topic, item) => questions.push(qNumber(`${prefix}-${questions.length + 1}`, topic, item.prompt, item.answer, item.explanation, item.meta, item.tolerance));
    const all = topics.map(([topic, make, regular, gridTuples]) => [topic, topicQuestions(regular10(regular), gridTuples, (i, tuple) => make(...tuple))]);
    all.forEach(([topic, items]) => items.slice(0, 10).forEach((item) => push(topic, item)));
    all.forEach(([topic, items]) => items.slice(10).forEach((item) => push(topic, item)));
    return questions;
  };
  const pairs = (gridTuples) => gridTuples.map(([a, b, c, d]) => [[a, b], [c, d]]);

  function linearAlgebra() {
    return generatedCourse('la', [
      ['Vectors and dot products',
        (u, v) => { const answer = u[0] * v[0] + u[1] * v[1]; return { prompt: `Find (${u.join(', ')}) · (${v.join(', ')}).`, answer, explanation: `Multiply aligned components and add: ${answer}.`, meta: { kind: 'vector-dot', u, v } }; },
        (i) => [[i + 1, i % 4 - 2], [i % 3 + 2, 3 - i]],
        pairs(grid(range(1, 5), range(-3, 3), range(1, 5), range(-4, 4)))],
      ['Vector magnitude',
        (a, b) => { const answer = Math.hypot(a, b); return { prompt: `Find the magnitude of vector (${a}, ${b}).`, answer, explanation: `The magnitude is √(${a}² + ${b}²) = ${fmt(answer)}.`, meta: { kind: 'pythagorean', a, b } }; },
        (i) => [i + 3, 2 * i + 4],
        grid(range(1, 15), range(1, 15))],
      ['Matrix determinants',
        (a, b, c, d) => { const answer = a * d - b * c; return { prompt: `Find det([[${a}, ${b}], [${c}, ${d}]]).`, answer, explanation: `For a 2×2 matrix, det = ad − bc = ${answer}.`, meta: { kind: 'determinant-2', a, b, c, d } }; },
        (i) => [i + 1, i % 4, 2 - i, i % 5 + 2],
        grid(range(1, 5), range(-3, 4), range(-4, 4), range(1, 5))],
      ['Matrix traces',
        (diagonal) => { const answer = diagonal.reduce((sum, value) => sum + value, 0); return { prompt: `Find the trace of a 3×3 matrix whose diagonal entries are ${diagonal.join(', ')}.`, answer, explanation: `The trace is the sum of diagonal entries: ${answer}.`, meta: { kind: 'sum-values', values: diagonal } }; },
        (i) => [[i - 3, i + 2, 2 * i + 1]],
        grid(range(-5, 8), range(-2, 8), range(-4, 5)).map((d) => [d])],
      ['Matrix multiplication',
        (row, column) => { const answer = row[0] * column[0] + row[1] * column[1]; return { prompt: `A matrix row is [${row.join(', ')}] and the aligned column is [${column.join(', ')}]. Find their product entry.`, answer, explanation: `The entry is the row-column dot product: ${answer}.`, meta: { kind: 'vector-dot', u: row, v: column } }; },
        (i) => [[i + 1, 2 - i], [i % 3 + 1, i + 2]],
        pairs(grid(range(-2, 5), range(-4, 3), range(1, 4), range(-2, 5)))],
      ['Eigenvalues',
        (values) => { const answer = Math.max(...values); return { prompt: `A diagonal matrix has diagonal entries ${values.join(', ')}. Find its largest eigenvalue.`, answer, explanation: `A diagonal matrix’s eigenvalues are its diagonal entries, so the largest is ${answer}.`, meta: { kind: 'max-values', values } }; },
        (i) => [[i - 2, 2 * i + 1, 5 - i]],
        grid(range(-7, 6), range(-2, 10), range(-5, 4)).map((d) => [d])]
    ]);
  }

  function differentialEquations() {
    return generatedCourse('de', [
      ['Differential equations',
        (coefficient, rate) => { const answer = coefficient * rate; return { prompt: `If y = ${coefficient}e^(${rate}t), find y′(0).`, answer, explanation: `y′ = ${coefficient * rate}e^(${rate}t), so y′(0) = ${answer}.`, meta: { kind: 'exponential-derivative-zero', coefficient, rate } }; },
        (i) => [i + 2, i % 5 - 2],
        grid(range(1, 15), nonZero(-4, 4))],
      ['Growth and decay',
        (initial, ratio, time) => { const answer = initial * ratio ** time; return { prompt: `A model satisfies y(t) = ${initial}(${ratio})^t. Find y(${time}).`, answer, explanation: `Substitution gives ${initial}(${ratio})^${time} = ${fmt(answer)}.`, meta: { kind: 'geometric-term-zero', initial, ratio, time } }; },
        (i) => [i + 3, i % 2 ? 0.5 : 2, i % 4 + 1],
        grid(range(1, 20), [0.5, 2, 3], range(1, 4))],
      ['Characteristic equations',
        (r1, r2) => { const sum = r1 + r2, product = r1 * r2; return { prompt: `Find the larger root of r² − ${sum}r + ${product} = 0.`, answer: Math.max(r1, r2), explanation: `The polynomial factors with roots ${r1} and ${r2}.`, meta: { kind: 'quadratic-larger-root', sum, product } }; },
        (i) => [i % 5 - 3, i + 1],
        grid(range(1, 12), range(1, 12)).filter(([r1, r2]) => r1 < r2)],
      ['Euler’s method',
        (y, h, a, b) => { const answer = y + h * (a * y + b); return { prompt: `Use one Euler step for y′ = ${a}y ${term(b, '')}, starting at y = ${y} with h = ${fmt(h)}. Find the next y-value.`, answer, explanation: `y_next = y + h·f = ${fmt(answer)}.`, meta: { kind: 'euler-step-linear', y, h, a, b } }; },
        (i) => [i + 1, 0.1 * (i % 4 + 1), i % 3 + 1, i - 2],
        grid(range(1, 10), [0.1, 0.2, 0.5], range(1, 3), nonZero(-3, 3))],
      ['Oscillations',
        (mass, omega) => { const spring = mass * omega ** 2; return { prompt: `A mass-spring system has m = ${mass} kg and k = ${spring} N/m. Find angular frequency ω in rad/s.`, answer: omega, explanation: `ω = √(k/m) = √(${spring}/${mass}) = ${omega}.`, meta: { kind: 'angular-frequency', mass, spring } }; },
        (i) => [i % 4 + 1, i % 5 + 1],
        grid(range(1, 10), range(1, 10))],
      ['Laplace transforms',
        (power, s) => { const answer = factorial(power) / s ** (power + 1); return { prompt: `For F(s) = L{t^${power}} = ${power}!/s^${power + 1}, find F(${s}).`, answer, explanation: `Evaluate ${power}!/${s}^${power + 1} = ${fmt(answer)}.`, meta: { kind: 'laplace-power', power, s } }; },
        (i) => [i % 5, i % 4 + 1],
        grid(range(0, 5), [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8]).filter(([power, s]) => factorial(power) / s ** (power + 1) >= 0.01)]
    ]);
  }

  function mathematicalProofs() {
    const logicCases = [[true, true, 'and'], [true, false, 'and'], [false, true, 'or'], [false, false, 'or'], [true, true, 'implies'], [true, false, 'implies'], [false, true, 'implies'], [false, false, 'implies'], [true, true, 'biconditional'], [true, false, 'biconditional']];
    return generatedCourse('proof', [
      ['Statements and logic',
        (shape, ...params) => {
          if (shape === '2') {
            const [p, q, operation] = params;
            const truth = evalLogic(p, q, operation);
            return { prompt: `Encode true as 1 and false as 0. With p=${Number(p)} and q=${Number(q)}, evaluate p ${operation} q.`, answer: Number(truth), explanation: `The truth table gives ${Number(truth)}.`, meta: { kind: 'logic-number', p, q, operation } };
          }
          const [p, q, r, op1, op2] = params;
          const inner = evalLogic(p, q, op1);
          const truth = evalLogic(inner, r, op2);
          return { prompt: `Encode true as 1 and false as 0. With p=${Number(p)}, q=${Number(q)}, and r=${Number(r)}, evaluate (p ${op1} q) ${op2} r.`, answer: Number(truth), explanation: `p ${op1} q gives ${Number(inner)}; then ${Number(inner)} ${op2} r gives ${Number(truth)}.`, meta: { kind: 'logic3-number', p, q, r, op1, op2 } };
        },
        (i) => ['2', ...logicCases[i]],
        grid(TF, TF, TF, LOGIC_OPS, LOGIC_OPS).map((t) => ['3', ...t])],
      ['Parity and divisibility',
        (a, b) => { const answer = (a + b) % 2; return { prompt: `Encode even as 0 and odd as 1. What is the parity of ${a} + ${b}?`, answer, explanation: `${a + b} has parity ${answer}.`, meta: { kind: 'sum-parity', a, b } }; },
        (i) => [2 * i + 1, 3 * i + 2],
        grid(range(1, 40), range(1, 25))],
      ['Direct proofs',
        (divisor, multiple) => { const value = divisor * multiple; return { prompt: `In a direct divisibility proof, ${value} = ${divisor}k. What integer value of k witnesses that ${divisor} divides ${value}?`, answer: multiple, explanation: `${value} = ${divisor}(${multiple}), so k = ${multiple}.`, meta: { kind: 'division', dividend: value, divisor } }; },
        (i) => [i % 5 + 2, i + 3],
        grid(range(2, 12), range(2, 15))],
      ['Proofs about sets',
        (start, mod) => { const a = Array.from({ length: 6 }, (_, n) => n + start).filter((n) => n % 2 === 0), b = Array.from({ length: 7 }, (_, n) => n + start).filter((n) => n % mod !== 0), answer = new Set(a.filter((value) => b.includes(value))).size; return { prompt: `Find |A ∩ B| for A={${a.join(', ')}} and B={${b.join(', ')}}.`, answer, explanation: `Counting the shared elements gives ${answer}.`, meta: { kind: 'intersection-size', a, b } }; },
        (i) => [i, 3],
        grid(range(0, 40), range(3, 5))],
      ['Mathematical induction',
        (n) => { const answer = n * (n + 1) / 2; return { prompt: `The induction formula is 1 + ··· + n = n(n+1)/2. Evaluate its right side for n=${n}.`, answer, explanation: `${n}(${n + 1})/2 = ${answer}.`, meta: { kind: 'loop-sum', n } }; },
        (i) => [i + 4],
        range(14, 60).map((n) => [n])],
      ['Quantifiers and witnesses',
        (limit, divisor) => { const values = Array.from({ length: limit }, (_, n) => n + 1), answer = values.filter((value) => value % divisor === 0).length; return { prompt: `Over integers 1 through ${limit}, how many witnesses satisfy “${divisor} divides x”?`, answer, explanation: `The satisfying integers are the multiples of ${divisor}; there are ${answer}.`, meta: { kind: 'count-divisible', limit, divisor } }; },
        (i) => [i + 8, i % 4 + 2],
        grid(range(10, 60), range(2, 9))]
    ]);
  }

  function networking() {
    return generatedCourse('net', [
      ['Bandwidth and transmission',
        (bits, rate) => { const answer = bits / rate; return { prompt: `How many seconds transmit ${bits} bits over a ${rate} bit/s link?`, answer, explanation: `Transmission time = bits/rate = ${fmt(answer)} s.`, meta: { kind: 'division', dividend: bits, divisor: rate } }; },
        (i) => [(i + 2) * 1000, (i % 5 + 1) * 1000],
        grid(range(1, 20).map((k) => k * 1000), range(1, 8).map((r) => r * 1000))],
      ['Latency and propagation',
        (distance) => { const speed = 200, answer = distance / speed; return { prompt: `A signal travels ${distance} km through fiber at 200,000 km/s. Find propagation delay in milliseconds.`, answer, explanation: `(${distance}/200000)×1000 = ${answer} ms.`, meta: { kind: 'propagation-ms', distance, speedThousands: speed } }; },
        (i) => [(i + 1) * 200],
        range(1, 120).map((k) => [k * 100])],
      ['IPv4 addressing',
        (shape, n) => {
          if (shape === 'bits') { const answer = 2 ** n - 2; return { prompt: `A traditional IPv4 subnet has ${n} host bits. How many usable host addresses does it provide?`, answer, explanation: `2^${n} − 2 = ${answer} usable addresses.`, meta: { kind: 'subnet-hosts', hostBits: n } }; }
          if (shape === 'prefix') { const hostBits = 32 - n, answer = 2 ** hostBits - 2; return { prompt: `How many usable host addresses does a /${n} IPv4 subnet provide?`, answer, explanation: `A /${n} leaves ${hostBits} host bits; subtracting the network and broadcast addresses gives 2^${hostBits} − 2 = ${answer}.`, meta: { kind: 'subnet-hosts', hostBits } }; }
          return { prompt: `An IPv4 address with a /${n} prefix has how many host bits?`, answer: 32 - n, explanation: `IPv4 addresses are 32 bits, so 32 − ${n} = ${32 - n} bits are left for hosts.`, meta: { kind: 'difference', a: 32, b: n } };
        },
        (i) => ['bits', i + 2],
        mixGrids(15, range(12, 16).map((n) => ['bits', n]), range(16, 30).map((n) => ['prefix', n]), range(8, 30).map((n) => ['hostbits', n]))],
      ['CIDR notation',
        (shape, p, q) => {
          if (shape === 'addresses') { const answer = 2 ** (32 - p); return { prompt: `How many total IPv4 addresses are in a /${p} block?`, answer, explanation: `A /${p} leaves ${32 - p} bits, so the block has ${answer} addresses.`, meta: { kind: 'cidr-addresses', prefix: p } }; }
          const answer = 2 ** (p - q);
          return { prompt: `How many /${p} subnets fit inside one /${q} block?`, answer, explanation: `Each extra prefix bit halves the block, so 2^(${p} − ${q}) = ${answer} subnets.`, meta: { kind: 'power-two', exponent: p - q } };
        },
        (i) => ['addresses', 22 + i],
        mixGrids(25, range(13, 21).map((p) => ['addresses', p]), range(16, 28).flatMap((q) => range(q + 1, Math.min(q + 6, 30)).map((p) => ['subnets', p, q])))],
      ['Bandwidth-delay product',
        (rateMbps, rttMs) => { const answer = rateMbps * rttMs * 125; return { prompt: `Find the bandwidth-delay product in bytes for ${rateMbps} Mb/s and ${rttMs} ms RTT.`, answer, explanation: `Mb/s × ms converts to 1000 bits; divide by 8: ${answer} bytes.`, meta: { kind: 'bandwidth-delay-bytes', rateMbps, rttMs } }; },
        (i) => [i + 1, (i % 5 + 1) * 10],
        grid([1, 2, 5, 10, 20, 50, 100], [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100]).filter(([rate, rtt]) => rate * rtt * 125 <= 1e6)],
      ['Ports and multiplexing',
        (low, high) => ({ prompt: `How many inclusive port numbers are in the range ${low}–${high}?`, answer: high - low + 1, explanation: `${high} − ${low} + 1 = ${high - low + 1}.`, meta: { kind: 'inclusive-count', low, high } }),
        (i) => { const low = 1000 + i * 100; return [low, low + 20 + i]; },
        grid([80, 443, 1024, 3000, 5000, 8000, 8080, 20000, 49152, 60000], [5, 10, 20, 40, 50, 60]).map(([low, width]) => [low, low + width])]
    ]);
  }

  function systemsProgramming() {
    return generatedCourse('sys', [
      ['Binary representation',
        (value) => { const binary = value.toString(2); return { prompt: `Convert binary ${binary} to decimal.`, answer: value, explanation: `Summing its powers of two gives ${value}.`, meta: { kind: 'binary-value', binary } }; },
        (i) => [i * 7 + 5],
        range(70, 255).map((v) => [v])],
      ['Hexadecimal',
        (value) => { const hex = value.toString(16).toUpperCase(); return { prompt: `Convert hexadecimal 0x${hex} to decimal.`, answer: value, explanation: `Base-16 expansion gives ${value}.`, meta: { kind: 'hex-value', hex } }; },
        (i) => [i * 19 + 16],
        range(200, 4095).map((v) => [v])],
      ['Two’s complement',
        (unsigned, bits) => {
          const signed = unsigned >= 2 ** (bits - 1) ? unsigned - 2 ** bits : unsigned;
          return { prompt: `Interpret ${bits}-bit two’s-complement ${unsigned.toString(2).padStart(bits, '0')} as a signed decimal integer.`, answer: signed, explanation: signed < 0 ? `The sign bit is 1, so subtract ${2 ** bits}: ${signed}.` : `The sign bit is 0, so the value is just ${signed}.`, meta: { kind: 'twos-complement', unsigned, bits } };
        },
        (i) => [128 + i * 7, 8],
        [...range(0, 15).map((v) => [v, 4]), ...range(0, 255).map((v) => [v, 8])]],
      ['Memory addressing',
        (base, index, width) => { const answer = base + index * width; return { prompt: `An array begins at byte address ${base}; elements are ${width} bytes. Find the address of element ${index}.`, answer, explanation: `base + index×width = ${answer}.`, meta: { kind: 'array-address', base, index, width } }; },
        (i) => [1024 + i * 64, i + 2, i % 4 + 1],
        grid([1000, 2048, 4096, 8192, 16384], range(0, 20), [1, 2, 4, 8])],
      ['Cache performance',
        (hitRate, hitTime, missTime) => { const answer = hitRate * hitTime + (1 - hitRate) * missTime; return { prompt: `A cache hits with probability ${fmt(hitRate)}, taking ${hitTime} ns; a miss takes ${missTime} ns. Find average access time in ns.`, answer, explanation: `Weighted average = ${fmt(answer)} ns.`, meta: { kind: 'cache-average', hitRate, hitTime, missTime } }; },
        (i) => [0.8 + i * 0.01, 1 + i % 3, 40 + i],
        grid([0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.98, 0.99], range(1, 4), [20, 40, 50, 80, 100, 120])],
      ['CPU scheduling',
        (arrival, start, burst) => { const answer = start + burst - arrival; return { prompt: `A process arrives at t=${arrival}, starts at t=${start}, and runs for ${burst} time units. Find turnaround time.`, answer, explanation: `Completion is ${start + burst}; turnaround = completion − arrival = ${answer}.`, meta: { kind: 'turnaround', arrival, start, burst } }; },
        (i) => [i, i + i % 3, i % 5 + 2],
        grid(range(0, 20), range(0, 6), range(2, 10)).map(([arrival, wait, burst]) => [arrival, arrival + wait, burst])]
    ]);
  }

  function engineeringOne() {
    return generatedCourse('eng', [
      ['Units and measurement',
        (meters) => { const answer = meters * 1000; return { prompt: `Convert ${meters} meters to millimeters.`, answer, explanation: `Multiply by 1000: ${fmt(answer)} mm.`, meta: { kind: 'meters-to-mm', meters } }; },
        (i) => [i + 1.25],
        range(1, 200).filter((k) => k % 8 !== 0).map((k) => [k / 8])],
      ['Vectors and resultants',
        (a, b) => ({ prompt: `Perpendicular forces have magnitudes ${a} N and ${b} N. Find the resultant magnitude.`, answer: Math.hypot(a, b), explanation: `Use the Pythagorean theorem: ${fmt(Math.hypot(a, b))} N.`, meta: { kind: 'pythagorean', a, b } }),
        (i) => [i + 3, i * 2 + 4],
        grid(range(1, 20), range(1, 20))],
      ['Statics and moments',
        (force, distance) => { const answer = force * distance; return { prompt: `A perpendicular ${force} N force acts ${distance} m from a pivot. Find its moment in N·m.`, answer, explanation: `Moment = Fd = ${fmt(answer)} N·m.`, meta: { kind: 'torque', force, radius: distance } }; },
        (i) => [i + 5, i % 4 + 0.5],
        grid(range(2, 40), [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4])],
      ['Stress and strain',
        (force, area) => { const answer = force / area; return { prompt: `A member carries ${force} N over ${area} mm². Find stress in N/mm².`, answer, explanation: `Stress = force/area = ${fmt(answer)} N/mm².`, meta: { kind: 'division', dividend: force, divisor: area } }; },
        (i) => [(i + 2) * 1000, (i % 5 + 1) * 100],
        grid(range(1, 40).map((k) => k * 500), [50, 100, 200, 250, 400, 500])],
      ['Work and power',
        (work, time) => { const answer = work / time; return { prompt: `A system performs ${work} J of work in ${time} s. Find average power in watts.`, answer, explanation: `P = W/t = ${fmt(answer)} W.`, meta: { kind: 'division', dividend: work, divisor: time } }; },
        (i) => [(i + 2) * 120, i % 5 + 2],
        grid(range(1, 40).map((k) => k * 60), range(1, 12))],
      ['Electric circuits',
        (resistance, current) => { const voltage = resistance * current; return { prompt: `A ${resistance} Ω resistor has ${voltage} V across it. Find current in amperes.`, answer: current, explanation: `I = V/R = ${current} A.`, meta: { kind: 'ohms-law-current', voltage, resistance } }; },
        (i) => [i % 6 + 2, i + 1],
        grid(range(1, 12), range(1, 15))]
    ]);
  }

  function physicsCMechanics() {
    return generatedCourse('physc', [
      ['Calculus-based kinematics',
        (a, b, t) => { const answer = 3 * a * t ** 2 + 2 * b * t; return { prompt: `Position is x(t)=${a}t³ ${term(b, 't²')}. Find velocity at t=${t}.`, answer, explanation: `v=3(${a})t²+2(${b})t, giving ${answer}.`, meta: { kind: 'cubic-position-velocity', a, b, t } }; },
        (i) => [i % 4 + 1, i - 2, i % 5 + 1],
        grid(range(1, 5), nonZero(-4, 6), range(1, 6))],
      ['Force and acceleration',
        (mass, force) => ({ prompt: `A ${mass} kg mass experiences net force ${force} N. Find acceleration in m/s².`, answer: force / mass, explanation: `a=F/m=${force / mass} m/s².`, meta: { kind: 'division', dividend: force, divisor: mass } }),
        (i) => [i % 5 + 1, (i + 2) * (i % 5 + 1)],
        grid(range(1, 10), range(1, 15)).map(([mass, acceleration]) => [mass, acceleration * mass])],
      ['Work by variable forces',
        (k, upper) => { const answer = k * upper ** 2 / 2; return { prompt: `Evaluate the work ∫₀^${upper} ${k}x dx, in joules.`, answer, explanation: `Work = (${k}/2)(${upper})² = ${fmt(answer)} J.`, meta: { kind: 'linear-integral', m: k, b: 0, upper } }; },
        (i) => [i + 2, i % 5 + 1],
        grid(range(1, 20), range(1, 8))],
      ['Impulse and momentum',
        (force, duration) => { const answer = force * duration; return { prompt: `A constant ${force} N force acts for ${duration} s. Find impulse in N·s.`, answer, explanation: `J=FΔt=${fmt(answer)} N·s.`, meta: { kind: 'product', a: force, b: duration } }; },
        (i) => [i + 3, i % 4 + 0.5],
        grid(range(2, 40), [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5])],
      ['Rotational dynamics',
        (torque, inertia) => ({ prompt: `Net torque is ${torque} N·m and moment of inertia is ${inertia} kg·m². Find angular acceleration.`, answer: torque / inertia, explanation: `α=τ/I=${torque / inertia} rad/s².`, meta: { kind: 'division', dividend: torque, divisor: inertia } }),
        (i) => [(i + 2) * (i % 4 + 1), i % 4 + 1],
        grid(range(1, 8), range(1, 12)).map(([inertia, alpha]) => [alpha * inertia, inertia])],
      ['Gravitation and orbits',
        (speed, radius) => ({ prompt: `In scaled units, a circular orbit has speed ${speed} and radius ${radius}. Find centripetal acceleration v²/r.`, answer: speed ** 2 / radius, explanation: `a=v²/r=${fmt(speed ** 2 / radius)}.`, meta: { kind: 'square-over', value: speed, divisor: radius } }),
        (i) => [i + 2, i % 5 + 1],
        grid(range(1, 20), range(1, 8))]
    ]);
  }

  function quantumPhysicsOptics() {
    return generatedCourse('quantum', [
      ['Wave optics',
        (wavelength, distance, slit) => { const answer = wavelength * distance / slit; return { prompt: `In scaled units, double-slit spacing is Δy=λL/d. Find Δy for λ=${wavelength}, L=${distance}, d=${slit}.`, answer, explanation: `Δy=${wavelength}(${distance})/${slit}=${fmt(answer)}.`, meta: { kind: 'triple-product-division', a: wavelength, b: distance, divisor: slit } }; },
        (i) => [i + 2, i % 5 + 1, i % 4 + 1],
        grid(range(1, 12), range(1, 8), range(1, 6))],
      ['Diffraction',
        (wavelength, slit) => ({ prompt: `For first-minimum diffraction, sin θ=λ/a. Find sin θ when λ=${wavelength} and a=${slit}.`, answer: wavelength / slit, explanation: `sin θ=λ/a=${fmt(wavelength / slit)}.`, meta: { kind: 'division', dividend: wavelength, divisor: slit } }),
        (i) => { const wavelength = i % 5 + 1; return [wavelength, wavelength * (i + 2)]; },
        grid(range(1, 9), range(2, 15)).map(([wavelength, multiple]) => [wavelength, wavelength * multiple])],
      ['Photons',
        (wavelength) => { const answer = 1240 / wavelength; return { prompt: `Using hc=1240 eV·nm, find photon energy for λ=${wavelength} nm.`, answer, explanation: `E=1240/${wavelength}=${fmt(answer)} eV.`, meta: { kind: 'photon-energy', wavelength } }; },
        (i) => [100 + i * 40],
        range(12, 200).map((k) => [k * 10])],
      ['Photoelectric effect',
        (photon, workFunction) => { const answer = photon - workFunction; return { prompt: `A photon has energy ${photon} eV and the work function is ${workFunction} eV. Find maximum electron kinetic energy.`, answer, explanation: `Kmax=E−φ=${fmt(answer)} eV.`, meta: { kind: 'difference', a: photon, b: workFunction } }; },
        (i) => [i + 4, i % 3 + 1.5],
        grid(range(2, 12), [1.8, 2.1, 2.3, 2.5, 4.3, 4.7]).filter(([photon, workFunction]) => photon > workFunction)],
      ['Matter waves',
        (momentum) => { const answer = 1 / momentum; return { prompt: `In units where h=1, find de Broglie wavelength for momentum p=${momentum}.`, answer, explanation: `λ=h/p=1/${momentum}=${fmt(answer)}.`, meta: { kind: 'reciprocal', value: momentum } }; },
        (i) => [i + 2],
        range(1, 40).filter((k) => k % 4 !== 0).map((k) => [k / 4])],
      ['Particle in a box',
        (n, baseEnergy) => { const answer = n ** 2 * baseEnergy; return { prompt: `For a particle in a box, Eₙ=n²E₁. Find E_${n} when E₁=${baseEnergy}.`, answer, explanation: `E_${n}=${n}²(${baseEnergy})=${answer}.`, meta: { kind: 'square-times', value: n, factor: baseEnergy } }; },
        (i) => [i % 5 + 1, i + 2],
        grid(range(1, 8), range(1, 20))]
    ]);
  }

  function realAnalysisA() {
    const epsilons = [0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.12, 0.09, 0.08, 0.07, 0.06, 0.05, 0.045, 0.04, 0.035, 0.03, 0.024, 0.02, 0.018, 0.016, 0.015, 0.012, 0.01, 0.009, 0.008, 0.007, 0.006, 0.005, 0.004, 0.003, 0.002, 0.001];
    return generatedCourse('real', [
      ['Absolute value and bounds',
        (x, center) => ({ prompt: `Find the distance |${x}−(${center})| on the real line.`, answer: Math.abs(x - center), explanation: `Absolute value gives distance: ${Math.abs(x - center)}.`, meta: { kind: 'absolute-difference', a: x, b: center } }),
        (i) => [i - 6, i % 4 - 1],
        grid(range(-12, 12), range(-6, 6))],
      ['Supremum and infimum',
        (lower, upper) => ({ prompt: `Find sup S for S=(${lower}, ${upper}).`, answer: upper, explanation: `The least upper bound is ${upper}, whether or not it belongs to S.`, meta: { kind: 'identity', value: upper } }),
        (i) => { const lower = i - 3; return [lower, lower + i % 5 + 1]; },
        grid(range(-10, 10), range(1, 8)).map(([lower, width]) => [lower, lower + width])],
      ['Sequences and limits',
        (limit, n) => { const answer = limit + 1 / n; return { prompt: `For aₙ=${limit}+1/n, find a_${n}.`, answer, explanation: `Substitute n=${n}: ${fmt(answer)}.`, meta: { kind: 'limit-sequence-term', limit, n } }; },
        (i) => [i - 4, (i + 2) * 10],
        grid(range(-5, 8), [5, 8, 10, 20, 25, 40, 50, 100])],
      ['Epsilon-N arguments',
        // bound = 1/ε; the regular 10 pass it as an exact integer (i + 2).
        (epsilon, bound) => { const answer = Math.floor(bound) + 1; return { prompt: `For aₙ=1/n, give the smallest positive integer N such that 1/n<${fmt(epsilon)} for every n≥N.`, answer, explanation: `n must exceed ${fmt(bound)}, so the smallest N is ${answer}.`, meta: { kind: 'epsilon-n-reciprocal', epsilon } }; },
        (i) => [1 / (i + 2), i + 2],
        epsilons.map((epsilon) => [epsilon, 1 / epsilon])],
      ['Topology of the real line',
        (left, right, point) => { const answer = Math.min(Math.abs(point - left), Math.abs(right - point)); return { prompt: `For interval (${left}, ${right}) and point x=${point}, find the distance from x to the nearer endpoint.`, answer, explanation: `The endpoint distances are ${fmt(Math.abs(point - left))} and ${fmt(Math.abs(right - point))}; minimum ${fmt(answer)}.`, meta: { kind: 'nearest-endpoint', left, right, point } }; },
        (i) => { const left = i - 5, right = left + i % 4 + 2; return [left, right, i % 2 ? left : (left + right) / 2]; },
        grid(range(-8, 8), range(2, 8)).flatMap(([left, width]) => range(1, width - 1).map((offset) => [left, left + width, left + offset]))],
      ['Riemann integration',
        (n) => { const width = 1 / n, sum = width * Array.from({ length: n }, (_, k) => (k + 1) / n).reduce((total, x) => total + x, 0); return { prompt: `Use ${n} equal subintervals and right endpoints to approximate ∫₀¹x dx.`, answer: sum, explanation: `The right sum is (1/${n})Σ(k/${n})=${fmt(sum)}.`, meta: { kind: 'right-riemann-x', n } }; },
        (i) => [i + 2],
        range(12, 50).map((n) => [n])]
    ]);
  }

  function advancedAlgorithms() {
    return generatedCourse('algo', [
      ['Asymptotic analysis',
        (shape, a, b) => {
          if (shape === 'halve') { const size = 2 ** a; return { prompt: `How many exact halvings reduce an input of size ${size} to 1?`, answer: a, explanation: `${size}=2^${a}, so ${a} halvings are required.`, meta: { kind: 'binary-halvings', size } }; }
          if (shape === 'triangle') { const answer = a * (a + 1) / 2; return { prompt: `An inner loop runs i times for each i from 1 to ${a}. How many inner-loop iterations run in total?`, answer, explanation: `1 + 2 + ··· + ${a} = ${a}(${a + 1})/2 = ${answer}.`, meta: { kind: 'loop-sum', n: a } }; }
          return { prompt: `An outer loop runs ${a} times and an inner loop runs ${b} times per outer iteration. How many times does the inner body execute?`, answer: a * b, explanation: `Nested loops multiply: ${a} × ${b} = ${a * b}.`, meta: { kind: 'product', a, b } };
        },
        (i) => ['halve', i + 3],
        mixGrids(12, range(13, 20).map((k) => ['halve', k]), range(5, 30).map((n) => ['triangle', n]), grid(range(5, 20), range(5, 20)).map(([a, b]) => ['nested', a, b]))],
      ['Divide and conquer',
        (shape, k) => {
          if (shape === 'nlogn') { const n = 2 ** k, answer = n * k; return { prompt: `A merge-style recurrence performs n log₂n units. Evaluate it for n=${n}.`, answer, explanation: `${n}·${k}=${answer}.`, meta: { kind: 'n-log2-n', n } }; }
          if (shape === 'depth') { const size = 2 ** k; return { prompt: `A divide-and-conquer algorithm halves its input at every level. How many levels does an input of size ${size} need to reach size 1?`, answer: k, explanation: `${size}=2^${k}, so ${k} levels of halving reach size 1.`, meta: { kind: 'binary-halvings', size } }; }
          const answer = 2 ** k;
          return { prompt: `A recursion tree splits every call into 2 subcalls. How many calls sit at depth ${k} (the root is depth 0)?`, answer, explanation: `Each level doubles the calls, so depth ${k} has 2^${k} = ${answer}.`, meta: { kind: 'power-two', exponent: k } };
        },
        (i) => ['nlogn', i + 2],
        mixGrids(14, range(12, 15).map((k) => ['nlogn', k]), range(3, 19).map((k) => ['depth', k]), range(2, 16).map((k) => ['leaves', k]))],
      ['Minimum spanning trees',
        (vertices) => ({ prompt: `Any spanning tree on ${vertices} vertices has how many edges?`, answer: vertices - 1, explanation: `Every tree on V vertices has V−1=${vertices - 1} edges.`, meta: { kind: 'tree-edges', vertices } }),
        (i) => [i + 5],
        range(15, 80).map((v) => [v])],
      ['Shortest paths',
        (edges) => { const answer = edges.reduce((sum, edge) => sum + edge, 0); return { prompt: `A path uses edge weights ${edges.join(', ')}. Find its total weight.`, answer, explanation: `Path length is the edge-weight sum: ${answer}.`, meta: { kind: 'sum-values', values: edges } }; },
        (i) => [[i + 2, i % 4 + 1, i + 5]],
        grid(range(1, 12), range(1, 9), range(1, 12)).map((edges) => [edges])],
      ['Dynamic programming',
        (shape, n) => {
          const fib = (k) => { const sequence = [0, 1]; for (let j = 2; j <= k; j += 1) sequence[j] = sequence[j - 1] + sequence[j - 2]; return sequence[k]; };
          if (shape === 'fib') return { prompt: `Using F₀=0, F₁=1, and Fₙ=Fₙ₋₁+Fₙ₋₂, find F_${n}.`, answer: fib(n), explanation: `Building the DP table gives F_${n}=${fib(n)}.`, meta: { kind: 'fibonacci', n } };
          return { prompt: `You climb stairs 1 or 2 steps at a time, so ways(1)=1, ways(2)=2, and ways(n)=ways(n−1)+ways(n−2). How many ways are there to climb ${n} stairs?`, answer: fib(n + 1), explanation: `ways(n) is the Fibonacci recurrence shifted by one: ways(${n}) = F_${n + 1} = ${fib(n + 1)}.`, meta: { kind: 'fibonacci', n: n + 1 } };
        },
        (i) => ['fib', i + 5],
        mixGrids(16, range(15, 30).map((n) => ['fib', n]), range(5, 25).map((n) => ['stairs', n]))],
      ['Bitmask algorithms',
        (shape, n) => {
          if (shape === 'subsets') { const answer = 2 ** n; return { prompt: `How many subsets can a ${n}-bit mask represent?`, answer, explanation: `Each bit has two states, so there are 2^${n}=${answer} subsets.`, meta: { kind: 'power-two', exponent: n } }; }
          if (shape === 'shift') { const answer = 2 ** n; return { prompt: `What integer does the expression 1 << ${n} produce?`, answer, explanation: `Shifting 1 left by ${n} places multiplies it by 2^${n}: ${answer}.`, meta: { kind: 'power-two', exponent: n } }; }
          const binary = n.toString(2);
          return { prompt: `Which integer does the bitmask 0b${binary} represent?`, answer: n, explanation: `Adding the place values of its set bits gives ${n}.`, meta: { kind: 'binary-value', binary } };
        },
        (i) => ['subsets', i + 1],
        mixGrids(12, range(11, 19).map((n) => ['subsets', n]), range(0, 19).map((n) => ['shift', n]), range(9, 63).map((n) => ['mask', n]))]
    ]);
  }

  // A page shows one course, so each set's questions (and Timed Mastery
  // pool) are built on first access instead of all 20 at load — 4,800+
  // questions is real work on a phone. Built once, then cached.
  const lazyQuestions = (course) => {
    ['questions', 'timedQuestions'].forEach((key) => {
      const build = course[key];
      if (!build) return;
      let value = null;
      Object.defineProperty(course, key, { enumerable: true, get: () => value || (value = build()) });
    });
    return course;
  };
  const courses = [
    {
      slug: 'algebra-geometry',
      title: 'Algebra & Geometry Fundamentals Review',
      tier: 'intro',
      summary: 'Linear equations, systems, quadratics, exponents, area, and right triangles.',
      questions: algebraGeometry
    },
    {
      slug: 'ap-calculus-bc',
      title: 'AP Calculus BC',
      tier: 'core',
      summary: 'Limits, derivatives, applications, integrals, the Fundamental Theorem, and series.',
      questions: calculus,
      timedQuestions: timedCalculus
    },
    {
      slug: 'computer-programming-1',
      title: 'Computer Programming 1',
      tier: 'intro',
      summary: 'Language fundamentals, operators, control flow, loops, functions, and collections.',
      questions: programming
    },
    {
      slug: 'discrete-math',
      title: 'Discrete Math',
      tier: 'core',
      summary: 'Logic, sets, combinatorics, probability, graph theory, and modular arithmetic.',
      questions: discreteMath
    },
    {
      slug: 'ap-physics-1',
      title: 'AP Physics 1',
      tier: 'intro',
      summary: 'Kinematics, forces, energy, momentum, rotation, and circular motion.',
      questions: physics
    },
    {
      slug: 'precalculus',
      title: 'Precalculus',
      tier: 'core',
      summary: 'Functions, composition, polynomials, exponentials, trigonometry, and sequences.',
      questions: precalculus,
      timedQuestions: timedPrecalculus
    },
    {
      slug: 'multivariable-calculus',
      title: 'Multivariable Calculus',
      tier: 'advanced',
      summary: 'Vectors, cross products, partial derivatives, gradients, multiple integrals, and vector fields.',
      questions: multivariableCalculus
    },
    {
      slug: 'computer-programming-2',
      title: 'Computer Programming 2',
      tier: 'core',
      summary: 'OOP, exceptions, data structures, recursion, complexity, memory, and concurrency.',
      questions: programmingTwo
    },
    {
      slug: 'data-handling-cb',
      title: 'Data Handling CB',
      tier: 'core',
      summary: 'Spreadsheets, SQL, descriptive statistics, cleaning, regression, and visualization.',
      questions: dataHandling
    },
    {
      slug: 'ap-physics-2',
      title: 'AP Physics 2',
      tier: 'core',
      summary: 'Thermodynamics, electrostatics, circuits, magnetism, optics, and modern physics.',
      questions: physicsTwo
    },
    {
      slug: 'linear-algebra-a', title: 'Linear Algebra A', tier: 'core',
      summary: 'Vectors, matrices, determinants, transformations, and eigenvalues.', questions: linearAlgebra
    },
    {
      slug: 'differential-equations', title: 'Differential Equations', tier: 'core',
      summary: 'First-order models, characteristic equations, Euler’s method, oscillations, and Laplace transforms.', questions: differentialEquations
    },
    {
      slug: 'mathematical-proofs', title: 'Mathematical Proofs', tier: 'core',
      summary: 'Logic, divisibility, sets, direct arguments, induction, and quantifiers.', questions: mathematicalProofs
    },
    {
      slug: 'computer-networking-fundamentals', title: 'Computer Networking Fundamentals', tier: 'intro',
      summary: 'Bandwidth, latency, IPv4, CIDR, bandwidth-delay products, and ports.', questions: networking
    },
    {
      slug: 'systems-programming-architecture', title: 'Systems Programming & Architecture', tier: 'core',
      summary: 'Binary, hexadecimal, two’s complement, memory, caches, and CPU scheduling.', questions: systemsProgramming
    },
    {
      slug: 'engineering-1', title: 'Engineering 1', tier: 'intro',
      summary: 'Measurement, vectors, statics, stress, power, and circuits.', questions: engineeringOne
    },
    {
      slug: 'ap-physics-c-mechanics', title: 'AP Physics C: Mechanics', tier: 'core',
      summary: 'Calculus-based motion, forces, work, impulse, rotation, and gravitation.', questions: physicsCMechanics
    },
    {
      slug: 'quantum-physics-optics', title: 'Quantum Physics and Optics', tier: 'core',
      summary: 'Wave optics, diffraction, photons, photoelectricity, matter waves, and quantum energy.', questions: quantumPhysicsOptics
    },
    {
      slug: 'real-analysis-a', title: 'Real Analysis A', tier: 'advanced',
      summary: 'Bounds, sequences, epsilon arguments, topology, continuity, and Riemann integration.', questions: realAnalysisA
    },
    {
      slug: 'advanced-algorithms', title: 'Advanced Algorithms', tier: 'advanced',
      summary: 'Asymptotic analysis, divide and conquer, graph algorithms, dynamic programming, and bitmasks.', questions: advancedAlgorithms
    }
  ].map(lazyQuestions);
  const courseBySlug = Object.fromEntries(courses.map((course) => [course.slug, course]));

  return {
    courses,
    getCourse(slug) {
      return courseBySlug[slug] || null;
    }
  };
}));
