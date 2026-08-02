(function () {
  'use strict';

  const project = window.STEMGuidedProject;
  if (!project) {
    document.body.textContent = 'Guided project not found.';
    return;
  }
  const STORAGE_KEY = `stemplus:guided-project:${project.id}:v1`;
  const MARKER = '__STEM_GUIDED_PROJECT__';
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const show = (value) => Array.isArray(value) ? `[${value.map(show).join(', ')}]` : typeof value === 'string' ? JSON.stringify(value) : String(value);
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

  const equalSource = `
const equal = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => equal(value, b[index]));
  return a === b;
};
const show = (value) => Array.isArray(value) ? '[' + value.map(show).join(', ') + ']' : typeof value === 'string' ? JSON.stringify(value) : String(value);
`;
  const runJavaScript = (code, tasks) => new Promise((resolve, reject) => {
    if (/\b(?:import|export)\b|\brequire\s*\(|\b(?:self|globalThis|indexedDB|caches)\b/.test(code)) {
      reject(new Error('Modules, packages, storage, and worker-global APIs are unavailable.'));
      return;
    }
    const source = `${equalSource}
const makeConsole = (lines) => ({ log: (...values) => lines.push(values.map(show).join(' ')), warn: (...values) => lines.push(values.map(show).join(' ')), error: (...values) => lines.push(values.map(show).join(' ')) });
onmessage = ({ data }) => {
  const lines = [];
  try {
    const names = [...new Set(data.tasks.map((task) => task.entry))];
    const exposed = names.map((name) => JSON.stringify(name) + ': typeof ' + name + ' === "function" ? ' + name + ' : null').join(',');
    const factory = Function('console', 'fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'postMessage', 'close', '"use strict";\\n' + data.code + '\\nreturn {' + exposed + '};');
    const entries = factory(makeConsole(lines), undefined, undefined, undefined, undefined, undefined, undefined);
    const taskResults = data.tasks.map((task) => {
      const entry = entries[task.entry];
      if (!entry) return { id: task.id, ok: false, durationMs: 0, error: 'Define function ' + task.entry + '.' };
      const started = performance.now();
      const results = task.tests.map((test, index) => {
        try {
          const actual = entry(...structuredClone(test.args));
          if (actual && typeof actual.then === 'function') throw new Error('Async solutions are unavailable.');
          return { index: index + 1, passed: equal(actual, test.expected), actual: show(actual), expected: show(test.expected) };
        } catch (error) { return { index: index + 1, passed: false, actual: error.name + ': ' + error.message, expected: show(test.expected) }; }
      });
      return { id: task.id, ok: results.every((test) => test.passed), durationMs: performance.now() - started, results };
    });
    postMessage({ tasks: taskResults, output: lines.join('\\n') });
  } catch (error) { postMessage({ error: error.name + ': ' + error.message, output: lines.join('\\n') }); }
};`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Run stopped after 8 seconds. Check for an infinite loop.')); }, 8000);
    worker.onmessage = ({ data }) => { clearTimeout(timer); worker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data); };
    worker.onerror = (event) => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message || 'JavaScript worker failed.')); };
    worker.postMessage({ code, tasks });
  });

  const typeOf = (type) => type.endsWith('[]') ? `std::vector<${typeOf(type.slice(0, -2))}>`
    : ({ long: 'long long', boolean: 'bool', String: 'std::string' }[type] || type);
  const cppString = (value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`;
  const cppLiteral = (type, value) => {
    if (type.endsWith('[]')) return `${typeOf(type)}{${value.map((item) => cppLiteral(type.slice(0, -2), item)).join(', ')}}`;
    if (type === 'String') return `std::string(${cppString(value)})`;
    if (type === 'boolean') return String(value);
    if (type === 'double') return Number.isInteger(value) ? `${value}.0` : String(value);
    return String(value);
  };
  const cppSupport = `
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
bool stemEqual(double left, double right) { return std::isfinite(left) && std::isfinite(right) && std::abs(left - right) <= 1e-9; }
template <typename T> bool stemEqual(const std::vector<T>& left, const std::vector<T>& right);
template <typename T> bool stemEqual(const T& left, const T& right) { return left == right; }
template <typename T> bool stemEqual(const std::vector<T>& left, const std::vector<T>& right) {
    if (left.size() != right.size()) return false;
    for (std::size_t i = 0; i < left.size(); ++i) if (!stemEqual(left[i], right[i])) return false;
    return true;
}
std::string stemShow(const std::string& value);
std::string stemShow(bool value);
template <typename T> std::string stemShow(const std::vector<T>& value);
template <typename T> std::string stemShow(const T& value) { std::ostringstream out; out << std::setprecision(17) << value; return out.str(); }
std::string stemShow(const std::string& value) { return "\\\"" + value + "\\\""; }
std::string stemShow(bool value) { return value ? "true" : "false"; }
template <typename T> std::string stemShow(const std::vector<T>& value) {
    std::string out = "[";
    for (std::size_t i = 0; i < value.size(); ++i) out += (i ? ", " : "") + stemShow(value[i]);
    return out + "]";
}
std::string stemHex(const std::string& value) {
    std::ostringstream out; out << std::hex << std::setfill('0');
    for (unsigned char character : value) out << std::setw(2) << static_cast<int>(character);
    return out.str();
}`;
  const clean = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');
  const compilerLines = (items) => (items || []).map((item) => item.text).join('\n');
  const runCpp = async (code, tasks) => {
    if (/\bmain\s*\(/.test(code)) throw new Error('Do not define main() inside the guided project.');
    const checks = tasks.flatMap((task, taskIndex) => task.tests.map((test, testIndex) => {
      const args = test.args.map((value, index) => cppLiteral(task.parameters[index][0], value)).join(', ');
      const expected = cppLiteral(task.returnType, test.expected);
      return `    try {
        auto started${taskIndex}_${testIndex} = std::chrono::steady_clock::now();
        auto actual${taskIndex}_${testIndex} = ${task.entry}(${args});
        auto elapsed${taskIndex}_${testIndex} = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - started${taskIndex}_${testIndex}).count();
        std::cout << "\\n${MARKER}${taskIndex}|${testIndex + 1}|" << (stemEqual(actual${taskIndex}_${testIndex}, ${expected}) ? 1 : 0) << "|" << stemHex(stemShow(actual${taskIndex}_${testIndex})) << "|" << elapsed${taskIndex}_${testIndex} << "\\n";
    } catch (const std::exception& error) {
        std::cout << "\\n${MARKER}${taskIndex}|${testIndex + 1}|0|" << stemHex(std::string("Error: ") + error.what()) << "|0\\n";
    }`;
    })).join('\n');
    const source = `#include <chrono>\n${cppSupport}\n${code}\nint main() {\n${checks}\n    return 0;\n}`;
    let response;
    try {
      response = await fetch('https://godbolt.org/api/compiler/g132/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ source, options: { userArguments: '-std=c++20 -Wall -Wextra', executeParameters: { args: [], stdin: '', runtimeTools: [] }, compilerOptions: { executorRequest: true }, filters: { execute: true }, tools: [], libraries: [] }, lang: 'c++', allowStoreCodeDebug: false })
      });
    } catch (_) { throw new Error('C++ compiler service is unreachable. Check your connection and try again.'); }
    if (!response.ok) throw new Error(`C++ compiler service returned ${response.status}. Try again shortly.`);
    const payload = await response.json();
    const buildError = clean(compilerLines(payload.buildResult?.stderr) || compilerLines(payload.stderr));
    if (payload.buildResult?.code !== 0 || (!payload.didExecute && payload.code !== 0)) throw new Error(buildError || 'C++ compilation failed.');
    const stdout = clean(compilerLines(payload.stdout));
    const found = [...stdout.matchAll(new RegExp(`${MARKER}(\\d+)\\|(\\d+)\\|([01])\\|([0-9a-f]*)\\|([0-9.eE+-]+)`, 'g'))];
    if (found.length !== tasks.reduce((sum, task) => sum + task.tests.length, 0)) throw new Error(clean(compilerLines(payload.stderr)) || stdout || 'C++ test runner did not finish.');
    const decodeHex = (hex) => { let text = ''; for (let index = 0; index < hex.length; index += 2) text += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16)); return text; };
    const taskResults = tasks.map((task, taskIndex) => {
      const matches = found.filter((match) => Number(match[1]) === taskIndex);
      const results = matches.map((match) => ({ index: Number(match[2]), passed: match[3] === '1', actual: decodeHex(match[4]), expected: show(task.tests[Number(match[2]) - 1].expected) }));
      return { id: task.id, ok: results.every((test) => test.passed), durationMs: matches.reduce((sum, match) => sum + Number(match[5]), 0), results };
    });
    return { tasks: taskResults, output: stdout.replace(new RegExp(`\\n?${MARKER}[^\\n]+`, 'g'), '').trim() };
  };

  const javaLiteral = (type, value) => {
    if (type.endsWith('[]')) return `new ${type}{${value.map((item) => javaLiteral(type.slice(0, -2), item)).join(', ')}}`;
    if (type === 'String') return JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
    if (type === 'boolean') return String(value);
    if (type === 'double') return Number.isInteger(value) ? `${value}.0` : String(value);
    return String(value);
  };
  const javaComparison = (type, actual, expected) => {
    if (type === 'double') return `Math.abs(${actual} - ${expected}) <= 1e-9`;
    if (type === 'double[]') return `equalDoubles(${actual}, ${expected})`;
    if (type.endsWith('[]')) return `java.util.Arrays.equals(${actual}, ${expected})`;
    if (type === 'String') return `java.util.Objects.equals(${actual}, ${expected})`;
    return `${actual} == ${expected}`;
  };
  let javaRuntime = null;
  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.onload = resolve; script.onerror = () => reject(new Error('Java runtime loader is unavailable. Check your connection.')); document.head.appendChild(script);
  });
  const ensureJava = () => {
    if (javaRuntime) return javaRuntime;
    javaRuntime = (async () => {
      if (typeof window.cheerpjInit !== 'function') await loadScript('https://cjrtnc.leaningtech.com/4.3/loader.js');
      await window.cheerpjInit({ status: 'none' });
      window.cheerpjCreateDisplay(1, 1, document.getElementById('cheerpjDisplay'));
      const response = await fetch('https://javafiddle.leaningtech.com/tools.jar');
      if (!response.ok) throw new Error(`Java compiler download failed (${response.status}).`);
      window.cheerpjAddStringFile('/str/tools.jar', new Uint8Array(await response.arrayBuffer()));
    })().catch((error) => { javaRuntime = null; throw error; });
    return javaRuntime;
  };
  const javaOutput = () => {
    const consoleElement = document.getElementById('console');
    const displayElement = document.getElementById('cheerpjDisplay');
    return (consoleElement.innerText || consoleElement.textContent || displayElement.innerText || displayElement.textContent || '').trim();
  };
  const clearJavaOutput = () => { document.getElementById('console').replaceChildren(); document.getElementById('cheerpjDisplay').replaceChildren(); };
  const runJava = async (code, tasks) => {
    if (!/\bpublic\s+class\s+Main\b/.test(code)) throw new Error('Define public class Main.');
    if (/^\s*package\s/m.test(code)) throw new Error('Package declarations are unavailable.');
    const imports = code.match(/^\s*import\s+[^;]+;/gm) || [];
    if (imports.some((line) => !/^\s*import\s+java\.util(?:\.[\w*]+)+;\s*$/.test(line))) throw new Error('Only java.util imports are available.');
    const checks = tasks.flatMap((task, taskIndex) => task.tests.map((test, testIndex) => {
      const args = test.args.map((value, index) => javaLiteral(task.parameters[index][0], value)).join(', ');
      const expected = javaLiteral(task.returnType, test.expected);
      const actual = `actual${taskIndex}_${testIndex}`;
      return `        try {
            long started = System.nanoTime();
            ${task.returnType} ${actual} = Main.${task.entry}(${args});
            double elapsed = (System.nanoTime() - started) / 1000000.0;
            report(${taskIndex}, ${testIndex + 1}, ${javaComparison(task.returnType, actual, expected)}, format(${actual}), elapsed);
        } catch (Throwable error) { report(${taskIndex}, ${testIndex + 1}, false, error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage()), 0); }`;
    })).join('\n');
    const harness = `class StemProjectTests {
    private static boolean equalDoubles(double[] a, double[] b) { if (a == null || b == null || a.length != b.length) return false; for (int i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return false; return true; }
    private static String format(Object value) { if (value instanceof int[]) return java.util.Arrays.toString((int[]) value); if (value instanceof double[]) return java.util.Arrays.toString((double[]) value); if (value instanceof Object[]) return java.util.Arrays.deepToString((Object[]) value); return String.valueOf(value); }
    private static void report(int task, int test, boolean passed, String actual, double elapsed) { String encoded = java.util.Base64.getEncoder().encodeToString(actual.getBytes(java.nio.charset.StandardCharsets.UTF_8)); System.out.println("${MARKER}" + task + "|" + test + "|" + passed + "|" + encoded + "|" + elapsed); }
    public static void main(String[] args) {
${checks}
    }
}`;
    await ensureJava();
    const encoder = new TextEncoder();
    window.cheerpjAddStringFile('/str/Main.java', encoder.encode(code));
    window.cheerpjAddStringFile('/str/StemProjectTests.java', encoder.encode(harness));
    clearJavaOutput();
    const compiled = await window.cheerpjRunMain('com.sun.tools.javac.Main', '/str/tools.jar:/files/', '/str/Main.java', '/str/StemProjectTests.java', '-d', '/files/', '-source', '8', '-target', '8', '-Xlint:none');
    if (compiled !== 0) throw new Error(javaOutput() || 'Java compilation failed.');
    clearJavaOutput();
    const exitCode = await window.cheerpjRunMain('StemProjectTests', '/str/tools.jar:/files/');
    const output = javaOutput();
    if (exitCode !== 0 && !output.includes(MARKER)) throw new Error(output || `Java exited with code ${exitCode}.`);
    const found = output.split(/\r?\n/).filter((line) => line.includes(MARKER)).map((line) => line.slice(line.indexOf(MARKER) + MARKER.length).split('|'));
    if (found.length !== tasks.reduce((sum, task) => sum + task.tests.length, 0)) throw new Error(output || 'Java test runner did not finish.');
    const decode = (value) => new TextDecoder().decode(Uint8Array.from(atob(value || ''), (char) => char.charCodeAt(0)));
    const taskResults = tasks.map((task, taskIndex) => {
      const matches = found.filter((parts) => Number(parts[0]) === taskIndex);
      const results = matches.map((parts) => ({ index: Number(parts[1]), passed: parts[2] === 'true', actual: decode(parts[3]), expected: show(task.tests[Number(parts[1]) - 1].expected) }));
      return { id: task.id, ok: results.every((test) => test.passed), durationMs: matches.reduce((sum, parts) => sum + Number(parts[4]), 0), results };
    });
    return { tasks: taskResults, output: output.split(/\r?\n/).filter((line) => !line.includes(MARKER)).join('\n') };
  };

  const execute = (tasks) => ({ javascript: runJavaScript, cpp: runCpp, java: runJava }[project.key])(state.code, clone(tasks));
  const literal = (type, value) => project.key === 'cpp' ? cppLiteral(type, value) : project.key === 'java' ? javaLiteral(type, value) : JSON.stringify(value);
  const exampleCall = (task, args) => `${project.key === 'java' ? 'Main.' : ''}${task.entry}(${args.map((value, index) => literal(task.parameters[index][0], value)).join(', ')})`;

  const taskList = document.querySelector('[data-project-tasks]');
  const editor = document.querySelector('[data-project-code]');
  const scores = document.querySelector('[data-project-scores]');
  const results = document.querySelector('[data-project-results]');
  const status = document.querySelector('[data-project-status]');
  const progress = document.querySelector('[data-project-progress]');
  const checkButton = document.querySelector('[data-project-check]');
  const nextButton = document.querySelector('[data-project-next]');
  const previousButton = document.querySelector('[data-project-previous]');
  const hintButton = document.querySelector('[data-project-hint-button]');
  const hint = document.querySelector('[data-project-hint]');
  const firstIncomplete = () => { const index = project.tasks.findIndex((task) => !state.completed[task.id]); return index < 0 ? project.tasks.length : index; };
  const targetBlock = (code, entry) => {
    const patterns = {
      javascript: new RegExp(`function\\s+${entry}\\s*\\(`),
      java: new RegExp(`(?:public\\s+)?static\\s+[\\w<>\\[\\]]+\\s+${entry}\\s*\\(`),
      cpp: new RegExp(`^[^\\n;{}]+\\b${entry}\\s*\\([^;]*\\)\\s*\\{`, 'm')
    };
    const match = patterns[project.key].exec(code);
    if (!match) return '';
    const open = code.indexOf('{', match.index);
    let depth = 0;
    for (let index = open; index < code.length; index += 1) {
      if (code[index] === '{') depth += 1;
      if (code[index] === '}' && --depth === 0) return code.slice(match.index, index + 1);
    }
    return code.slice(match.index);
  };
  const scoreAttempt = (task, result) => {
    const block = targetBlock(editor.value, task.entry);
    const lines = block.split('\n').filter((line) => line.trim() && !/^\s*(?:\/\/|#)/.test(line));
    const runtime = result.ok ? Math.max(1, Math.min(100, Math.round(100 * task.runtimeBudgetMs / Math.max(task.runtimeBudgetMs, result.durationMs)))) : 1;
    const deepest = lines.reduce((max, line) => Math.max(max, (line.match(/^ */)[0].length / project.indent)), 0);
    const efficiency = result.ok ? Math.max(1, 100 - Math.max(0, lines.length - task.maxLines) * 5 - Math.max(0, deepest - 4) * 5) : 1;
    const matched = task.concepts.filter((concept) => concept.patterns.some((pattern) => new RegExp(pattern, 'm').test(block))).length;
    const application = Math.max(1, Math.round(100 * matched / task.concepts.length));
    return { runtime, efficiency, application, average: Math.round((runtime + efficiency + application) / 3), durationMs: result.durationMs, lines: lines.length };
  };
  const scoreCard = (label, value, detail) => {
    const card = document.createElement('div'); card.className = 'project-score-card';
    const name = document.createElement('span'); name.textContent = label;
    const amount = document.createElement('strong'); amount.textContent = `${value}%`; card.append(name, amount);
    if (detail) { const small = document.createElement('small'); small.textContent = detail; card.appendChild(small); }
    return card;
  };
  const renderScores = (score) => {
    scores.replaceChildren();
    if (!score) { scores.hidden = true; return; }
    scores.append(scoreCard('Runtime', score.runtime, `${score.durationMs.toFixed(2)} ms`), scoreCard('Efficiency', score.efficiency, `${score.lines} meaningful lines`), scoreCard('Course application', score.application), scoreCard('Average', score.average));
    scores.hidden = false;
  };
  const renderTaskList = () => {
    const unlockedThrough = firstIncomplete(); taskList.replaceChildren();
    project.tasks.forEach((task, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = `project-task-button${index === active ? ' is-active' : ''}${state.completed[task.id] ? ' is-complete' : ''}`;
      button.disabled = index > unlockedThrough;
      button.textContent = `${state.completed[task.id] ? '✓' : index > unlockedThrough ? '🔒' : index + 1} ${task.title}`;
      button.addEventListener('click', () => { active = index; save(); render(); }); taskList.appendChild(button);
    });
  };
  const render = () => {
    const task = project.tasks[active]; const completed = project.tasks.filter((item) => state.completed[item.id]).length;
    progress.textContent = `${completed}/${project.tasks.length} tasks completed${completed === project.tasks.length ? ' — project complete' : ''}`;
    document.querySelector('[data-project-number]').textContent = `Task ${active + 1} of ${project.tasks.length}`;
    document.querySelector('[data-project-course]').textContent = task.course;
    document.querySelector('[data-project-title]').textContent = task.title;
    document.querySelector('[data-project-prompt]').textContent = task.prompt;
    document.querySelector('[data-project-requirements]').replaceChildren(...task.requirements.map((text) => { const item = document.createElement('li'); item.textContent = text; return item; }));
    const examples = document.querySelector('[data-project-examples]'); examples.replaceChildren();
    task.tests.slice(0, 2).forEach((test) => { const pre = document.createElement('pre'); pre.className = 'code-block'; pre.textContent = `${exampleCall(task, test.args)}\n// expected ${show(test.expected)}`; examples.appendChild(pre); });
    hint.textContent = task.hint; hint.hidden = true; hintButton.textContent = 'Show Hint'; results.hidden = true;
    status.textContent = state.completed[task.id] ? 'Task completed. Recheck after later edits to confirm it still passes.' : 'Check this task to run its tests and all prior regression tests.';
    previousButton.disabled = active === 0; nextButton.disabled = active === project.tasks.length - 1 || !state.completed[task.id];
    renderScores(state.scores[task.id]); renderTaskList();
  };
  const renderResults = (task, taskResult, regressions, output) => {
    results.replaceChildren(); results.className = `sandbox-results ${taskResult?.ok && !regressions.length ? 'is-pass' : 'is-fail'}`;
    const heading = document.createElement('p'); heading.className = 'test-result-score';
    heading.textContent = taskResult ? `${taskResult.results.filter((test) => test.passed).length}/${taskResult.results.length} current-task tests passed` : 'Code could not run'; results.appendChild(heading);
    if (regressions.length) { const warning = document.createElement('p'); warning.textContent = `Regression detected in: ${regressions.map((result) => project.tasks.find((item) => item.id === result.id).title).join(', ')}.`; results.appendChild(warning); }
    if (taskResult?.results) {
      const list = document.createElement('ul'); taskResult.results.forEach((test) => { const item = document.createElement('li'); item.className = test.passed ? 'is-correct' : 'is-incorrect'; item.textContent = test.passed ? `Test ${test.index}: passed` : `Test ${test.index}: expected ${test.expected}; got ${test.actual}`; list.appendChild(item); }); results.appendChild(list);
    }
    if (output) { const pre = document.createElement('pre'); pre.className = 'sandbox-output'; pre.textContent = output; results.appendChild(pre); }
    results.hidden = false;
  };

  document.title = `${project.language} Guided Project — STEM+`;
  document.querySelector('.page').dataset.indentSize = project.indent;
  document.querySelector('[data-project-kicker]').textContent = `STEM+ · Guided Sandbox Project · ${project.language}`;
  document.querySelector('[data-project-page-title]').textContent = project.title;
  document.querySelector('[data-project-subtitle]').textContent = project.description;
  const problemLink = document.querySelector('[data-project-problems]'); problemLink.href = project.problemHref; problemLink.textContent = `${project.language} Problems`;
  document.querySelector('[data-project-runtime-note]').textContent = project.key === 'cpp' ? 'Checks use the same remote GCC 13.2 service as the C++ sandbox; current project code is sent for compilation with storage disabled.' : project.key === 'java' ? 'Java compiles and runs inside this browser through CheerpJ. The compiler loads on the first check.' : 'JavaScript checks run inside a fresh disposable browser worker with modules, storage, and network APIs blocked.';
  document.querySelector('[data-project-editor-label]').textContent = `Cumulative ${project.language} project code`;
  document.querySelector('[data-project-footer]').textContent = `STEM+ · ${project.language} Guided Project · 10 ordered milestones`;
  editor.value = state.code;
  editor.addEventListener('input', () => { state.code = editor.value; save(); });
  hintButton.addEventListener('click', () => { hint.hidden = !hint.hidden; hintButton.textContent = hint.hidden ? 'Show Hint' : 'Hide Hint'; });
  document.querySelector('[data-project-jump]').addEventListener('click', () => { const block = targetBlock(editor.value, project.tasks[active].entry); if (!block) return; const index = editor.value.indexOf(block); editor.focus(); editor.setSelectionRange(index, index + block.split(/[\n{]/)[0].length); });
  previousButton.addEventListener('click', () => { if (active > 0) { active -= 1; save(); render(); } });
  nextButton.addEventListener('click', () => { if (active < project.tasks.length - 1 && state.completed[project.tasks[active].id]) { active += 1; save(); render(); } });
  document.querySelector('[data-project-reset]').addEventListener('click', () => { if (!confirm('Reset all project code, task completion, and scores?')) return; state = { code: project.starter, completed: {}, scores: {}, active: 0 }; active = 0; editor.value = project.starter; save(); render(); });
  checkButton.addEventListener('click', async () => {
    const task = project.tasks[active]; checkButton.disabled = true; status.textContent = `Checking ${project.language} task and regressions…`; results.hidden = true;
    try {
      state.code = editor.value; const payload = await execute(project.tasks.slice(0, active + 1));
      const taskResult = payload.tasks.find((result) => result.id === task.id);
      const regressions = payload.tasks.filter((result) => result.id !== task.id && !result.ok);
      const score = scoreAttempt(task, taskResult); renderScores(score); renderResults(task, taskResult, regressions, payload.output);
      if (taskResult.ok && !regressions.length) { state.completed[task.id] = true; state.scores[task.id] = score; save(); status.textContent = active === project.tasks.length - 1 ? 'Project complete — every task and regression check passed.' : 'Task complete. The next task is unlocked.'; }
      else status.textContent = regressions.length ? 'Fix the regression before this task can complete.' : 'Review the failed tests and try again.';
      renderTaskList(); progress.textContent = `${project.tasks.filter((item) => state.completed[item.id]).length}/${project.tasks.length} tasks completed`; nextButton.disabled = active === project.tasks.length - 1 || !state.completed[task.id];
    } catch (error) { renderResults(task, null, [], ''); const pre = document.createElement('pre'); pre.className = 'sandbox-error'; pre.textContent = error.message; results.appendChild(pre); status.textContent = 'Project check stopped.'; }
    finally { checkButton.disabled = false; }
  });
  render();
}());
