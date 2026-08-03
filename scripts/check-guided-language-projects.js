'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const projects = require('../public/assets/guided-language-projects.js');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const round = (value) => Number(value.toFixed(2));
const supportedTypes = new Set(['int', 'double', 'boolean', 'String', 'int[]', 'double[]', 'String[]']);
const matchesType = (type, value) => type.endsWith('[]') ? Array.isArray(value) && value.every((item) => matchesType(type.slice(0, -2), item))
  : type === 'String' ? typeof value === 'string' : type === 'boolean' ? typeof value === 'boolean' : type === 'double' ? typeof value === 'number' && Number.isFinite(value) : Number.isInteger(value);
const same = (actual, expected) => typeof actual === 'number' && typeof expected === 'number' ? Math.abs(actual - expected) <= 1e-9 : JSON.stringify(actual) === JSON.stringify(expected);

const java = {};
java.normalizeSku = (value) => value.trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/^_+|_+$/g, '');
java.isValidItem = (sku, quantity, price) => java.normalizeSku(sku) !== '' && Number.isInteger(quantity) && quantity >= 0 && Number.isFinite(price) && price >= 0;
java.inventoryValue = (quantities, prices) => quantities.length === prices.length && quantities.every((value) => Number.isInteger(value) && value >= 0) && prices.every((value) => Number.isFinite(value) && value >= 0) ? round(quantities.reduce((sum, quantity, index) => sum + quantity * prices[index], 0)) : 0;
java.stockStatus = (quantity) => quantity <= 0 ? 'OUT' : quantity <= 5 ? 'LOW' : quantity <= 50 ? 'IN_STOCK' : 'OVERSTOCKED';
java.countLowStock = (quantities) => quantities.filter((quantity) => quantity >= 0 && quantity <= 5).length;
java.sortedSkus = (skus) => [...new Set(skus.map(java.normalizeSku).filter(Boolean))].sort();
java.restockQuantities = (quantities, target) => quantities.map((quantity) => Math.max(0, target - quantity));
java.highestValueSku = (skus, quantities, prices) => !skus.length || skus.length !== quantities.length || skus.length !== prices.length ? '' : skus.map((sku, index) => ({ sku: java.normalizeSku(sku), value: quantities[index] * prices[index] })).sort((a, b) => b.value - a.value || a.sku.localeCompare(b.sku))[0].sku;
java.reorderCost = (quantities, prices, target) => quantities.length === prices.length ? round(java.restockQuantities(quantities, target).reduce((sum, amount, index) => sum + amount * prices[index], 0)) : 0;
java.buildInventoryReport = (skus, quantities, prices, target) => {
  const names = [], counts = [], costs = [];
  for (let index = 0; index < Math.min(skus.length, quantities.length, prices.length); index += 1) if (java.isValidItem(skus[index], quantities[index], prices[index])) { names.push(skus[index]); counts.push(quantities[index]); costs.push(prices[index]); }
  const units = counts.reduce((sum, value) => sum + value, 0);
  return `skus=${java.sortedSkus(names).join('|')};items=${names.length};units=${units};value=${java.inventoryValue(counts, costs).toFixed(2)};low=${java.countLowStock(counts)};top=${java.highestValueSku(names, counts, costs)};reorder=${java.reorderCost(counts, costs, target).toFixed(2)};stock=${java.stockStatus(units)}`;
};

