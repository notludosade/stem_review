'use strict';

// Generates public/assets/skill-catalog.json: one skill per course unit,
// derived from the site's own tables and pages. Run it after adding,
// removing, or renaming a unit, then review the diff — skill IDs key student
// mastery, so an existing ID must never change meaning.
const fs = require('node:fs');
const path = require('node:path');
const { PREREQUISITE_GRAPH, decodeEntities } = require('../lib/plan-catalog');
const banks = require('../public/assets/problem-banks.js');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const CATALOG_FILE = path.join(ROOT, 'public/assets/skill-catalog.json');

// Problem Set slug → topic → unit number. The only hand-written data here;
// assigned by comparing each topic's questions with the unit's lessons.
const PROBLEM_TOPIC_UNITS = {
  'algebra-geometry': { 'Linear equations': 1, Systems: 1, Quadratics: 2, Exponents: 3, Area: 5, 'Right triangles': 6 },
  precalculus: { Functions: 1, 'Composition and inverses': 1, 'Polynomial functions': 2, 'Exponential and logarithmic functions': 3, Trigonometry: 4, Sequences: 6 },
  'ap-calculus-bc': { Limits: 1, Derivatives: 2, 'Derivative applications': 2, 'Quotient Rule': 2, 'Chain Rule': 3, 'Implicit Differentiation': 3, Integrals: 6, 'Fundamental Theorem': 6, 'Infinite series': 10 },
  'multivariable-calculus': { 'Vectors and dot products': 1, 'Cross products': 1, 'Partial derivatives': 2, Gradients: 2, 'Multiple integrals': 4, 'Vector fields': 6 },
  'linear-algebra-a': { 'Vectors and dot products': 1, 'Vector magnitude': 1, 'Matrix determinants': 5, 'Matrix traces': 2, 'Matrix multiplication': 2, Eigenvalues: 6 },
  'differential-equations': { 'Differential equations': 1, 'Growth and decay': 2, 'Characteristic equations': 3, 'Euler’s method': 7, Oscillations: 4, 'Laplace transforms': 5 },
  'mathematical-proofs': { 'Statements and logic': 1, 'Parity and divisibility': 2, 'Direct proofs': 2, 'Proofs about sets': 2, 'Mathematical induction': 4, 'Quantifiers and witnesses': 1 },
  'discrete-math': { Logic: 1, Sets: 2, Combinatorics: 3, Probability: 4, 'Graph theory': 5, 'Number theory': 6 },
  'computer-programming-1': { 'Language fundamentals': 1, 'Variables and operators': 2, 'Control flow': 3, Loops: 3, Functions: 4, Collections: 6 },
  'computer-programming-2': { 'Object-oriented programming': 1, Exceptions: 2, 'Data structures': 3, Recursion: 4, 'Algorithms and complexity': 5, 'Memory and concurrency': 6 },
  'data-handling-cb': { Spreadsheets: 2, 'SQL and databases': 3, 'Descriptive statistics': 4, 'Data quality and cleaning': 5, 'Correlation and regression': 4, 'Visualization and storytelling': 6 },
  'computer-networking-fundamentals': { 'Bandwidth and transmission': 1, 'Latency and propagation': 1, 'IPv4 addressing': 3, 'CIDR notation': 3, 'Bandwidth-delay product': 1, 'Ports and multiplexing': 5 },
  'systems-programming-architecture': { 'Binary representation': 4, Hexadecimal: 4, 'Two’s complement': 4, 'Memory addressing': 3, 'Cache performance': 7, 'CPU scheduling': 5 },
  'ap-physics-1': { Kinematics: 1, Forces: 2, Energy: 3, Momentum: 4, Rotation: 5, 'Circular motion': 2 },
  'ap-physics-2': { Thermodynamics: 1, Electrostatics: 2, 'Electric circuits': 3, Magnetism: 4, 'Geometric optics': 5, 'Modern physics': 7 },
  'ap-physics-c-mechanics': { 'Calculus-based kinematics': 1, 'Force and acceleration': 2, 'Work by variable forces': 3, 'Impulse and momentum': 4, 'Rotational dynamics': 5, 'Gravitation and orbits': 7 },
  'quantum-physics-optics': { 'Wave optics': 1, Diffraction: 2, Photons: 3, 'Photoelectric effect': 3, 'Matter waves': 4, 'Particle in a box': 6 },
  'engineering-1': { 'Units and measurement': 2, 'Vectors and resultants': 3, 'Statics and moments': 3, 'Stress and strain': 3, 'Work and power': 5, 'Electric circuits': 6 },
  'real-analysis-a': { 'Absolute value and bounds': 1, 'Supremum and infimum': 1, 'Sequences and limits': 2, 'Epsilon-N arguments': 2, 'Topology of the real line': 3, 'Riemann integration': 6 },
  'advanced-algorithms': { 'Asymptotic analysis': 1, 'Divide and conquer': 2, 'Minimum spanning trees': 3, 'Shortest paths': 4, 'Dynamic programming': 5, 'Bitmask algorithms': 5 },
};

