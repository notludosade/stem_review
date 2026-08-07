(function () {
  'use strict';

  const parseNumber = (raw) => {
    const value = raw.trim().replace(/,/g, '').replace(/−/g, '-');
    if (!value) return NaN;
    const fraction = value.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
    if (fraction && Number(fraction[2]) !== 0) return Number(fraction[1]) / Number(fraction[2]);
    const percent = value.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (percent) return Number(percent[1]) / 100;
    return Number(value);
  };
  const answersClose = (value, answer, tolerance) => {
    const allowed = Number.isInteger(answer) ? tolerance : Math.max(tolerance, Math.min(0.1, Math.max(0.01, Math.abs(answer) * 0.01)));
    return Math.abs(value - answer) <= allowed;
  };
  if (typeof module === 'object' && module.exports) {
    module.exports = { parseNumber, answersClose };
    return;
  }

  const bankApi = window.STEMProblemBanks;
  const slug = new URLSearchParams(window.location.search).get('course');
  const course = bankApi && bankApi.getCourse(slug);
  const mount = document.querySelector('[data-problem-set]');

  if (!course || !mount) {
    if (mount) mount.textContent = 'Problem set not found. Return to the Problem Sets page and choose a course.';
    return;
  }

  const storageKey = `stemplus:problem-sets:v1:${course.slug}`;
  const loadProgress = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || { attempted: {}, correct: {} };
    } catch (_) {
      return { attempted: {}, correct: {} };
    }
  };
  const saveProgress = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch (_) {
      // Practice still works when storage is unavailable.
    }
  };
  const shuffle = (items) => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const formatAnswer = (answer) => typeof answer === 'number'
    ? String(Number(answer.toFixed(3)))
    : answer;

  const title = document.querySelector('[data-problem-title]');
  const subtitle = document.querySelector('[data-problem-subtitle]');
  const topicSelect = document.querySelector('[data-topic-filter]');
  const progressText = document.querySelector('[data-problem-progress]');
  const topicText = document.querySelector('[data-problem-topic]');
  const prompt = document.querySelector('[data-problem-prompt]');
  const choices = document.querySelector('[data-problem-choices]');
  const fillRow = document.querySelector('[data-problem-fill]');
  const input = document.querySelector('[data-problem-input]');
  const checkButton = document.querySelector('[data-problem-check]');
  const nextButton = document.querySelector('[data-problem-next]');
  const feedback = document.querySelector('[data-problem-feedback]');
  const explanation = document.querySelector('[data-problem-explanation]');
  const stats = document.querySelector('[data-problem-stats]');
  const resetButton = document.querySelector('[data-problem-reset]');

  document.title = `${course.title} Problem Set — STEM+`;
  document.querySelector('.page').dataset.tier = course.tier;
  title.textContent = `${course.title} Problem Set`;
  subtitle.textContent = `${course.questions.length} practice questions · ${course.summary}`;

  const topics = [...new Set(course.questions.map((question) => question.topic))];
  topics.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    topicSelect.appendChild(option);
  });

  let progress = loadProgress();
  let deck = [];
  let current = null;
  let answered = false;

  const filteredQuestions = () => {
    const selected = topicSelect.value;
    return selected === 'all' ? course.questions : course.questions.filter((question) => question.topic === selected);
  };
  const rebuildDeck = () => {
    const filtered = filteredQuestions();
    const unseen = filtered.filter((question) => !progress.attempted[question.id]);
    const seen = filtered.filter((question) => progress.attempted[question.id]);
    deck = [...shuffle(unseen), ...shuffle(seen)];
  };
  const renderStats = () => {
    const attempted = course.questions.filter((question) => progress.attempted[question.id]).length;
    const correct = course.questions.filter((question) => progress.correct[question.id]).length;
    const accuracy = attempted ? Math.round(correct / attempted * 100) : 0;
    stats.textContent = `${attempted}/${course.questions.length} answered · ${correct} first-try correct · ${accuracy}% accuracy`;
  };
  const finishAnswer = (isCorrect, selectedButton) => {
    if (answered) return;
    answered = true;
    const firstAttempt = !progress.attempted[current.id];
    progress.attempted[current.id] = true;
    if (firstAttempt && isCorrect) progress.correct[current.id] = true;
    saveProgress();
    renderStats();

    if (current.type === 'choice') {
      choices.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
        if (button.dataset.answer === current.answer) button.classList.add('is-correct');
      });
      if (!isCorrect && selectedButton) selectedButton.classList.add('is-incorrect');
    } else {
      input.disabled = true;
      checkButton.disabled = true;
    }

    feedback.textContent = isCorrect ? 'Correct.' : `Not quite. Answer: ${formatAnswer(current.answer)}.`;
    feedback.className = `quiz-feedback ${isCorrect ? 'is-correct' : 'is-incorrect'}`;
    feedback.hidden = false;
    explanation.textContent = current.explanation;
    explanation.hidden = false;
    nextButton.hidden = false;
    nextButton.focus();
  };
  const checkFill = () => {
    if (answered) return;
    const value = parseNumber(input.value);
    if (!Number.isFinite(value)) {
      feedback.textContent = 'Enter a number, fraction, or percent.';
      feedback.className = 'quiz-feedback is-incorrect';
      feedback.hidden = false;
      return;
    }
    finishAnswer(answersClose(value, current.answer, current.tolerance));
  };
  const renderQuestion = () => {
    if (!deck.length) rebuildDeck();
    current = deck.shift();
    answered = false;

    const filtered = filteredQuestions();
    const position = filtered.length - deck.length;
    progressText.textContent = `Question ${Math.min(position, filtered.length)} of ${filtered.length}`;
    topicText.textContent = current.topic;
    prompt.textContent = current.prompt;
    choices.replaceChildren();
    fillRow.hidden = current.type !== 'number';
    choices.hidden = current.type !== 'choice';
    feedback.hidden = true;
    explanation.hidden = true;
    nextButton.hidden = true;
    input.value = '';
    input.disabled = false;
    checkButton.disabled = false;

    if (current.type === 'choice') {
      shuffle(current.choices).forEach((answer) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quiz-choice';
        button.dataset.answer = answer;
        button.textContent = answer;
        button.addEventListener('click', () => finishAnswer(answer === current.answer, button));
        choices.appendChild(button);
      });
    } else {
      window.setTimeout(() => input.focus(), 0);
    }
  };

  topicSelect.addEventListener('change', () => {
    rebuildDeck();
    renderQuestion();
  });
  checkButton.addEventListener('click', checkFill);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') checkFill();
  });
  nextButton.addEventListener('click', renderQuestion);
  resetButton.addEventListener('click', () => {
    if (!window.confirm(`Reset saved progress for ${course.title}?`)) return;
    progress = { attempted: {}, correct: {} };
    saveProgress();
    rebuildDeck();
    renderStats();
    renderQuestion();
  });

  renderStats();
  rebuildDeck();
  renderQuestion();
}());
