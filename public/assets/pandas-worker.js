import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs';

const pyodideReady = loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.2/full/' })
  .then(async (pyodide) => { await pyodide.loadPackage(['pandas']); return pyodide; });

pyodideReady.then(() => self.postMessage({ type: 'ready' })).catch((error) => {
  self.postMessage({ type: 'fatal', error: error.message || String(error) });
});

const runner = String.raw`
import builtins, contextlib, io, json, math, traceback
import numpy as np
import pandas as pd

_real_import = builtins.__import__
def _limited_import(name, *args, **kwargs):
    if name.split('.')[0] not in {'pandas', 'numpy'}:
        raise ImportError('Only pandas and numpy imports are available in this package sandbox.')
    return _real_import(name, *args, **kwargs)

def _blocked_open(*args, **kwargs):
    raise RuntimeError('File access is disabled; use the provided in-memory data.')

def _blocked_input(*args, **kwargs):
    raise RuntimeError('input() is unavailable; use fixed values in your program.')

def _argument(kind, value):
    if kind == 'series':
        return pd.Series(value)
    if kind == 'dataframe':
        return pd.DataFrame(value)
    return value

def _normalize(value):
    if value is pd.NA or value is pd.NaT or value is None:
        return None
    if isinstance(value, pd.DataFrame):
        return _normalize(value.to_dict(orient='records'))
    if isinstance(value, pd.Series):
        return _normalize(value.tolist())
    if isinstance(value, (pd.Index, np.ndarray)):
        return _normalize(value.tolist())
    if isinstance(value, np.generic):
        return _normalize(value.item())
    if isinstance(value, (pd.Timestamp, pd.Period)):
        return str(value)
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, dict):
        def json_key(key):
            normalized = _normalize(key)
            if isinstance(normalized, bool):
                return str(normalized).lower()
            return normalized if isinstance(normalized, str) else str(normalized)
        return {json_key(key): _normalize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_normalize(item) for item in value]
    return value

def _equivalent(actual, expected):
    if isinstance(actual, bool) or isinstance(expected, bool):
        return actual is expected
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return math.isclose(actual, expected, rel_tol=1e-8, abs_tol=1e-8)
    if isinstance(actual, list) and isinstance(expected, list):
        return len(actual) == len(expected) and all(_equivalent(a, b) for a, b in zip(actual, expected))
    if isinstance(actual, dict) and isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(_equivalent(actual[key], expected[key]) for key in actual)
    return actual == expected

safe_builtins = dict(vars(builtins))
safe_builtins['__import__'] = _limited_import
safe_builtins['open'] = _blocked_open
safe_builtins['input'] = _blocked_input
namespace = {'__builtins__': safe_builtins, '__name__': '__main__', 'pd': pd, 'np': np}
stdout = io.StringIO()

try:
    with contextlib.redirect_stdout(stdout):
        exec(str(_stem_code), namespace)
    if str(_stem_mode) == 'free':
        payload = {'ok': True, 'output': stdout.getvalue()}
    else:
        solution = namespace.get(str(_stem_function))
        if not callable(solution):
            raise NameError(f'Define a function named {str(_stem_function)}.')
        cases = json.loads(str(_stem_tests))
        kinds = json.loads(str(_stem_kinds))
        results = []
        for index, case in enumerate(cases, 1):
            try:
                arguments = [_argument(kinds[position], value) for position, value in enumerate(case['args'])]
                with contextlib.redirect_stdout(stdout):
                    actual = _normalize(solution(*arguments))
                expected = _normalize(case['expected'])
                results.append({'index': index, 'passed': _equivalent(actual, expected), 'actual': repr(actual), 'expected': repr(expected)})
            except Exception as error:
                results.append({'index': index, 'passed': False, 'error': ''.join(traceback.format_exception_only(type(error), error)).strip(), 'expected': repr(case['expected'])})
        payload = {'ok': all(result['passed'] for result in results), 'output': stdout.getvalue(), 'results': results}
except Exception as error:
    payload = {'ok': False, 'output': stdout.getvalue(), 'error': ''.join(traceback.format_exception_only(type(error), error)).strip()}

json.dumps(payload)
`;

self.onmessage = async ({ data }) => {
  const { id, mode, code, functionName, tests, argKinds } = data;
  try {
    const pyodide = await pyodideReady;
    pyodide.globals.set('_stem_mode', mode);
    pyodide.globals.set('_stem_code', code);
    pyodide.globals.set('_stem_function', functionName || '');
    pyodide.globals.set('_stem_tests', JSON.stringify(tests || []));
    pyodide.globals.set('_stem_kinds', JSON.stringify(argKinds || []));
    const result = await pyodide.runPythonAsync(runner);
    self.postMessage({ type: 'result', id, payload: JSON.parse(result) });
  } catch (error) {
    self.postMessage({ type: 'result', id, payload: { ok: false, error: error.message || String(error) } });
  }
};
