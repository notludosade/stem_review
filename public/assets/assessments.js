// STEM+ Assessments: course, track, and goal assessments.
// The engine (draw, grade, score) is pure and exported for
// scripts/check-assessments.js; the UI further down only runs in a browser.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./problem-sets.js') : root.STEMProblemAnswers);
  if (isNode) module.exports = api;
  else root.STEMAssessments = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (numbers) {
  'use strict';

  const TYPES = {
    single: { badge: 'Multiple choice', icon: '◉', how: 'Pick the one best answer.' },
    multi: { badge: 'Select all that apply', icon: '▣', how: 'Tick every correct option. You need all of them, and no wrong ones, to score.' },
    truefalse: { badge: 'True / False', icon: '⇄', how: 'Decide whether the statement is true or false.' },
    number: { badge: 'Type a number', icon: '#', how: 'Type a number. Fractions like 3/4, decimals, and percents are accepted.' },
    text: { badge: 'Type a short answer', icon: '✎', how: 'Type a word or short phrase. Capital letters and extra spaces don’t matter.' },
    order: { badge: 'Put in order', icon: '⇅', how: 'Use the ↑ and ↓ buttons to put the items in order, first at the top. The whole order must be right to score.' },
    match: { badge: 'Match pairs', icon: '⇔', how: 'Choose the partner for each item on the left. Each correct pair earns part of the point.' },
    written: { badge: 'Written answer', icon: '¶', how: 'Write a few sentences. After you submit, compare with a model answer and score yourself with a checklist.' },
    code: { badge: 'Code it up', icon: '</>', how: 'Write the function, then press Run tests. Each passing test earns part of the point.' },
  };

  const GOALS = [
    { slug: 'get-ahead', title: 'Get Ahead in School', courses: ['Algebra/Geometry Fundamentals Review', 'Precalculus', 'AP Calculus BC', 'Multivariable Calculus'] },
    { slug: 'prepare-for-college', title: 'Prepare for College', courses: ['Precalculus', 'AP Calculus BC', 'AP Physics 1', 'Computer Programming 1'] },
    { slug: 'stronger-at-math', title: 'Become Stronger at Math', courses: ['Algebra/Geometry Fundamentals Review', 'Discrete Math', 'Mathematical Proofs', 'Linear Algebra A'] },
    { slug: 'challenge-myself', title: 'Challenge Myself', courses: ['Real Analysis A', 'Real Analysis B', 'Topology: Fundamentals', 'Linear Algebra B', 'Advanced Algorithms'] },
    { slug: 'review-and-test', title: 'Review & Test Myself', courses: null, summary: 'Covers every course you’ve started in this browser.' },
  ];

  const SUBJECTS = ['Math', 'Science', 'Technology', 'Engineering', 'Advanced+'];
  const SUBJECT_OF = {
    'Algebra/Geometry Fundamentals Review': 'Math', 'Precalculus': 'Math', 'AP Calculus BC': 'Math',
    'Multivariable Calculus': 'Math', 'Differential Equations': 'Math', 'Discrete Math': 'Math',
    'Linear Algebra A': 'Math', 'Mathematical Proofs': 'Math',
    'AP Physics 1': 'Science', 'AP Physics 2': 'Science', 'AP Physics C: Mechanics': 'Science',
    'AP Physics C: Electricity and Magnetism': 'Science', 'Quantum Physics & Optics': 'Science',
    'Computer Programming 1': 'Technology', 'Computer Programming 2': 'Technology',
    'Computer Programming 2+': 'Technology', 'Computer Programming Ethics': 'Technology',
    'Software Engineering': 'Technology', 'Data Handling CB': 'Technology', 'AI Developer': 'Technology',
    'Applied Machine/Deep Learning': 'Technology', 'Programming with Packages': 'Technology',
    'Computer Networking Fundamentals': 'Technology', 'Systems Programming & Architecture: CS': 'Technology',
    'Cloud Computing A': 'Technology', 'Cloud Computing B / DevOps': 'Technology',
    'Cybersecurity+': 'Technology', 'Bash for Cybersecurity': 'Technology',
    'Game Engine Architecture': 'Technology', 'Video Game Modding': 'Technology',
    'Engineering 1': 'Engineering', 'Career Applied Engineering': 'Engineering', 'CAD & Prototyping': 'Engineering',
    'Mechatronics': 'Engineering', 'Advanced Robotics': 'Engineering', 'Thermodynamics': 'Engineering',
    'Advanced Algorithms': 'Advanced+', 'Real Analysis A': 'Advanced+', 'Real Analysis B': 'Advanced+',
    'Topology: Fundamentals': 'Advanced+', 'Linear Algebra B': 'Advanced+', 'Quantum Computing': 'Advanced+',
  };

  const shuffle = (list, rng = Math.random) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  // A "Put in order" question must never start already solved.
  const scramble = (list, rng = Math.random) => {
    const out = shuffle(list, rng);
    return list.length > 1 && out.every((item, i) => item === list[i]) ? list.slice(1).concat(list[0]) : out;
  };

  const unitsOf = (pool) => [...new Set(pool.questions.map((question) => question.unit))].sort((a, b) => a - b);
  const pick = (pool, perUnit, rng) => unitsOf(pool).flatMap((unit) => (
    shuffle(pool.questions.filter((question) => question.unit === unit), rng).slice(0, perUnit)
  ));
  const drawCourse = (pool, rng = Math.random) => pick(pool, 2, rng);
  const drawSections = (pools, rng = Math.random) => pools.map((pool) => ({ course: pool.course, slug: pool.slug, questions: pick(pool, 1, rng) }));

  const normalizeText = (value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ');

  const isAnswered = (question, response) => {
    if (response === undefined || response === null) return false;
    switch (question.type) {
      case 'number': case 'text': return String(response).trim() !== '';
      case 'multi': return response.length > 0;
      case 'match': return Object.keys(response).length > 0;
      case 'written': return String(response.text || '').trim() !== '';
      case 'code': return String(response.code || '').trim() !== String(question.starter || '').trim();
      default: return true;
    }
  };

  const grade = (question, response) => {
    if (!isAnswered(question, response)) return 0;
    switch (question.type) {
      case 'single': case 'truefalse': return response === question.answer ? 1 : 0;
      case 'multi': {
        const wanted = new Set(question.answers);
        return response.length === wanted.size && response.every((choice) => wanted.has(choice)) ? 1 : 0;
      }
      case 'number': {
        const value = numbers.parseNumber(String(response));
        return Number.isFinite(value) && numbers.answersClose(value, question.answer, question.tolerance ?? 0.001) ? 1 : 0;
      }
      case 'text': return question.answers.some((answer) => normalizeText(answer) === normalizeText(response)) ? 1 : 0;
      case 'order': return response.length === question.items.length && response.every((item, i) => item === question.items[i]) ? 1 : 0;
      case 'match': return question.pairs.filter(([left, right]) => response[left] === right).length / question.pairs.length;
      case 'written': return Array.isArray(response.rubric) ? response.rubric.filter(Boolean).length / question.rubric.length : 0;
      case 'code': return response.total ? response.passed / response.total : 0;
      default: return 0;
    }
  };

  const scoreAttempt = (entries) => {
    const units = {};
    const courses = {};
    let points = 0;
    entries.forEach(({ question, slug, response }) => {
      const value = grade(question, response);
      const unitId = `${slug}.u${question.unit}`;
      points += value;
      units[unitId] = units[unitId] || { points: 0, total: 0 };
      units[unitId].points += value;
      units[unitId].total += 1;
      courses[slug] = courses[slug] || { points: 0, total: 0 };
      courses[slug].points += value;
      courses[slug].total += 1;
    });
    return { points, total: entries.length, units, courses };
  };

  const label = (fraction) => (fraction >= 0.85 ? 'Strong' : fraction >= 0.6 ? 'Developing' : 'Review');

  const api = { TYPES, GOALS, SUBJECTS, SUBJECT_OF, shuffle, scramble, drawCourse, drawSections, normalizeText, isAnswered, grade, scoreAttempt, label };
  if (typeof document === 'undefined') return api;

  // ---- Browser UI (Task 4) goes here ----

  return api;
}));
