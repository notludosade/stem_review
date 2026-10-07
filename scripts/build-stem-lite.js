'use strict';

const fs = require('fs');
const path = require('path');
const { buildSearchIndex } = require('../lib/global-search');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const PUBLIC = path.join(ROOT, 'public');
const OUTPUT = path.join(ROOT, 'dist-lite');
const FULL_SITE = 'https://stem-review.vercel.app/';

const COURSES = [
  { title: 'Algebra/Geometry Fundamentals Review', path: 'Algebra Geometry Fundamentals Review', subject: 'Math', practice: 'algebra-geometry' },
  { title: 'Precalculus', path: 'Precalculus', subject: 'Math', practice: 'precalculus' },
  { title: 'AP Calculus BC', path: 'AP STEM+/AP_CALC', subject: 'Math', practice: 'ap-calculus-bc' },
  { title: 'Linear Algebra A', path: 'Linear Algebra A', subject: 'Math', practice: 'linear-algebra-a' },
  { title: 'AP Physics 1', path: 'AP Physics 1', subject: 'Science', practice: 'ap-physics-1' },
  { title: 'AP Physics C: Mechanics', path: 'AP Physics C Mechanics', subject: 'Science', practice: 'ap-physics-c-mechanics' },
  { title: 'Computer Programming 1', path: 'Computer Programming 1', subject: 'Computing', practice: 'computer-programming-1', keywords: ['python', 'java', 'javascript', 'c++', 'coding'] },
  { title: 'Computer Programming 2', path: 'Computer Programming 2', subject: 'Computing', practice: 'computer-programming-2', keywords: ['python', 'java', 'javascript', 'c++', 'data structures', 'algorithms'] },
];

const APPLICATIONS = [
  { title: 'Keeping a Satellite in Orbit', slug: 'keeping-a-satellite-in-orbit' },
  { title: 'Designing a Roller Coaster Safely', slug: 'designing-a-roller-coaster-safely' },
  { title: 'Route Planning Like a GPS App', slug: 'route-planning-like-gps' },
  { title: 'How Recommendation Engines Actually Work', slug: 'how-recommendation-engines-work' },
];

const PROJECTS = [
  { title: 'Mathematics Capstone', slug: 'mathematics-capstone' },
  { title: 'Engineering & Physics Capstone', slug: 'engineering-physics-capstone' },
  { title: 'Software Engineer Capstone', slug: 'software-engineer-capstone' },
  { title: 'AI & Data Capstone', slug: 'ai-data-capstone' },
];

const BLOCKED_SCRIPTS = new Set(['account.js', 'auth.js', 'frq.js', 'mastery.js', 'reports.js', 'tests.js']);
const EXCLUDED_PAGE = /(?:^|\/)(?:unit-test-[ab]|course-exam|progress-report)\.html$/;

function mkdir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function write(rel, value) {
  const file = path.join(OUTPUT, rel);
  mkdir(file);
  fs.writeFileSync(file, value);
}
function copy(source, rel) {
  const target = path.join(OUTPUT, rel);
  mkdir(target);
  fs.copyFileSync(source, target);
}
function urlPath(value) { return value.split('/').map(encodeURIComponent).join('/'); }
function rootFor(rel) {
  const dir = path.posix.dirname(rel);
  return dir === '.' ? './' : '../'.repeat(dir.split('/').length);
}
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function header(root) {
  return `<header class="lite-header"><a class="lite-brand" href="${root}index.html">STEM Lite</a><nav class="lite-nav" aria-label="Primary"><a href="${root}courses.html">Courses</a><a href="${root}practice.html">Practice</a><a href="${root}applications.html">Applications</a><a href="${root}projects.html">Projects</a><a href="${root}calculators.html">Calculators</a><a class="lite-search-link" href="${root}search.html">Search <span aria-hidden="true">⌘K</span></a></nav></header>`;
}