// Concept-level metadata complements (but never replaces) the unit skills
// above. Questions opt in through `skills`; untagged content remains valid.
const CONCEPT_DEFINITIONS = [
  {
    id: 'ap-calculus-bc.power-rule', name: 'Power Rule', course: 'AP Calculus BC', unit: 2,
    lessons: ['/AP STEM+/AP_CALC/Unit 2/0004-the-power-rule-and-basic-derivative-rules.html'], prerequisites: [],
  },
  {
    id: 'ap-calculus-bc.product-rule', name: 'Product Rule', course: 'AP Calculus BC', unit: 2,
    lessons: ['/AP STEM+/AP_CALC/Unit 2/0006-the-product-and-quotient-rules.html'], prerequisites: ['ap-calculus-bc.power-rule'],
  },
  {
    id: 'ap-calculus-bc.quotient-rule', name: 'Quotient Rule', course: 'AP Calculus BC', unit: 2,
    lessons: ['/AP STEM+/AP_CALC/Unit 2/0006-the-product-and-quotient-rules.html'], prerequisites: ['ap-calculus-bc.product-rule'],
  },
  {
    id: 'ap-calculus-bc.chain-rule', name: 'Chain Rule', course: 'AP Calculus BC', unit: 3,
    lessons: ['/AP STEM+/AP_CALC/Unit 3/0001-the-chain-rule.html'], prerequisites: ['ap-calculus-bc.power-rule'],
  },
  {
    id: 'ap-calculus-bc.implicit-differentiation', name: 'Implicit Differentiation', course: 'AP Calculus BC', unit: 3,
    lessons: ['/AP STEM+/AP_CALC/Unit 3/0002-implicit-differentiation.html'], prerequisites: ['ap-calculus-bc.chain-rule'],
  },
];

// Application slug (content/Applications/<slug>.html) → the skills it puts
// to work. Hand-written; shown as "Concepts used" and counted toward the
// Applied mastery state.
const APPLICATION_SKILLS = {
  'ab-testing-a-feature-launch': ['data-handling-cb.u4', 'data-handling-cb.u6', 'discrete-math.u4'],
  'bias-in-a-hiring-algorithm': ['computer-programming-ethics.u5', 'data-handling-cb.u4', 'data-handling-cb.u7', 'ai-developer.u9'],
  'designing-a-roller-coaster-safely': ['ap-physics-1.u2', 'ap-physics-1.u3'],
  'how-recommendation-engines-work': ['linear-algebra-a.u1', 'linear-algebra-a.u7', 'ai-developer.u3'],
  'keeping-a-satellite-in-orbit': ['ap-physics-1.u2', 'ap-physics-c-mechanics.u2', 'ap-physics-c-mechanics.u7'],
  'modeling-an-epidemic': ['ap-calculus-bc.u7', 'differential-equations.u6', 'differential-equations.u7'],
  'route-planning-like-gps': ['discrete-math.u5', 'computer-programming-2.u3', 'advanced-algorithms.u4'],
  'scaling-a-viral-app': ['cloud-computing-a.u2', 'cloud-computing-a.u4', 'cloud-computing-a.u6'],
  'why-your-video-call-freezes': ['computer-networking-fundamentals.u1', 'computer-networking-fundamentals.u2', 'computer-networking-fundamentals.u5'],
};

