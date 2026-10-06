// Mastery engine (revision Phase 2c): one state per skill — a course unit
// from skill-catalog.json — worked out from the student's saved work each
// time a page loads. Nothing here is stored, so states can't drift from the
// results, Problem Set progress, lesson views, and projects they come from.
(function () {
  'use strict';

  const STATES = ['unseen', 'learning', 'practiced', 'proficient', 'mastered', 'applied'];
  const LABELS = {
    unseen: 'Unseen',
    learning: 'Learning',
    practiced: 'Practiced',
    proficient: 'Proficient',
    mastered: 'Mastered',
    applied: 'Applied',
  };
  const PRACTICED_ATTEMPTS = 5;
  const PROFICIENT_ATTEMPTS = 10;
  const PROFICIENT_ACCURACY = 0.8;
  const PROFICIENT_UNIT_TEST = 0.7;

  // Folder prefixes ("/Course/Unit 3/") match any page inside; course.js
  // lesson pages ("…/lesson.html?id=slug") must match exactly.
  const isLessonOf = (skill, page) => skill.pagePrefixes.some((prefix) => (
    prefix.endsWith('/') ? page.startsWith(prefix) : page === prefix
  ));

  // evidence: { lessons: { page: iso }, results: [saved test rows],
  //   problems: { skillId: { attempted, correct } }, completedProjects: [id] }
  function computeMastery(catalog, evidence) {
    const pages = Object.keys(evidence.lessons || {});
    const results = evidence.results || [];
    const completed = new Set(evidence.completedProjects || []);
    const examPassed = new Set(results.filter((row) => row.kind === 'course_exam' && row.passed).map((row) => row.course));
    const mastery = {};
    catalog.skills.forEach((skill) => {
      const tests = results.filter((row) => row.kind === 'unit_test' && row.course === skill.course && row.unit === skill.unit);
      const best = tests.reduce((max, row) => Math.max(max, row.total ? row.score / row.total : 0), 0);
      const practice = (evidence.problems || {})[skill.id] || { attempted: 0, correct: 0 };
      const lessonsViewed = pages.filter((page) => isLessonOf(skill, page)).length;
      const mastered = tests.some((row) => row.passed) || examPassed.has(skill.course);

      // Each rule raises the state, so the highest one earned wins.
      let state = 'unseen';
      if (lessonsViewed > 0) state = 'learning';
      if (practice.attempted >= PRACTICED_ATTEMPTS || tests.length > 0) state = 'practiced';
      if ((practice.attempted >= PROFICIENT_ATTEMPTS && practice.correct / practice.attempted >= PROFICIENT_ACCURACY)
        || best >= PROFICIENT_UNIT_TEST) state = 'proficient';
      if (mastered) state = 'mastered';
      if (mastered && (catalog.capstones[skill.course] || []).some((id) => completed.has(id))) state = 'applied';

      mastery[skill.id] = { state, lessonsViewed, practice, bestUnitTest: tests.length ? best : null };
    });
    return mastery;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { STATES, LABELS, computeMastery };
    return;
  }

  const read = (key, fallback) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  };
  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const courseFolder = (skill) => skill.pagePrefixes[0].replace(/(Unit \d+\/|lesson\.html\?id=.*)$/, '');
  const courseHref = (skill) => `${courseFolder(skill).split('/').map(encodeURIComponent).join('/')}index.html`;

  const loadCatalog = () => fetch('/assets/skill-catalog.json').then((res) => res.json());
  const loadBanks = () => (window.STEMProblemBanks ? Promise.resolve(window.STEMProblemBanks) : new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/assets/problem-banks.js';
    script.onload = () => resolve(window.STEMProblemBanks);
    script.onerror = reject;
    document.head.append(script);
  }));

  // Problem Set progress is saved by question ID; the banks know each
  // question's topic. They're only loaded when there is progress to read.
  async function problemEvidence(catalog) {
    const skillsBySet = {};
    catalog.skills.filter((skill) => skill.problemSet && skill.problemTopics.length).forEach((skill) => {
      (skillsBySet[skill.problemSet] = skillsBySet[skill.problemSet] || []).push(skill);
    });
    const progress = Object.fromEntries(Object.keys(skillsBySet).map((slug) => [slug, read(`stemplus:problem-sets:v1:${slug}`, {})]));
    const practiced = Object.keys(progress).filter((slug) => Object.keys(progress[slug].attempted || {}).length);
    if (!practiced.length) return {};
    const banks = await loadBanks();
    const evidence = {};
    practiced.forEach((slug) => {
      const topicOf = new Map(banks.getCourse(slug).questions.map((question) => [question.id, question.topic]));
      const attempted = Object.keys(progress[slug].attempted);
      skillsBySet[slug].forEach((skill) => {
        const ids = attempted.filter((id) => skill.problemTopics.includes(topicOf.get(id)));
        evidence[skill.id] = { attempted: ids.length, correct: ids.filter((id) => progress[slug].correct && progress[slug].correct[id]).length };
      });
    });
    return evidence;
  }

  async function studentMastery() {
    const catalog = await loadCatalog();
    const projects = read('stemplus:projects:v1', {});
    const mastery = computeMastery(catalog, {
      lessons: read('stemplus:lessons:v1', {}),
      results: read('stemplus:results:v1', []),
      problems: await problemEvidence(catalog),
      completedProjects: Object.keys(projects).filter((id) => projects[id] && projects[id].complete),
    });
    return { catalog, mastery };
  }

  const chip = (state) => `<span class="mastery-chip" data-state="${state}">${LABELS[state]}</span>`;

  // Course page: a chip after each "Unit N: Title" heading.
  function mountCourseChips(catalog, mastery) {
    const page = decodeURIComponent(window.location.pathname).replace(/index\.html$/, '');
    const skills = catalog.skills.filter((skill) => courseFolder(skill) === page);
    document.querySelectorAll('details.unit-toc > summary').forEach((summary) => {
      const unit = summary.textContent.match(/^\s*(Unit \d+)/);
      const skill = unit && skills.find((s) => s.unit === unit[1]);
      if (!skill || summary.querySelector('.mastery-chip')) return;
      summary.insertAdjacentHTML('beforeend', ` ${chip(mastery[skill.id].state)}`);
    });
  }

  // Dashboard: one strip of unit cells per course the student has started.
  function mountSummary(el, catalog, mastery) {
    const courses = [...new Set(catalog.skills.map((skill) => skill.course))];
    const rows = courses
      .map((course) => catalog.skills.filter((skill) => skill.course === course))
      .filter((skills) => skills.some((skill) => mastery[skill.id].state !== 'unseen'));
    const legend = `<p class="mastery-legend">${STATES.map(chip).join(' ')}</p>`;
    if (!rows.length) {
      el.innerHTML = '<h2>Skill Mastery</h2><p class="toc-empty">Open a lesson, practice, or take a unit test and your skills show up here.</p>';
      return;
    }
    el.innerHTML = `<h2>Skill Mastery</h2>${legend}${rows.map((skills) => {
      const states = skills.map((skill) => mastery[skill.id].state);
      const counts = STATES.slice().reverse()
        .map((state) => [state, states.filter((s) => s === state).length])
        .filter(([, count]) => count)
        .map(([state, count]) => `${count} ${LABELS[state].toLowerCase()}`)
        .join(' · ');
      const cells = skills.map((skill, i) => `<span class="mastery-cell" data-state="${states[i]}" title="${escapeHtml(`${skill.unit}: ${skill.name} — ${LABELS[states[i]]}`)}"></span>`).join('');
      return `<div class="mastery-row"><p class="mastery-course"><a href="${escapeHtml(courseHref(skills[0]))}">${escapeHtml(skills[0].course)}</a> <span class="mastery-counts">${counts}</span></p>`
        + `<div class="mastery-strip" role="img" aria-label="${escapeHtml(`${skills[0].course}: ${counts}`)}">${cells}</div></div>`;
    }).join('')}`;
  }

  function init() {
    const summary = document.querySelector('[data-mastery-summary]');
    const coursePage = document.querySelector('details.unit-toc');
    const account = window.STEMPlusAccount;
    if ((!summary && !coursePage) || !account) return;
    account.ready.then((me) => {
      if (!me) return null;
      return studentMastery().then(({ catalog, mastery }) => {
        if (coursePage) mountCourseChips(catalog, mastery);
        if (summary) mountSummary(summary, catalog, mastery);
      });
    }).catch((err) => console.error('Could not load skill mastery', err));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
