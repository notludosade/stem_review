(function (root, factory) {
  const api = factory(root.STEMJavaProblems || (typeof require === 'function' ? require('./java-problems.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.STEMJavaScriptProblems = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (source) {
  'use strict';
  if (!source) return null;

  const fallback = (type) => {
    if (type === 'boolean') return 'false';
    if (type === 'String') return "''";
    if (type.endsWith('[]')) return '[]';
    return '0';
  };
  const problems = source.problems.map((problem, index) => ({
    ...problem,
    id: `js-${String(index + 1).padStart(3, '0')}`,
    functionName: problem.methodName,
    starter: `function ${problem.methodName}(${problem.parameters.map(([, name]) => name).join(', ')}) {\n  // Write your solution here\n  return ${fallback(problem.returnType)};\n}`
  }));

  return {
    problems,
    topics: source.topics,
    getProblem(id) { return problems.find((problem) => problem.id === id) || null; }
  };
}));