// tests.js is a browser script, so its tables are read from source (the same
// approach check-plan-catalog.js uses).
const testsSrc = fs.readFileSync(path.join(ROOT, 'public/assets/tests.js'), 'utf8');
const readTable = (name) => {
  const match = testsSrc.match(new RegExp(`var ${name} = \\{([\\s\\S]*?)\\};`));
  return Object.fromEntries([...match[1].matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
};
const COURSE_PATHS = readTable('COURSE_PATHS');
const PROBLEM_SET_SLUGS = readTable('PROBLEM_SET_SLUGS');

const courseSlug = (name) => name.toLowerCase().replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const unitFolders = (dir) => fs.readdirSync(path.join(CONTENT, dir)).filter((name) => /^Unit \d+$/.test(name));
// A few courses (Programming with Packages) build every page from a
// public/<dir>/course.js data file instead of Unit N folders.
const courseScript = (dir) => {
  const file = path.join(ROOT, 'public', dir, 'course.js');
  return fs.existsSync(file) ? require(file) : null;
};
const expectedSkillCount = () => Object.values(COURSE_PATHS)
  .reduce((sum, dir) => sum + (courseScript(dir) ? courseScript(dir).units.length : unitFolders(dir).length), 0);

// tests.js PATHWAYS: diagnostics are built per Pathway, and a completed
// capstone makes its courses "Applied". The slug names content/Pathways/<slug>.html.
const PATHWAYS = [...testsSrc.matchAll(/\{ name: '([^']+)', courses: \[([^\]]*)\], projectId: '([^']+)'/g)].map((m) => ({
  name: m[1],
  slug: m[3].replace(/-capstone$/, ''),
  courses: [...m[2].matchAll(/'([^']+)'/g)].map(([, course]) => course),
  projectId: m[3],
}));
const capstonesByCourse = () => {
  const capstones = {};
  PATHWAYS.forEach((pathway) => pathway.courses.forEach((course) => {
    capstones[course] = [...(capstones[course] || []), pathway.projectId];
  }));
  return capstones;
};

const problemSetTopics = () => Object.entries(PROBLEM_SET_SLUGS).flatMap(([course, slug]) =>
  [...new Set(banks.getCourse(slug).questions.map((question) => question.topic))].map((topic) => ({ course, slug, topic })));

function courseUnits(course, dir) {
  const script = courseScript(dir);
  if (script) {
    return script.units.map((unit, index) => ({
      number: index + 1,
      name: unit.title,
      lessons: unit.lessons.map((lesson) => ({ page: `/${dir}/lesson.html?id=${lesson.slug}`, title: lesson.title })),
      testPage: `/${dir}/unit-test.html?unit=${index + 1}`,
    }));
  }
  const html = fs.readFileSync(path.join(CONTENT, dir, 'index.html'), 'utf8');
  const units = [...html.matchAll(/<summary>\s*Unit (\d+)\s*[:—-]\s*([^<]+)<\/summary>/g)]
    .map((m) => ({ number: Number(m[1]), name: decodeEntities(m[2].trim()) }));
  const folders = unitFolders(dir).map((name) => Number(name.slice(5))).sort((a, b) => a - b);
  if (units.map((u) => u.number).join() !== folders.join()) {
    throw new Error(`${course}: unit headings (${units.map((u) => u.number)}) don't match unit folders (${folders})`);
  }
  return units.map((unit) => ({
    ...unit,
    // Lesson pages in order, titled by their <h1>; mastery matches lesson
    // views against these exact paths.
    lessons: fs.readdirSync(path.join(CONTENT, dir, `Unit ${unit.number}`))
      .filter((name) => /^\d{4}-.*\.html$/.test(name))
      .sort()
      .map((name) => ({
        page: `/${dir}/Unit ${unit.number}/${name}`,
        title: decodeEntities(fs.readFileSync(path.join(CONTENT, dir, `Unit ${unit.number}`, name), 'utf8').match(/<h1>([^<]+)<\/h1>/)[1].trim()),
      })),
    testPage: `/${dir}/Unit ${unit.number}/unit-test-a.html`,
  }));
}

function buildCatalog() {
  const units = Object.fromEntries(Object.entries(COURSE_PATHS).map(([course, dir]) => [course, courseUnits(course, dir)]));
  const idFor = (course, number) => `${courseSlug(course)}.u${number}`;

  const topicsByUnit = new Map();
  problemSetTopics().forEach(({ course, slug, topic }) => {
    const number = PROBLEM_TOPIC_UNITS[slug]?.[topic];
    if (!number) throw new Error(`Problem Set ${slug} topic "${topic}" has no unit in PROBLEM_TOPIC_UNITS`);
    if (!units[course].some((unit) => unit.number === number)) throw new Error(`${slug} "${topic}" → Unit ${number}, which ${course} doesn't have`);
    const id = idFor(course, number);
    topicsByUnit.set(id, [...(topicsByUnit.get(id) || []), topic]);
  });
  const mapped = Object.values(PROBLEM_TOPIC_UNITS).reduce((sum, topics) => sum + Object.keys(topics).length, 0);
  if (mapped !== problemSetTopics().length) throw new Error('PROBLEM_TOPIC_UNITS names a topic no Problem Set has');

  const concepts = CONCEPT_DEFINITIONS.map((concept) => {
    const unitSkill = idFor(concept.course, concept.unit);
    const courseLessons = units[concept.course]?.flatMap((unit) => unit.lessons.map((lesson) => lesson.page)) || [];
    concept.lessons.forEach((page) => {
      if (!courseLessons.includes(page)) throw new Error(`${concept.id} lists unknown lesson ${page}`);
    });
    const problemSet = PROBLEM_SET_SLUGS[concept.course] || null;
    const questionCount = problemSet
      ? banks.getCourse(problemSet).questions.filter((question) => question.skills?.includes(concept.id)).length
      : 0;
    return { ...concept, subject: 'Mathematics', unitSkill, problemSet, questionCount };
  });
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  Object.entries(PROBLEM_SET_SLUGS).forEach(([, slug]) => banks.getCourse(slug).questions.forEach((question) => {
    (question.skills || []).forEach((id) => {
      if (!conceptIds.has(id)) throw new Error(`${slug} question ${question.id} lists unknown concept ${id}`);
    });
  }));

  const skills = Object.entries(units).flatMap(([course, courseUnitList]) => courseUnitList.map((unit, index) => ({
    id: idFor(course, unit.number),
    name: unit.name,
    course,
    unit: `Unit ${unit.number}`,
    lessons: unit.lessons.map((lesson) => {
      const lessonConcepts = concepts.filter((concept) => concept.lessons.includes(lesson.page)).map((concept) => concept.id);
      return lessonConcepts.length ? { ...lesson, concepts: lessonConcepts } : lesson;
    }),
    prerequisites: index > 0
      ? [idFor(course, courseUnitList[index - 1].number)]
      : (PREREQUISITE_GRAPH[course] || []).map((before) => idFor(before, units[before][units[before].length - 1].number)),
    problemTopics: topicsByUnit.get(idFor(course, unit.number)) || [],
    problemSet: PROBLEM_SET_SLUGS[course] || null,
    testPage: unit.testPage,
  })));
  const ids = new Set(skills.map((skill) => skill.id));
  const applications = fs.readdirSync(path.join(CONTENT, 'Applications')).filter((f) => f.endsWith('.html')).sort().map((file) => {
    const slug = file.slice(0, -5);
    const skillIds = APPLICATION_SKILLS[slug];
    if (!skillIds) throw new Error(`Application ${slug} has no entry in APPLICATION_SKILLS`);
    skillIds.forEach((id) => { if (!ids.has(id)) throw new Error(`Application ${slug} lists unknown skill ${id}`); });
    const html = fs.readFileSync(path.join(CONTENT, 'Applications', file), 'utf8');
    return { slug, title: decodeEntities(html.match(/<h1>([^<]+)<\/h1>/)[1].trim()), skills: skillIds };
  });
  const capstones = capstonesByCourse();
  return {
    version: 3,
    pathways: PATHWAYS.map(({ name, slug, courses }) => ({ name, slug, courses })),
    applications,
    capstones: Object.fromEntries(Object.keys(COURSE_PATHS).filter((c) => capstones[c]).map((c) => [c, capstones[c]])),
    skills,
    concepts,
  };
}

const catalogText = (catalog) => `${JSON.stringify(catalog, null, 2)}\n`;

if (require.main === module) {
  const catalog = buildCatalog();
  fs.writeFileSync(CATALOG_FILE, catalogText(catalog));
  console.log(`wrote ${path.relative(ROOT, CATALOG_FILE)}: ${catalog.skills.length} skills`);
}

module.exports = { buildCatalog, catalogText, CATALOG_FILE, expectedSkillCount, problemSetTopics, COURSE_PATHS };
