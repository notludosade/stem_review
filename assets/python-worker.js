import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs';

const pyodideReady = loadPyodide({
  indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.2/full/'
});

pyodideReady.then(() => {
  self.postMessage({ type: 'ready' });
}).catch((error) => {
  self.postMessage({ type: 'fatal', error: error.message || String(error) });
});

const runner = String.raw`
import builtins, contextlib, io, json, math, traceback

def _blocked_import(*args, **kwargs):
    raise ImportError('Imports are disabled in this beginner sandbox.')

def _blocked_open(*args, **kwargs):
    raise RuntimeError('File access is disabled in this browser sandbox.')

def _blocked_input(*args, **kwargs):
    raise RuntimeError('input() is unavailable; use fixed values in your program.')

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
safe_builtins['__import__'] = _blocked_import
safe_builtins['open'] = _blocked_open
safe_builtins['input'] = _blocked_input
namespace = {'__builtins__': safe_builtins, '__name__': '__main__'}
stdout = io.StringIO()

try:
    with contextlib.redirect_stdout(stdout):
        exec(str(_stem_code), namespace)

    if str(_stem_mode) == 'free':
        payload = {'ok': True, 'output': stdout.getvalue()}
    else:
        function_name = str(_stem_function)
        solution = namespace.get(function_name)
        if not callable(solution):
            raise NameError(f'Define a function named {function_name}.')

        cases = json.loads(str(_stem_tests))
        results = []
        for index, case in enumerate(cases, 1):
            try:
                with contextlib.redirect_stdout(stdout):
                    actual = solution(*case['args'])
                passed = _equivalent(actual, case['expected'])
                results.append({
                    'index': index,
                    'passed': passed,
                    'actual': repr(actual),
                    'expected': repr(case['expected'])
                })
            except Exception as error:
                results.append({
                    'index': index,
                    'passed': False,
                    'error': ''.join(traceback.format_exception_only(type(error), error)).strip(),
                    'expected': repr(case['expected'])
                })
        payload = {
            'ok': all(result['passed'] for result in results),
            'output': stdout.getvalue(),
            'results': results
        }
except Exception as error:
    payload = {
        'ok': False,
        'output': stdout.getvalue(),
        'error': ''.join(traceback.format_exception_only(type(error), error)).strip()
    }

json.dumps(payload)
`;

self.onmessage = async (event) => {
  const { id, mode, code, functionName, tests } = event.data;
  try {
    const pyodide = await pyodideReady;
    pyodide.globals.set('_stem_mode', mode);
    pyodide.globals.set('_stem_code', code);
    pyodide.globals.set('_stem_function', functionName || '');
    pyodide.globals.set('_stem_tests', JSON.stringify(tests || []));
    const result = await pyodide.runPythonAsync(runner);
    self.postMessage({ type: 'result', id, payload: JSON.parse(result) });
  } catch (error) {
    self.postMessage({ type: 'result', id, payload: { ok: false, error: error.message || String(error) } });
  }
};
