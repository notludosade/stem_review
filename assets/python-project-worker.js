import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs';

const pyodideReady = loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.2/full/' });
pyodideReady.then(() => self.postMessage({ type: 'ready' })).catch((error) => {
  self.postMessage({ type: 'fatal', error: error.message || String(error) });
});

const runner = String.raw`
import builtins, contextlib, copy, io, json, math, time, traceback

_real_import = builtins.__import__
def _limited_import(name, *args, **kwargs):
    if name.split('.')[0] not in {'datetime', 'math', 'statistics', 'collections'}:
        raise ImportError('Only datetime, math, statistics, and collections are available in this project.')
    return _real_import(name, *args, **kwargs)

def _blocked(*args, **kwargs):
    raise RuntimeError('File access and interactive input are unavailable in this project.')

def _normalize(value):
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, dict):
        return {str(key): _normalize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_normalize(item) for item in value]
    return value

def _equivalent(actual, expected):
    if isinstance(actual, bool) or isinstance(expected, bool):
        return actual is expected
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(actual, list) and isinstance(expected, list):
        return len(actual) == len(expected) and all(_equivalent(a, b) for a, b in zip(actual, expected))
    if isinstance(actual, dict) and isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(_equivalent(actual[key], expected[key]) for key in actual)
    return actual == expected

safe_builtins = dict(vars(builtins))
safe_builtins['__import__'] = _limited_import
safe_builtins['open'] = _blocked
safe_builtins['input'] = _blocked
namespace = {'__builtins__': safe_builtins, '__name__': '__main__'}
stdout = io.StringIO()

try:
    with contextlib.redirect_stdout(stdout):
        exec(str(_stem_code), namespace)
    requested = json.loads(str(_stem_tasks))
    task_results = []
    for task in requested:
        entry = namespace.get(task['entry'])
        if not callable(entry):
            task_results.append({'id': task['id'], 'ok': False, 'durationMs': 0, 'error': f'Define {task["entry"]}.'})
            continue
        results = []
        started = time.perf_counter()
        for index, case in enumerate(task['tests'], 1):
            try:
                arguments = copy.deepcopy(case['args'])
                with contextlib.redirect_stdout(stdout):
                    if task['entryType'] == 'tracker':
                        tracker = entry()
                        for record in arguments[0]:
                            tracker.add_learner(record)
                        actual = {'learners': tracker.learner_summaries(), 'courses': tracker.course_report()}
                    else:
                        actual = entry(*arguments)
                actual = _normalize(actual)
                expected = _normalize(case['expected'])
                results.append({'index': index, 'passed': _equivalent(actual, expected), 'actual': repr(actual), 'expected': repr(expected)})
            except Exception as error:
                results.append({'index': index, 'passed': False, 'error': ''.join(traceback.format_exception_only(type(error), error)).strip(), 'expected': repr(case['expected'])})
        duration = (time.perf_counter() - started) * 1000
        task_results.append({'id': task['id'], 'ok': all(result['passed'] for result in results), 'durationMs': duration, 'results': results})
    payload = {'ok': all(task['ok'] for task in task_results), 'tasks': task_results, 'output': stdout.getvalue()}
except Exception as error:
    payload = {'ok': False, 'error': ''.join(traceback.format_exception_only(type(error), error)).strip(), 'output': stdout.getvalue()}

json.dumps(payload)
`;

self.onmessage = async ({ data }) => {
  try {
    const pyodide = await pyodideReady;
    pyodide.globals.set('_stem_code', data.code);
    pyodide.globals.set('_stem_tasks', JSON.stringify(data.tasks));
    const result = await pyodide.runPythonAsync(runner);
    self.postMessage({ type: 'result', id: data.id, payload: JSON.parse(result) });
  } catch (error) {
    self.postMessage({ type: 'result', id: data.id, payload: { ok: false, error: error.message || String(error) } });
  }
};
