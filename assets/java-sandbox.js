(function () {
  'use strict';

  const api = window.STEMJavaProblems;
  if (!api) return;

  const STORAGE_KEY = 'stemplus:java-sandbox:v1';
  const TEST_MARKER = '__STEM_JAVA_TEST__';
  const DEFAULT_FREE_CODE = `public class Main {
    public static void main(String[] args) {
        for (int number = 1; number <= 3; number++) {
            System.out.println(number + ": Hello from Java!");
        }
    }
}`;

  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && saved.solved && saved.drafts ? saved : { solved: {}, drafts: {}, freestyle: DEFAULT_FREE_CODE };
    } catch (_) {
      return { solved: {}, drafts: {}, freestyle: DEFAULT_FREE_CODE };
    }
  };
  const saveState = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* Progress remains in memory. */ }
  };

  const javaLiteral = (type, value) => {
    if (type.endsWith('[]')) {
      const itemType = type.slice(0, -2);
      return `new ${type}{${value.map((item) => javaLiteral(itemType, item)).join(', ')}}`;
    }
    if (type === 'String') return JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
    if (type === 'boolean') return String(value);
    if (type === 'long') return `${value}L`;
    if (type === 'double') return Number.isInteger(value) ? `${value}.0` : String(value);
    return String(value);
  };
  const displayValue = (value) => Array.isArray(value)
    ? `[${value.map(displayValue).join(', ')}]`
    : typeof value === 'string' ? JSON.stringify(value) : String(value);

  const comparisonFor = (type, actual, expected) => {
    if (type === 'double') return `Math.abs(${actual} - ${expected}) <= 1e-9`;
    if (type === 'double[]') return `equalDoubles(${actual}, ${expected})`;
    if (type === 'int[][]') return `java.util.Arrays.deepEquals(${actual}, ${expected})`;
    if (type.endsWith('[]')) return `java.util.Arrays.equals(${actual}, ${expected})`;
    if (type === 'String') return `java.util.Objects.equals(${actual}, ${expected})`;
    return `${actual} == ${expected}`;
  };

  const buildHarness = (problem) => {
    const checks = problem.tests.map((test, index) => {
      const args = test.args.map((value, argIndex) => javaLiteral(problem.parameters[argIndex][0], value)).join(', ');
      const expected = javaLiteral(problem.returnType, test.expected);
      const actual = `actual${index}`;
      return `        try {
            ${problem.returnType} ${actual} = Main.${problem.methodName}(${args});
            boolean passed = ${comparisonFor(problem.returnType, actual, expected)};
            report(${index + 1}, passed, format(${actual}));
        } catch (Throwable error) {
            report(${index + 1}, false, error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage()));
        }`;
    }).join('\n');

    return `class StemTests {
    private static boolean equalDoubles(double[] left, double[] right) {
        if (left == null || right == null || left.length != right.length) return false;
        for (int i = 0; i < left.length; i++) if (Math.abs(left[i] - right[i]) > 1e-9) return false;
        return true;
    }
    private static String format(Object value) {
        if (value instanceof int[]) return java.util.Arrays.toString((int[]) value);
        if (value instanceof long[]) return java.util.Arrays.toString((long[]) value);
        if (value instanceof double[]) return java.util.Arrays.toString((double[]) value);
        if (value instanceof boolean[]) return java.util.Arrays.toString((boolean[]) value);
        if (value instanceof Object[]) return java.util.Arrays.deepToString((Object[]) value);
        return String.valueOf(value);
    }
    private static void report(int index, boolean passed, String actual) {
        String encoded = java.util.Base64.getEncoder().encodeToString(actual.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        System.out.println("${TEST_MARKER}" + index + "|" + passed + "|" + encoded);
    }
    public static void main(String[] args) {
${checks}
    }
}`;
  };

  const validateCode = (code) => {
    if (/^\s*package\s/m.test(code)) throw new Error('Package declarations are unavailable in this sandbox.');
    const imports = code.match(/^\s*import\s+[^;]+;/gm) || [];
    if (imports.some((line) => !/^\s*import\s+java\.util(?:\.[\w*]+)+;\s*$/.test(line))) {
      throw new Error('Only java.util imports are available in this sandbox.');
    }
    if (/\b(?:java\.(?:io|net|nio\.file|lang\.reflect)|ProcessBuilder|Runtime\.getRuntime|System\.in|Thread|ClassLoader)\b/.test(code)) {
      throw new Error('File, network, process, reflection, input, and thread APIs are unavailable.');
    }
    if (!/\bpublic\s+class\s+Main\b/.test(code)) throw new Error('Define public class Main.');
  };

  const consoleElement = document.getElementById('console');
  const displayElement = document.getElementById('cheerpjDisplay');
  const clearRuntimeOutput = () => {
    consoleElement.replaceChildren();
    displayElement.replaceChildren();
  };
  const runtimeOutput = () => (consoleElement.innerText || consoleElement.textContent || displayElement.innerText || displayElement.textContent || '').trim();

  let runtimePromise = null;
  const ensureRuntime = () => {
    if (runtimePromise) return runtimePromise;
    runtimePromise = (async () => {
      if (typeof window.cheerpjInit !== 'function') throw new Error('Java runtime loader is unavailable. Check your connection.');
      await window.cheerpjInit({ status: 'none' });
      window.cheerpjCreateDisplay(1, 1, displayElement);
      const response = await fetch('https://javafiddle.leaningtech.com/tools.jar');
      if (!response.ok) throw new Error(`Java compiler download failed (${response.status}).`);
      window.cheerpjAddStringFile('/str/tools.jar', new Uint8Array(await response.arrayBuffer()));
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
    return runtimePromise;
  };

  const compile = async (code, harness) => {
    validateCode(code);
    await ensureRuntime();
    const encoder = new TextEncoder();
    window.cheerpjAddStringFile('/str/Main.java', encoder.encode(code));
    const sources = ['/str/Main.java'];
    if (harness) {
      window.cheerpjAddStringFile('/str/StemTests.java', encoder.encode(harness));
      sources.push('/str/StemTests.java');
    }
    clearRuntimeOutput();
    const exitCode = await window.cheerpjRunMain(
      'com.sun.tools.javac.Main',
      '/str/tools.jar:/files/',
      ...sources,
      '-d', '/files/', '-source', '8', '-target', '8', '-Xlint:none'
    );
    if (exitCode !== 0) throw new Error(runtimeOutput() || 'Java compilation failed.');
  };

  const runProblem = async (problem, code) => {
    await compile(code, buildHarness(problem));
    clearRuntimeOutput();
    const exitCode = await window.cheerpjRunMain('StemTests', '/str/tools.jar:/files/');
    const output = runtimeOutput();
    if (exitCode !== 0 && !output.includes(TEST_MARKER)) throw new Error(output || `Java exited with code ${exitCode}.`);
    const results = [];
    const userOutput = [];
    output.split(/\r?\n/).forEach((line) => {
      const markerIndex = line.indexOf(TEST_MARKER);
      if (markerIndex < 0) {
        if (line.trim()) userOutput.push(line);
        return;
      }
      const parts = line.slice(markerIndex + TEST_MARKER.length).split('|');
      const index = Number(parts[0]);
      const actual = new TextDecoder().decode(Uint8Array.from(atob(parts[2] || ''), (char) => char.charCodeAt(0)));
      results.push({ index, passed: parts[1] === 'true', actual, expected: displayValue(problem.tests[index - 1].expected) });
    });
    if (results.length !== problem.tests.length) throw new Error(output || 'Java test runner did not finish. Check for an infinite loop.');
    return { ok: results.every((test) => test.passed), results, output: userOutput.join('\n') };
  };

  const runFree = async (code) => {
    await compile(code);
    clearRuntimeOutput();
    const exitCode = await window.cheerpjRunMain('Main', '/str/tools.jar:/files/');
    const output = runtimeOutput();
    return { ok: exitCode === 0, output, error: exitCode === 0 ? '' : output || `Java exited with code ${exitCode}.` };
  };

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

  const difficultySelect = document.querySelector('[data-java-difficulty]');
  const topicSelect = document.querySelector('[data-java-topic]');
  const picker = document.querySelector('[data-java-picker]');
  const progressText = document.querySelector('[data-java-progress]');
  const numberText = document.querySelector('[data-java-number]');
  const problemTopic = document.querySelector('[data-java-problem-topic]');
  const title = document.querySelector('[data-java-title]');
  const prompt = document.querySelector('[data-java-prompt]');
  const examples = document.querySelector('[data-java-examples]');
  const solved = document.querySelector('[data-java-solved]');
  const editor = document.querySelector('[data-java-code]');
  const runButton = document.querySelector('[data-java-run]');
  const resetButton = document.querySelector('[data-java-reset]');
  const hintButton = document.querySelector('[data-java-hint-button]');
  const hint = document.querySelector('[data-java-hint]');
  const nextButton = document.querySelector('[data-java-next]');
  const status = document.querySelector('[data-java-status]');
  const resultsElement = document.querySelector('[data-java-results]');

  let state = loadState();
  let currentProblem = null;
  const filteredProblems = () => api.problems.filter((problem) => (
    (difficultySelect.value === 'all' || problem.difficulty === difficultySelect.value)
    && (topicSelect.value === 'all' || problem.topic === topicSelect.value)
  ));
  const renderProgress = () => {
    const totalSolved = api.problems.filter((problem) => state.solved[problem.id]).length;
    const byDifficulty = ['Easy', 'Medium', 'Hard'].map((difficulty) => {
      const problems = api.problems.filter((problem) => problem.difficulty === difficulty);
      return `${problems.filter((problem) => state.solved[problem.id]).length}/${problems.length} ${difficulty}`;
    });
    progressText.textContent = `${totalSolved}/${api.problems.length} solved · ${byDifficulty.join(' · ')}`;
  };
  const populatePicker = (preferredId) => {
    const filtered = filteredProblems();
    const fallback = filtered.find((problem) => !state.solved[problem.id]) || filtered[0];
    const selectedId = filtered.some((problem) => problem.id === preferredId) ? preferredId : fallback.id;
    picker.replaceChildren();
    filtered.forEach((problem) => {
      const option = document.createElement('option');
      option.value = problem.id;
      option.textContent = `${state.solved[problem.id] ? '✓ ' : ''}${problem.id.slice(5)} · ${problem.title} · ${problem.difficulty}`;
      option.selected = problem.id === selectedId;
      picker.appendChild(option);
    });
  };
  const renderProblem = () => {
    currentProblem = api.getProblem(picker.value);
    numberText.textContent = `Problem ${api.problems.indexOf(currentProblem) + 1} of ${api.problems.length}`;
    problemTopic.textContent = `${currentProblem.difficulty} · ${currentProblem.topic}`;
    title.textContent = currentProblem.title;
    prompt.textContent = currentProblem.prompt;
    solved.textContent = state.solved[currentProblem.id] ? 'Solved' : 'Not solved yet';
    solved.className = state.solved[currentProblem.id] ? 'sandbox-solved is-solved' : 'sandbox-solved';
    editor.value = state.drafts[currentProblem.id] || currentProblem.starter;
    hint.textContent = currentProblem.hint;
    hint.hidden = true;
    hintButton.textContent = 'Show Hint';
    resultsElement.hidden = true;
    resultsElement.replaceChildren();
    status.textContent = 'Java compiler loads on first run.';
    examples.replaceChildren();
    currentProblem.tests.slice(0, 2).forEach((test) => {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      pre.className = 'code-block';
      code.textContent = `Main.${currentProblem.methodName}(${test.args.map((value, index) => javaLiteral(currentProblem.parameters[index][0], value)).join(', ')})\n// returns ${displayValue(test.expected)}`;
      pre.appendChild(code);
      examples.appendChild(pre);
    });
  };

  const renderTestResults = (payload) => {
    resultsElement.replaceChildren();
    resultsElement.className = `sandbox-results ${payload.ok ? 'is-pass' : 'is-fail'}`;
    const heading = document.createElement('p');
    heading.className = 'test-result-score';
    const score = payload.results ? payload.results.filter((test) => test.passed).length : 0;
    heading.textContent = payload.error ? 'Code could not run' : `${score}/${payload.results.length} tests passed${payload.ok ? ' — solved' : ''}`;
    resultsElement.appendChild(heading);
    if (payload.error) {
      const error = document.createElement('pre');
      error.className = 'sandbox-error';
      error.textContent = payload.error;
      resultsElement.appendChild(error);
    } else {
      const list = document.createElement('ul');
      payload.results.forEach((test) => {
        const item = document.createElement('li');
        item.className = test.passed ? 'is-correct' : 'is-incorrect';
        item.textContent = test.passed ? `Test ${test.index}: passed` : `Test ${test.index}: expected ${test.expected}; got ${test.actual}`;
        list.appendChild(item);
      });
      resultsElement.appendChild(list);
    }
    if (payload.output) {
      const output = document.createElement('pre');
      output.className = 'sandbox-output';
      output.textContent = payload.output;
      resultsElement.appendChild(output);
    }
    resultsElement.hidden = false;
  };

  api.topics.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    topicSelect.appendChild(option);
  });
  const allTopics = document.createElement('option');
  allTopics.value = 'all';
  allTopics.textContent = 'All topics';
  topicSelect.prepend(allTopics);
  topicSelect.value = 'all';
  const refreshFilter = () => { populatePicker(); renderProblem(); };
  difficultySelect.addEventListener('change', refreshFilter);
  topicSelect.addEventListener('change', refreshFilter);
  picker.addEventListener('change', renderProblem);
  editor.addEventListener('input', () => { state.drafts[currentProblem.id] = editor.value; saveState(); });
  resetButton.addEventListener('click', () => {
    if (editor.value !== currentProblem.starter && !window.confirm('Replace your current solution with starter code?')) return;
    delete state.drafts[currentProblem.id];
    saveState();
    editor.value = currentProblem.starter;
    resultsElement.hidden = true;
  });
  hintButton.addEventListener('click', () => {
    hint.hidden = !hint.hidden;
    hintButton.textContent = hint.hidden ? 'Show Hint' : 'Hide Hint';
  });
  nextButton.addEventListener('click', () => {
    const filtered = filteredProblems();
    const index = filtered.findIndex((problem) => problem.id === currentProblem.id);
    picker.value = filtered[(index + 1) % filtered.length].id;
    renderProblem();
  });
  runButton.addEventListener('click', async () => {
    const problemAtRun = currentProblem;
    const codeAtRun = editor.value;
    [runButton, editor, difficultySelect, topicSelect, picker, nextButton].forEach((element) => { element.disabled = true; });
    status.textContent = runtimePromise ? 'Compiling and running tests…' : 'Loading Java compiler, then running tests…';
    resultsElement.hidden = true;
    try {
      const payload = await runProblem(problemAtRun, codeAtRun);
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
      [runButton, editor, difficultySelect, topicSelect, picker, nextButton].forEach((element) => { element.disabled = false; });
    }
  });

  const freeEditor = document.querySelector('[data-java-free-code]');
  const freeRun = document.querySelector('[data-java-free-run]');
  const freeReset = document.querySelector('[data-java-free-reset]');
  const freeStatus = document.querySelector('[data-java-free-status]');
  const freeOutput = document.querySelector('[data-java-output]');
  freeEditor.value = state.freestyle || DEFAULT_FREE_CODE;
  freeEditor.addEventListener('input', () => { state.freestyle = freeEditor.value; saveState(); });
  freeReset.addEventListener('click', () => {
    if (freeEditor.value !== DEFAULT_FREE_CODE && !window.confirm('Replace your freestyle program with the example?')) return;
    freeEditor.value = DEFAULT_FREE_CODE;
    state.freestyle = DEFAULT_FREE_CODE;
    saveState();
    freeOutput.textContent = 'Program output appears here.';
  });
  freeRun.addEventListener('click', async () => {
    freeRun.disabled = true;
    freeStatus.textContent = runtimePromise ? 'Compiling and running…' : 'Loading Java compiler, then running…';
    try {
      const payload = await runFree(freeEditor.value);
      freeOutput.textContent = payload.error || payload.output || '(Program finished with no output.)';
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