function shell(title, body, rel, extraHead = '') {
  const root = rootFor(rel);
  const key = process.env.DESMOS_API_KEY || '';
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} — STEM Lite</title><link rel="icon" href="${root}favicon.ico" type="image/x-icon"><link rel="stylesheet" href="${root}assets/style.css"><link rel="stylesheet" href="${root}assets/lite.css">${key ? `<meta name="desmos-api-key" content="${escapeHtml(key)}">` : ''}${extraHead}</head><body data-lite-root="${root}">${header(root)}${body}<footer class="lite-footer">STEM Lite is the public, no-account edition of STEM+. Progress is not synced or graded. <a href="${FULL_SITE}">Open full STEM+</a>.</footer><script src="${root}assets/lite.js" defer></script></body></html>`;
}

function cards(items) {
  return `<div class="toc-list">${items.map((item) => `<a class="toc-item" href="${item.href}"><span class="toc-num">${escapeHtml(item.eyebrow || '')}</span><p class="toc-title">${escapeHtml(item.title)}</p><p class="toc-sub">${escapeHtml(item.description || '')}</p></a>`).join('')}</div>`;
}

function page(title, subtitle, content, rel, extraHead = '') {
  return shell(title, `<main class="page"><span class="kicker">STEM Lite · Public learning</span><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p>${content}</main>`, rel, extraHead);
}

function stripBlockedScripts(html) {
  return html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (tag, src) => {
    const name = src.split(/[/?#]/).pop();
    return BLOCKED_SCRIPTS.has(name) ? '' : tag;
  });
}

function transformFragment(source, rel, courseRoot) {
  const root = rootFor(rel);
  let html = stripBlockedScripts(source).replace(/STEM\+/g, 'STEM Lite');
  if (courseRoot) {
    html = html.replace(/<a\b[^>]*href=["'][^"']*(?:unit-test-[ab]|course-exam|progress-report)\.html[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
    const courseIndex = path.posix.relative(path.posix.dirname(rel), path.posix.join(courseRoot, 'index.html')) || 'index.html';
    html = html.replace(/href=(["'])[^"']*(?:unit-test-[ab]|course-exam|progress-report)\.html[^"']*\1/gi, `href="${courseIndex}"`);
  }
  html = html.replace(/data-project-content\s+hidden/g, 'data-project-content');
  html = html.replace(/(?:href|src)=(["'])\/([^/][^"']*)\1/gi, (match, quote, target) => match.replace(`${quote}/${target}${quote}`, `${quote}${root}${target}${quote}`));
  const firstPage = html.search(/<div\b[^>]*class=["'][^"']*\bpage\b/i);
  const head = firstPage >= 0 ? html.slice(0, firstPage) : '';
  const body = firstPage >= 0 ? html.slice(firstPage) : html;
  const key = process.env.DESMOS_API_KEY || '';
  return `<!doctype html><html lang="en"><head>${head}<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${root}assets/lite.css">${key ? `<meta name="desmos-api-key" content="${escapeHtml(key)}">` : ''}</head><body data-lite-root="${root}">${header(root)}<main>${body}</main><footer class="lite-footer">STEM Lite is public and account-free. Work on this page is not synced. <a href="${FULL_SITE}${urlPath(rel)}">Continue in full STEM+</a>.</footer><script src="${root}assets/lite.js" defer></script></body></html>`;
}

function copyCourse(course) {
  const sourceRoot = path.join(CONTENT, course.path);
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const source = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(source);
      if (!entry.name.endsWith('.html')) return;
      const inside = path.relative(sourceRoot, source).split(path.sep).join('/');
      const rel = path.posix.join(course.path, inside);
      if (EXCLUDED_PAGE.test(rel)) return;
      write(rel, transformFragment(fs.readFileSync(source, 'utf8'), rel, course.path));
    });
  }
  walk(sourceRoot);
}

function copyContentPage(sourceRel, outputRel = sourceRel) {
  write(outputRel, transformFragment(fs.readFileSync(path.join(CONTENT, sourceRel), 'utf8'), outputRel));
}