const javascript = {};
javascript.normalizeAnswer = (value) => value.trim().toLowerCase().replace(/\s+/g, ' ');
javascript.answersMatch = (answer, expected) => javascript.normalizeAnswer(answer) === javascript.normalizeAnswer(expected);
javascript.scoreQuiz = (answers, key) => answers.length === key.length ? answers.filter((answer, index) => javascript.answersMatch(answer, key[index])).length : 0;
javascript.scorePercent = (correct, total) => total > 0 && correct >= 0 ? round(100 * correct / total) : 0;
javascript.feedbackBand = (percent) => percent >= 100 ? 'Perfect' : percent >= 80 ? 'Great' : percent >= 60 ? 'Keep Practicing' : 'Review Needed';
javascript.missedQuestions = (answers, key) => answers.length === key.length ? answers.flatMap((answer, index) => javascript.answersMatch(answer, key[index]) ? [] : [index + 1]) : [];
javascript.topicAccuracy = (topics, answers, key) => {
  if (topics.length !== answers.length || topics.length !== key.length) return [];
  const groups = {};
  topics.forEach((topic, index) => { const name = topic.trim().replace(/\s+/g, ' ').toUpperCase(); if (name) { const group = groups[name] ||= [0, 0]; group[1] += 1; if (javascript.answersMatch(answers[index], key[index])) group[0] += 1; } });
  return Object.keys(groups).sort().map((name) => `${name}=${javascript.scorePercent(groups[name][0], groups[name][1]).toFixed(2)}%`);
};
javascript.longestCorrectStreak = (answers, key) => { if (answers.length !== key.length) return 0; let best = 0, run = 0; answers.forEach((answer, index) => { run = javascript.answersMatch(answer, key[index]) ? run + 1 : 0; best = Math.max(best, run); }); return best; };
javascript.weightedScore = (answers, key, weights) => {
  if (!answers.length || answers.length !== key.length || answers.length !== weights.length || weights.some((weight) => weight < 0)) return 0;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return total ? round(100 * weights.reduce((sum, weight, index) => sum + (javascript.answersMatch(answers[index], key[index]) ? weight : 0), 0) / total) : 0;
};
javascript.buildQuizReport = (topics, answers, key, weights) => {
  if (topics.length !== answers.length || answers.length !== key.length || key.length !== weights.length) return 'invalid quiz';
  const correct = javascript.scoreQuiz(answers, key), percent = javascript.scorePercent(correct, key.length), missed = javascript.missedQuestions(answers, key);
  return `questions=${key.length};correct=${correct};percent=${percent.toFixed(2)};feedback=${javascript.feedbackBand(percent)};missed=${missed.length ? missed.join(',') : 'none'};topics=${javascript.topicAccuracy(topics, answers, key).join('|')};streak=${javascript.longestCorrectStreak(answers, key)};weighted=${javascript.weightedScore(answers, key, weights).toFixed(2)}`;
};

const cpp = {};
cpp.normalizeRobotId = (value) => value.trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/^_+|_+$/g, '');
cpp.clampMotorSignal = (signal) => Math.max(-100, Math.min(100, signal));
cpp.isSafeTemperature = (temperature) => temperature >= -20 && temperature <= 85;
cpp.calibrateReadings = (readings, offset) => readings.map((value) => round(value + offset));
cpp.averageReading = (readings) => readings.length ? round(readings.reduce((sum, value) => sum + value, 0) / readings.length) : 0;
cpp.countUnsafeTemperatures = (temperatures) => temperatures.filter((value) => !cpp.isSafeTemperature(value)).length;
cpp.peakMotorMagnitude = (signals) => signals.reduce((best, signal) => Math.max(best, Math.abs(cpp.clampMotorSignal(signal))), 0);
cpp.longestStableRun = (readings, tolerance) => { if (!readings.length || tolerance < 0) return 0; let best = 1, run = 1; for (let index = 1; index < readings.length; index += 1) { run = Math.abs(readings[index] - readings[index - 1]) <= tolerance ? run + 1 : 1; best = Math.max(best, run); } return best; };
cpp.energyEstimate = (signals, durations) => signals.length === durations.length && durations.every((value) => value >= 0) ? round(signals.reduce((sum, signal, index) => sum + Math.abs(cpp.clampMotorSignal(signal)) / 100 * durations[index], 0)) : 0;
cpp.buildTelemetryReport = (robotId, signals, temperatures, durations, offset) => {
  if (!cpp.normalizeRobotId(robotId) || signals.length !== temperatures.length || signals.length !== durations.length) return 'invalid telemetry';
  const calibrated = cpp.calibrateReadings(temperatures, offset);
  return `robot=${cpp.normalizeRobotId(robotId)};samples=${signals.length};peak=${cpp.peakMotorMagnitude(signals)};averageTemp=${cpp.averageReading(calibrated).toFixed(2)};unsafe=${cpp.countUnsafeTemperatures(calibrated)};stable=${cpp.longestStableRun(calibrated, 1.5)};energy=${cpp.energyEstimate(signals, durations).toFixed(2)}`;
};
const references = { java, javascript, cpp };

