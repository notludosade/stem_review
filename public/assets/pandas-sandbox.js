(function () {
  'use strict';

  const api = window.STEMPandasProblems;
  if (!api) return;
  const DEFAULT_FREE_CODE = `import pandas as pd

sales = pd.DataFrame({
    "course": ["Python", "Java", "Python"],
    "completed": [12, 8, 15]
})

print(sales.groupby("course")["completed"].sum())`;
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
      worker = new Worker('assets/pandas-worker.js', { type: 'module' });
      const timer = setTimeout(() => { const error = new Error('Pandas took too long to load. Check your connection.'); stop(error); reject(error); }, 60000);
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready') { clearTimeout(timer); resolve(); return; }
        if (data.type === 'fatal') { clearTimeout(timer); const error = new Error(`Pandas failed to load: ${data.error}`); stop(error); reject(error); return; }
        if (data.type === 'result' && pending.has(data.id)) {
          const request = pending.get(data.id);
          pending.delete(data.id);
          clearTimeout(request.timer);
          request.resolve(data.payload);
        }
      };
      worker.onerror = () => { clearTimeout(timer); const error = new Error('Pandas runtime could not start. Use HTTPS or localhost.'); stop(error); reject(error); };
    });
    return readyPromise;
  };
  const execute = async (payload) => {
    await ensureWorker();
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const timer = setTimeout(() => { pending.delete(id); const error = new Error('Run stopped after 12 seconds.'); stop(error); reject(error); }, 12000);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, ...payload });
    });
  };
  const repr = (value) => {
    if (value === null) return 'None';
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(repr).join(', ')}]`;
    if (typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${repr(key)}: ${repr(item)}`).join(', ')}}`;
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    return String(value);
  };
  const argument = (kind, value) => kind === 'series' ? `pd.Series(${repr(value)})` : kind === 'dataframe' ? `pd.DataFrame(${repr(value)})` : repr(value);

  window.STEMFunctionSandbox = {
    api,
    difficulties: ['Easy', 'Medium', 'Hard', 'Expert'],
    storageKey: 'stemplus:pandas-sandbox:v1',
    defaultFreeCode: DEFAULT_FREE_CODE,
    readyMessage: 'Pandas runtime loads on first run.',
    runningMessage: worker ? 'Running Pandas tests…' : 'Loading Pandas, then running tests…',
    freeRunningMessage: worker ? 'Running Pandas program…' : 'Loading Pandas, then running program…',
    exampleCall(problem, args) { return `${problem.functionName}(${args.map((value, index) => argument(problem.argKinds[index], value)).join(', ')})`; },
    runProblem(problem, code) { return execute({ mode: 'problem', code, functionName: problem.functionName, tests: problem.tests, argKinds: problem.argKinds }); },
    runFree(code) { return execute({ mode: 'free', code }); }
  };
}());