function buildSearch() {
  const catalog = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'assets/skill-catalog.json'), 'utf8'));
  const courseNames = new Set(COURSES.map((course) => course.title));
  const appSlugs = new Set(APPLICATIONS.map((application) => application.slug));
  const projectSlugs = new Set(PROJECTS.map((project) => project.slug));
  const filtered = {
    skills: catalog.skills.filter((skill) => courseNames.has(skill.course)),
    applications: catalog.applications.filter((application) => appSlugs.has(application.slug)),
    pathways: [],
    capstones: Object.fromEntries(Object.entries(catalog.capstones || {}).map(([course, ids]) => [course, ids.filter((id) => projectSlugs.has(id))]).filter(([, ids]) => ids.length)),
  };
  const seeds = [
    ...COURSES.map((course) => ({ type: 'COURSE', title: course.title, href: `/${course.path}/index.html`, context: course.subject, keywords: course.keywords })),
    ...COURSES.map((course) => ({ type: 'PRACTICE', title: course.title, href: `/problem-set.html?course=${course.practice}`, context: course.subject, keywords: course.keywords })),
    ...APPLICATIONS.map((application) => ({ type: 'APPLICATION', title: application.title, href: `/Applications/${application.slug}.html`, context: 'Application' })),
    ...PROJECTS.map((project) => ({ type: 'PROJECT', title: project.title, href: `/Projects/${project.slug}.html`, context: 'Project' })),
    { type: 'CALCULATOR', title: 'Scientific Calculator', href: '/Calculators/scientific.html', context: 'Desmos Tools', keywords: ['math arithmetic trigonometry logarithms fractions'] },
    { type: 'CALCULATOR', title: 'Graphing Calculator', href: '/Calculators/graphing.html', context: 'Desmos Tools', keywords: ['math graph functions plots tables sliders'] },
    { type: 'PAGE', title: 'Courses', href: '/courses.html' },
    { type: 'PAGE', title: 'Practice', href: '/practice.html' },
    { type: 'PAGE', title: 'Applications', href: '/applications.html' },
    { type: 'PAGE', title: 'Projects', href: '/projects.html' },
  ];
  const index = buildSearchIndex(filtered, seeds).map((entry) => ({ ...entry, href: entry.href.replace(/^\/+/, '') }));
  write('assets/search-index.json', `${JSON.stringify(index)}\n`);
}

