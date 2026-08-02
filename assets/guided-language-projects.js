(function (root, factory) {
  const projects = factory();
  if (typeof module === 'object' && module.exports) module.exports = projects;
  if (typeof location !== 'undefined') root.STEMGuidedProject = projects[new URLSearchParams(location.search).get('project')];
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const round = (value) => Number(value.toFixed(2));
  const test = (args, expected) => ({ args: clone(args), expected: clone(expected) });
  const project = (key, meta, sources, starter) => ({
    key, ...meta, starter,
    tasks: sources.map((source, index) => ({
      ...clone(source), id: `${key}-project-task-${index + 1}`, number: index + 1,
      runtimeBudgetMs: key === 'javascript' ? 25 : key === 'java' ? 5000 : 8000,
      concepts: [{ label: 'Function or method', patterns: [`${source.entry}\\s*\\(`] }, ...source.checks.map(([label, ...patterns]) => ({ label, patterns }))]
    }))
  });

  const normalizeSku = (sku) => sku.trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/^_+|_+$/g, '');
  const validItem = (sku, quantity, price) => normalizeSku(sku) !== '' && Number.isInteger(quantity) && quantity >= 0 && Number.isFinite(price) && price >= 0;
  const inventoryValue = (quantities, prices) => quantities.length === prices.length && quantities.every((value) => Number.isInteger(value) && value >= 0) && prices.every((value) => Number.isFinite(value) && value >= 0)
    ? round(quantities.reduce((sum, quantity, index) => sum + quantity * prices[index], 0)) : 0;
  const stockStatus = (quantity) => quantity <= 0 ? 'OUT' : quantity <= 5 ? 'LOW' : quantity <= 50 ? 'IN_STOCK' : 'OVERSTOCKED';
  const countLowStock = (quantities) => quantities.filter((quantity) => quantity >= 0 && quantity <= 5).length;
  const sortedSkus = (skus) => [...new Set(skus.map(normalizeSku).filter(Boolean))].sort();
  const restockQuantities = (quantities, target) => quantities.map((quantity) => Math.max(0, target - quantity));
  const highestValueSku = (skus, quantities, prices) => {
    if (!skus.length || skus.length !== quantities.length || skus.length !== prices.length) return '';
    return skus.map((sku, index) => ({ sku: normalizeSku(sku), value: quantities[index] * prices[index] }))
      .sort((a, b) => b.value - a.value || a.sku.localeCompare(b.sku))[0].sku;
  };
  const reorderCost = (quantities, prices, target) => quantities.length === prices.length
    ? round(restockQuantities(quantities, target).reduce((sum, amount, index) => sum + amount * prices[index], 0)) : 0;
  const inventoryReport = (skus, quantities, prices, target) => {
    const keptSkus = [], keptQuantities = [], keptPrices = [];
    for (let index = 0; index < Math.min(skus.length, quantities.length, prices.length); index += 1) {
      if (validItem(skus[index], quantities[index], prices[index])) { keptSkus.push(skus[index]); keptQuantities.push(quantities[index]); keptPrices.push(prices[index]); }
    }
    const total = keptQuantities.reduce((sum, value) => sum + value, 0);
    return `skus=${sortedSkus(keptSkus).join('|')};items=${keptSkus.length};units=${total};value=${inventoryValue(keptQuantities, keptPrices).toFixed(2)};low=${countLowStock(keptQuantities)};top=${highestValueSku(keptSkus, keptQuantities, keptPrices)};reorder=${reorderCost(keptQuantities, keptPrices, target).toFixed(2)};stock=${stockStatus(total)}`;
  };
  const javaTasks = [
    { title: 'Normalize Inventory SKUs', entry: 'normalizeSku', returnType: 'String', parameters: [['String', 'sku']], course: 'Computer Programming 1', prompt: 'Normalize an inventory SKU by trimming it, uppercasing it, and replacing runs of spaces or hyphens with one underscore.', requirements: ['Return a string.', 'Remove outside separators.', 'Whitespace-only input becomes empty.'], hint: 'Trim, replace separators, then uppercase.', maxLines: 7, checks: [['String processing', 'trim|toUpperCase|replace'], ['Normalization', 'replaceAll|split']], tests: [' ab-12 ', 'lab  sensor', '--java-book--', 'A---B', '   '].map((value) => test([value], normalizeSku(value))) },
    { title: 'Validate Inventory Items', entry: 'isValidItem', returnType: 'boolean', parameters: [['String', 'sku'], ['int', 'quantity'], ['double', 'price']], course: 'Computer Programming 1', prompt: 'Validate one item: normalized SKU must be nonempty, quantity must be nonnegative, and price must be finite and nonnegative.', requirements: ['Accept zero quantity and price.', 'Reject negative values.', 'Reuse normalizeSku.'], hint: 'Combine the three rules with boolean AND.', maxLines: 8, checks: [['Validation', 'if|&&'], ['Helper reuse', 'normalizeSku\\s*\\(']], tests: [['a-1', 4, 2.5], ['', 4, 2.5], ['b', -1, 2], ['c', 0, 0], ['d', 5, -0.01]].map((args) => test(args, validItem(...args))) },
    { title: 'Calculate Inventory Value', entry: 'inventoryValue', returnType: 'double', parameters: [['int[]', 'quantities'], ['double[]', 'prices']], course: 'Computer Programming 1', prompt: 'Return the sum of quantity × price, rounded to two decimals. Return 0 for mismatched or invalid collections.', requirements: ['Collections must be aligned.', 'Reject negative values.', 'Round only the final total.'], hint: 'Validate first, then accumulate matching positions.', maxLines: 14, checks: [['Parallel iteration', 'for|while'], ['Validation', 'if|length'], ['Rounding', 'round']], tests: [[[], []], [[2, 3], [4.5, 2]], [[1], [2, 3]], [[-1], [5]], [[10, 1], [0.99, 100]]].map(([q, p]) => test([q, p], inventoryValue(q, p))) },
    { title: 'Classify Stock Levels', entry: 'stockStatus', returnType: 'String', parameters: [['int', 'quantity']], course: 'Computer Programming 1', prompt: 'Classify quantity as OUT (≤0), LOW (1–5), IN_STOCK (6–50), or OVERSTOCKED (>50).', requirements: ['Return exact uppercase labels.', 'Check thresholds in order.', 'Boundary values belong to the lower range.'], hint: 'Use an if/else-if chain.', maxLines: 11, checks: [['Branching', 'if'], ['Multiple cases', 'else']], tests: [-1, 0, 1, 5, 6, 50, 51].map((value) => test([value], stockStatus(value))) },
    { title: 'Count Low-Stock Items', entry: 'countLowStock', returnType: 'int', parameters: [['int[]', 'quantities']], course: 'Computer Programming 2', prompt: 'Count quantities from 0 through 5. Negative values are invalid and do not count.', requirements: ['Zero counts as low stock.', 'Empty input returns 0.', 'Do not mutate input.'], hint: 'Increment only when both bounds pass.', maxLines: 9, checks: [['Iteration', 'for|while'], ['Filtering', 'if']], tests: [[0, 1, 5, 6], [], [-1, 2, 9], [50, 51]].map((values) => test([values], countLowStock(values))) },
    { title: 'Sort Unique SKUs', entry: 'sortedSkus', returnType: 'String[]', parameters: [['String[]', 'skus']], course: 'Computer Programming 2', prompt: 'Normalize SKUs, discard empty values and duplicates, then return them alphabetically.', requirements: ['Reuse normalizeSku.', 'Return a new array.', 'Deduplicate after normalization.'], hint: 'Use a TreeSet or HashSet plus sorting.', maxLines: 15, checks: [['Set collection', 'Set|TreeSet|HashSet'], ['Sorting', 'sort|TreeSet'], ['Helper reuse', 'normalizeSku\\s*\\(']], tests: [[' b-2 ', 'A 1', 'B-2'], [], ['', 'x'], ['z', 'a', 'm']].map((values) => test([values], sortedSkus(values))) },
    { title: 'Plan Restock Quantities', entry: 'restockQuantities', returnType: 'int[]', parameters: [['int[]', 'quantities'], ['int', 'target']], course: 'Computer Programming 2', prompt: 'For each quantity, return how many units are required to reach target; items already at or above target need 0.', requirements: ['Preserve input order.', 'Return a new array.', 'Do not return negative amounts.'], hint: 'Use Math.max(target - quantity, 0).', maxLines: 11, checks: [['Array construction', 'new\\s+int|Arrays'], ['Iteration', 'for|while'], ['Bounds', 'Math\\.max|if']], tests: [[[], 10], [[2, 10, 15], 10], [[0, 1], 5], [[20], 0]].map(([values, target]) => test([values, target], restockQuantities(values, target))) },
    { title: 'Find the Highest-Value SKU', entry: 'highestValueSku', returnType: 'String', parameters: [['String[]', 'skus'], ['int[]', 'quantities'], ['double[]', 'prices']], course: 'Computer Programming 2+', prompt: 'Return the normalized SKU with the greatest quantity × price. Alphabetical SKU resolves ties; invalid alignment returns empty.', requirements: ['Require equal nonempty lengths.', 'Normalize returned SKU.', 'Resolve ties alphabetically.'], hint: 'Track the best value and SKU while scanning aligned arrays.', maxLines: 20, checks: [['Parallel iteration', 'for|while'], ['Tie handling', 'compareTo|sort'], ['Helper reuse', 'normalizeSku\\s*\\(']], tests: [[['a', 'b'], [2, 1], [5, 8]], [[], [], []], [['z', 'a'], [1, 1], [5, 5]], [[' lab-1 '], [4], [2.5]]].map((args) => test(args, highestValueSku(...args))) },
    { title: 'Estimate Reorder Cost', entry: 'reorderCost', returnType: 'double', parameters: [['int[]', 'quantities'], ['double[]', 'prices'], ['int', 'target']], course: 'Computer Programming 2+', prompt: 'Calculate the cost of raising every item to target stock, rounded to two decimals; mismatched arrays return 0.', requirements: ['Reuse restockQuantities.', 'Multiply needed units by aligned prices.', 'Round the final total.'], hint: 'Generate the restock plan, then price each amount.', maxLines: 13, checks: [['Helper reuse', 'restockQuantities\\s*\\('], ['Aggregation', 'for|while'], ['Rounding', 'round']], tests: [[[], [], 10], [[2, 10], [5, 2], 10], [[1], [2, 3], 4], [[0, 5], [1.25, 3], 5]].map((args) => test(args, reorderCost(...args))) },
    { title: 'Build the Inventory Report', entry: 'buildInventoryReport', returnType: 'String', parameters: [['String[]', 'skus'], ['int[]', 'quantities'], ['double[]', 'prices'], ['int', 'target']], course: 'Computer Programming 2+', prompt: 'Filter invalid aligned items and compose the exact inventory report shown by the examples.', requirements: ['Reuse the earlier inventory helpers.', 'Format value and reorder with two decimals.', 'Keep report fields in the required order.'], hint: 'Collect valid parallel values, then compose tested helpers.', maxLines: 34, checks: [['Validation reuse', 'isValidItem\\s*\\('], ['Helper composition', 'sortedSkus\\s*\\(', 'inventoryValue\\s*\\(', 'countLowStock\\s*\\(', 'highestValueSku\\s*\\(', 'reorderCost\\s*\\(', 'stockStatus\\s*\\(']], tests: [[['a-1', 'b 2'], [2, 8], [5, 2], 10], [['', 'x'], [3, 0], [2, 4], 5], [[], [], [], 10], [['z', 'a'], [1, 1], [5, 5], 3]].map((args) => test(args, inventoryReport(...args))) }
  ];

  const normalizeAnswer = (answer) => answer.trim().toLowerCase().replace(/\s+/g, ' ');
  const answersMatch = (answer, expected) => normalizeAnswer(answer) === normalizeAnswer(expected);
  const scoreQuiz = (answers, key) => answers.length === key.length ? answers.filter((answer, index) => answersMatch(answer, key[index])).length : 0;
  const scorePercent = (correct, total) => total > 0 && correct >= 0 ? round(100 * correct / total) : 0;
  const feedbackBand = (percent) => percent >= 100 ? 'Perfect' : percent >= 80 ? 'Great' : percent >= 60 ? 'Keep Practicing' : 'Review Needed';
  const missedQuestions = (answers, key) => answers.length === key.length ? answers.flatMap((answer, index) => answersMatch(answer, key[index]) ? [] : [index + 1]) : [];
  const topicAccuracy = (topics, answers, key) => {
    if (topics.length !== answers.length || topics.length !== key.length) return [];
    const groups = {};
    topics.forEach((topic, index) => { const name = topic.trim().replace(/\s+/g, ' ').toUpperCase(); if (name) { const group = groups[name] ||= [0, 0]; group[1] += 1; if (answersMatch(answers[index], key[index])) group[0] += 1; } });
    return Object.keys(groups).sort().map((name) => `${name}=${scorePercent(groups[name][0], groups[name][1]).toFixed(2)}%`);
  };
  const longestCorrectStreak = (answers, key) => {
    if (answers.length !== key.length) return 0;
    let best = 0, run = 0; answers.forEach((answer, index) => { run = answersMatch(answer, key[index]) ? run + 1 : 0; best = Math.max(best, run); }); return best;
  };
  const weightedScore = (answers, key, weights) => {
    if (!answers.length || answers.length !== key.length || answers.length !== weights.length || weights.some((weight) => weight < 0)) return 0;
    const total = weights.reduce((sum, weight) => sum + weight, 0); if (!total) return 0;
    return round(100 * weights.reduce((sum, weight, index) => sum + (answersMatch(answers[index], key[index]) ? weight : 0), 0) / total);
  };
  const quizReport = (topics, answers, key, weights) => {
    if (topics.length !== answers.length || answers.length !== key.length || key.length !== weights.length) return 'invalid quiz';
    const correct = scoreQuiz(answers, key), percent = scorePercent(correct, key.length), missed = missedQuestions(answers, key);
    return `questions=${key.length};correct=${correct};percent=${percent.toFixed(2)};feedback=${feedbackBand(percent)};missed=${missed.length ? missed.join(',') : 'none'};topics=${topicAccuracy(topics, answers, key).join('|')};streak=${longestCorrectStreak(answers, key)};weighted=${weightedScore(answers, key, weights).toFixed(2)}`;
  };
  const javascriptTasks = [
    { title: 'Normalize Quiz Answers', entry: 'normalizeAnswer', returnType: 'String', parameters: [['String', 'answer']], course: 'Computer Programming 1', prompt: 'Trim a quiz answer, collapse repeated whitespace, and lowercase it.', requirements: ['Return a string.', 'Preserve punctuation.', 'Whitespace-only input becomes empty.'], hint: 'Chain trim, whitespace replacement, and lowercase.', maxLines: 5, checks: [['String methods', 'trim|toLowerCase'], ['Replacement', 'replace']], tests: ['  Paris ', 'New   York', 'C++', ' YES! ', '   '].map((value) => test([value], normalizeAnswer(value))) },
    { title: 'Compare Answers', entry: 'answersMatch', returnType: 'boolean', parameters: [['String', 'answer'], ['String', 'expected']], course: 'Computer Programming 1', prompt: 'Return whether two answers match after normalization.', requirements: ['Reuse normalizeAnswer.', 'Comparison is case-insensitive.', 'Whitespace differences do not matter.'], hint: 'Normalize both values, then compare strictly.', maxLines: 5, checks: [['Helper reuse', 'normalizeAnswer\\s*\\('], ['Strict comparison', '===']], tests: [[' Paris ', 'paris'], ['New  York', 'new york'], ['yes', 'no'], ['', ' ']].map((args) => test(args, answersMatch(...args))) },
    { title: 'Score a Quiz', entry: 'scoreQuiz', returnType: 'int', parameters: [['String[]', 'answers'], ['String[]', 'key']], course: 'Computer Programming 1', prompt: 'Count matching aligned answers; mismatched array lengths return 0.', requirements: ['Reuse answersMatch.', 'Do not mutate arrays.', 'Empty aligned arrays score 0.'], hint: 'Validate lengths, then count matches by index.', maxLines: 10, checks: [['Array iteration', 'for|reduce|filter'], ['Helper reuse', 'answersMatch\\s*\\('], ['Validation', 'length']], tests: [[['a', 'b'], ['A', 'c']], [[], []], [['a'], ['a', 'b']], [[' yes ', '2'], ['YES', '2']]].map((args) => test(args, scoreQuiz(...args))) },
    { title: 'Calculate Quiz Percentage', entry: 'scorePercent', returnType: 'double', parameters: [['int', 'correct'], ['int', 'total']], course: 'Computer Programming 1', prompt: 'Convert correct/total to a percentage rounded to two decimals; invalid totals return 0.', requirements: ['Avoid division by zero.', 'Return 0 for negative correct.', 'Round the final percentage.'], hint: 'Validate first, then multiply by 100.', maxLines: 7, checks: [['Validation', 'if|\\?'], ['Rounding', 'round|toFixed']], tests: [[3, 4], [1, 3], [0, 0], [-1, 5], [5, 5]].map((args) => test(args, scorePercent(...args))) },
    { title: 'Choose Quiz Feedback', entry: 'feedbackBand', returnType: 'String', parameters: [['double', 'percent']], course: 'Computer Programming 2', prompt: 'Return Perfect for 100+, Great for 80–99.99, Keep Practicing for 60–79.99, otherwise Review Needed.', requirements: ['Return exact labels.', 'Check highest threshold first.', 'Boundary values move up.'], hint: 'Use an if/else-if chain.', maxLines: 10, checks: [['Branching', 'if'], ['Multiple cases', 'else|\\?']], tests: [100, 99.99, 80, 79.99, 60, 0].map((value) => test([value], feedbackBand(value))) },
    { title: 'List Missed Questions', entry: 'missedQuestions', returnType: 'int[]', parameters: [['String[]', 'answers'], ['String[]', 'key']], course: 'Computer Programming 2', prompt: 'Return one-based question numbers for incorrect answers; mismatched arrays return empty.', requirements: ['Reuse answersMatch.', 'Use one-based numbering.', 'Preserve question order.'], hint: 'Push index + 1 for every mismatch.', maxLines: 11, checks: [['Array construction', 'push|map|reduce'], ['Helper reuse', 'answersMatch\\s*\\('], ['Iteration', 'for|forEach']], tests: [[['a', 'x', 'c'], ['a', 'b', 'c']], [[], []], [['a'], ['a', 'b']], [['x', 'y'], ['a', 'b']]].map((args) => test(args, missedQuestions(...args))) },
    { title: 'Analyze Topic Accuracy', entry: 'topicAccuracy', returnType: 'String[]', parameters: [['String[]', 'topics'], ['String[]', 'answers'], ['String[]', 'key']], course: 'Computer Programming 2', prompt: 'Group aligned questions by normalized topic and return sorted TOPIC=00.00% summaries.', requirements: ['Reject mismatched lengths with empty.', 'Ignore empty topics.', 'Return alphabetical topic order.'], hint: 'Use an object or Map to store correct and total counts.', maxLines: 24, checks: [['Grouping', 'Map|Object|\\{'], ['Sorting', 'sort'], ['Helper reuse', 'answersMatch\\s*\\(', 'scorePercent\\s*\\(']], tests: [[['math', 'math', 'science'], ['2', '3', 'yes'], ['2', '4', 'YES']], [[], [], []], [['', 'web'], ['x', 'a'], ['x', 'b']], [['b', 'a'], ['x', 'y'], ['x', 'y']]].map((args) => test(args, topicAccuracy(...args))) },
    { title: 'Find the Longest Correct Streak', entry: 'longestCorrectStreak', returnType: 'int', parameters: [['String[]', 'answers'], ['String[]', 'key']], course: 'Computer Programming 2+', prompt: 'Return the longest consecutive run of correct answers; mismatched arrays return 0.', requirements: ['Reuse answersMatch.', 'An incorrect answer resets the run.', 'Empty input returns 0.'], hint: 'Track current and best counters.', maxLines: 13, checks: [['Stateful iteration', 'for|forEach'], ['Helper reuse', 'answersMatch\\s*\\('], ['State', 'run|streak']], tests: [[['a', 'b', 'x', 'd'], ['a', 'b', 'c', 'd']], [[], []], [['a'], ['a', 'b']], [['x', 'b', 'c'], ['a', 'b', 'c']]].map((args) => test(args, longestCorrectStreak(...args))) },
    { title: 'Calculate Weighted Score', entry: 'weightedScore', returnType: 'double', parameters: [['String[]', 'answers'], ['String[]', 'key'], ['int[]', 'weights']], course: 'Computer Programming 2+', prompt: 'Return the percentage of available question weight earned, rounded to two decimals.', requirements: ['Require equal nonempty lengths.', 'Reject negative weights or zero total weight.', 'Reuse answersMatch.'], hint: 'Sum all weights and separately sum weights for correct answers.', maxLines: 16, checks: [['Parallel iteration', 'for|reduce'], ['Helper reuse', 'answersMatch\\s*\\('], ['Rounding', 'round|toFixed']], tests: [[['a', 'x'], ['a', 'b'], [1, 3]], [[], [], []], [['a'], ['a', 'b'], [1]], [['a', 'b'], ['a', 'b'], [0, 0]], [['a', 'b'], ['a', 'x'], [2, 1]]].map((args) => test(args, weightedScore(...args))) },
    { title: 'Build the Quiz Report', entry: 'buildQuizReport', returnType: 'String', parameters: [['String[]', 'topics'], ['String[]', 'answers'], ['String[]', 'key'], ['int[]', 'weights']], course: 'Computer Programming 2+', prompt: 'Compose the exact cumulative quiz report shown by the examples; mismatched inputs return "invalid quiz".', requirements: ['Reuse all earlier analytics helpers.', 'Format percent and weighted with two decimals.', 'Use none when no questions are missed.'], hint: 'Calculate each tested component once, then build the labeled string.', maxLines: 24, checks: [['Helper composition', 'scoreQuiz\\s*\\(', 'scorePercent\\s*\\(', 'feedbackBand\\s*\\(', 'missedQuestions\\s*\\(', 'topicAccuracy\\s*\\(', 'longestCorrectStreak\\s*\\(', 'weightedScore\\s*\\('], ['Formatting', 'toFixed|join']], tests: [[['math', 'math', 'science'], ['2', '3', 'yes'], ['2', '4', 'YES'], [1, 2, 3]], [[], [], [], []], [['web'], ['HTML'], ['html'], [5]], [['a'], ['x'], ['y', 'z'], [1]]].map((args) => test(args, quizReport(...args))) }
  ];

  const normalizeRobotId = (robotId) => robotId.trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/^_+|_+$/g, '');
  const clampMotorSignal = (signal) => Math.max(-100, Math.min(100, signal));
  const isSafeTemperature = (temperature) => temperature >= -20 && temperature <= 85;
  const calibrateReadings = (readings, offset) => readings.map((value) => round(value + offset));
  const averageReading = (readings) => readings.length ? round(readings.reduce((sum, value) => sum + value, 0) / readings.length) : 0;
  const countUnsafeTemperatures = (temperatures) => temperatures.filter((value) => !isSafeTemperature(value)).length;
  const peakMotorMagnitude = (signals) => signals.reduce((best, signal) => Math.max(best, Math.abs(clampMotorSignal(signal))), 0);
  const longestStableRun = (readings, tolerance) => {
    if (!readings.length || tolerance < 0) return 0;
    let best = 1, run = 1; for (let index = 1; index < readings.length; index += 1) { run = Math.abs(readings[index] - readings[index - 1]) <= tolerance ? run + 1 : 1; best = Math.max(best, run); } return best;
  };
  const energyEstimate = (signals, durations) => signals.length === durations.length && durations.every((value) => value >= 0)
    ? round(signals.reduce((sum, signal, index) => sum + Math.abs(clampMotorSignal(signal)) / 100 * durations[index], 0)) : 0;
  const telemetryReport = (robotId, signals, temperatures, durations, offset) => {
    if (!normalizeRobotId(robotId) || signals.length !== temperatures.length || signals.length !== durations.length) return 'invalid telemetry';
    const calibrated = calibrateReadings(temperatures, offset);
    return `robot=${normalizeRobotId(robotId)};samples=${signals.length};peak=${peakMotorMagnitude(signals)};averageTemp=${averageReading(calibrated).toFixed(2)};unsafe=${countUnsafeTemperatures(calibrated)};stable=${longestStableRun(calibrated, 1.5)};energy=${energyEstimate(signals, durations).toFixed(2)}`;
  };
  const cppTasks = [
    { title: 'Normalize Robot IDs', entry: 'normalizeRobotId', returnType: 'String', parameters: [['String', 'robotId']], course: 'Computer Programming 1', prompt: 'Normalize a robot ID by trimming, uppercasing, and replacing runs of spaces or hyphens with one underscore.', requirements: ['Return a new string.', 'Remove outside separators.', 'Whitespace-only input becomes empty.'], hint: 'Walk the characters and emit one separator per run.', maxLines: 18, checks: [['String processing', 'toupper|isspace|string'], ['Iteration', 'for|while']], tests: [' rover-7 ', 'arm  unit', '--bot--', 'C++', '   '].map((value) => test([value], normalizeRobotId(value))) },
    { title: 'Clamp Motor Signals', entry: 'clampMotorSignal', returnType: 'int', parameters: [['int', 'signal']], course: 'Computer Programming 1', prompt: 'Clamp a motor command to the safe range from -100 through 100.', requirements: ['Preserve in-range values.', 'Clamp both extremes.', 'Return an integer.'], hint: 'std::clamp expresses this directly.', maxLines: 5, checks: [['Bounds', 'clamp|min|max'], ['Function', 'clampMotorSignal']], tests: [-150, -100, -25, 0, 100, 150].map((value) => test([value], clampMotorSignal(value))) },
    { title: 'Validate Temperatures', entry: 'isSafeTemperature', returnType: 'boolean', parameters: [['double', 'temperature']], course: 'Computer Programming 1', prompt: 'Return whether a temperature is inside the inclusive robot-safe range -20°C through 85°C.', requirements: ['Accept both boundaries.', 'Reject values outside either side.', 'Return bool.'], hint: 'Use two comparisons joined by AND.', maxLines: 5, checks: [['Comparison', '<=|>='], ['Boolean logic', '&&']], tests: [-20, 85, -20.01, 85.01, 25].map((value) => test([value], isSafeTemperature(value))) },
    { title: 'Calibrate Sensor Readings', entry: 'calibrateReadings', returnType: 'double[]', parameters: [['double[]', 'readings'], ['double', 'offset']], course: 'Computer Programming 1', prompt: 'Add offset to every reading and round each calibrated value to two decimals.', requirements: ['Return a new vector.', 'Preserve order.', 'Empty input returns empty.'], hint: 'Push each rounded value into a result vector.', maxLines: 11, checks: [['Vector construction', 'vector|push_back'], ['Iteration', 'for|while'], ['Rounding', 'round']], tests: [[[], 1], [[1, 2.25], 0.5], [[-20.005], 0.005], [[10.111, 20.999], -0.1]].map(([values, offset]) => test([values, offset], calibrateReadings(values, offset))) },
    { title: 'Average Telemetry Readings', entry: 'averageReading', returnType: 'double', parameters: [['double[]', 'readings']], course: 'Computer Programming 2', prompt: 'Return the mean rounded to two decimals, or 0 for an empty vector.', requirements: ['Handle empty vectors.', 'Use floating-point division.', 'Round the final average.'], hint: 'Accumulate, divide by size, then round.', maxLines: 9, checks: [['Aggregation', 'accumulate|for'], ['Empty handling', 'empty|size'], ['Rounding', 'round']], tests: [[], [10], [10, 20, 30], [1, 2]].map((values) => test([values], averageReading(values))) },
    { title: 'Count Unsafe Temperatures', entry: 'countUnsafeTemperatures', returnType: 'int', parameters: [['double[]', 'temperatures']], course: 'Computer Programming 2', prompt: 'Count temperatures outside the safe range.', requirements: ['Reuse isSafeTemperature.', 'Empty input returns 0.', 'Boundary values are safe.'], hint: 'Increment when the helper returns false.', maxLines: 9, checks: [['Iteration', 'for|while|count_if'], ['Helper reuse', 'isSafeTemperature\\s*\\(']], tests: [[], [-20, 85], [-21, 20, 86], [100, -100]].map((values) => test([values], countUnsafeTemperatures(values))) },
    { title: 'Find Peak Motor Magnitude', entry: 'peakMotorMagnitude', returnType: 'int', parameters: [['int[]', 'signals']], course: 'Computer Programming 2', prompt: 'Clamp every signal and return the greatest absolute motor magnitude; empty input returns 0.', requirements: ['Reuse clampMotorSignal.', 'Treat positive and negative equally.', 'Never return above 100.'], hint: 'Compare abs(clampMotorSignal(signal)) with the current peak.', maxLines: 9, checks: [['Iteration', 'for|while'], ['Helper reuse', 'clampMotorSignal\\s*\\('], ['Absolute value', 'abs']], tests: [[], [-20, 30], [-150, 90], [0, 100]].map((values) => test([values], peakMotorMagnitude(values))) },
    { title: 'Detect Stable Sensor Runs', entry: 'longestStableRun', returnType: 'int', parameters: [['double[]', 'readings'], ['double', 'tolerance']], course: 'Computer Programming 2+', prompt: 'Return the longest run where each adjacent reading differs by no more than tolerance.', requirements: ['Negative tolerance returns 0.', 'One reading has a run of 1.', 'A large jump starts a new run.'], hint: 'Compare each reading with the previous one while tracking current and best.', maxLines: 15, checks: [['Stateful iteration', 'for|while'], ['Absolute difference', 'abs'], ['State', 'run|best']], tests: [[[], 1], [[5], 0], [[1, 1.5, 2, 5], 0.5], [[10, 12, 13, 14], 1.1], [[1, 1], -1]].map(([values, tolerance]) => test([values, tolerance], longestStableRun(values, tolerance))) },
    { title: 'Estimate Motor Energy', entry: 'energyEstimate', returnType: 'double', parameters: [['int[]', 'signals'], ['double[]', 'durations']], course: 'Computer Programming 2+', prompt: 'Sum abs(clamped signal)/100 × duration and round to two decimals; invalid alignment or negative duration returns 0.', requirements: ['Reuse clampMotorSignal.', 'Require aligned vectors.', 'Round the final sum.'], hint: 'Accumulate normalized motor magnitude times aligned duration.', maxLines: 14, checks: [['Parallel iteration', 'for|while'], ['Helper reuse', 'clampMotorSignal\\s*\\('], ['Rounding', 'round']], tests: [[[], []], [[50, -100], [2, 1]], [[1], [1, 2]], [[150], [2]], [[20], [-1]]].map((args) => test(args, energyEstimate(...args))) },
    { title: 'Build the Telemetry Report', entry: 'buildTelemetryReport', returnType: 'String', parameters: [['String', 'robotId'], ['int[]', 'signals'], ['double[]', 'temperatures'], ['double[]', 'durations'], ['double', 'offset']], course: 'Computer Programming 2+', prompt: 'Validate alignment and compose the exact robotics telemetry report shown by the examples.', requirements: ['Return invalid telemetry for empty robot ID or mismatched vectors.', 'Analyze calibrated temperatures.', 'Format averageTemp and energy with two decimals.'], hint: 'Compose the earlier helpers and format with fixed precision.', maxLines: 24, checks: [['Helper composition', 'normalizeRobotId\\s*\\(', 'calibrateReadings\\s*\\(', 'averageReading\\s*\\(', 'countUnsafeTemperatures\\s*\\(', 'peakMotorMagnitude\\s*\\(', 'longestStableRun\\s*\\(', 'energyEstimate\\s*\\('], ['Formatting', 'setprecision|fixed']], tests: [[' rover-7 ', [50, -120, 20], [20, 21, 90], [2, 1, 0.5], -1], ['', [], [], [], 0], ['bot', [10], [20, 30], [1], 0], ['arm 2', [], [], [], 2]].map((args) => test(args, telemetryReport(...args))) }
  ];

  const javaStarter = `import java.util.*;

public class Main {
    public static String normalizeSku(String sku) { // Task 1
        return "";
    }
    public static boolean isValidItem(String sku, int quantity, double price) { // Task 2
        return false;
    }
    public static double inventoryValue(int[] quantities, double[] prices) { // Task 3
        return 0;
    }
    public static String stockStatus(int quantity) { // Task 4
        return "";
    }
    public static int countLowStock(int[] quantities) { // Task 5
        return 0;
    }
    public static String[] sortedSkus(String[] skus) { // Task 6
        return new String[0];
    }
    public static int[] restockQuantities(int[] quantities, int target) { // Task 7
        return new int[0];
    }
    public static String highestValueSku(String[] skus, int[] quantities, double[] prices) { // Task 8
        return "";
    }
    public static double reorderCost(int[] quantities, double[] prices, int target) { // Task 9
        return 0;
    }
    public static String buildInventoryReport(String[] skus, int[] quantities, double[] prices, int target) { // Task 10
        return "";
    }
}
`;
  const javascriptStarter = `function normalizeAnswer(answer) { // Task 1
}
function answersMatch(answer, expected) { // Task 2
}
function scoreQuiz(answers, key) { // Task 3
}
function scorePercent(correct, total) { // Task 4
}
function feedbackBand(percent) { // Task 5
}
function missedQuestions(answers, key) { // Task 6
}
function topicAccuracy(topics, answers, key) { // Task 7
}
function longestCorrectStreak(answers, key) { // Task 8
}
function weightedScore(answers, key, weights) { // Task 9
}
function buildQuizReport(topics, answers, key, weights) { // Task 10
}
`;
  const cppStarter = `#include <algorithm>
#include <cmath>
#include <iomanip>
#include <numeric>
#include <sstream>
#include <string>
#include <vector>

std::string normalizeRobotId(const std::string& robotId) { // Task 1
    return "";
}
int clampMotorSignal(int signal) { // Task 2
    return 0;
}
bool isSafeTemperature(double temperature) { // Task 3
    return false;
}
std::vector<double> calibrateReadings(const std::vector<double>& readings, double offset) { // Task 4
    return {};
}
double averageReading(const std::vector<double>& readings) { // Task 5
    return 0;
}
int countUnsafeTemperatures(const std::vector<double>& temperatures) { // Task 6
    return 0;
}
int peakMotorMagnitude(const std::vector<int>& signals) { // Task 7
    return 0;
}
int longestStableRun(const std::vector<double>& readings, double tolerance) { // Task 8
    return 0;
}
double energyEstimate(const std::vector<int>& signals, const std::vector<double>& durations) { // Task 9
    return 0;
}
std::string buildTelemetryReport(const std::string& robotId, const std::vector<int>& signals, const std::vector<double>& temperatures, const std::vector<double>& durations, double offset) { // Task 10
    return "";
}
`;

  return {
    java: project('java', { id: 'java-inventory-system', language: 'Java', title: 'Smart Inventory Management System', description: 'Build a cumulative Java inventory system using validation, arrays, collections, sorting, and reporting.', problemHref: 'java-sandbox.html', indent: 4 }, javaTasks, javaStarter),
    javascript: project('javascript', { id: 'javascript-quiz-engine', language: 'JavaScript', title: 'Interactive Quiz Analytics Engine', description: 'Build a cumulative JavaScript quiz engine using answer normalization, array analytics, grouping, weights, and feedback.', problemHref: 'javascript-sandbox.html', indent: 2 }, javascriptTasks, javascriptStarter),
    cpp: project('cpp', { id: 'cpp-robotics-telemetry', language: 'C++', title: 'Robotics Telemetry Analyzer', description: 'Build a cumulative C++ robotics analyzer using safe bounds, vectors, calibration, telemetry statistics, and reporting.', problemHref: 'cpp-sandbox.html', indent: 4 }, cppTasks, cppStarter)
  };
}));