assert(JSON.stringify(Object.keys(projects).sort()) === JSON.stringify(['cpp', 'java', 'javascript']), 'Expected Java, JavaScript, and C++ projects');
assert(new Set(Object.values(projects).map((item) => item.title)).size === 3, 'Project titles must be distinct');
Object.values(projects).forEach((project) => {
  assert(project.tasks.length === 10, `${project.language}: expected 10 tasks`);
  assert(new Set(project.tasks.map((task) => task.course)).size === 3, `${project.language}: expected all three course levels`);
  project.tasks.forEach((task, index) => {
    assert(task.id === `${project.key}-project-task-${index + 1}`, `${task.id}: broken task sequence`);
    assert(task.tests.length >= 4, `${task.id}: fewer than four tests`);
    assert(supportedTypes.has(task.returnType), `${task.id}: unsupported return type`);
    assert(task.parameters.every(([type, name]) => supportedTypes.has(type) && /^\w+$/.test(name)), `${task.id}: invalid parameter`);
    assert(project.starter.includes(task.entry), `${task.id}: starter entry missing`);
    assert(task.answer.includes(task.entry), `${task.id}: reference answer missing`);
    assert(typeof references[project.key][task.entry] === 'function', `${task.id}: independent reference missing`);
    task.concepts.forEach((concept) => concept.patterns.forEach((pattern) => new RegExp(pattern, 'm')));
    task.tests.forEach((caseData, testIndex) => {
      assert(caseData.args.length === task.parameters.length, `${task.id} test ${testIndex + 1}: wrong argument count`);
      caseData.args.forEach((value, argIndex) => assert(matchesType(task.parameters[argIndex][0], value), `${task.id} test ${testIndex + 1}: invalid argument`));
      assert(matchesType(task.returnType, caseData.expected), `${task.id} test ${testIndex + 1}: invalid expected value`);
      assert(same(references[project.key][task.entry](...JSON.parse(JSON.stringify(caseData.args))), caseData.expected), `${task.id} test ${testIndex + 1}: incorrect answer`);
    });
  });
});

const javascriptApi = new Function(`${projects.javascript.tasks.map((task) => task.answer).join('\n\n')}\nreturn { ${projects.javascript.tasks.map((task) => task.entry).join(', ')} };`)();
projects.javascript.tasks.forEach((task) => task.tests.forEach((caseData, index) => {
  const actual = javascriptApi[task.entry](...JSON.parse(JSON.stringify(caseData.args)));
  assert(same(actual, caseData.expected), `${task.id} answer test ${index + 1}: incorrect result`);
}));

