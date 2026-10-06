// Pathway diagnostic (revision Phase 2b, content/diagnostic.html): a short
// test built from the Problem Set questions of a Pathway's skills. Results
// show readiness and raise unit mastery up to Proficient (mastery.js).
(function () {
  'use strict';

  const MAX_QUESTIONS = 30;
  const TWO_PER_SKILL_UP_TO = 15;

  // Skills the diagnostic can test: the Pathway's units that have Problem
  // Set questions, in Pathway course order, then unit order.
  const testableSkills = (catalog, pathway) => pathway.courses.flatMap((course) => (
    catalog.skills.filter((skill) => skill.course === course && skill.problemTopics.length)
  ));

  const pick = (items, count, random) => {
    const copy = items.slice();
    for (let i = 0; i < count && i < copy.length; i += 1) {
      const j = i + Math.floor(random() * (copy.length - i));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  };

  // 2 questions per skill for small Pathways, 1 for larger ones, at most 30.
  const questionCount = (testable) => (testable > MAX_QUESTIONS ? MAX_QUESTIONS : testable <= TWO_PER_SKILL_UP_TO ? testable * 2 : testable);

  function buildDiagnostic(catalog, pathway, banks, random = Math.random) {
    let skills = testableSkills(catalog, pathway);
    if (skills.length > MAX_QUESTIONS) {
      skills = Array.from({ length: MAX_QUESTIONS }, (_, i) => skills[Math.floor(i * skills.length / MAX_QUESTIONS)]);
    }
    const perSkill = skills.length <= TWO_PER_SKILL_UP_TO ? 2 : 1;
    return skills.flatMap((skill) => {
      const pool = banks.getCourse(skill.problemSet).questions.filter((question) => skill.problemTopics.includes(question.topic));
      return pick(pool, perSkill, random).map((question) => ({ skillId: skill.id, question }));
    });
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { buildDiagnostic, testableSkills, questionCount };
    return;
  }

  const mount = document.querySelector('[data-diagnostic]');
  if (!mount || mount.dataset.mounted) return;
  mount.dataset.mounted = '1';

  const STORAGE_KEY = 'stemplus:diagnostics:v1';
  const masteryApi = window.STEMPlusMastery;
  const answerApi = window.STEMProblemAnswers;
  const account = window.STEMPlusAccount;
  const title = document.querySelector('[data-diagnostic-title]');
  const subtitle = document.querySelector('[data-diagnostic-subtitle]');
  const slug = new URLSearchParams(window.location.search).get('pathway');

  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const loadSaved = () => {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_) {
      return {};
    }
  };
  // Like every save point, only signed-in students keep their attempt.
  const saveAttempt = (attempt) => {
    if (account && !account.canSave()) return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSaved(), [slug]: attempt }));
      return true;
    } catch (_) {
      return false;
    }
  };
  const pathwaySkills = (catalog, pathway) => pathway.courses.flatMap((course) => catalog.skills.filter((skill) => skill.course === course));

  function renderPicker(catalog) {
    mount.innerHTML = `<div class="toc-list">${catalog.pathways.map((pathway) => {
      const testable = testableSkills(catalog, pathway).length;
      return `<a class="toc-item" href="diagnostic.html?pathway=${encodeURIComponent(pathway.slug)}"><span class="toc-num">${questionCount(testable)} questions</span>`
        + `<p class="toc-title">${escapeHtml(pathway.name)}</p><p class="toc-sub">Tests ${testable} of its ${pathwaySkills(catalog, pathway).length} skills</p></a>`;
    }).join('')}</div>`;
  }

  function renderIntro(catalog, pathway) {
    const testable = testableSkills(catalog, pathway);
    const courses = [...new Set(testable.map((skill) => skill.course))];
    mount.innerHTML = `<div class="widget"><p class="widget-label">${questionCount(testable.length)} questions</p>`
      + `<p>Covers ${testable.length} of the Pathway's ${pathwaySkills(catalog, pathway).length} skills, from ${escapeHtml(courses.join(', '))}. `
      + 'Answer what you can and choose “I don’t know” instead of guessing. You see your results at the end.</p>'
      + '<button type="button" class="widget-btn" data-diagnostic-start>Start the diagnostic</button></div>';
    mount.querySelector('[data-diagnostic-start]').addEventListener('click', () => run(catalog, pathway));
  }

  function run(catalog, pathway) {
    const items = buildDiagnostic(catalog, pathway, window.STEMProblemBanks);
    const skillById = new Map(catalog.skills.map((skill) => [skill.id, skill]));
    const answers = [];
    const show = () => {
      if (answers.length === items.length) {
        const attempt = { takenAt: new Date().toISOString(), answers };
        window.STEMPlusReportQuestion = undefined;
        renderResults(catalog, pathway, attempt, saveAttempt(attempt) ? 'saved' : 'guest');
        return;
      }
      const { skillId, question } = items[answers.length];
      window.STEMPlusReportQuestion = question.id;
      mount.innerHTML = `<div class="quiz problem-card">
        <div class="problem-meta"><span>Question ${answers.length + 1} of ${items.length}</span><span data-diagnostic-course></span></div>
        <p class="quiz-prompt problem-prompt" data-diagnostic-prompt></p>
        <div class="quiz-choices" data-diagnostic-choices hidden></div>
        <div class="quiz-fill-row" data-diagnostic-fill hidden>
          <label class="sr-only" for="diagnostic-answer">Your answer</label>
          <input class="quiz-fill-input" id="diagnostic-answer" data-diagnostic-input inputmode="decimal" autocomplete="off" placeholder="Enter number, fraction, or percent">
          <button type="button" class="quiz-fill-check" data-diagnostic-check>Submit answer</button>
        </div>
        <p class="quiz-feedback is-incorrect" data-diagnostic-warning hidden></p>
        <button type="button" class="problem-report" data-diagnostic-skip>I don’t know</button>
      </div>`;
      mount.querySelector('[data-diagnostic-course]').textContent = skillById.get(skillId).course;
      mount.querySelector('[data-diagnostic-prompt]').textContent = question.prompt;
      const record = (correct) => {
        answers.push({ skillId, questionId: question.id, correct });
        show();
      };
      mount.querySelector('[data-diagnostic-skip]').addEventListener('click', () => record(false));
      if (question.type === 'choice') {
        const choices = mount.querySelector('[data-diagnostic-choices]');
        choices.hidden = false;
        pick(question.choices, question.choices.length, Math.random).forEach((choice) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'quiz-choice';
          button.textContent = choice;
          button.addEventListener('click', () => record(choice === question.answer));
          choices.appendChild(button);
        });
      } else {
        const fill = mount.querySelector('[data-diagnostic-fill]');
        const input = mount.querySelector('[data-diagnostic-input]');
        const warning = mount.querySelector('[data-diagnostic-warning]');
        fill.hidden = false;
        const submit = () => {
          const value = answerApi.parseNumber(input.value);
          if (!Number.isFinite(value)) {
            warning.textContent = 'Enter a number, fraction, or percent — or choose “I don’t know”.';
            warning.hidden = false;
            return;
          }
          record(answerApi.answersClose(value, question.answer, question.tolerance));
        };
        mount.querySelector('[data-diagnostic-check]').addEventListener('click', submit);
        input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
        window.setTimeout(() => input.focus(), 0);
      }
    };
    show();
  }

  // status: 'saved' (just saved), 'guest' (not saved), or 'stored' (an
  // earlier saved attempt, shown when the page opens).
  async function renderResults(catalog, pathway, attempt, status) {
    const evidence = await masteryApi.studentEvidence(catalog);
    evidence.diagnostics = { ...evidence.diagnostics, [pathway.slug]: attempt };
    const mastery = masteryApi.computeMastery(catalog, evidence);
    const ready = masteryApi.readiness(catalog, mastery, pathway);
    const tested = new Set(attempt.answers.map((answer) => answer.skillId)).size;
    const skillCourse = new Map(catalog.skills.map((skill) => [skill.id, skill.course]));

    const bars = pathway.courses.map((course) => {
      const asked = attempt.answers.filter((answer) => skillCourse.get(answer.skillId) === course);
      if (!asked.length) return '';
      const correct = asked.filter((answer) => answer.correct).length;
      return `<div class="diag-bar"><span class="diag-course">${escapeHtml(course)}</span>`
        + `<span class="diag-track"><span class="diag-fill" style="width:${Math.round(correct * 100 / asked.length)}%"></span></span>`
        + `<span class="diag-score">${correct}/${asked.length}</span></div>`;
    }).join('');

    const next = pathwaySkills(catalog, pathway)
      .find((skill) => masteryApi.STATES.indexOf(mastery[skill.id].state) < masteryApi.STATES.indexOf('proficient'));
    const startHere = next
      ? `<a class="toc-item" href="${escapeHtml(masteryApi.courseHref(next))}"><span class="toc-num">Start here</span><p class="toc-title">${escapeHtml(next.course)} · ${escapeHtml(next.unit)}</p><p class="toc-sub">${escapeHtml(next.name)} — ${masteryApi.LABELS[mastery[next.id].state]}</p></a>`
      : `<a class="toc-item" href="Projects/${encodeURIComponent(pathway.slug)}-capstone.html"><span class="toc-num">Ready</span><p class="toc-title">You're ready for the ${escapeHtml(pathway.name)} capstone</p><p class="toc-sub">Every skill on this Pathway is at Proficient or above.</p></a>`;

    const note = {
      saved: 'Saved. Your course pages and Dashboard now include these results.',
      stored: `Taken ${escapeHtml(new Date(attempt.takenAt).toLocaleDateString())}.`,
      guest: `This attempt wasn’t saved. <a href="${account ? escapeHtml(account.signInHref()) : 'login.html'}">Sign in</a> to save these results.`,
    }[status];

    mount.innerHTML = `<div class="widget diag-result">
        <p class="diag-readiness"><strong>${ready.percent}%</strong> ready</p>
        <p>${ready.ready} of ${ready.total} ${escapeHtml(pathway.name)} skills are at Proficient or above. This diagnostic tested ${tested} of them; unit tests cover the rest.</p>
        <p class="${status === 'guest' ? 'signin-prompt' : 'widget-label'}">${note}</p>
      </div>
      <h2>By course</h2><div class="diag-bars">${bars}</div>
      <h2>Next step</h2><div class="toc-list">${startHere}</div>
      <p class="nav-links"><button type="button" class="widget-btn" data-diagnostic-retake>Retake the diagnostic</button> <a class="nav-toc" href="Pathways/${encodeURIComponent(pathway.slug)}.html">${escapeHtml(pathway.name)} Pathway →</a></p>`;
    mount.querySelector('[data-diagnostic-retake]').addEventListener('click', () => renderIntro(catalog, pathway));
  }

  function init() {
    masteryApi.loadCatalog().then((catalog) => {
      const pathway = catalog.pathways.find((p) => p.slug === slug);
      if (!pathway) {
        renderPicker(catalog);
        return;
      }
      title.textContent = `${pathway.name} Diagnostic`;
      document.title = `${pathway.name} Diagnostic — STEM+`;
      subtitle.textContent = 'See how ready you are for this Pathway and where to start.';
      const saved = loadSaved()[pathway.slug];
      if (saved) renderResults(catalog, pathway, saved, 'stored');
      else renderIntro(catalog, pathway);
    }).catch((err) => {
      mount.innerHTML = '<p class="toc-empty">The diagnostic couldn’t load. Refresh to try again.</p>';
      console.error(err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
