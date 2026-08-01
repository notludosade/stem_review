(function () {
  'use strict';

  const api = window.STEMCppProblems;
  if (!api) return;
  const ENDPOINT = 'https://godbolt.org/api/compiler/g132/compile';
  const MARKER = '__STEM_CPP_TEST__';
  const DEFAULT_FREE_CODE = `#include <iostream>

int main() {
    for (int number = 1; number <= 3; ++number) {
        std::cout << number << ": Hello from C++!\\n";
    }
    return 0;
}`;
  const typeOf = (type) => type.endsWith('[]')
    ? `std::vector<${typeOf(type.slice(0, -2))}>`
    : ({ long: 'long long', boolean: 'bool', String: 'std::string' }[type] || type);
  const escapeString = (value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`;
  const literal = (type, value) => {
    if (type.endsWith('[]')) {
      const inner = type.slice(0, -2);
      return `${typeOf(type)}{${value.map((item) => literal(inner, item)).join(', ')}}`;
    }
    if (type === 'String') return `std::string(${escapeString(value)})`;
    if (type === 'boolean') return String(value);
    if (type === 'long') return `${value}LL`;
    if (type === 'double') return Number.isInteger(value) ? `${value}.0` : String(value);
    return String(value);
  };
  const displayValue = (value) => Array.isArray(value)
    ? `[${value.map(displayValue).join(', ')}]`
    : typeof value === 'string' ? JSON.stringify(value) : String(value);
  const supportCode = `
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
template <typename T> std::string stemShow(const T& value) {
    std::ostringstream out;
    out << std::setprecision(17) << value;
    return out.str();
}
std::string stemShow(const std::string& value) { return "\\\"" + value + "\\\""; }
std::string stemShow(bool value) { return value ? "true" : "false"; }
template <typename T> std::string stemShow(const std::vector<T>& value) {
    std::string out = "[";
    for (std::size_t i = 0; i < value.size(); ++i) out += (i ? ", " : "") + stemShow(value[i]);
    return out + "]";
}
std::string stemHex(const std::string& value) {
    std::ostringstream out;
    out << std::hex << std::setfill('0');
    for (unsigned char character : value) out << std::setw(2) << static_cast<int>(character);
    return out.str();
}
`;

  const buildHarness = (problem, code) => {
    if (/\bmain\s*\(/.test(code)) throw new Error('Do not define main() in a coding problem; only complete the requested function.');
    const checks = problem.tests.map((test, index) => {
      const args = test.args.map((value, argIndex) => literal(problem.parameters[argIndex][0], value)).join(', ');
      const expected = literal(problem.returnType, test.expected);
      return `    try {
        auto actual = ${problem.functionName}(${args});
        bool passed = stemEqual(actual, ${expected});
        std::cout << "\\n${MARKER}${index + 1}|" << (passed ? 1 : 0) << "|" << stemHex(stemShow(actual)) << "\\n";
    } catch (const std::exception& error) {
        std::cout << "\\n${MARKER}${index + 1}|0|" << stemHex(std::string("Error: ") + error.what()) << "\\n";
    } catch (...) {
        std::cout << "\\n${MARKER}${index + 1}|0|" << stemHex("Unknown error") << "\\n";
    }`;
    }).join('\n');
    return `${supportCode}\n${code}\n\nint main() {\n${checks}\n    return 0;\n}`;
  };
  const clean = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');
  const lines = (items) => (items || []).map((item) => item.text).join('\n');
  const compile = async (code) => {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          source: code,
          options: {
            userArguments: '-std=c++20 -Wall -Wextra',
            executeParameters: { args: [], stdin: '', runtimeTools: [] },
            compilerOptions: { executorRequest: true },
            filters: { execute: true },
            tools: [],
            libraries: []
          },
          lang: 'c++',
          allowStoreCodeDebug: false
        })
      });
    } catch (_) { throw new Error('C++ compiler service is unreachable. Check your connection and try again.'); }
    if (!response.ok) throw new Error(`C++ compiler service returned ${response.status}. Try again shortly.`);
    const payload = await response.json();
    const buildError = clean(lines(payload.buildResult?.stderr) || lines(payload.stderr));
    if (payload.buildResult?.code !== 0 || (!payload.didExecute && payload.code !== 0)) {
      throw new Error(buildError || 'C++ compilation failed.');
    }
    return { code: payload.code, stdout: clean(lines(payload.stdout)), stderr: clean(lines(payload.stderr)) };
  };
  const decodeHex = (hex) => {
    let text = '';
    for (let index = 0; index < hex.length; index += 2) text += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16));
    return text;
  };
  const runProblem = async (problem, code) => {
    const compiled = await compile(buildHarness(problem, code));
    const found = [...compiled.stdout.matchAll(new RegExp(`${MARKER}(\\d+)\\|([01])\\|([0-9a-f]*)`, 'g'))];
    if (found.length !== problem.tests.length) throw new Error(compiled.stderr || compiled.stdout || 'C++ test runner did not finish.');
    const results = found.map((match) => ({
      index: Number(match[1]),
      passed: match[2] === '1',
      actual: decodeHex(match[3]),
      expected: displayValue(problem.tests[Number(match[1]) - 1].expected)
    }));
    const output = compiled.stdout.replace(new RegExp(`\\n?${MARKER}\\d+\\|[01]\\|[0-9a-f]*\\n?`, 'g'), '\n').trim();
    return { ok: results.every((test) => test.passed), results, output };
  };
  const runFree = async (code) => {
    if (!/\bmain\s*\(/.test(code)) throw new Error('Define int main() for a freestyle C++ program.');
    const compiled = await compile(code);
    return { ok: compiled.code === 0, output: compiled.stdout, error: compiled.code === 0 ? compiled.stderr : compiled.stderr || `Program exited with code ${compiled.code}.` };
  };

  window.STEMFunctionSandbox = {
    api,
    storageKey: 'stemplus:cpp-sandbox:v1',
    defaultFreeCode: DEFAULT_FREE_CODE,
    readyMessage: 'GCC 13.2 runs on demand through Compiler Explorer.',
    runningMessage: 'Sending code to GCC 13.2 and running tests…',
    freeRunningMessage: 'Sending program to GCC 13.2…',
    exampleCall(problem, args) {
      return `${problem.functionName}(${args.map((value, index) => literal(problem.parameters[index][0], value)).join(', ')})`;
    },
    runProblem,
    runFree
  };
  if (typeof module === 'object' && module.exports) module.exports = { buildHarness, literal };
}());
