(function (root, factory) {
  const projects = factory();
  if (typeof module === 'object' && module.exports) module.exports = projects;
  if (typeof location !== 'undefined') {
    const key = new URLSearchParams(location.search).get('project');
    root.STEMGuidedProject = projects[key];
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const round = (value) => Number(value.toFixed(2));
  const normalizeTopic = (topic) => topic.trim().replace(/\s+/g, ' ').toUpperCase();
  const validSession = (topic, minutes, score) => normalizeTopic(topic) !== '' && Number.isInteger(minutes)
    && minutes >= 1 && minutes <= 1440 && typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
  const totalMinutes = (minutes) => minutes.reduce((sum, value) => sum + value, 0);
  const averageScore = (scores) => scores.length ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  const masteryBand = (average) => average >= 90 ? 'Mastery' : average >= 80 ? 'Proficient' : average >= 70 ? 'Developing' : average >= 60 ? 'Emerging' : 'Beginning';
  const countPassed = (scores) => scores.filter((score) => score >= 60).length;
  const uniqueTopics = (topics) => [...new Set(topics.map(normalizeTopic).filter(Boolean))].sort();
  const longestStreak = (days) => {
    const ordered = [...new Set(days)].sort((a, b) => a - b);
    let best = 0, run = 0, previous = null;
    ordered.forEach((day) => { run = previous !== null && day === previous + 1 ? run + 1 : 1; best = Math.max(best, run); previous = day; });
    return best;
  };
  const productivityScore = (minutes, scores) => minutes.length && minutes.length === scores.length
    ? round(totalMinutes(minutes) * averageScore(scores) / 100) : 0;
  const buildReport = (topics, minutes, scores, days) => {
    const keptTopics = [], keptMinutes = [], keptScores = [];
    for (let index = 0; index < Math.min(topics.length, minutes.length, scores.length); index += 1) {
      if (validSession(topics[index], minutes[index], scores[index])) {
        keptTopics.push(topics[index]); keptMinutes.push(minutes[index]); keptScores.push(scores[index]);
      }
    }
    const average = averageScore(keptScores);
    return `topics=${uniqueTopics(keptTopics).join('|')};sessions=${keptTopics.length};minutes=${totalMinutes(keptMinutes)};average=${average.toFixed(2)};band=${masteryBand(average)};passed=${countPassed(keptScores)};streak=${longestStreak(days)};productivity=${productivityScore(keptMinutes, keptScores).toFixed(2)}`;
  };
  const test = (args, expected) => ({ args: clone(args), expected: clone(expected) });
  const TASKS = [
    {
      title: 'Normalize Study Topics', entry: 'normalizeTopic', returnType: 'String', parameters: [['String', 'topic']], course: 'Computer Programming 1',
      prompt: 'Implement normalizeTopic(topic). Trim outside whitespace, collapse repeated internal whitespace, and uppercase the result.',
      requirements: ['Return a new string.', 'Whitespace-only input becomes an empty string.', 'Do not alter word order.'],
      hint: 'Trim first, collapse whitespace, then uppercase.', maxLines: 7, checks: [['String processing', 'trim|strip|isspace|toupper|toUpperCase'], ['Transformation', 'replace|split|stringstream']],
      tests: [' algebra ', 'computer   science', 'C++', '  data structures  ', '   '].map((value) => test([value], normalizeTopic(value)))
    },
    {
      title: 'Validate Study Sessions', entry: 'isValidSession', returnType: 'boolean', parameters: [['String', 'topic'], ['int', 'minutes'], ['double', 'score']], course: 'Computer Programming 1',
      prompt: 'Implement isValidSession(topic, minutes, score). A valid session has a nonempty normalized topic, 1–1440 minutes, and a score from 0 through 100.',
      requirements: ['Accept both score boundaries.', 'Reject zero or excessive minutes.', 'Reuse normalizeTopic.'],
      hint: 'Combine the three validity rules with boolean AND.', maxLines: 8, checks: [['Conditionals or boolean logic', 'if|&&'], ['Helper reuse', 'normalizeTopic\\s*\\(']],
      tests: [['algebra', 30, 90], ['  ', 30, 90], ['physics', 0, 80], ['data', 1441, 80], ['java', 45, 100], ['cpp', 20, -0.1]].map((args) => test(args, validSession(...args)))
    },
    {
      title: 'Total Study Minutes', entry: 'totalMinutes', returnType: 'int', parameters: [['int[]', 'minutes']], course: 'Computer Programming 1',
      prompt: 'Implement totalMinutes(minutes). Return the sum of every duration, or 0 for an empty collection.',
      requirements: ['Handle empty input.', 'Return an integer.', 'Do not mutate the collection.'],
      hint: 'Start a total at zero and accumulate each value.', maxLines: 8, checks: [['Iteration', 'for|while|reduce|accumulate'], ['Accumulation', '\\+=|reduce|accumulate']],
      tests: [[30, 45, 15], [], [1, 1440], [25, 25, 25, 25]].map((values) => test([values], totalMinutes(values)))
    },
    {
      title: 'Calculate Average Scores', entry: 'averageScore', returnType: 'double', parameters: [['double[]', 'scores']], course: 'Computer Programming 1',
      prompt: 'Implement averageScore(scores). Return the arithmetic mean rounded to two decimals, or 0 for empty input.',
      requirements: ['Round only the final average.', 'Handle empty input.', 'Use floating-point division.'],
      hint: 'Guard the empty case, sum the values, then divide by the count.', maxLines: 10, checks: [['Iteration or aggregation', 'for|while|reduce|accumulate'], ['Empty handling', 'if|length|size'], ['Rounding', 'round|toFixed']],
      tests: [[90, 80, 70], [59.5, 60], [], [100], [1, 2]].map((values) => test([values], averageScore(values)))
    },
    {
      title: 'Assign Mastery Bands', entry: 'masteryBand', returnType: 'String', parameters: [['double', 'average']], course: 'Computer Programming 2',
      prompt: 'Implement masteryBand(average): Mastery ≥90, Proficient ≥80, Developing ≥70, Emerging ≥60, otherwise Beginning.',
      requirements: ['Check thresholds from highest to lowest.', 'Boundary values belong to the higher band.', 'Return the exact label.'],
      hint: 'Use an ordered if/else-if chain.', maxLines: 13, checks: [['Branching', 'if'], ['Multiple cases', 'else|\\?']],
      tests: [100, 90, 89.99, 80, 70, 60, 0].map((value) => test([value], masteryBand(value)))
    },
    {
      title: 'Count Passing Scores', entry: 'countPassed', returnType: 'int', parameters: [['double[]', 'scores']], course: 'Computer Programming 2',
      prompt: 'Implement countPassed(scores). Count scores greater than or equal to 60.',
      requirements: ['A score of 60 passes.', 'Empty input returns 0.', 'Do not sort or mutate scores.'],
      hint: 'Increment a counter when a score meets the threshold.', maxLines: 9, checks: [['Iteration', 'for|while|filter'], ['Filtering or branch', 'if|filter'], ['Counter', '\\+\\+|\\+=|length']],
      tests: [[90, 80, 70], [59.99, 60], [], [0, 100, 45, 61]].map((values) => test([values], countPassed(values)))
    },
    {
      title: 'Collect Unique Topics', entry: 'uniqueTopics', returnType: 'String[]', parameters: [['String[]', 'topics']], course: 'Computer Programming 2',
      prompt: 'Implement uniqueTopics(topics). Normalize topics, remove empty values and duplicates, then return them alphabetically.',
      requirements: ['Reuse normalizeTopic.', 'Return a new collection.', 'Comparison occurs after normalization.'],
      hint: 'Normalize into a set, then sort the result.', maxLines: 15, checks: [['Collection processing', 'Set|set|vector|Array'], ['Sorting', 'sort'], ['Helper reuse', 'normalizeTopic\\s*\\(']],
      tests: [[' algebra ', 'Physics', 'ALGEBRA'], [], ['  ', 'java', ' java '], ['C++', 'JavaScript', 'Java']].map((values) => test([values], uniqueTopics(values)))
    },
    {
      title: 'Find the Longest Study Streak', entry: 'longestStudyStreak', returnType: 'int', parameters: [['int[]', 'days']], course: 'Computer Programming 2+',
      prompt: 'Implement longestStudyStreak(days). Day numbers may be unordered and duplicated; return the longest consecutive run.',
      requirements: ['Deduplicate days.', 'Sort before comparing.', 'Empty input returns 0.'],
      hint: 'Track the current and best runs while walking sorted unique days.', maxLines: 18, checks: [['Deduplication', 'Set|set|unique'], ['Sorting', 'sort'], ['Stateful iteration', 'for|while']],
      tests: [[1, 2, 4], [5, 3, 4, 4], [], [10], [8, 5, 6, 7, 10]].map((values) => test([values], longestStreak(values)))
    },
    {
      title: 'Score Study Productivity', entry: 'productivityScore', returnType: 'double', parameters: [['int[]', 'minutes'], ['double[]', 'scores']], course: 'Computer Programming 2+',
      prompt: 'Implement productivityScore(minutes, scores). For equal nonempty collections, return total minutes × average score ÷ 100, rounded to two decimals; otherwise return 0.',
      requirements: ['Reject empty or mismatched collections with 0.', 'Reuse totalMinutes and averageScore.', 'Round the final result.'],
      hint: 'Validate collection lengths, then compose the two earlier helpers.', maxLines: 9, checks: [['Validation', 'if|length|size'], ['Helper reuse', 'totalMinutes\\s*\\(', 'averageScore\\s*\\('], ['Rounding', 'round|toFixed']],
      tests: [[[30, 45, 15], [90, 80, 70]], [[], []], [[10], [100, 90]], [[20, 20], [50, 100]]].map(([minutes, scores]) => test([minutes, scores], productivityScore(minutes, scores)))
    },
    {
      title: 'Build the Final Study Report', entry: 'buildStudyReport', returnType: 'String', parameters: [['String[]', 'topics'], ['int[]', 'minutes'], ['double[]', 'scores'], ['int[]', 'days']], course: 'Computer Programming 2+',
      prompt: 'Implement buildStudyReport(topics, minutes, scores, days). Filter invalid aligned sessions and compose every earlier analysis into the exact report format shown by the examples.',
      requirements: ['Only aligned sessions passing isValidSession enter session statistics.', 'Use normalized unique topics separated by |.', 'Format average and productivity with exactly two decimal places.'],
      hint: 'Collect valid parallel values, call your helpers, then concatenate the labeled fields in order.', maxLines: 32, checks: [['Parallel collection processing', 'for|while|map'], ['Validation reuse', 'isValidSession\\s*\\('], ['Helper composition', 'uniqueTopics\\s*\\(', 'totalMinutes\\s*\\(', 'averageScore\\s*\\(', 'masteryBand\\s*\\(', 'countPassed\\s*\\(', 'longestStudyStreak\\s*\\(', 'productivityScore\\s*\\(']],
      tests: [
        [[' algebra ', 'physics', 'algebra'], [30, 45, 15], [90, 80, 70], [1, 2, 4]],
        [['js', '', 'data'], [20, 30, -5], [100, 80, 70], [5, 6, 7]],
        [['cpp', 'java'], [50, 50], [59.5, 60], [10, 12]],
        [[], [], [], []]
      ].map((args) => test(args, buildReport(...args)))
    }
  ];

  const starters = {
    javascript: `function normalizeTopic(topic) {
  // Task 1
}

function isValidSession(topic, minutes, score) {
  // Task 2
}

function totalMinutes(minutes) {
  // Task 3
}

function averageScore(scores) {
  // Task 4
}

function masteryBand(average) {
  // Task 5
}

function countPassed(scores) {
  // Task 6
}

function uniqueTopics(topics) {
  // Task 7
}

function longestStudyStreak(days) {
  // Task 8
}

function productivityScore(minutes, scores) {
  // Task 9
}

function buildStudyReport(topics, minutes, scores, days) {
  // Task 10
}
`,
    java: `import java.util.*;

public class Main {
    public static String normalizeTopic(String topic) {
        // Task 1
        return "";
    }

    public static boolean isValidSession(String topic, int minutes, double score) {
        // Task 2
        return false;
    }

    public static int totalMinutes(int[] minutes) {
        // Task 3
        return 0;
    }

    public static double averageScore(double[] scores) {
        // Task 4
        return 0;
    }

    public static String masteryBand(double average) {
        // Task 5
        return "";
    }

    public static int countPassed(double[] scores) {
        // Task 6
        return 0;
    }

    public static String[] uniqueTopics(String[] topics) {
        // Task 7
        return new String[0];
    }

    public static int longestStudyStreak(int[] days) {
        // Task 8
        return 0;
    }

    public static double productivityScore(int[] minutes, double[] scores) {
        // Task 9
        return 0;
    }

    public static String buildStudyReport(String[] topics, int[] minutes, double[] scores, int[] days) {
        // Task 10
        return "";
    }
}
`,
    cpp: `#include <algorithm>
#include <cmath>
#include <iomanip>
#include <numeric>
#include <set>
#include <sstream>
#include <string>
#include <vector>

std::string normalizeTopic(const std::string& topic) {
    // Task 1
    return "";
}

bool isValidSession(const std::string& topic, int minutes, double score) {
    // Task 2
    return false;
}

int totalMinutes(const std::vector<int>& minutes) {
    // Task 3
    return 0;
}

double averageScore(const std::vector<double>& scores) {
    // Task 4
    return 0;
}

std::string masteryBand(double average) {
    // Task 5
    return "";
}

int countPassed(const std::vector<double>& scores) {
    // Task 6
    return 0;
}

std::vector<std::string> uniqueTopics(const std::vector<std::string>& topics) {
    // Task 7
    return {};
}

int longestStudyStreak(const std::vector<int>& days) {
    // Task 8
    return 0;
}

double productivityScore(const std::vector<int>& minutes, const std::vector<double>& scores) {
    // Task 9
    return 0;
}

std::string buildStudyReport(const std::vector<std::string>& topics, const std::vector<int>& minutes, const std::vector<double>& scores, const std::vector<int>& days) {
    // Task 10
    return "";
}
`
  };

  const meta = {
    java: { language: 'Java', problemHref: 'java-sandbox.html', runtimeMessage: 'Java compiler loads on the first task check.', indent: 4 },
    javascript: { language: 'JavaScript', problemHref: 'javascript-sandbox.html', runtimeMessage: 'JavaScript worker is ready.', indent: 2 },
    cpp: { language: 'C++', problemHref: 'cpp-sandbox.html', runtimeMessage: 'GCC 13.2 runs through Compiler Explorer.', indent: 4 }
  };
  const buildProject = (key) => {
    const tasks = TASKS.map((source, index) => ({
      ...clone(source), id: `${key}-study-project-task-${index + 1}`, number: index + 1,
      runtimeBudgetMs: key === 'javascript' ? 25 : key === 'java' ? 5000 : 8000,
      concepts: [
        { label: 'Function or method', patterns: [`${source.entry}\\s*\\(`] },
        ...source.checks.map(([label, ...patterns]) => ({ label, patterns }))
      ]
    }));
    return {
      id: `${key}-study-analytics`, key, ...meta[key], title: 'Study Session Analytics Engine',
      description: `Build a cumulative ${meta[key].language} study-data engine through Computer Programming 1, 2, and 2+.`,
      tasks, starter: starters[key]
    };
  };
  return { java: buildProject('java'), javascript: buildProject('javascript'), cpp: buildProject('cpp') };
}));
