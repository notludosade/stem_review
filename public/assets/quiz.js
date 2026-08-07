// Shared retrieval-practice quiz interactions for STEM+ lessons.
// Two markup contracts:
//   Multiple choice: <div class="quiz" data-quiz> ... button.quiz-choice[data-correct] ... .quiz-feedback, .quiz-explain
//   Fill-in-blank:   <div class="quiz" data-quiz-fill data-answers="a|b|c"> ... .quiz-fill-input, .quiz-fill-check ...
function shuffleQuizChoices(container) {
  container.querySelectorAll('.quiz-choices').forEach((choicesEl) => {
    const items = Array.from(choicesEl.children);
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    items.forEach((item) => choicesEl.appendChild(item));
  });
}

function normalizeSentenceAnswer(value) {
  return String(value)
    .replace(/[εϵ]/g, ' epsilon ')
    .replace(/θ/g, ' theta ')
    .replace(/δ/g, ' delta ')
    .replace(/β/g, ' beta ')
    .replace(/π/g, ' pi ')
    .replace(/λ/g, ' lambda ')
    .replace(/∇/g, ' nabla ')
    .replace(/∞/g, ' infinity ')
    .replace(/#/g, ' hash ')
    .replace(/:/g, ' colon ')
    .replace(/ℝ/g, ' real numbers ')
    .replace(/ℚ/g, ' rational numbers ')
    .replace(/∅/g, ' empty set ')
    .replace(/[−–—]/g, '-')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\b(?:isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t|doesn['’]?t|don['’]?t|cannot|can['’]?t)\b/g, ' not ')
    .replace(/\bnot rational\b/g, ' irrational ')
    .replace(/\bnot complete\b/g, ' incomplete ')
    .replace(/\bnot converg(?:e|ent)\b/g, ' diverge ')
    .replace(/['’]s\b/g, '')
    .replace(/([a-z])-([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9+*/=<>&|!-]+/g, ' ')
    .replace(/\s*([+*/=<>&|!-])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalAnswerToken(token) {
  const forms = {
    smallest: 'least', minimum: 'least', min: 'least', largest: 'greatest', maximum: 'greatest', max: 'greatest',
    finitely: 'finite', bounds: 'bound', converges: 'converge', convergent: 'converge', convergence: 'converge',
    diverges: 'diverge', divergent: 'diverge', divergence: 'diverge', continuity: 'continuous',
    differentiability: 'differentiable', monotonicity: 'monotone', uniformly: 'uniform',
    completeness: 'complete', rationals: 'rational', irrationals: 'irrational',
    sequences: 'sequence', intersections: 'intersection', unions: 'union',
    derivatives: 'derivative', integrals: 'integral', integration: 'integral', refinements: 'refinement'
  };
  return forms[token] || token;
}

function answerMatches(value, acceptedAnswers) {
  const input = normalizeSentenceAnswer(value);
  if (!input) return false;
  const stop = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'it', 'this', 'that', 'of', 'to', 'for', 'as', 'answer', 'term', 'called', 'and']);
  const tokens = (text) => text.split(' ').map(canonicalAnswerToken).filter((token) => token && !stop.has(token));
  const inputTokens = tokens(input);
  const negative = (items) => items.some((token) => ['not', 'no', 'never', 'without', 'neither'].includes(token));
  return acceptedAnswers.some((answer) => {
    const expected = normalizeSentenceAnswer(answer);
    if (!expected) return false;
    if (input === expected) return true;
    if (!/[a-z]{2}/.test(expected)) return false;
    const expectedTokens = tokens(expected);
    if (negative(inputTokens) !== negative(expectedTokens)) return false;
    if (inputTokens.includes('or') && !expectedTokens.includes('or')) return false;
    return expectedTokens.length > 0 && expectedTokens.every((token) => inputTokens.includes(token)) && inputTokens.length <= expectedTokens.length + 10;
  });
}

if (typeof module === 'object' && module.exports) module.exports = { normalizeSentenceAnswer, answerMatches };

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-quiz]').forEach((quiz) => {
    shuffleQuizChoices(quiz);
    const choices = Array.from(quiz.querySelectorAll('.quiz-choice'));
    const feedback = quiz.querySelector('.quiz-feedback');
    const explain = quiz.querySelector('.quiz-explain');
    let answered = false;

    choices.forEach((choice) => {
      choice.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const correct = choice.getAttribute('data-correct') === 'true';
        choices.forEach((c) => {
          c.disabled = true;
          if (c.getAttribute('data-correct') === 'true') c.classList.add('is-correct');
        });
        if (!correct) choice.classList.add('is-incorrect');
        if (feedback) {
          feedback.textContent = correct ? 'Correct.' : 'Not quite.';
          feedback.classList.remove('is-correct', 'is-incorrect');
          feedback.classList.add(correct ? 'is-correct' : 'is-incorrect');
          feedback.hidden = false;
        }
        if (explain) explain.hidden = false;
      });
    });
  });

  document.querySelectorAll('[data-quiz-fill]').forEach((quiz) => {
    const input = quiz.querySelector('.quiz-fill-input');
    const button = quiz.querySelector('.quiz-fill-check');
    const feedback = quiz.querySelector('.quiz-feedback');
    const explain = quiz.querySelector('.quiz-explain');
    const answers = (quiz.getAttribute('data-answers') || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    const check = () => {
      const correct = answerMatches(input.value, answers);
      feedback.textContent = correct ? 'Correct.' : 'Not quite — try again.';
      feedback.classList.remove('is-correct', 'is-incorrect');
      feedback.classList.add(correct ? 'is-correct' : 'is-incorrect');
      feedback.hidden = false;
      if (correct) {
        input.disabled = true;
        button.disabled = true;
        if (explain) explain.hidden = false;
      }
    };

    button.addEventListener('click', check);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') check();
    });
  });
});
