(function () {
  'use strict';

  const api = window.STEMPythonProblems;
  if (!api) return;

  const STORAGE_KEY = 'stemplus:python-sandbox:v1';
  const DEFAULT_FREE_CODE = 'name = "STEM+"\nfor number in range(1, 4):\n    print(f"{number}: Hello from {name}!")';
  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && saved.solved && saved.drafts ? saved : { solved: {}, drafts: {}, freestyle: DEFAULT_FREE_CODE };
    } catch (_) {
      return { solved: {}, drafts: {}, freestyle: DEFAULT_FREE_CODE };
    }
  };
  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      // Sandbox still runs if storage is unavailable.
    }
  };
  const pythonRepr = (value) => {
    if (value === null) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(pythonRepr).join(', ')}]`;
    if (typeof value === 'object') {
      return `{${Object.entries(value).map(([key, item]) => `${pythonRepr(key)}: ${pythonRepr(item)}`).join(', ')}}`;
    }
    return String(value);
  };

  let worker = null;
  let readyPromise = null;
  let readyReject = null;
  let requestId = 0;
  const pending = new Map();

  const stopWorker = (error) => {
    if (worker) worker.terminate();
    worker = null;
    readyPromise = null;
    if (readyReject) readyReject(error);
    readyReject = null;
    pending.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(error);
    });
    pending.clear();
  };

  const ensureWorker = () => {
    if (readyPromise) return readyPromise;
    if (!window.Worker) return Promise.reject(new Error('This browser does not support Web Workers.'));

    readyPromise = new Promise((resolve, reject) => {
      readyReject = reject;
      let ready = false;
      const loadTimer = window.setTimeout(() => {
        if (!ready) stopWorker(new Error('Python runtime took too long to load. Check your connection and try again.'));
      }, 30000);

      try {
        worker = new Worker('assets/python-worker.js', { type: 'module' });
      } catch (error) {
        clearTimeout(loadTimer);
        worker = null;
        readyReject = null;
        reject(error);
        window.setTimeout(() => { readyPromise = null; }, 0);
        return;
      }

      worker.onmessage = (event) => {
        const message = event.data;
        if (message.type === 'ready') {
          ready = true;
          readyReject = null;
          clearTimeout(loadTimer);
          resolve();
          return;
        }
        if (message.type === 'fatal') {
          clearTimeout(loadTimer);
          stopWorker(new Error(`Python runtime failed to load: ${message.error}`));
          return;
        }
        if (message.type === 'result' && pending.has(message.id)) {
          const request = pending.get(message.id);
          pending.delete(message.id);
          clearTimeout(request.timer);
          request.resolve(message.payload);
        }
      };
      worker.onerror = () => {
        clearTimeout(loadTimer);
        stopWorker(new Error('Python runtime could not start. Serve the site over HTTPS or localhost and check your connection.'));
      };
    });
    return readyPromise;
  };

  const runPython = async (payload) => {
    await ensureWorker();
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const timer = window.setTimeout(() => {
        pending.delete(id);
        const error = new Error('Program stopped after 5 seconds. Check for an infinite loop.');
        stopWorker(error);
        reject(error);
      }, 5000);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, ...payload });
    });
  };

  const tabs = [...document.querySelectorAll('[data-sandbox-tab]')];
  const panels = [...document.querySelectorAll('[data-sandbox-panel]')];
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const selected = tab.dataset.sandboxTab;
      tabs.forEach((button) => {
        const active = button === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.sandboxPanel !== selected;
      });
    });
  });

  const difficultySelect = document.querySelector('[data-python-difficulty]');
  const topicSelect = document.querySelector('[data-python-topic]');
  const problemPicker = document.querySelector('[data-python-picker]');
  const progressText = document.querySelector('[data-python-progress]');
  const numberText = document.querySelector('[data-python-number]');
  const problemTopic = document.querySelector('[data-python-problem-topic]');
  const title = document.querySelector('[data-python-title]');
  const prompt = document.querySelector('[data-python-prompt]');
  const examples = document.querySelector('[data-python-examples]');
  const solved = document.querySelector('[data-python-solved]');
  const editor = document.querySelector('[data-python-code]');
  const runButton = document.querySelector('[data-python-run]');
  const resetButton = document.querySelector('[data-python-reset]');
  const hintButton = document.querySelector('[data-python-hint-button]');
  const hint = document.querySelector('[data-python-hint]');
  const nextButton = document.querySelector('[data-python-next]');
  const status = document.querySelector('[data-python-status]');
  const results = document.querySelector('[data-python-results]');

  let state = loadState();
  let currentProblem = null;

  const filteredProblems = () => api.problems.filter((problem) => (
    (difficultySelect.value === 'all' || problem.difficulty === difficultySelect.value)
    && (topicSelect.value === 'all' || problem.topic === topicSelect.value)
  ));

  const renderProgress = () => {
    const solvedCount = api.problems.filter((problem) => state.solved[problem.id]).length;
    const difficultyProgress = ['Easy', 'Medium', 'Hard'].map((difficulty) => {
      const problems = api.problems.filter((problem) => problem.difficulty === difficulty);
      const solved = problems.filter((problem) => state.solved[problem.id]).length;
      return `${solved}/${problems.length} ${difficulty}`;
    });
    progressText.textContent = `${solvedCount}/${api.problems.length} solved · ${difficultyProgress.join(' · ')}`;
  };

  const populatePicker = (preferredId) => {
    const filtered = filteredProblems();
    const fallback = filtered.find((problem) => !state.solved[problem.id]) || filtered[0];
    const selectedId = filtered.some((problem) => problem.id === preferredId) ? preferredId : fallback.id;
    problemPicker.replaceChildren();
    filtered.forEach((problem) => {
      const option = document.createElement('option');
      option.value = problem.id;
      option.textContent = `${state.solved[problem.id] ? '✓ ' : ''}${problem.id.slice(3)} · ${problem.title} · ${problem.difficulty}`;
      option.selected = problem.id === selectedId;
      problemPicker.appendChild(option);
    });
  };

  const renderProblem = () => {
    currentProblem = api.getProblem(problemPicker.value);
    const index = api.problems.indexOf(currentProblem);
    numberText.textContent = `Problem ${index + 1} of ${api.problems.length}`;
    problemTopic.textContent = `${currentProblem.difficulty} · ${currentProblem.topic}`;
    title.textContent = currentProblem.title;
    prompt.textContent = currentProblem.prompt;
    solved.textContent = state.solved[currentProblem.id] ? 'Solved' : 'Not solved yet';
    solved.className = state.solved[currentProblem.id] ? 'sandbox-solved is-solved' : 'sandbox-solved';
    editor.value = state.drafts[currentProblem.id] || currentProblem.starter;
    hint.textContent = currentProblem.hint;
    hint.hidden = true;
    hintButton.textContent = 'Show Hint';
    results.hidden = true;
    results.replaceChildren();
    status.textContent = 'Python runtime loads on first run.';

    examples.replaceChildren();
    currentProblem.tests.slice(0, 2).forEach((test) => {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      pre.className = 'code-block';
      code.textContent = `${currentProblem.functionName}(${test.args.map(pythonRepr).join(', ')})\n# returns ${pythonRepr(test.expected)}`;
      pre.appendChild(code);
      examples.appendChild(pre);
    });
  };

  const renderTestResults = (payload) => {
    results.replaceChildren();
    results.className = `sandbox-results ${payload.ok ? 'is-pass' : 'is-fail'}`;
    const score = payload.results ? payload.results.filter((test) => test.passed).length : 0;
    const heading = document.createElement('p');
    heading.className = 'test-result-score';
    heading.textContent = payload.error
      ? 'Code could not run'
      : `${score}/${payload.results.length} tests passed${payload.ok ? ' — solved' : ''}`;
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
        item.textContent = test.passed
          ? `Test ${test.index}: passed`
          : `Test ${test.index}: expected ${test.expected}; ${test.error ? test.error : `got ${test.actual}`}`;
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

  api.topics.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    topicSelect.appendChild(option);
  });
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All topics';
  topicSelect.prepend(allOption);
  topicSelect.value = 'all';

  difficultySelect.addEventListener('change', () => {
    populatePicker();
    renderProblem();
  });
  topicSelect.addEventListener('change', () => {
    populatePicker();
    renderProblem();
  });
  problemPicker.addEventListener('change', renderProblem);
  editor.addEventListener('input', () => {
    state.drafts[currentProblem.id] = editor.value;
    saveState();
  });
  resetButton.addEventListener('click', () => {
    if (editor.value !== currentProblem.starter && !window.confirm('Replace your current solution with starter code?')) return;
    delete state.drafts[currentProblem.id];
    saveState();
    editor.value = currentProblem.starter;
    results.hidden = true;
  });
  hintButton.addEventListener('click', () => {
    hint.hidden = !hint.hidden;
    hintButton.textContent = hint.hidden ? 'Show Hint' : 'Hide Hint';
  });
  nextButton.addEventListener('click', () => {
    const filtered = filteredProblems();
    const currentIndex = filtered.findIndex((problem) => problem.id === currentProblem.id);
    const next = filtered[(currentIndex + 1) % filtered.length];
    problemPicker.value = next.id;
    renderProblem();
  });
  runButton.addEventListener('click', async () => {
    const problemAtRun = currentProblem;
    const codeAtRun = editor.value;
    runButton.disabled = true;
    editor.disabled = true;
    difficultySelect.disabled = true;
    topicSelect.disabled = true;
    problemPicker.disabled = true;
    nextButton.disabled = true;
    status.textContent = worker ? 'Running tests…' : 'Loading Python runtime, then running tests…';
    results.hidden = true;
    try {
      const payload = await runPython({
        mode: 'problem',
        code: codeAtRun,
        functionName: problemAtRun.functionName,
        tests: problemAtRun.tests
      });
      renderTestResults(payload);
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
      renderTestResults({ ok: false, error: error.message });
      status.textContent = 'Run stopped.';
    } finally {
      runButton.disabled = false;
      editor.disabled = false;
      difficultySelect.disabled = false;
      topicSelect.disabled = false;
      problemPicker.disabled = false;
      nextButton.disabled = false;
    }
  });

  const freeEditor = document.querySelector('[data-python-free-code]');
  const freeRun = document.querySelector('[data-python-free-run]');
  const freeReset = document.querySelector('[data-python-free-reset]');
  const freeStatus = document.querySelector('[data-python-free-status]');
  const freeOutput = document.querySelector('[data-python-output]');
  freeEditor.value = state.freestyle || DEFAULT_FREE_CODE;
  freeEditor.addEventListener('input', () => {
    state.freestyle = freeEditor.value;
    saveState();
  });
  freeReset.addEventListener('click', () => {
    if (freeEditor.value !== DEFAULT_FREE_CODE && !window.confirm('Replace your freestyle program with the example?')) return;
    freeEditor.value = DEFAULT_FREE_CODE;
    state.freestyle = DEFAULT_FREE_CODE;
    saveState();
    freeOutput.textContent = 'Program output appears here.';
  });
  freeRun.addEventListener('click', async () => {
    freeRun.disabled = true;
    freeStatus.textContent = worker ? 'Running program…' : 'Loading Python runtime, then running program…';
    try {
      const payload = await runPython({ mode: 'free', code: freeEditor.value });
      freeOutput.textContent = payload.error
        ? `${payload.output || ''}${payload.output ? '\n' : ''}${payload.error}`
        : payload.output || '(Program finished with no output.)';
      freeStatus.textContent = payload.ok ? 'Program finished.' : 'Program finished with an error.';
    } catch (error) {
      freeOutput.textContent = error.message;
      freeStatus.textContent = 'Run stopped.';
    } finally {
      freeRun.disabled = false;
    }
  });

  renderProgress();
  populatePicker();
  renderProblem();
}());