function fixMissingLinks() {
  const htmlFiles = [];
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.html')) htmlFiles.push(file);
    });
  }
  walk(OUTPUT);
  htmlFiles.forEach((file) => {
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/href=(["'])(?!https?:|mailto:|tel:|#)([^"']+)\1/gi, (match, quote, href) => {
      const clean = href.split(/[?#]/)[0];
      if (!clean) return match;
      let decoded;
      try { decoded = decodeURIComponent(clean); } catch (_) { return match; }
      const target = path.resolve(path.dirname(file), decoded);
      if (target.startsWith(OUTPUT) && fs.existsSync(target)) return match;
      const sourceTarget = path.resolve(CONTENT, path.relative(OUTPUT, target));
      if (!sourceTarget.startsWith(CONTENT) || !fs.existsSync(sourceTarget)) return match;
      const fullPath = path.relative(CONTENT, sourceTarget).split(path.sep).map(encodeURIComponent).join('/');
      const suffix = href.slice(clean.length);
      return `href=${quote}${FULL_SITE}${fullPath}${suffix}${quote}`;
    });
    fs.writeFileSync(file, html);
  });
}

function build() {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT, { recursive: true });

  COURSES.forEach(copyCourse);
  APPLICATIONS.forEach((application) => copyContentPage(`Applications/${application.slug}.html`));
  PROJECTS.forEach((project) => copyContentPage(`Projects/${project.slug}.html`));
  copyContentPage('problem-set.html');
  copyContentPage('Calculators/scientific.html');
  copyContentPage('Calculators/graphing.html');

  const courseCards = COURSES.map((course) => ({ title: course.title, eyebrow: course.subject, href: `${urlPath(course.path)}/index.html`, description: 'Lessons and interactive checks from the shared STEM+ curriculum.' }));
  const practiceCards = COURSES.map((course) => ({ title: course.title, eyebrow: course.subject, href: `problem-set.html?course=${encodeURIComponent(course.practice)}`, description: 'Topic-filtered questions with immediate explanations.' }));
  const applicationCards = APPLICATIONS.map((item) => ({ ...item, eyebrow: 'Real-world concept', href: `Applications/${item.slug}.html`, description: 'Connect course ideas to a practical system.' }));
  const projectCards = PROJECTS.map((item) => ({ ...item, eyebrow: 'Open project', href: `Projects/${item.slug}.html`, description: 'A substantial build brief with reflection prompts.' }));

  write('index.html', page('Learn STEM without an account', 'STEM Lite is a public, static collection of selected STEM+ courses, practice, applications, projects, and calculators.', `<p class="lite-note">No sign-in, synced progress, mastery dashboard, or AI grading. Open a resource and start learning.</p><h2>Start learning</h2>${cards(courseCards.slice(0, 4))}<h2>Practice and build</h2>${cards([
    { title: 'Practice', eyebrow: 'Question banks', href: 'practice.html', description: 'Check concepts with immediate feedback.' },
    { title: 'Applications', eyebrow: 'Real world', href: 'applications.html', description: 'See why the concepts matter.' },
    { title: 'Projects', eyebrow: 'Build', href: 'projects.html', description: 'Apply several concepts together.' },
    { title: 'Calculators', eyebrow: 'Tools', href: 'calculators.html', description: 'Scientific and graphing calculators powered by Desmos.' },
  ])}`, 'index.html'));
  write('courses.html', page('Courses', 'Eight selected courses across math, science, and computing.', cards(courseCards), 'courses.html'));
  write('practice.html', page('Practice', 'Selected question banks run entirely in your browser.', cards(practiceCards), 'practice.html'));
  write('applications.html', page('Applications', 'Short explorations that connect STEM concepts to real systems.', cards(applicationCards), 'applications.html'));
  write('projects.html', page('Projects', 'Open-ended briefs for combining concepts into something substantial.', `<p class="lite-note">Project prerequisites are recommendations in STEM Lite, not account gates. Reflections are not saved.</p>${cards(projectCards)}`, 'projects.html'));
  write('calculators.html', page('Calculators', 'Embedded Desmos tools shared with the full STEM+ platform.', cards([
    { title: 'Scientific Calculator', eyebrow: 'Desmos Tool', href: 'Calculators/scientific.html', description: 'Fractions, powers, roots, logarithms, and trigonometry.' },
    { title: 'Graphing Calculator', eyebrow: 'Desmos Tool', href: 'Calculators/graphing.html', description: 'Functions, tables, intersections, and sliders.' },
  ]), 'calculators.html'));
  write('search.html', page('Search STEM Lite', 'Find a course, lesson, skill, practice topic, application, project, or calculator.', '<div data-lite-search><label class="sr-only" for="lite-search-input">Search STEM Lite</label><div class="lite-search-form"><input id="lite-search-input" type="search" autocomplete="off" placeholder="Try chain rule, satellite, or python…"></div><div class="lite-search-results" data-lite-results aria-live="polite"><p>Loading the catalog…</p></div></div>', 'search.html', '<script src="assets/global-search.js" defer></script>'));

  ['style.css', 'interactive.js', 'quiz.js', 'applications.js', 'problem-banks.js', 'problem-sets.js', 'desmos.js'].forEach((name) => copy(path.join(PUBLIC, 'assets', name), `assets/${name}`));
  copy(path.join(ROOT, 'stem-lite/lite.css'), 'assets/lite.css');
  copy(path.join(ROOT, 'stem-lite/lite.js'), 'assets/lite.js');
  copy(path.join(ROOT, 'lib/global-search.js'), 'assets/global-search.js');
  copy(path.join(PUBLIC, 'favicon.ico'), 'favicon.ico');
  write('.nojekyll', '');
  buildSearch();
  fixMissingLinks();
  return OUTPUT;
}

if (require.main === module) {
  build();
  console.log(`STEM Lite built at ${OUTPUT}`);
}

module.exports = { build, OUTPUT, COURSES, APPLICATIONS, PROJECTS };
