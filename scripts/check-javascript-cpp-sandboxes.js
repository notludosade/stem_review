'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const javascript = require('../assets/javascript-problems.js');
const cpp = require('../assets/cpp-problems.js');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const counts = (api, prefix) => {
  assert(api.problems.length === 180, `${prefix}: expected 180 problems`);
  assert(api.topics.length === 6, `${prefix}: expected 6 topics`);
  ['Easy', 'Medium', 'Hard'].forEach((difficulty) => {
    assert(api.problems.filter((problem) => problem.difficulty === difficulty).length === 60, `${prefix}: expected 60 ${difficulty}`);
  });
  api.problems.forEach((problem, index) => {
    assert(problem.id === `${prefix}-${String(index + 1).padStart(3, '0')}`, `${prefix}: broken ID sequence`);
    assert(problem.tests.length >= 4, `${problem.id}: fewer than four tests`);
    assert(problem.starter.includes(problem.functionName), `${problem.id}: invalid starter`);
  });
};
counts(javascript, 'js');
counts(cpp, 'cpp');

global.window = global;
global.STEMCppProblems = cpp;
const { buildHarness } = require('../assets/cpp-sandbox.js');
const solutions = new Map([
  ['cpp-001', '#include <string>\n#include <vector>\nint addNumbers(int a, int b) { return a + b; }'],
  ['cpp-031', '#include <string>\n#include <vector>\nstd::string greet(std::string name) { return "Hello, " + name + "!"; }'],
  ['cpp-106', '#include <string>\n#include <vector>\nstd::vector<int> matrixRowSums(std::vector<std::vector<int>> matrix) { std::vector<int> out; for (const auto& row : matrix) { int sum = 0; for (int value : row) sum += value; out.push_back(sum); } return out; }'],
  ['cpp-170', '#include <string>\n#include <vector>\nstd::vector<std::vector<int>> sparseMatrixMultiply(std::vector<std::vector<int>> left, std::vector<std::vector<int>> right) { std::vector<std::vector<int>> out(left.size(), std::vector<int>(right[0].size())); for (std::size_t r = 0; r < left.size(); ++r) for (std::size_t c = 0; c < right[0].size(); ++c) for (std::size_t k = 0; k < right.size(); ++k) out[r][c] += left[r][k] * right[k][c]; return out; }']
]);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'stem-cpp-check-'));
try {
  solutions.forEach((solution, id) => {
    const source = path.join(temporary, `${id}.cpp`);
    const binary = path.join(temporary, id);
    fs.writeFileSync(source, buildHarness(cpp.getProblem(id), solution));
    const compiled = spawnSync('c++', ['-std=c++20', source, '-o', binary], { encoding: 'utf8' });
    assert(compiled.status === 0, `${id}: local compile failed\n${compiled.stderr}`);
    const executed = spawnSync(binary, [], { encoding: 'utf8', timeout: 5000 });
    assert(executed.status === 0, `${id}: local run failed\n${executed.stderr}`);
    const passed = [...executed.stdout.matchAll(/__STEM_CPP_TEST__\d+\|1\|/g)].length;
    assert(passed === cpp.getProblem(id).tests.length, `${id}: expected every generated test to pass`);
  });
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }

const root = path.resolve(__dirname, '..');
['index.html', 'sandbox.html', 'javascript-sandbox.html', 'cpp-sandbox.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
  }
});

console.log('JavaScript/C++ sandbox audit passed: 180 problems per language; representative C++ scalar, string, vector, and matrix harnesses passed locally.');
