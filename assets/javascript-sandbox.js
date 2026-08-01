(function () {
  'use strict';

  const api = window.STEMJavaScriptProblems;
  if (!api) return;
  const DEFAULT_FREE_CODE = `const course = 'Computer Programming';

for (let number = 1; number <= 3; number += 1) {
  console.log(\`${'${number}'}: Hello from JavaScript!\`);
}`;
  const displayValue = (value) => Array.isArray(value)
    ? `[${value.map(displayValue).join(', ')}]`
    : typeof value === 'string' ? JSON.stringify(value) : String(value);
  const workerSource = `
const equal = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => equal(value, b[index]));
  return a === b;
};
const show = (value) => Array.isArray(value) ? '[' + value.map(show).join(', ') + ']' : typeof value === 'string' ? JSON.stringify(value) : String(value);
const makeConsole = (lines) => ({ log: (...values) => lines.push(values.map(show).join(' ')), warn: (...values) => lines.push(values.map(show).join(' ')), error: (...values) => lines.push(values.map(show).join(' ')) });
onmessage = ({ data }) => {
  const lines = [];
  try {
    const blocked = [undefined, undefined, undefined, undefined, undefined, undefined, undefined];
    if (data.mode === 'problem') {
      const factory = Function('console', 'fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'postMessage', 'close', '"use strict";\\n' + data.code + '\\nreturn typeof ' + data.functionName + ' === "function" ? ' + data.functionName + ' : null;');
      const solution = factory(makeConsole(lines), ...blocked);
      if (!solution) throw new Error('Define function ' + data.functionName + '.');
      const results = data.tests.map((test, index) => {
        try {
          const actual = solution(...structuredClone(test.args));
          if (actual && typeof actual.then === 'function') throw new Error('Async solutions are unavailable.');
          return { index: index + 1, passed: equal(actual, test.expected), actual: show(actual), expected: show(test.expected) };
        } catch (error) { return { index: index + 1, passed: false, actual: error.name + ': ' + error.message, expected: show(test.expected) }; }
      });
      postMessage({ ok: results.every((test) => test.passed), results, output: lines.join('\\n') });
    } else {
      Function('console', 'fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'postMessage', 'close', '"use strict";\\n' + data.code)(makeConsole(lines), ...blocked);
      postMessage({ ok: true, output: lines.join('\\n') });
    }
  } catch (error) { postMessage({ ok: false, error: error.name + ': ' + error.message, output: lines.join('\\n') }); }
};`;

  const validate = (code) => {
    if (/\b(?:import|export)\b|\brequire\s*\(|\b(?:self|globalThis|indexedDB|caches)\b/.test(code)) {
      throw new Error('Modules, packages, storage, and worker-global APIs are unavailable.');
    }
  };
  const runWorker = (payload) => new Promise((resolve, reject) => {
    validate(payload.code);
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('Run stopped after 5 seconds. Check for an infinite loop.'));
    }, 5000);
    worker.onmessage = ({ data }) => {
      window.clearTimeout(timeout);
      worker.terminate();
      resolve(data);
    };
    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || 'JavaScript worker failed.'));
    };
    worker.postMessage(payload);
  });
  const jsLiteral = (value) => JSON.stringify(value);

  window.STEMFunctionSandbox = {
    api,
    storageKey: 'stemplus:javascript-sandbox:v1',
    defaultFreeCode: DEFAULT_FREE_CODE,
    readyMessage: 'JavaScript worker is ready.',
    runningMessage: 'Running tests in a disposable worker…',
    freeRunningMessage: 'Running program in a disposable worker…',
    exampleCall(problem, args) { return `${problem.functionName}(${args.map(jsLiteral).join(', ')})`; },
    runProblem(problem, code) {
      return runWorker({ mode: 'problem', code, functionName: problem.functionName, tests: problem.tests });
    },
    runFree(code) { return runWorker({ mode: 'free', code }); },
    displayValue
  };
}());
