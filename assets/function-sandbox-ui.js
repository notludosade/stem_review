(function () {
  'use strict';

  const config = window.STEMFunctionSandbox;
  if (!config || !config.api) return;
  const api = config.api;
  const $ = (name) => document.querySelector(`[data-code-${name}]`);
  const DEFAULT_STATE = { solved: {}, drafts: {}, freestyle: config.defaultFreeCode };
  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(config.storageKey));
      return saved && saved.solved && saved.drafts ? saved : { ...DEFAULT_STATE };
    } catch (_) { return { ...DEFAULT_STATE }; }
  };
  let state = loadState();
  const saveState = () => {
    try { localStorage.setItem(config.storageKey, JSON.stringify(state)); } catch (_) { /* Keep progress in memory. */ }
  };
  const displayValue = (value) => Array.isArray(value)
    ? `[${value.map(displayValue).join(', ')}]`
    : typeof value === 'string' ? JSON.stringify(value) : String(value);

  const tabs = [...document.querySelectorAll('[data-sandbox-tab]')];
  const panels = [...document.querySelectorAll('[data-sandbox-panel]')];
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    const selected = tab.dataset.sandboxTab;
    tabs.forEach((button) => {
      const active = button === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.sandboxPanel !== selected; });
  }));

  const difficulty = $('difficulty');
  const topic = $('topic');
  const picker = $('picker');
  const progress = $('progress');
  const number = $('number');
  const problemTopic = $('problem-topic');
  const title = $('title');
  const prompt = $('prompt');
  const examples = $('examples');
  const solved = $('solved');
  const editor = $('editor');
  const run = $('run');
  const reset = $('reset');
  const hintButton = $('hint-button');
  const hint = $('hint');
  const next = $('next');
  const status = $('status');
  const results = $('results');
  let current = null;

  const filteredProblems = () => api.problems.filter((problem) => (
    (difficulty.value === 'all' || problem.difficulty === difficulty.value)
    && (topic.value === 'all' || problem.topic === topic.value)
  ));
  const renderProgress = () => {
    const total = api.problems.filter((problem) => state.solved[problem.id]).length;
    const groups = ['Easy', 'Medium', 'Hard'].map((level) => {
      const problems = api.problems.filter((problem) => problem.difficulty === level);
      return `${problems.filter((problem) => state.solved[problem.id]).length}/${problems.length} ${level}`;
    });
    progress.textContent = `${total}/${api.problems.length} solved · ${groups.join(' · ')}`;
  };
  const populatePicker = (preferredId) => {
    const filtered = filteredProblems();
    const fallback = filtered.find((problem) => !state.solved[problem.id]) || filtered[0];
    const selectedId = filtered.some((problem) => problem.id === preferredId) ? preferredId : fallback.id;
    picker.replaceChildren();
    filtered.forEach((problem) => {
      const option = document.createElement('option');
      option.value = problem.id;
      option.textContent = `${state.solved[problem.id] ? '✓ ' : ''}${problem.id.split('-')[1]} · ${problem.title} · ${problem.difficulty}`;
      option.selected = problem.id === selectedId;
      picker.appendChild(option);
    });
  };
  const renderProblem = () => {
    current = api.getProblem(picker.value);
    number.textContent = `Problem ${api.problems.indexOf(current) + 1} of ${api.problems.length}`;
    problemTopic.textContent = `${current.difficulty} · ${current.topic}`;
    title.textContent = current.title;
    prompt.textContent = current.prompt;
    solved.textContent = state.solved[current.id] ? 'Solved' : 'Not solved yet';
    solved.className = state.solved[current.id] ? 'sandbox-solved is-solved' : 'sandbox-solved';
    editor.value = state.drafts[current.id] || current.starter;
    hint.textContent = current.hint;
    hint.hidden = true;
    hintButton.textContent = 'Show Hint';
    results.hidden = true;
    results.replaceChildren();
    status.textContent = config.readyMessage;
    examples.replaceChildren();
    current.tests.slice(0, 2).forEach((test) => {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      pre.className = 'code-block';
      code.textContent = `${config.exampleCall(current, test.args)}\n// returns ${displayValue(test.expected)}`;
      pre.appendChild(code);
      examples.appendChild(pre);
    });
  };
  const renderResults = (payload) => {
    results.replaceChildren();
    results.className = `sandbox-results ${payload.ok ? 'is-pass' : 'is-fail'}`;
    const heading = document.createElement('p');
    heading.className = 'test-result-score';
    const score = payload.results ? payload.results.filter((test) => test.passed).length : 0;
    heading.textContent = payload.error ? 'Code could not run' : `${score}/${payload.results.length} tests passed${payload.ok ? ' — solved' : ''}`;
    results.appendChild(heading);
    if (payload.error) {
      const error = document.createElement('pre');
      error.className = 'sandbox-error';
      error.textContent = payload.error;
      results.appendChild(error);
    } else {
      const list = document.createElement('ul');
      payload.results.forEach((test) => {
        const item = document.createElement('li');
        item.className = test.passed ? 'is-correct' : 'is-incorrect';
        item.textContent = test.passed ? `Test ${test.index}: passed` : `Test ${test.index}: expected ${test.expected}; got ${test.actual}`;
        list.appendChild(item);
      });
      results.appendChild(list);
    }
    if (payload.output) {
      const output = document.createElement('pre');
      output.className = 'sandbox-output';
      output.textContent = payload.output;
      results.appendChild(output);
    }
    results.hidden = false;
  };

  const allTopics = document.createElement('option');
  allTopics.value = 'all';
  allTopics.textContent = 'All topics';
  topic.appendChild(allTopics);
  api.topics.forEach((name) => topic.appendChild(new Option(name, name)));
  const refresh = () => { populatePicker(); renderProblem(); };
  difficulty.addEventListener('change', refresh);
  topic.addEventListener('change', refresh);
  picker.addEventListener('change', renderProblem);
  editor.addEventListener('input', () => { state.drafts[current.id] = editor.value; saveState(); });
  reset.addEventListener('click', () => {
    if (editor.value !== current.starter && !window.confirm('Replace your current solution with starter code?')) return;
    delete state.drafts[current.id];
    saveState();
    editor.value = current.starter;
    results.hidden = true;
  });
  hintButton.addEventListener('click', () => {
    hint.hidden = !hint.hidden;
    hintButton.textContent = hint.hidden ? 'Show Hint' : 'Hide Hint';
  });
  next.addEventListener('click', () => {
    const filtered = filteredProblems();
    const index = filtered.findIndex((problem) => problem.id === current.id);
    picker.value = filtered[(index + 1) % filtered.length].id;
    renderProblem();
  });
  run.addEventListener('click', async () => {
    const problemAtRun = current;
    const codeAtRun = editor.value;
    const disabled = [run, editor, difficulty, topic, picker, next];
    disabled.forEach((element) => { element.disabled = true; });
    status.textContent = config.runningMessage;
    results.hidden = true;
    try {
      const payload = await config.runProblem(problemAtRun, codeAtRun);
      renderResults(payload);
      if (payload.ok) {
        state.solved[problemAtRun.id] = true;
        state.drafts[problemAtRun.id] = codeAtRun;
        saveState();
        renderProgress();
        solved.textContent = 'Solved';
        solved.className = 'sandbox-solved is-solved';
        populatePicker(problemAtRun.id);
      }
      status.textContent = payload.ok ? 'All tests passed.' : 'Tests finished. Review results below.';
    } catch (error) {
      renderResults({ ok: false, error: error.message });
      status.textContent = 'Run stopped.';
    } finally { disabled.forEach((element) => { element.disabled = false; }); }
  });

  const freeEditor = $('free-editor');
  const freeRun = $('free-run');
  const freeReset = $('free-reset');
  const freeStatus = $('free-status');
  const freeOutput = $('output');
  freeEditor.value = state.freestyle || config.defaultFreeCode;
  freeEditor.addEventListener('input', () => { state.freestyle = freeEditor.value; saveState(); });
  freeReset.addEventListener('click', () => {
    if (freeEditor.value !== config.defaultFreeCode && !window.confirm('Replace your freestyle program with the example?')) return;
    freeEditor.value = config.defaultFreeCode;
    state.freestyle = config.defaultFreeCode;
    saveState();
    freeOutput.textContent = 'Program output appears here.';
  });
  freeRun.addEventListener('click', async () => {
    freeRun.disabled = true;
    freeStatus.textContent = config.freeRunningMessage;
    try {
      const payload = await config.runFree(freeEditor.value);
      freeOutput.textContent = payload.error || payload.output || '(Program finished with no output.)';
      freeStatus.textContent = payload.ok ? 'Program finished.' : 'Program finished with an error.';
    } catch (error) {
      freeOutput.textContent = error.message;
      freeStatus.textContent = 'Run stopped.';
    } finally { freeRun.disabled = false; }
  });

  renderProgress();
  populatePicker();
  renderProblem();
}());
