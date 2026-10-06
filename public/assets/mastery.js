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

  // Lesson views are recorded by exact page (decoded path + search).
  const isLessonOf = (skill, page) => skill.lessons.some((lesson) => lesson.page === page);
  const encodePath = (page) => {
    const [pathname, query] = page.split('?');
    return pathname.split('/').map(encodeURIComponent).join('/') + (query ? `?${query}` : '');
  };
  // The course page: the unit test's folder, minus "Unit N/".
  const courseFolder = (skill) => skill.testPage.replace(/(Unit \d+\/)?unit-test[^/]*$/, '');
  const courseHref = (skill) => `${encodePath(courseFolder(skill))}index.html`;

  // Each skill's answers from the newest saved diagnostic that tested it.
  function diagnosticAnswers(diagnostics) {
    const bySkill = new Map();
    Object.values(diagnostics || {})
      .sort((a, b) => String(a.takenAt).localeCompare(String(b.takenAt)))
      .forEach((attempt) => {
        const tally = new Map();
        (attempt.answers || []).forEach(({ skillId, correct }) => {
          const t = tally.get(skillId) || { asked: 0, correct: 0 };
          tally.set(skillId, { asked: t.asked + 1, correct: t.correct + (correct ? 1 : 0) });
        });
        tally.forEach((t, skillId) => bySkill.set(skillId, t));
      });
    return bySkill;
  }

  // evidence: { lessons: { page: iso }, results: [saved test rows],
  //   problems: { skillId: { attempted, correct } }, completedProjects: [id],
  //   diagnostics: { pathwaySlug: { takenAt, answers: [{ skillId, correct }] } },
  //   completedApplications: [slug] }
  function computeMastery(catalog, evidence) {
    const pages = Object.keys(evidence.lessons || {});
    const diagnostics = diagnosticAnswers(evidence.diagnostics);
    const results = evidence.results || [];
    const completed = new Set(evidence.completedProjects || []);
    // Skills put to work by a completed Application.
    const appliedByApplication = new Set((catalog.applications || [])
      .filter((application) => (evidence.completedApplications || []).includes(application.slug))
      .flatMap((application) => application.skills));
    const examPassed = new Set(results.filter((row) => row.kind === 'course_exam' && row.passed).map((row) => row.course));
    const mastery = {};
    catalog.skills.forEach((skill) => {
      const tests = results.filter((row) => row.kind === 'unit_test' && row.course === skill.course && row.unit === skill.unit);
      const best = tests.reduce((max, row) => Math.max(max, row.total ? row.score / row.total : 0), 0);
      const practice = (evidence.problems || {})[skill.id] || { attempted: 0, correct: 0 };
      const lessonsViewed = pages.filter((page) => isLessonOf(skill, page)).length;
      const mastered = tests.some((row) => row.passed) || examPassed.has(skill.course);
      // A diagnostic raises a unit to Practiced or Proficient, never Mastered.
      const diagnostic = diagnostics.get(skill.id) || { asked: 0, correct: 0 };

      // Each rule raises the state, so the highest one earned wins.
      let state = 'unseen';
      if (lessonsViewed > 0) state = 'learning';
      if (practice.attempted >= PRACTICED_ATTEMPTS || tests.length > 0 || diagnostic.correct > 0) state = 'practiced';
      if ((practice.attempted >= PROFICIENT_ATTEMPTS && practice.correct / practice.attempted >= PROFICIENT_ACCURACY)
        || best >= PROFICIENT_UNIT_TEST
        || (diagnostic.asked > 0 && diagnostic.correct === diagnostic.asked)) state = 'proficient';
      if (mastered) state = 'mastered';
      if (mastered && ((catalog.capstones[skill.course] || []).some((id) => completed.has(id)) || appliedByApplication.has(skill.id))) state = 'applied';

      mastery[skill.id] = { state, lessonsViewed, practice, diagnostic, bestUnitTest: tests.length ? best : null };
    });
    return mastery;
  }

  // A Pathway's readiness: its skills at Proficient or above, over all of them.
  function readiness(catalog, mastery, pathway) {
    const skills = catalog.skills.filter((skill) => pathway.courses.includes(skill.course));
    const ready = skills.filter((skill) => STATES.indexOf(mastery[skill.id].state) >= STATES.indexOf('proficient')).length;
    return { ready, total: skills.length, percent: skills.length ? Math.round(ready * 100 / skills.length) : 0 };
  }

  // A single course's readiness, by name — same rule as readiness() above,
  // scoped to one course instead of a pathway's course list. Used by the
  // Learning Record so its per-course figure agrees with the mastery states
  // every other mastery-aware page already shows (diagnostics, Applications,
  // the dashboard), instead of computing its own separate number.
  function courseReadiness(catalog, mastery, course) {
    return readiness(catalog, mastery, { courses: [course] });
  }

  const rank = (state) => STATES.indexOf(state);

  // The single next action on a track: the first unit (track course order,
  // then unit order) below Mastered. While it's Unseen or Learning, open its
  // next unopened lesson; after that, take its unit test.
  function nextStep(catalog, mastery, evidence, courses) {
    const viewed = new Set(Object.keys((evidence && evidence.lessons) || {}));
    const skill = courses.flatMap((course) => catalog.skills.filter((s) => s.course === course))
      .find((s) => rank(mastery[s.id].state) < rank('mastered'));
    if (!skill) return { kind: 'done' };
    if (rank(mastery[skill.id].state) <= rank('learning')) {
      const lesson = skill.lessons.find((l) => !viewed.has(l.page));
      if (lesson) return { kind: 'lesson', skill, lesson };
    }
    return { kind: 'test', skill };
  }

  // Units started but not mastered, weakest first by their best evidence.
  function reviewList(catalog, mastery, limit = 5) {
    const strength = (m) => Math.max(
      m.practice.attempted ? m.practice.correct / m.practice.attempted : 0,
      m.bestUnitTest || 0,
      m.diagnostic.asked ? m.diagnostic.correct / m.diagnostic.asked : 0,
    );
    return catalog.skills
      .map((skill, index) => ({ skill, index, m: mastery[skill.id] }))
      .filter(({ m }) => m.state === 'practiced' || m.state === 'proficient')
      .sort((a, b) => strength(a.m) - strength(b.m) || a.index - b.index)
      .slice(0, limit)
      .map(({ skill }) => ({
        skill,
        action: skill.problemSet && skill.problemTopics.length
          ? { kind: 'practice', slug: skill.problemSet, topic: skill.problemTopics[0] }
          : { kind: 'test' },
      }));
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { STATES, LABELS, computeMastery, readiness, courseReadiness, nextStep, reviewList };
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

  async function studentEvidence(catalog) {
    const projects = read('stemplus:projects:v1', {});
    return {
      lessons: read('stemplus:lessons:v1', {}),
      results: read('stemplus:results:v1', []),
      problems: await problemEvidence(catalog),
      completedProjects: Object.keys(projects).filter((id) => projects[id] && projects[id].complete),
      diagnostics: read('stemplus:diagnostics:v1', {}),
      completedApplications: Object.keys(read('stemplus:applications:v1', {})),
    };
  }

  async function studentMastery() {
    const catalog = await loadCatalog();
    const evidence = await studentEvidence(catalog);
    return { catalog, evidence, mastery: computeMastery(catalog, evidence) };
  }

  // For the diagnostic page (assets/diagnostic.js) and the Learning Record
  // (assets/tests.js's mountLearningRecord).
  window.STEMPlusMastery = { STATES, LABELS, computeMastery, readiness, courseReadiness, studentEvidence, loadCatalog, courseHref };

  const chip = (state) => `<span class="mastery-chip" data-state="${state}">${LABELS[state]}</span>`;

  // Course page: a chip after each "Unit N: Title" heading.
  function mountCourseChips(catalog, mastery) {
    const page = decodeURIComponent(window.location.pathname).replace(/index\.html$/, '');
    const skills = catalog.skills.filter((skill) => courseFolder(skill) === page);
    document.querySelectorAll('details.unit-toc > summary').forEach((summary) => {
      const unit = summary.textContent.match(/^\s*(Unit \d+)/);
      const skill = unit && skills.find((s) => s.unit === unit[1]);
      if (!skill || summary.querySelector('.mastery-chip')) return;
      const state = mastery[skill.id].state;
      // Skip-by-mastery: passing the unit test marks the unit Mastered.
      const prove = rank(state) < rank('mastered')
        ? ` <a class="mastery-prove" href="${escapeHtml(encodePath(skill.testPage))}">Prove mastery →</a>`
        : '';
      summary.insertAdjacentHTML('beforeend', ` ${chip(state)}${prove}`);
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

  const where = (skill) => `${skill.course} · ${skill.unit}: ${skill.name}`;

  // Dashboard: the active track's readiness and its one next action.
  function mountNextStep(el, catalog, mastery, evidence) {
    const tests = window.STEMPlusTests;
    const track = tests && tests.resolveTrack(tests.loadActiveTrack());
    if (!track) {
      el.innerHTML = '<h2>Your Next Step</h2><p class="toc-empty">Pick a track in Continue Learning below, or <a href="diagnostic.html">take a diagnostic</a> to see where to start.</p>';
      return;
    }
    const ready = readiness(catalog, mastery, track);
    const step = nextStep(catalog, mastery, evidence, track.courses);
    let card;
    let prove = '';
    if (step.kind === 'lesson') {
      card = `<a class="toc-item" href="${escapeHtml(encodePath(step.lesson.page))}"><span class="toc-num">Next lesson</span>`
        + `<p class="toc-title">${escapeHtml(step.lesson.title)}</p><p class="toc-sub">${escapeHtml(where(step.skill))} — ${LABELS[mastery[step.skill.id].state]}</p></a>`;
      prove = `<p class="next-step-prove"><a href="${escapeHtml(encodePath(step.skill.testPage))}">Already know this? Prove mastery →</a></p>`;
    } else if (step.kind === 'test') {
      card = `<a class="toc-item" href="${escapeHtml(encodePath(step.skill.testPage))}"><span class="toc-num">Unit test</span>`
        + `<p class="toc-title">Take the ${escapeHtml(step.skill.unit)} test</p><p class="toc-sub">Pass at 80% to master ${escapeHtml(where(step.skill))}</p></a>`;
    } else if (track.projectId) {
      card = `<a class="toc-item" href="Projects/${encodeURIComponent(track.projectId)}.html"><span class="toc-num">Capstone</span>`
        + `<p class="toc-title">${escapeHtml(track.capstoneLabel)}</p><p class="toc-sub">Every unit on this track is mastered.</p></a>`;
    } else {
      card = '<p class="toc-empty">Every course on this plan is mastered.</p>';
    }
    el.innerHTML = '<h2>Your Next Step</h2>'
      + `<p class="next-step-track"><a href="${escapeHtml(track.href)}">${escapeHtml(track.label)}</a> · <strong>${ready.percent}% ready</strong> (${ready.ready} of ${ready.total} skills)</p>`
      + `<div class="toc-list">${card}</div>${prove}`;
  }

  // Dashboard: units started but not mastered, each with one review action.
  function mountReview(el, catalog, mastery) {
    const items = reviewList(catalog, mastery);
    if (!items.length) {
      el.innerHTML = '<h2>Review</h2><p class="toc-empty">Nothing to review — units you’ve started but not mastered show up here.</p>';
      return;
    }
    el.innerHTML = `<h2>Review</h2><div class="toc-list">${items.map(({ skill, action }) => {
      const practice = action.kind === 'practice';
      const href = practice
        ? `problem-set.html?course=${encodeURIComponent(action.slug)}&topic=${encodeURIComponent(action.topic)}`
        : encodePath(skill.testPage);
      const title = practice ? `Practice ${action.topic}` : `Retake the ${skill.unit} test`;
      return `<a class="toc-item" href="${escapeHtml(href)}"><span class="toc-num">${LABELS[mastery[skill.id].state]}</span>`
        + `<p class="toc-title">${escapeHtml(title)}</p><p class="toc-sub">${escapeHtml(where(skill))}</p></a>`;
    }).join('')}</div>`;
  }

  const APPLICATIONS_KEY = 'stemplus:applications:v1';

  // Application page: the concepts it uses (everyone) and, for signed-in
  // students, their mastery of each plus completion — both "Check your
  // understanding" questions answered correctly (quiz.js locks each
  // question after one answer).
  function mountApplication(el, catalog, mastery) {
    const slug = (decodeURIComponent(window.location.pathname).match(/\/Applications\/([^/]+)\.html$/) || [])[1];
    const application = (catalog.applications || []).find((a) => a.slug === slug);
    if (!application) return;
    const account = window.STEMPlusAccount;
    const skillById = new Map(catalog.skills.map((skill) => [skill.id, skill]));
    const rows = application.skills.map((id) => {
      const skill = skillById.get(id);
      const state = mastery && mastery[id].state;
      const mark = state ? `<span class="concept-mark" aria-hidden="true">${rank(state) >= rank('proficient') ? '✓' : '○'}</span>` : '';
      return `<li>${mark}<a href="${escapeHtml(encodePath(skill.lessons[0].page))}">${escapeHtml(where(skill))}</a>${state ? ` ${chip(state)}` : ''}</li>`;
    }).join('');
    const completed = () => !!read(APPLICATIONS_KEY, {})[slug];
    el.innerHTML = `<div class="box concepts-box"><span class="box-label">Concepts used</span><ul class="concept-list">${rows}</ul>`
      + '<p class="concept-status" data-application-status></p></div>';
    const status = el.querySelector('[data-application-status]');
    if (!mastery) {
      status.innerHTML = `<a href="${escapeHtml(account ? account.signInHref() : 'login.html')}">Sign in</a> to record completing this Application.`;
      return;
    }
    status.textContent = completed() ? 'Completed ✓' : 'Answer both questions below correctly to complete this Application.';
    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-quiz] .quiz-choice')) return;
      const quizzes = [...document.querySelectorAll('[data-quiz]')];
      if (!quizzes.every((quiz) => [...quiz.querySelectorAll('.quiz-choice')].every((choice) => choice.disabled))) return;
      if (quizzes.some((quiz) => quiz.querySelector('.is-incorrect'))) {
        if (!completed()) status.textContent = 'Not quite — reload the page to try both questions again.';
        return;
      }
      if (!completed() && account && account.canSave()) {
        try {
          window.localStorage.setItem(APPLICATIONS_KEY, JSON.stringify({ ...read(APPLICATIONS_KEY, {}), [slug]: new Date().toISOString() }));
        } catch (_) {
          // Completion just isn't remembered when storage is unavailable.
        }
      }
      status.textContent = 'Completed ✓';
    });
  }

  // Applications hub: a Completed chip on each finished Application.
  function mountHubChips(cards) {
    const done = read(APPLICATIONS_KEY, {});
    cards.forEach((card) => {
      const slug = (card.getAttribute('href').match(/Applications\/([^/]+)\.html$/) || [])[1];
      const title = card.querySelector('.toc-title');
      if (!done[slug] || !title || title.querySelector('.mastery-chip')) return;
      title.insertAdjacentHTML('beforeend', ' <span class="mastery-chip" data-state="applied">Completed</span>');
    });
  }

  function init() {
    const summary = document.querySelector('[data-mastery-summary]');
    const coursePage = document.querySelector('details.unit-toc');
    const nextEl = document.querySelector('[data-next-step]');
    const reviewEl = document.querySelector('[data-skill-review]');
    const applicationEl = document.querySelector('[data-application-concepts]');
    const hubCards = document.querySelectorAll('a.toc-item[href^="Applications/"]');
    const account = window.STEMPlusAccount;
    if (!account || (!summary && !coursePage && !nextEl && !reviewEl && !applicationEl && !hubCards.length)) return;
    account.ready.then((me) => {
      // Guests still see an Application's concepts, without mastery.
      if (!me) return applicationEl ? loadCatalog().then((catalog) => mountApplication(applicationEl, catalog, null)) : null;
      if (hubCards.length) mountHubChips(hubCards);
      if (!summary && !coursePage && !nextEl && !reviewEl && !applicationEl) return null;
      return studentMastery().then(({ catalog, evidence, mastery }) => {
        if (coursePage) mountCourseChips(catalog, mastery);
        if (summary) mountSummary(summary, catalog, mastery);
        if (reviewEl) mountReview(reviewEl, catalog, mastery);
        if (applicationEl) mountApplication(applicationEl, catalog, mastery);
        if (nextEl) {
          mountNextStep(nextEl, catalog, mastery, evidence);
          window.addEventListener('stemplus:track-change', () => mountNextStep(nextEl, catalog, mastery, evidence));
        }
      });
    }).catch((err) => console.error('Could not load skill mastery', err));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
