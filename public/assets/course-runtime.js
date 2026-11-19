(function () {
  'use strict';

  const data = window.STEMPlusCourseData;
  if (!data) return;
  const params = new URLSearchParams(location.search);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const rotate = (items, amount) => items.slice(amount).concat(items.slice(0, amount));
  const lessons = data.units.flatMap((unit, unitIndex) => unit.lessons.map((lesson) => ({ ...lesson, unit: unitIndex + 1, unitTitle: unit.title })));
  lessons.forEach((lesson, index) => { lesson.number = index + 1; });

  function choices(question, index, testItem) {
    const options = rotate([question.correct, ...question.wrong], index % 3);
    return `<div class="quiz" ${testItem ? 'data-test-item' : 'data-quiz'} data-topic="${esc(question.prompt)}"><p class="quiz-prompt">${esc(question.prompt)}</p><div class="quiz-choices">${options.map((option) => `<button class="quiz-choice" data-correct="${option === question.correct}">${esc(option)}</button>`).join('')}</div><p class="quiz-feedback" hidden></p><p class="quiz-explain" hidden>${esc(question.explain)}</p></div>`;
  }

  function indexPage() {
    const root = document.querySelector('[data-course-index]');
    if (!root) return;
    data.units.forEach((unit, unitIndex) => {
      const details = document.createElement('details');
      details.className = 'unit-toc';
      details.innerHTML = `<summary>Unit ${unitIndex + 1} — ${esc(unit.title)}</summary><div class="toc-list">${unit.lessons.map((lesson) => { const item = lessons.find((candidate) => candidate.slug === lesson.slug); return `<a class="toc-item" href="lesson.html?id=${encodeURIComponent(lesson.slug)}"><span class="toc-num">Lesson ${item.number}</span><p class="toc-title">${esc(lesson.title)}</p><p class="toc-sub">${esc(lesson.subtitle)}</p></a>`; }).join('')}<a class="toc-item" href="unit-test.html?unit=${unitIndex + 1}&version=A"><span class="toc-num">Unit Test</span><p class="toc-title">Unit ${unitIndex + 1} Test</p><p class="toc-sub">10 questions in two versions. Score 80% or higher to clear the unit.</p></a></div>`;
      root.appendChild(details);
    });
  }

  function lessonPage() {
    const root = document.querySelector('[data-course-lesson]');
    if (!root) return;
    const lesson = lessons.find((item) => item.slug === params.get('id')) || lessons[0];
    const index = lessons.indexOf(lesson), previous = lessons[index - 1], next = lessons[index + 1];
    document.title = `Lesson ${lesson.number}: ${lesson.title} — STEM+`;
    root.dataset.lessonExperience = 'ready';
    root.innerHTML = `<span class="kicker">STEM+ · ${esc(data.course)} · Unit ${lesson.unit} · Lesson ${lesson.number}</span><h1>${esc(lesson.title)}</h1><p class="subtitle">${esc(lesson.subtitle)}</p><p class="nav-links">${previous ? `<a href="lesson.html?id=${encodeURIComponent(previous.slug)}" class="nav-prev">← Lesson ${previous.number}</a>` : ''}<a href="index.html" class="nav-toc">Contents</a>${next ? `<a href="lesson.html?id=${encodeURIComponent(next.slug)}" class="nav-next">Lesson ${next.number} →</a>` : '<a href="lab.html" class="nav-next">Course Lab →</a>'}<a href="reference/glossary.html" class="nav-glossary">Glossary →</a></p><nav class="lesson-path" aria-label="Lesson stages"><a href="#learn-it"><span>Step 1</span>Learn it</a><a href="#study-it"><span>Step 2</span>Study it</a><a href="#apply-it"><span>Step 3</span>Apply it</a></nav><section class="lesson-stage" id="learn-it"><h2 class="lesson-stage-title">Learn it</h2><p class="lesson-stage-intro">Start with the meaning, then connect it to the technical detail.</p><div class="lesson-concept-grid">${lesson.key.map(([term, definition], termIndex) => `<div class="box" id="concept-${termIndex + 1}"><span class="concept-kind">Key concept</span><span class="box-label">${esc(term)}</span><p>${esc(definition)}</p></div>`).join('')}</div><div class="box example"><span class="concept-kind">Good to know</span><span class="box-label">Competition note</span><p>${esc(lesson.good)}</p>${lesson.code ? `<pre class="code-block"><code>${esc(lesson.code)}</code></pre>` : ''}</div></section><section class="lesson-stage" id="study-it"><h2 class="lesson-stage-title">Study it</h2><p class="lesson-stage-intro">Practice the decision process, not just the vocabulary.</p><div class="box why"><span class="box-label">How to study this lesson</span><p>${esc(lesson.study)}</p><ul class="lesson-study-list"><li>Define each key term without copying the page.</li><li>Explain when the tool or idea is useful and when it is not.</li><li>Complete the recall checks closed-note, then correct the reason for every miss.</li></ul></div><h2>Practice from memory</h2>${lesson.checks.map((question, questionIndex) => choices(question, questionIndex, false)).join('')}</section><section class="lesson-stage" id="apply-it" data-lesson-apply><h2 class="lesson-stage-title">Apply it</h2><p class="lesson-stage-intro">Connect the idea to the workflow used in an authorized CTF or defensive investigation.</p><div class="box lesson-apply-scenario"><span class="box-label">Real-world scenario</span><p>${esc(lesson.apply)}</p><ul class="lesson-apply-list"><li>State what evidence you would inspect first.</li><li>Choose the lesson technique and justify it.</li><li>Describe the expected result and one possible false lead.</li><li>Keep all testing inside systems and challenges you are authorized to use.</li></ul></div><p class="nav-links"><a class="nav-next" href="${esc(lesson.practice)}">Practice in CyLab Academy →</a><a class="nav-toc" href="${esc(lesson.source)}">Official learning source →</a></p></section><p class="ask-teacher">If you can explain the evidence, the method, and the limitation, you understand the lesson well enough to use it.</p><footer class="lesson-footer">STEM+ · ${esc(data.course)} · Lesson ${lesson.number} of ${lessons.length}</footer>`;
  }

  function testPage() {
    const root = document.querySelector('[data-course-unit-test]');
    if (!root) return;
    const unitNumber = Math.min(data.units.length, Math.max(1, Number(params.get('unit')) || 1));
    const version = params.get('version') === 'B' ? 'B' : 'A';
    const unit = data.units[unitNumber - 1];
    let bank = [...unit.lessons.flatMap((lesson) => lesson.checks), unit.synthesis];
    if (version === 'B') bank = rotate([...bank].reverse(), 2);
    bank = bank.slice(0, 10);
    document.title = `Unit ${unitNumber} Test — Version ${version} — ${data.course} — STEM+`;
    root.innerHTML = `<span class="kicker">STEM+ · ${esc(data.course)} · Unit ${unitNumber} · Unit Test</span><h1>Unit ${unitNumber} Test — Version ${version}</h1><p class="subtitle">${esc(unit.title)}. 10 questions; score 80% or higher to clear this unit.</p><p class="nav-links"><a href="index.html" class="nav-toc">← Course Contents</a><a href="unit-test.html?unit=${unitNumber}&version=${version === 'A' ? 'B' : 'A'}" class="nav-toc">Version ${version === 'A' ? 'B' : 'A'} →</a></p><div data-test data-course="${esc(data.course)}" data-unit="Unit ${unitNumber}" data-kind="unit_test" data-version="${version}">${bank.map((question, index) => choices(question, index, true)).join('')}<p class="test-warning" data-test-warning hidden></p><button class="widget-btn" data-test-submit>Submit Test</button><div class="test-result" data-test-result hidden></div></div><footer class="lesson-footer">STEM+ · ${esc(data.course)} · Unit ${unitNumber} Test — Version ${version}</footer>`;
  }

  function examPage() {
    const root = document.querySelector('[data-course-exam]');
    if (!root) return;
    const questions = data.units.flatMap((unit) => [unit.lessons[0].checks[0], unit.lessons[1].checks[1]]).concat(data.units.slice(0, 4).map((unit) => unit.synthesis));
    const required = data.units.map((_, index) => `Unit ${index + 1}`).join('|');
    root.innerHTML = `<span class="kicker">STEM+ · ${esc(data.course)} · Course Exam</span><h1>${esc(data.course)} — Course Exam</h1><p class="subtitle">20 questions spanning all ${data.units.length} units. Clear every unit test, then score 85% or higher.</p><p class="nav-links"><a href="index.html" class="nav-toc">← Course Contents</a><a href="lab.html" class="nav-toc">Course Lab →</a><a href="progress-report.html" class="nav-toc">Progress Report →</a></p><div data-exam-gate data-course="${esc(data.course)}" data-required-units="${required}"><div class="exam-locked" data-exam-locked hidden></div><div data-test data-course="${esc(data.course)}" data-unit="Course Exam" data-kind="course_exam" hidden>${questions.map((question, index) => choices(question, index, true)).join('')}<p class="test-warning" data-test-warning hidden></p><button class="widget-btn" data-test-submit>Submit Exam</button><div class="test-result" data-test-result hidden></div></div></div><footer class="lesson-footer">STEM+ · ${esc(data.course)} · Course Exam</footer>`;
  }

  function glossaryPage() {
    const root = document.querySelector('[data-course-glossary]');
    if (!root) return;
    const terms = new Map(lessons.flatMap((lesson) => lesson.key).map(([term, definition]) => [term, definition]));
    root.innerHTML = [...terms].map(([term, definition]) => `<div class="box"><span class="box-label">${esc(term)}</span><p>${esc(definition)}</p></div>`).join('');
  }

  function labPage() {
    const root = document.querySelector('[data-course-lab]');
    if (!root) return;
    const storageKey = `stemplus:course-lab:${data.slug}`;
    let solved = [];
    try { solved = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { solved = []; }
    let active = Math.min(data.labs.length - 1, Math.max(0, solved.findIndex((done) => !done)));
    if (active < 0) active = data.labs.length - 1;
    const normalize = (value) => String(value).trim().toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ');

    function render() {
      const task = data.labs[active];
      const count = solved.filter(Boolean).length;
      root.innerHTML = `<span class="kicker">STEM+ · ${esc(data.course)} · Embedded Lab</span><h1>${esc(data.labTitle)}</h1><p class="subtitle">${esc(data.labDescription)}</p><p class="nav-links"><a href="index.html" class="nav-toc">← Course Contents</a><a href="course-exam.html" class="nav-toc">Course Exam →</a></p><div class="problem-stats">Completed ${count} of ${data.labs.length} lab tasks</div><div class="project-task-list">${data.labs.map((item, index) => `<button class="project-task-button${index === active ? ' is-active' : ''}${solved[index] ? ' is-complete' : ''}" data-lab-task="${index}">${index + 1}. ${esc(item.title)}${solved[index] ? ' ✓' : ''}</button>`).join('')}</div><section class="sandbox-challenge"><span class="box-label">Task ${active + 1} · Authorized simulation</span><h2 class="sandbox-title">${esc(task.title)}</h2><p>${esc(task.brief)}</p>${task.artifact ? `<pre class="sandbox-output"><code>${esc(task.artifact)}</code></pre>` : ''}<p class="quiz-prompt">${esc(task.prompt)}</p><div class="quiz-fill-row"><input class="quiz-fill-input" data-lab-answer aria-label="Lab answer"><button class="widget-btn" data-lab-check>Check task</button></div><div class="sandbox-actions"><button class="widget-btn" data-lab-hint>Show hint</button><button class="widget-btn" data-lab-show>Show answer</button></div><p class="sandbox-hint" data-lab-help hidden></p><div class="sandbox-results" data-lab-result hidden></div></section><div class="box why"><span class="box-label">Safe practice boundary</span><p>These tasks use provided artifacts and simulations. Use the same techniques only in CyLab Academy, picoCTF, your own systems, or another environment where you have explicit permission.</p></div><p class="nav-links"><a class="nav-next" href="https://learn.cylabacademy.org/">Continue in CyLab Academy →</a><a class="nav-toc" href="https://webshell.cylabacademy.org/">Open the CyLab Academy Webshell →</a></p><footer class="lesson-footer">STEM+ · ${esc(data.course)} · Embedded Course Lab</footer>`;
      root.querySelectorAll('[data-lab-task]').forEach((button) => button.addEventListener('click', () => { active = Number(button.dataset.labTask); render(); }));
      const input = root.querySelector('[data-lab-answer]');
      const result = root.querySelector('[data-lab-result]');
      const check = () => {
        const correct = task.answers.some((answer) => normalize(answer) === normalize(input.value));
        result.hidden = false;
        result.className = `sandbox-results ${correct ? 'is-pass' : 'is-fail'}`;
        result.innerHTML = correct ? `<strong>Task complete.</strong><p>${esc(task.explain)}</p>` : '<strong>Not yet.</strong><p>Check the artifact, command syntax, and requested output. Use the hint if you need a smaller next step.</p>';
        if (!correct) return;
        solved[active] = true;
        try { localStorage.setItem(storageKey, JSON.stringify(solved)); } catch {}
        setTimeout(() => { if (active < data.labs.length - 1) active += 1; render(); }, 700);
      };
      root.querySelector('[data-lab-check]').addEventListener('click', check);
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') check(); });
      root.querySelector('[data-lab-hint]').addEventListener('click', () => { const help = root.querySelector('[data-lab-help]'); help.hidden = false; help.textContent = task.hint; });
      root.querySelector('[data-lab-show]').addEventListener('click', () => { const help = root.querySelector('[data-lab-help]'); help.hidden = false; help.textContent = `One accepted answer: ${task.answers[0]}`; });
    }
    render();
  }

  indexPage();
  lessonPage();
  testPage();
  examPage();
  glossaryPage();
  labPage();
}());
