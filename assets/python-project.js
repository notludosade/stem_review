(function () {
  'use strict';

  const project = window.STEMPythonProject;
  if (!project) return;
  const STORAGE_KEY = 'stemplus:python-project:progress-engine:v1';
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved.code === 'string' && saved.completed && saved.scores) return saved;
    } catch (_) { /* Start fresh. */ }
    return { code: project.starter, completed: {}, scores: {}, active: 0 };
  };
  let state = load();
  let active = Math.min(state.active || 0, Math.max(0, project.tasks.findIndex((task) => !state.completed[task.id])));
  if (active < 0) active = project.tasks.length - 1;
  const save = () => {
    state.active = active;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* Keep work in memory. */ }
  };
  const repr = (value) => {
    if (value === null) return 'None';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (Array.isArray(value)) return `[${value.map(repr).join(', ')}]`;
    if (typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${repr(key)}: ${repr(item)}`).join(', ')}}`;
    return String(value);
  };

  let worker = null;
  let readyPromise = null;
  let requestId = 0;
  const pending = new Map();
  const stop = (error) => {
    worker?.terminate();
    worker = null;
    readyPromise = null;
    pending.forEach(({ reject, timer }) => { clearTimeout(timer); reject(error); });
    pending.clear();
  };
  const ensureWorker = () => {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve, reject) => {
      worker = new Worker('assets/python-project-worker.js', { type: 'module' });
      const timer = setTimeout(() => { const error = new Error('Python took too long to load. Check your connection.'); stop(error); reject(error); }, 30000);
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready') { clearTimeout(timer); resolve(); return; }
        if (data.type === 'fatal') { clearTimeout(timer); const error = new Error(`Python failed to load: ${data.error}`); stop(error); reject(error); return; }
        if (data.type === 'result' && pending.has(data.id)) {
          const request = pending.get(data.id);
          pending.delete(data.id);
          clearTimeout(request.timer);
          request.resolve(data.payload);
        }
      };
      worker.onerror = () => { clearTimeout(timer); const error = new Error('Python project runtime could not start. Use HTTPS or localhost.'); stop(error); reject(error); };
    });
    return readyPromise;
  };
  const execute = async (tasks) => {
    await ensureWorker();
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const timer = setTimeout(() => { const error = new Error('Project check stopped after 12 seconds.'); pending.delete(id); stop(error); reject(error); }, 12000);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, code: editor.value, tasks: tasks.map(({ id: taskId, entry, entryType, tests }) => ({ id: taskId, entry, entryType, tests })) });
    });
  };

  const taskList = document.querySelector('[data-project-tasks]');
  const taskNumber = document.querySelector('[data-project-number]');
  const course = document.querySelector('[data-project-course]');
  const title = document.querySelector('[data-project-title]');
  const prompt = document.querySelector('[data-project-prompt]');
  const requirements = document.querySelector('[data-project-requirements]');
  const examples = document.querySelector('[data-project-examples]');
  const hint = document.querySelector('[data-project-hint]');
  const hintButton = document.querySelector('[data-project-hint-button]');
  const editor = document.querySelector('[data-project-code]');
  const checkButton = document.querySelector('[data-project-check]');
  const jumpButton = document.querySelector('[data-project-jump]');
  const previousButton = document.querySelector('[data-project-previous]');
  const nextButton = document.querySelector('[data-project-next]');
  const resetButton = document.querySelector('[data-project-reset]');
  const status = document.querySelector('[data-project-status]');
  const results = document.querySelector('[data-project-results]');
  const scores = document.querySelector('[data-project-scores]');
  const progress = document.querySelector('[data-project-progress]');
  editor.value = state.code;

  const firstIncomplete = () => {
    const index = project.tasks.findIndex((task) => !state.completed[task.id]);
    return index < 0 ? project.tasks.length : index;
  };
  const targetBlock = (code, entry) => {
    const startMatch = new RegExp(`^(?:def|class)\\s+${entry}\\b`, 'm').exec(code);
    if (!startMatch) return '';
    const rest = code.slice(startMatch.index + startMatch[0].length);
    const next = /\n(?=^(?:def|class)\s+\w+)/m.exec(rest);
    return code.slice(startMatch.index, next ? startMatch.index + startMatch[0].length + next.index : code.length);
  };
  const scoreAttempt = (task, result) => {
    const block = targetBlock(editor.value, task.entry);
    const lines = block.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#') && line.trim() !== 'pass');
    const runtime = result.ok ? Math.max(1, Math.min(100, Math.round(100 * task.runtimeBudgetMs / Math.max(task.runtimeBudgetMs, result.durationMs)))) : 1;
    const excess = Math.max(0, lines.length - task.maxLines);
    const deepest = lines.reduce((max, line) => Math.max(max, (line.match(/^ */)[0].length / 4)), 0);
    const structure = Math.max(1, 100 - excess * 5 - Math.max(0, deepest - 4) * 5);
    const efficiency = result.ok ? structure : Math.min(50, structure);
    const matched = task.concepts.filter((concept) => concept.patterns.some((pattern) => new RegExp(pattern, 'm').test(block))).length;
    const application = Math.max(1, Math.round(100 * matched / task.concepts.length));
    return { runtime, efficiency, application, average: Math.round((runtime + efficiency + application) / 3), durationMs: result.durationMs, lines: lines.length };
  };
  const scoreCard = (label, value, detail) => {
    const card = document.createElement('div');
    card.className = 'project-score-card';
    const name = document.createElement('span');
    name.textContent = label;
    const amount = document.createElement('strong');
    amount.textContent = `${value}%`;
    card.append(name, amount);
    if (detail) { const small = document.createElement('small'); small.textContent = detail; card.appendChild(small); }
    return card;
  };
  const renderScores = (score) => {
    scores.replaceChildren();
    if (!score) { scores.hidden = true; return; }
    scores.append(
      scoreCard('Runtime', score.runtime, `${score.durationMs.toFixed(2)} ms`),
      scoreCard('Efficiency', score.efficiency, `${score.lines} meaningful lines`),
      scoreCard('Course application', score.application),
      scoreCard('Average', score.average)
    );
    scores.hidden = false;
  };
  const renderTaskList = () => {
    const unlockedThrough = firstIncomplete();
    taskList.replaceChildren();
    project.tasks.forEach((task, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `project-task-button${index === active ? ' is-active' : ''}${state.completed[task.id] ? ' is-complete' : ''}`;
      button.disabled = index > unlockedThrough;
      button.textContent = `${state.completed[task.id] ? '✓' : index > unlockedThrough ? '🔒' : index + 1} ${task.title}`;
      button.addEventListener('click', () => { active = index; save(); render(); });
      taskList.appendChild(button);
    });
  };
  const render = () => {
    const task = project.tasks[active];
    const completedCount = project.tasks.filter((item) => state.completed[item.id]).length;
    progress.textContent = `${completedCount}/${project.tasks.length} tasks completed${completedCount === project.tasks.length ? ' — project complete' : ''}`;
    taskNumber.textContent = `Task ${active + 1} of ${project.tasks.length}`;
    course.textContent = task.course;
    title.textContent = task.title;
    prompt.textContent = task.prompt;
    requirements.replaceChildren(...task.requirements.map((text) => { const item = document.createElement('li'); item.textContent = text; return item; }));
    examples.replaceChildren();
    task.tests.slice(0, 2).forEach((test) => {
      const pre = document.createElement('pre');
      pre.className = 'code-block';
      pre.textContent = `${task.entry}(${test.args.map(repr).join(', ')})\n# expected ${repr(test.expected)}`;
      examples.appendChild(pre);
    });
    hint.textContent = task.hint;
    hint.hidden = true;
    hintButton.textContent = 'Show Hint';
    results.hidden = true;
    status.textContent = state.completed[task.id] ? 'Task completed. Recheck after later edits to confirm it still passes.' : 'Check this task to run its tests and all prior regression tests.';
    previousButton.disabled = active === 0;
    nextButton.disabled = active === project.tasks.length - 1 || !state.completed[task.id];
    renderScores(state.scores[task.id]);
    renderTaskList();
  };
  const jumpToEntry = () => {
    const task = project.tasks[active];
    const match = new RegExp(`^(?:def|class)\\s+${task.entry}\\b`, 'm').exec(editor.value);
    if (!match) return;
    editor.focus();
    editor.setSelectionRange(match.index, match.index + match[0].length);
  };
  const renderResults = (task, taskResult, regressions, output) => {
    results.replaceChildren();
    results.className = `sandbox-results ${taskResult?.ok && regressions.length === 0 ? 'is-pass' : 'is-fail'}`;
    const heading = document.createElement('p');
    heading.className = 'test-result-score';
    if (!taskResult) heading.textContent = 'Code could not run';
    else heading.textContent = `${taskResult.results.filter((test) => test.passed).length}/${taskResult.results.length} current-task tests passed`;
    results.appendChild(heading);
    if (regressions.length) {
      const warning = document.createElement('p');
      warning.textContent = `Regression detected in: ${regressions.map((result) => project.tasks.find((item) => item.id === result.id).title).join(', ')}.`;
      results.appendChild(warning);
    }
    if (taskResult?.results) {
      const list = document.createElement('ul');
      taskResult.results.forEach((test) => {
        const item = document.createElement('li');
        item.className = test.passed ? 'is-correct' : 'is-incorrect';
        item.textContent = test.passed ? `Test ${test.index}: passed` : `Test ${test.index}: expected ${test.expected}; ${test.error || `got ${test.actual}`}`;
        list.appendChild(item);
      });
      results.appendChild(list);
    }
    if (output) { const pre = document.createElement('pre'); pre.className = 'sandbox-output'; pre.textContent = output; results.appendChild(pre); }
    results.hidden = false;
  };

  editor.addEventListener('input', () => { state.code = editor.value; save(); });
  hintButton.addEventListener('click', () => { hint.hidden = !hint.hidden; hintButton.textContent = hint.hidden ? 'Show Hint' : 'Hide Hint'; });
  jumpButton.addEventListener('click', jumpToEntry);
  previousButton.addEventListener('click', () => { if (active > 0) { active -= 1; save(); render(); } });
  nextButton.addEventListener('click', () => { if (active < project.tasks.length - 1 && state.completed[project.tasks[active].id]) { active += 1; save(); render(); jumpToEntry(); } });
  resetButton.addEventListener('click', () => {
    if (!window.confirm('Reset all project code, task completion, and scores?')) return;
    state = { code: project.starter, completed: {}, scores: {}, active: 0 };
    active = 0;
    editor.value = project.starter;
    save();
    render();
  });
  checkButton.addEventListener('click', async () => {
    const task = project.tasks[active];
    checkButton.disabled = true;
    status.textContent = worker ? 'Checking current task and regressions…' : 'Loading Python, then checking the project…';
    results.hidden = true;
    try {
      const payload = await execute(project.tasks.slice(0, active + 1));
      if (payload.error) throw new Error(payload.error);
      const taskResult = payload.tasks.find((result) => result.id === task.id);
      const regressions = payload.tasks.filter((result) => result.id !== task.id && !result.ok);
      const score = scoreAttempt(task, taskResult);
      renderScores(score);
      renderResults(task, taskResult, regressions, payload.output);
      if (taskResult.ok && regressions.length === 0) {
        state.completed[task.id] = true;
        state.scores[task.id] = score;
        save();
        status.textContent = active === project.tasks.length - 1 ? 'Project complete — every task and regression check passed.' : 'Task complete. The next task is unlocked.';
      } else status.textContent = regressions.length ? 'Fix the regression before this task can complete.' : 'Review the failed tests and try again.';
      renderTaskList();
      progress.textContent = `${project.tasks.filter((item) => state.completed[item.id]).length}/${project.tasks.length} tasks completed`;
      nextButton.disabled = active === project.tasks.length - 1 || !state.completed[task.id];
    } catch (error) {
      renderResults(task, null, [], '');
      const pre = document.createElement('pre'); pre.className = 'sandbox-error'; pre.textContent = error.message; results.appendChild(pre);
      status.textContent = 'Project check stopped.';
    } finally { checkButton.disabled = false; }
  });

  render();
}());
