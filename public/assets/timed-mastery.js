// STEM+ Timed Mastery (timed-mastery.html?course=<slug>): a timed run of
// 1–20 random questions from a course's 500-question timedQuestions pool in
// problem-banks.js. Each question's time, plus a penalty per wrong try, is
// scored against a speed scale tuned by the student's own mastery in that
// course (tests.js masteryForProblemSet). Results stay in this browser.
(function () {
  'use strict';

  // Seconds: full credit at or under `fast`, zero at or over `slow`, linear
  // in between — before the personal benchmark factor below. Hand-tuned;
  // adjust here if real runs feel too strict or too lenient.
  const BASE_SCALES = {
    precalculus: { fast: 20, slow: 90 },
    'ap-calculus-bc': { fast: 30, slow: 120 },
  };
  const PENALTY_SECONDS = 5;
  const MAX_REPS = 20;
  const DEFAULT_REPS = 10;
  const STORAGE_KEY = 'stemplus:timed-mastery:v1';

  // 100% course mastery → 0.75× (stricter), 50% → 1×, 0% → 1.25× (more
  // lenient). No graded course work yet → the standard 1× scale.
  const benchmarkFactor = (mastery) => (mastery == null ? 1 : 1.25 - 0.5 * (mastery / 100));
  const questionScore = (seconds, fast, slow) => {
    if (seconds <= fast) return 100;
    if (seconds >= slow) return 0;
    return (slow - seconds) / (slow - fast) * 100;
  };
  const effectiveSeconds = (rawSeconds, wrongTries) => rawSeconds + wrongTries * PENALTY_SECONDS;
  const letterGrade = (pct) => (pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F');
  const clampReps = (value) => {
    const reps = Number.parseInt(value, 10);
    return Number.isFinite(reps) ? Math.min(MAX_REPS, Math.max(1, reps)) : DEFAULT_REPS;
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = { BASE_SCALES, PENALTY_SECONDS, MAX_REPS, benchmarkFactor, questionScore, effectiveSeconds, letterGrade, clampReps };
    return;
  }

  const mount = document.querySelector('[data-timed-mastery]');
  // The Next.js shell re-creates this script after load (and twice in dev's
  // Strict Mode) — the flag lives on the DOM node, not in this closure, so
  // a second execution can't bind a second set of listeners.
  if (!mount || mount.dataset.mounted) return;
  mount.dataset.mounted = '1';

  const slug = new URLSearchParams(window.location.search).get('course');
  const bankApi = window.STEMProblemBanks;
  const answerApi = window.STEMProblemAnswers;
  const course = bankApi && bankApi.getCourse(slug);
  const baseScale = course && BASE_SCALES[course.slug];
  const title = document.querySelector('[data-timed-title]');
  const subtitle = document.querySelector('[data-timed-subtitle]');

  if (!course || !course.timedQuestions || !baseScale || !answerApi) {
    if (subtitle) subtitle.textContent = '';
    mount.innerHTML = '<p class="toc-empty">Timed Mastery isn’t available for this course. <a href="problem-sets.html">Back to Problem Sets</a></p>';
    return;
  }

  const tests = window.STEMPlusTests;
  const mastery = tests && tests.masteryForProblemSet ? tests.masteryForProblemSet(course.slug) : null;
  const factor = benchmarkFactor(mastery);
  const fast = baseScale.fast * factor;
  const slow = baseScale.slow * factor;
  const seconds = (value) => `${Number(value.toFixed(1))}s`;
  const benchmarkLine = mastery == null
    ? `No graded ${course.title} unit tests or exams in this browser yet, so you’re on the standard scale: full credit at or under ${seconds(fast)}, zero at ${seconds(slow)}.`
    : `Tuned to your ${mastery}% ${course.title} mastery: full credit at or under ${seconds(fast)}, zero at ${seconds(slow)}.`;

  document.title = `${course.title} Timed Mastery — STEM+`;
  document.querySelector('.page').dataset.tier = course.tier;
  if (title) title.textContent = `${course.title} Timed Mastery`;
  if (subtitle) subtitle.textContent = `${course.timedQuestions.length} questions · answer each one correctly, as fast as you can.`;

  const loadHistory = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_) {
      return {};
    }
  };
  const saveRun = (record) => {
    const history = loadHistory();
    const previous = history[course.slug] || {};
    history[course.slug] = {
      best: previous.best && previous.best.pct >= record.pct ? previous.best : record,
      last: record,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      return true;
    } catch (_) {
      return false;
    }
  };
  const pickRandom = (items, count) => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  };
  const recordText = (record) => `${record.grade} (${record.pct}%) over ${record.reps} rep${record.reps === 1 ? '' : 's'}`;

  let deck = [];
  let results = [];
  let clockTimer = null;

  const stopClock = () => {
    if (clockTimer) window.clearInterval(clockTimer);
    clockTimer = null;
  };

  const renderStart = () => {
    stopClock();
    const saved = loadHistory()[course.slug];
    mount.innerHTML = `
      <div class="box why"><span class="box-label">Your benchmark</span>
        <p data-timed-benchmark></p>
        <p>Each wrong try adds ${PENALTY_SECONDS}s. A: 90%+ · B: 80%+ · C: 70%+ · D: 60%+.</p>
      </div>
      <p class="problem-stats" data-timed-history></p>
      <div class="problem-toolbar">
        <label for="timed-reps">Reps (1–${MAX_REPS})</label>
        <input type="number" id="timed-reps" class="quiz-fill-input" data-timed-reps min="1" max="${MAX_REPS}" value="${DEFAULT_REPS}">
        <button type="button" class="widget-btn" data-timed-start>Start</button>
      </div>`;
    mount.querySelector('[data-timed-benchmark]').textContent = benchmarkLine;
    mount.querySelector('[data-timed-history]').textContent = saved && saved.best && saved.last
      ? `Personal best: ${recordText(saved.best)} · Last run: ${recordText(saved.last)}`
      : 'No runs yet in this browser.';
    mount.querySelector('[data-timed-start]').addEventListener('click', () => {
      deck = pickRandom(course.timedQuestions, clampReps(mount.querySelector('[data-timed-reps]').value));
      results = [];
      renderQuestion();
    });
  };

  const renderQuestion = () => {
    const current = deck[results.length];
    let wrongTries = 0;
    let solved = false;
    mount.innerHTML = `
      <div class="quiz problem-card">
        <div class="problem-meta"><span>Question ${results.length + 1} of ${deck.length}</span><span data-timed-topic></span></div>
        <p class="problem-stats" data-timed-clock></p>
        <p class="quiz-prompt problem-prompt" data-timed-prompt></p>
        <div class="quiz-choices" data-timed-choices hidden></div>
        <div class="quiz-fill-row" data-timed-fill hidden>
          <label class="sr-only" for="timed-answer">Your answer</label>
          <input class="quiz-fill-input" id="timed-answer" data-timed-input inputmode="decimal" autocomplete="off" placeholder="Enter number, fraction, or percent">
          <button type="button" class="quiz-fill-check" data-timed-check>Check answer</button>
        </div>
        <p class="quiz-feedback" data-timed-feedback aria-live="polite" hidden></p>
        <p class="quiz-explain" data-timed-explanation hidden></p>
        <button type="button" class="widget-btn problem-next" data-timed-next hidden></button>
      </div>`;
    const clock = mount.querySelector('[data-timed-clock]');
    const choices = mount.querySelector('[data-timed-choices]');
    const fillRow = mount.querySelector('[data-timed-fill]');
    const input = mount.querySelector('[data-timed-input]');
    const checkButton = mount.querySelector('[data-timed-check]');
    const feedback = mount.querySelector('[data-timed-feedback]');
    const explanation = mount.querySelector('[data-timed-explanation]');
    const nextButton = mount.querySelector('[data-timed-next]');
    mount.querySelector('[data-timed-topic]').textContent = current.topic;
    mount.querySelector('[data-timed-prompt]').textContent = current.prompt;

    const startedAt = performance.now();
    const elapsed = () => (performance.now() - startedAt) / 1000;
    const tick = () => {
      clock.textContent = `${elapsed().toFixed(1)}s${wrongTries ? ` + ${wrongTries * PENALTY_SECONDS}s penalty` : ''}`;
    };
    tick();
    stopClock();
    clockTimer = window.setInterval(tick, 100);

    const showFeedback = (text, isCorrect) => {
      feedback.textContent = text;
      feedback.className = `quiz-feedback ${isCorrect ? 'is-correct' : 'is-incorrect'}`;
      feedback.hidden = false;
    };
    const markWrong = () => {
      wrongTries += 1;
      tick();
      showFeedback(`Not quite — +${PENALTY_SECONDS}s. Try again.`, false);
    };
    const markCorrect = () => {
      solved = true;
      stopClock();
      const raw = elapsed();
      const effective = effectiveSeconds(raw, wrongTries);
      const score = questionScore(effective, fast, slow);
      results.push({ topic: current.topic, raw, wrongTries, effective, score });
      clock.textContent = seconds(effective);
      input.disabled = true;
      checkButton.disabled = true;
      choices.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      showFeedback(`Correct · ${seconds(effective)}${wrongTries ? ` (${seconds(raw)} + ${wrongTries * PENALTY_SECONDS}s penalty)` : ''} · ${Math.round(score)}%`, true);
      explanation.textContent = current.explanation;
      explanation.hidden = false;
      nextButton.textContent = results.length === deck.length ? 'See results' : 'Next question';
      nextButton.hidden = false;
      nextButton.focus();
    };
    const checkFill = () => {
      if (solved) return;
      const value = answerApi.parseNumber(input.value);
      if (!Number.isFinite(value)) {
        showFeedback('Enter a number, fraction, or percent.', false);
        return;
      }
      if (answerApi.answersClose(value, current.answer, current.tolerance)) markCorrect();
      else {
        markWrong();
        input.select();
      }
    };

    if (current.type === 'choice') {
      choices.hidden = false;
      pickRandom(current.choices, current.choices.length).forEach((answer) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quiz-choice';
        button.textContent = answer;
        button.addEventListener('click', () => {
          if (solved) return;
          if (answer === current.answer) {
            button.classList.add('is-correct');
            markCorrect();
          } else {
            button.disabled = true;
            button.classList.add('is-incorrect');
            markWrong();
          }
        });
        choices.appendChild(button);
      });
    } else {
      fillRow.hidden = false;
      checkButton.addEventListener('click', checkFill);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') checkFill();
      });
      window.setTimeout(() => input.focus(), 0);
    }
    nextButton.addEventListener('click', () => {
      if (results.length === deck.length) renderResults();
      else renderQuestion();
    });
  };

  const renderResults = () => {
    stopClock();
    const pct = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
    const grade = letterGrade(pct);
    const saved = saveRun({ pct, grade, reps: results.length, factor: Number(factor.toFixed(3)), at: new Date().toISOString() });
    const rows = results.map((r, i) => `<tr><td>${i + 1}</td><td>${r.topic}</td><td>${seconds(r.raw)}</td><td>${r.wrongTries}</td><td>${seconds(r.effective)}</td><td>${Math.round(r.score)}%</td></tr>`).join('');
    mount.innerHTML = `
      <div class="box why" data-timed-result><span class="box-label">Result</span>
        <p class="test-result-score">${grade} · ${pct}%</p>
        <p data-timed-benchmark></p>
        ${saved ? '' : '<p class="test-result-note test-result-error">This browser couldn’t save this result.</p>'}
      </div>
      <table>
        <thead><tr><th>#</th><th>Topic</th><th>Time</th><th>Wrong tries</th><th>With penalty</th><th>Score</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="nav-links"><button type="button" class="widget-btn" data-timed-again>Run again</button></p>`;
    mount.querySelector('[data-timed-benchmark]').textContent = benchmarkLine;
    mount.querySelector('[data-timed-again]').addEventListener('click', renderStart);
  };

  renderStart();
}());
