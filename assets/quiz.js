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

document.addEventListener('DOMContentLoaded', () => {
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
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const check = () => {
      const val = input.value.trim().toLowerCase();
      const correct = answers.includes(val);
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
