// STEM+ unit test / course exam / progress report engine. Parallel to quiz.js,
// but scores a whole page of questions at once (Submit Test) instead of giving
// instant per-question feedback, and saves each attempt to this browser's
// localStorage so unit clears can gate the course exam and feed the progress
// report. Everything lives in this one browser — there is no server and no
// account, so progress does not follow the learner across devices.
//
// Markup contracts:
//   Test page:  <div data-test data-course="…" data-unit="…" data-kind="unit_test|course_exam" data-version="A|B">
//                 <div class="quiz" data-test-item data-topic="…"> … .quiz-choice[data-correct] … </div>
//                 <div class="quiz" data-test-item data-test-fill data-topic="…" data-answers="a|b|c"> … .quiz-fill-input … </div>
//                 <p data-test-warning hidden></p>
//                 <button data-test-submit>Submit Test</button>
//                 <div data-test-result hidden></div>
//               </div>
//   A question worth 1 point can instead be split into multiple parts (partial credit —
//   missing one part costs a fraction of a point, not the whole point):
//     <div class="quiz" data-test-item data-topic="…">
//       <p class="quiz-prompt">6. Given f(x) = 2x − 3, answer both parts:</p>
//       <div class="quiz-part" data-part> … .quiz-choice[data-correct] … </div>
//       <div class="quiz-part" data-part data-answers="a|b|c"> … .quiz-fill-input … </div>
//       <p class="quiz-feedback" hidden></p><p class="quiz-explain" hidden>…</p>
//     </div>
//   A [data-part] is fill-type if it carries data-answers, otherwise multiple-choice —
//   same rule `data-test-fill`/`data-answers` follow at the item level for single-part questions.
//   Course exam gate: <div data-exam-gate data-course="…" data-required-units="Unit 1|Unit 2|…">
//                        <div data-exam-locked hidden></div>
//                        <div data-test …>…</div>   (hidden until unlocked)
//                      </div>
//   Progress report:  <div data-report data-course="…" data-required-units="Unit 1|Unit 2|…">
//                        <div data-report-body></div>
//                        <button data-report-print>Print Report</button>
//                      </div>
//   Project gate (Projects/*.html): locked until every listed course's exam has been passed —
//   same "course exam, not just units" standard as the course-exam gate above, generalized
//   across courses instead of across units within one course.
//     <div data-project-gate data-required-courses="Course A|Course B|…">
//       <div data-project-locked hidden></div>
//       <div data-project-content hidden> … the brief + <div data-reflection> below … </div>
//     </div>
//   Project status badge (hub/pathway listings) — read-only, never hides anything, just
//   reports this browser's progress toward a project so it can be judged "separately":
//     <span data-project-status data-required-courses="Course A|Course B|…"></span>
//   Single-course badge (pathway listings, one per course in the route):
//     <span data-course-status="Course A"></span>
//   Reflection (project pages) — open-ended answers, saved to this browser's localStorage,
//   independent of the pass/fail scoring in mountTest above:
//     <div data-reflection data-project="unique-project-id">
//       <div data-reflection-item data-key="q1">
//         <p class="reflection-prompt">…</p>
//         <textarea class="reflection-textarea" data-reflection-input></textarea>
//       </div>
//       <div class="reflection-actions">
//         <button data-reflection-save class="widget-btn">Save Reflection</button>
//         <label><input type="checkbox" data-reflection-complete> Mark project complete</label>
//         <span data-reflection-status class="reflection-status"></span>
//       </div>
//     </div>
window.STEMPlusTests = (function () {
  var PASS_THRESHOLD = 0.9;
  var WEAK_TOPIC_THRESHOLD = 0.7;
  var STORAGE_KEY = 'stemplus:results:v1';
  var PROJECTS_STORAGE_KEY = 'stemplus:projects:v1';

  function normalize(s) {
    return s.trim().toLowerCase();
  }

  function loadResults() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Could not read saved progress', err);
      return [];
    }
  }

  function saveResults(results) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
      return true;
    } catch (err) {
      console.error('Could not save progress', err);
      return false;
    }
  }

  function recordAttempt({ course, unit, kind, version, answers }) {
    const total = answers.length;
    const score = answers.reduce((sum, a) => sum + a.correct, 0);
    const passed = score / total >= PASS_THRESHOLD;
    const results = loadResults();
    results.push({
      course, unit, kind, version: version || null,
      score, total, passed,
      topicBreakdown: answers,
      takenAt: new Date().toISOString(),
    });
    const saved = saveResults(results);
    return { score, total, passed, saved };
  }

  function getResultsForCourse(course) {
    return loadResults().filter((r) => r.course === course);
  }

  function summarizeUnits(rows) {
    const units = {};
    rows.forEach((row) => {
      if (row.kind !== 'unit_test') return;
      if (!units[row.unit]) units[row.unit] = { cleared: false, attempts: [] };
      const attempt = { version: row.version, score: row.score, total: row.total, passed: row.passed, takenAt: row.takenAt };
      units[row.unit].attempts.push(attempt);
      if (row.passed) {
        units[row.unit].cleared = true;
        units[row.unit].clearedBy = attempt;
      }
    });
    return units;
  }

  function summarizeCourseExam(rows) {
    const attempts = rows
      .filter((row) => row.kind === 'course_exam')
      .map((row) => ({ score: row.score, total: row.total, passed: row.passed, takenAt: row.takenAt }));
    return { attempts, passed: attempts.some((a) => a.passed) };
  }

  function buildReport(course) {
    const rows = getResultsForCourse(course);
    const units = summarizeUnits(rows);
    const courseExam = summarizeCourseExam(rows);

    const topicTallies = {};
    rows.forEach((row) => {
      (row.topicBreakdown || []).forEach((answer) => {
        if (!topicTallies[answer.topic]) topicTallies[answer.topic] = { correct: 0, total: 0 };
        topicTallies[answer.topic].total += 1;
        topicTallies[answer.topic].correct += answer.correct;
      });
    });
    const topics = Object.entries(topicTallies).map(([topic, tally]) => {
      const accuracy = tally.correct / tally.total;
      return { topic, correct: tally.correct, total: tally.total, accuracy, status: accuracy >= WEAK_TOPIC_THRESHOLD ? 'strong' : 'weak' };
    });
    topics.sort((a, b) => a.accuracy - b.accuracy);

    return { units, courseExam, topics };
  }

  function isCourseExamPassed(course) {
    return summarizeCourseExam(getResultsForCourse(course)).passed;
  }

  function requiredCoursesStatus(courses) {
    return courses.map((course) => ({ course, passed: isCourseExamPassed(course) }));
  }

  function loadProjectData() {
    try {
      var raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.error('Could not read saved project progress', err);
      return {};
    }
  }

  function saveProjectData(data) {
    try {
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('Could not save project progress', err);
      return false;
    }
  }

  function isProjectComplete(projectId) {
    var data = loadProjectData();
    return !!(data[projectId] && data[projectId].complete);
  }

  function mountProjectGate(gate) {
    const required = (gate.getAttribute('data-required-courses') || '').split('|').filter(Boolean);
    const locked = gate.querySelector('[data-project-locked]');
    const content = gate.querySelector('[data-project-content]');
    const statuses = requiredCoursesStatus(required);
    const missing = statuses.filter((s) => !s.passed);

    if (missing.length > 0) {
      if (locked) {
        let html = '<p class="box-label">Project locked</p>';
        html += '<p>This project draws on every course below — pass each course exam (not just the unit tests) before it unlocks:</p><ul>';
        statuses.forEach((s) => {
          html += '<li>' + (s.passed ? '✓ ' : '— ') + s.course + (s.passed ? ' — passed' : ' — not yet') + '</li>';
        });
        html += '</ul>';
        locked.innerHTML = html;
        locked.hidden = false;
      }
      if (content) content.hidden = true;
      return;
    }

    if (locked) locked.hidden = true;
    if (content) content.hidden = false;
  }

  function mountCourseStatus(el) {
    const course = el.getAttribute('data-course-status');
    const passed = isCourseExamPassed(course);
    el.classList.add('lock-badge');
    el.classList.remove('is-locked', 'is-unlocked');
    el.classList.add(passed ? 'is-unlocked' : 'is-locked');
    el.textContent = passed ? 'Course exam passed' : 'Course exam not yet passed';
  }

  function mountProjectStatus(el) {
    const required = (el.getAttribute('data-required-courses') || '').split('|').filter(Boolean);
    const statuses = requiredCoursesStatus(required);
    const passedCount = statuses.filter((s) => s.passed).length;
    const unlocked = passedCount === statuses.length;
    el.classList.add('lock-badge');
    el.classList.remove('is-locked', 'is-unlocked');
    el.classList.add(unlocked ? 'is-unlocked' : 'is-locked');
    el.textContent = unlocked ? 'Unlocked' : 'Locked · ' + passedCount + '/' + statuses.length + ' courses passed';
  }

  function mountReflection(container) {
    if (!container) return;
    const projectId = container.getAttribute('data-reflection');
    const items = Array.from(container.querySelectorAll('[data-reflection-item]'));
    const completeBox = container.querySelector('[data-reflection-complete]');
    const status = container.querySelector('[data-reflection-status]');
    const saveBtn = container.querySelector('[data-reflection-save]');

    const saved = loadProjectData()[projectId];
    if (saved) {
      items.forEach((item) => {
        const key = item.getAttribute('data-key');
        const textarea = item.querySelector('[data-reflection-input]');
        if (textarea && saved.answers && saved.answers[key] != null) textarea.value = saved.answers[key];
      });
      if (completeBox) completeBox.checked = !!saved.complete;
      if (status && saved.savedAt) {
        status.textContent = 'Last saved ' + new Date(saved.savedAt).toLocaleString() + (saved.complete ? ' — marked complete.' : '.');
        status.classList.add('is-saved');
      }
    }

    if (!saveBtn) return;
    saveBtn.addEventListener('click', () => {
      const answers = {};
      items.forEach((item) => {
        const key = item.getAttribute('data-key');
        const textarea = item.querySelector('[data-reflection-input]');
        answers[key] = textarea ? textarea.value : '';
      });
      const complete = completeBox ? completeBox.checked : false;
      const data = loadProjectData();
      data[projectId] = { answers, complete, savedAt: new Date().toISOString() };
      const ok = saveProjectData(data);
      if (status) {
        status.classList.remove('is-saved');
        if (ok) {
          status.textContent = 'Saved just now' + (complete ? ' — marked complete.' : '.');
          status.classList.add('is-saved');
        } else {
          status.textContent = 'This browser could not save your reflection (storage may be disabled or full).';
        }
      }
    });
  }

  function isSubAnswered(el) {
    if (el.hasAttribute('data-answers') || el.hasAttribute('data-test-fill')) {
      const input = el.querySelector('.quiz-fill-input');
      return input && input.value.trim() !== '';
    }
    return !!el.querySelector('.quiz-choice.is-selected');
  }

  function gradeSub(el) {
    if (el.hasAttribute('data-answers') || el.hasAttribute('data-test-fill')) {
      const input = el.querySelector('.quiz-fill-input');
      const answers = (el.getAttribute('data-answers') || '').split('|').map(normalize).filter(Boolean);
      return answers.includes(normalize(input ? input.value : ''));
    }
    const selected = el.querySelector('.quiz-choice.is-selected');
    return !!selected && selected.getAttribute('data-correct') === 'true';
  }

  function revealSub(el) {
    if (el.hasAttribute('data-answers') || el.hasAttribute('data-test-fill')) {
      const input = el.querySelector('.quiz-fill-input');
      if (input) input.disabled = true;
    } else {
      const choices = Array.from(el.querySelectorAll('.quiz-choice'));
      choices.forEach((choice) => {
        choice.disabled = true;
        if (choice.getAttribute('data-correct') === 'true') choice.classList.add('is-correct');
        else if (choice.classList.contains('is-selected')) choice.classList.add('is-incorrect');
      });
    }
  }

  function isAnswered(item) {
    const parts = item.querySelectorAll('[data-part]');
    if (parts.length > 0) return Array.from(parts).every(isSubAnswered);
    return isSubAnswered(item);
  }

  // Returns a fraction 0..1 of the question's single point earned — 0 or 1 for an
  // ordinary question, or a fraction like 0.5 for a multi-part question where only
  // some parts were correct (real partial credit, not all-or-nothing).
  function gradeItem(item) {
    const parts = item.querySelectorAll('[data-part]');
    if (parts.length > 0) {
      const partArray = Array.from(parts);
      return partArray.filter(gradeSub).length / partArray.length;
    }
    return gradeSub(item) ? 1 : 0;
  }

  function revealItem(item, fraction) {
    const parts = item.querySelectorAll('[data-part]');
    if (parts.length > 0) Array.from(parts).forEach(revealSub);
    else revealSub(item);

    const feedback = item.querySelector('.quiz-feedback');
    const explain = item.querySelector('.quiz-explain');
    if (feedback) {
      feedback.classList.remove('is-correct', 'is-incorrect', 'is-partial');
      if (fraction >= 1) {
        feedback.textContent = 'Correct.';
        feedback.classList.add('is-correct');
      } else if (fraction <= 0) {
        feedback.textContent = 'Not quite.';
        feedback.classList.add('is-incorrect');
      } else {
        feedback.textContent = 'Partially correct (' + Math.round(fraction * 100) + '%).';
        feedback.classList.add('is-partial');
      }
      feedback.hidden = false;
    }
    if (explain) explain.hidden = false;
  }

  function shuffleChoices(container) {
    container.querySelectorAll('.quiz-choices').forEach((choicesEl) => {
      const items = Array.from(choicesEl.children);
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      items.forEach((item) => choicesEl.appendChild(item));
    });
  }

  function wireSelection(container) {
    container.querySelectorAll('[data-test-item]:not([data-test-fill]) .quiz-choice').forEach((choice) => {
      choice.addEventListener('click', () => {
        const siblings = choice.closest('.quiz-choices').querySelectorAll('.quiz-choice');
        siblings.forEach((c) => c.classList.remove('is-selected'));
        choice.classList.add('is-selected');
      });
    });
  }

  function otherVersionHref(version) {
    if (version === 'A') return location.href.replace('unit-test-a.html', 'unit-test-b.html');
    if (version === 'B') return location.href.replace('unit-test-b.html', 'unit-test-a.html');
    return null;
  }

  function renderResult(container, { score, total, passed, version, kind, saved }) {
    const result = container.querySelector('[data-test-result]');
    if (!result) return;
    const pct = Math.round((score / total) * 100);
    result.classList.remove('is-pass', 'is-fail');
    result.classList.add(passed ? 'is-pass' : 'is-fail');

    let html = '<p class="test-result-score">' + score + ' / ' + total + ' (' + pct + '%) — ' +
      (passed ? 'Passed' : 'Not yet — 90% is required to pass') + '</p>';

    if (kind === 'unit_test') {
      if (passed) {
        html += '<p class="test-result-note">This unit is cleared. <a href="../index.html" class="nav-toc">Back to course contents</a></p>';
      } else {
        const retry = otherVersionHref(version);
        html += '<p class="test-result-note">Review the questions above, then ' +
          (retry ? '<a href="' + retry + '">try the other version of this test</a>' : 'try again') + '.</p>';
      }
    } else {
      html += '<p class="test-result-note">' + (passed
        ? 'Course exam passed — congratulations.'
        : 'Review your weak topics on the <a href="progress-report.html">progress report</a>, then retake the exam.') + '</p>';
    }
    if (saved === false) html += '<p class="test-result-note test-result-error">This browser could not save your result (storage may be disabled or full), so this attempt may not be remembered next time.</p>';

    result.innerHTML = html;
    result.hidden = false;
  }

  function mountTest(container) {
    shuffleChoices(container);
    wireSelection(container);
    const submit = container.querySelector('[data-test-submit]');
    const warning = container.querySelector('[data-test-warning]');
    if (!submit) return;

    submit.addEventListener('click', () => {
      const items = Array.from(container.querySelectorAll('[data-test-item]'));
      const unanswered = items.filter((item) => !isAnswered(item));
      if (unanswered.length > 0) {
        if (warning) {
          warning.textContent = 'Answer all questions before submitting (' + unanswered.length + ' remaining).';
          warning.hidden = false;
        }
        return;
      }
      if (warning) warning.hidden = true;
      submit.disabled = true;

      const answers = items.map((item) => {
        const correct = gradeItem(item);
        revealItem(item, correct);
        return { topic: item.getAttribute('data-topic') || container.getAttribute('data-unit') || 'General', correct };
      });

      const course = container.getAttribute('data-course');
      const unit = container.getAttribute('data-unit');
      const kind = container.getAttribute('data-kind');
      const version = container.getAttribute('data-version');

      const result = recordAttempt({ course, unit, kind, version, answers });
      renderResult(container, { ...result, version, kind });
    });
  }

  function mountCourseExamGate(gate) {
    const course = gate.getAttribute('data-course');
    const required = (gate.getAttribute('data-required-units') || '').split('|').filter(Boolean);
    const locked = gate.querySelector('[data-exam-locked]');
    const test = gate.querySelector('[data-test]');

    const units = summarizeUnits(getResultsForCourse(course));
    const missing = required.filter((unit) => !units[unit] || !units[unit].cleared);

    if (missing.length > 0) {
      if (locked) {
        let html = '<p class="box-label">Course exam locked</p>';
        html += '<p>Pass a unit test (either version) for every unit before the course exam unlocks. Still needed:</p><ul>';
        missing.forEach((unit) => {
          html += '<li><a href="' + encodeURIComponent(unit) + '/unit-test-a.html">' + unit + '</a></li>';
        });
        html += '</ul>';
        locked.innerHTML = html;
        locked.hidden = false;
      }
      if (test) test.hidden = true;
      return;
    }

    if (locked) locked.hidden = true;
    if (test) {
      test.hidden = false;
      mountTest(test);
    }
  }

  function unitStatusRow(unit, status) {
    if (!status || !status.cleared) {
      return '<tr><td>' + unit + '</td><td class="unit-status is-pending">Not yet cleared</td><td>—</td></tr>';
    }
    const best = status.clearedBy;
    return '<tr><td>' + unit + '</td><td class="unit-status is-cleared">Cleared</td><td>Version ' + best.version + ' — ' + best.score + '/' + best.total + '</td></tr>';
  }

  function mountProgressReport(report) {
    const course = report.getAttribute('data-course');
    const required = (report.getAttribute('data-required-units') || '').split('|').filter(Boolean);
    const body = report.querySelector('[data-report-body]');
    const printBtn = report.querySelector('[data-report-print]');

    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const data = buildReport(course);

    let html = '<table><thead><tr><th>Unit</th><th>Status</th><th>Best result</th></tr></thead><tbody>';
    required.forEach((unit) => { html += unitStatusRow(unit, data.units[unit]); });
    html += '</tbody></table>';

    html += '<h2>Course Exam</h2>';
    html += '<p>' + (data.courseExam.passed ? 'Passed.' : (data.courseExam.attempts.length > 0 ? 'Attempted, not yet passed.' : 'Not attempted yet.')) + '</p>';

    const weak = data.topics.filter((t) => t.status === 'weak');
    const strong = data.topics.filter((t) => t.status === 'strong');

    html += '<h2>Weak spots</h2>';
    html += weak.length
      ? '<ul>' + weak.map((t) => '<li class="topic-badge is-weak">' + t.topic + ' — ' + Math.round(t.accuracy * 100) + '%</li>').join('') + '</ul>'
      : '<p class="toc-empty">No weak topics identified yet — take some unit tests first.</p>';

    html += '<h2>Strong areas</h2>';
    html += strong.length
      ? '<ul>' + strong.map((t) => '<li class="topic-badge is-strong">' + t.topic + ' — ' + Math.round(t.accuracy * 100) + '%</li>').join('') + '</ul>'
      : '<p class="toc-empty">No strong topics identified yet — take some unit tests first.</p>';

    if (body) body.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-test]').forEach((container) => {
      if (!container.closest('[data-exam-gate]')) mountTest(container);
    });
    document.querySelectorAll('[data-exam-gate]').forEach(mountCourseExamGate);
    document.querySelectorAll('[data-report]').forEach(mountProgressReport);
    document.querySelectorAll('[data-project-gate]').forEach(mountProjectGate);
    document.querySelectorAll('[data-project-status]').forEach(mountProjectStatus);
    document.querySelectorAll('[data-course-status]').forEach(mountCourseStatus);
    document.querySelectorAll('[data-reflection]').forEach(mountReflection);
  });

  return {
    mountTest, mountCourseExamGate, mountProgressReport,
    mountProjectGate, mountProjectStatus, mountCourseStatus, mountReflection,
    isCourseExamPassed, isProjectComplete,
  };
})();