const javaLiteral = (type, value) => {
  if (type.endsWith('[]')) return `new ${type.slice(0, -2)}[]{${value.map((item) => javaLiteral(type.slice(0, -2), item)).join(',')}}`;
  if (type === 'String') return JSON.stringify(value);
  if (type === 'double') return Number.isInteger(value) ? `${value}.0` : String(value);
  return String(value);
};
const cppLiteral = (type, value) => {
  if (type.endsWith('[]')) return `std::vector<${type.slice(0, -2) === 'String' ? 'std::string' : type.slice(0, -2)}>{${value.map((item) => cppLiteral(type.slice(0, -2), item)).join(',')}}`;
  if (type === 'String') return JSON.stringify(value);
  if (type === 'double') return Number.isInteger(value) ? `${value}.0` : String(value);
  return String(value);
};
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'stem-guided-projects-'));
try {
  const javaFinal = projects.java.tasks.at(-1);
  const javaChecks = javaFinal.tests.map((caseData, index) => {
    const args = caseData.args.map((value, argIndex) => javaLiteral(javaFinal.parameters[argIndex][0], value)).join(', ');
    return `if (!buildInventoryReport(${args}).equals(${javaLiteral('String', caseData.expected)})) throw new AssertionError("case ${index + 1}");`;
  }).join('\n        ');
  const javaImports = projects.java.starter.split(/\n(?=public class Main)/)[0];
  const javaProgram = `${javaImports}\npublic class Main {\n${projects.java.tasks.map((task) => task.answer).join('\n\n')}\n    public static void main(String[] args) {\n        ${javaChecks}\n    }\n}\n`;
  const javaSource = path.join(temporary, 'Main.java'); fs.writeFileSync(javaSource, javaProgram);
  const javaCompile = spawnSync('javac', [javaSource], { encoding: 'utf8' });
  assert(javaCompile.status === 0 || /Unable to locate a Java Runtime/.test(javaCompile.stderr), `Java answers do not compile:\n${javaCompile.stderr}`);
  if (javaCompile.status === 0) {
    const javaRun = spawnSync('java', ['-cp', temporary, 'Main'], { encoding: 'utf8' });
    assert(javaRun.status === 0, `Java answers failed:\n${javaRun.stderr}`);
  }
  const cppFinal = projects.cpp.tasks.at(-1);
  const cppChecks = cppFinal.tests.map((caseData, index) => {
    const args = caseData.args.map((value, argIndex) => cppLiteral(cppFinal.parameters[argIndex][0], value)).join(', ');
    return `if (buildTelemetryReport(${args}) != ${cppLiteral('String', caseData.expected)}) return ${index + 1};`;
  }).join('\n    ');
  const cppIncludes = projects.cpp.starter.split(/\n(?=std::string normalizeRobotId)/)[0];
  const cppSource = path.join(temporary, 'project.cpp'), cppBinary = path.join(temporary, 'project');
  fs.writeFileSync(cppSource, `${cppIncludes}\n${projects.cpp.tasks.map((task) => task.answer).join('\n\n')}\nint main() {\n    ${cppChecks}\n    return 0;\n}\n`);
  const cppCompile = spawnSync('c++', ['-std=c++20', cppSource, '-o', cppBinary], { encoding: 'utf8' });
  assert(cppCompile.status === 0, `C++ answers do not compile:\n${cppCompile.stderr}`);
  const cppRun = spawnSync(cppBinary, [], { encoding: 'utf8' });
  assert(cppRun.status === 0, `C++ answers failed final reports (case ${cppRun.status}).`);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }

const root = path.resolve(__dirname, '../public');
['sandbox.html', 'python-projects.html', 'guided-language-project.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split(/[?#]/)[0];
    if (!target || target === 'index.html' || /^(?:https?:|mailto:)/.test(target)) continue;
    assert(fs.existsSync(path.resolve(root, target)), `${page}: broken local reference ${match[1]}`);
  }
});
const picker = fs.readFileSync(path.join(root, 'python-projects.html'), 'utf8');
Object.keys(projects).forEach((key) => assert(picker.includes(`guided-language-project.html?project=${key}`), `Project picker lacks ${key}`));
Object.values(projects).forEach((item) => assert(picker.includes(item.title), `Project picker lacks ${item.title}`));
const projectPage = fs.readFileSync(path.join(root, 'guided-language-project.html'), 'utf8');
assert(projectPage.includes('data-project-answer-button'), 'guided-language-project.html: missing Show Answer button');
assert(projectPage.includes('data-project-answer-code'), 'guided-language-project.html: missing reference-answer panel');

const tests = Object.values(projects).reduce((sum, item) => sum + item.tasks.reduce((count, task) => count + task.tests.length, 0), 0);
console.log(`Distinct guided-project audit passed: 3 projects, 30 tasks, and ${tests} independently recomputed answers.`);
