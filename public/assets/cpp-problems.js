(function (root, factory) {
  const api = factory(root.STEMJavaProblems || (typeof require === 'function' ? require('./java-problems.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.STEMCppProblems = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (source) {
  'use strict';
  if (!source) return null;

  const cppType = (type) => {
    if (type.endsWith('[]')) return `std::vector<${cppType(type.slice(0, -2))}>`;
    return { long: 'long long', boolean: 'bool', String: 'std::string' }[type] || type;
  };
  const fallback = (type) => {
    if (type === 'boolean') return 'false';
    if (type === 'String') return '""';
    if (type.endsWith('[]')) return '{}';
    return '0';
  };
  const problems = source.problems.map((problem, index) => ({
    ...problem,
    id: `cpp-${String(index + 1).padStart(3, '0')}`,
    functionName: problem.methodName,
    cppReturnType: cppType(problem.returnType),
    cppParameters: problem.parameters.map(([type, name]) => [cppType(type), name]),
    starter: `#include <string>\n#include <vector>\n\n${cppType(problem.returnType)} ${problem.methodName}(${problem.parameters.map(([type, name]) => `${cppType(type)} ${name}`).join(', ')}) {\n    // Write your solution here\n    return ${fallback(problem.returnType)};\n}`
  }));

  return {
    problems,
    topics: source.topics,
    getProblem(id) { return problems.find((problem) => problem.id === id) || null; }
  };
}));
