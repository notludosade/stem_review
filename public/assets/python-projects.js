(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.STEMPythonProject = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const normalizeName = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/(^|[\s-])\w/g, (letter) => letter.toUpperCase());
  const validScores = (scores) => scores.length > 0 && scores.every((score) => typeof score === 'number' && score >= 0 && score <= 100);
  const averageScore = (scores) => scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : 0;
  const assignLevel = (average) => average >= 90 ? 'A' : average >= 80 ? 'B' : average >= 70 ? 'C' : average >= 60 ? 'D' : 'F';
  const summarize = (record) => {
    const average = averageScore(record.scores);
    return { name: normalizeName(record.name), course: record.course.trim().toUpperCase(), average, level: assignLevel(average), passed: average >= 60, completion_count: record.scores.length };
  };
  const sortLearners = (records) => records.map(summarize).sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));
  const coursePerformance = (records) => {
    const groups = {};
    records.forEach((record) => { const key = record.course.trim().toUpperCase(); (groups[key] ||= []).push(summarize(record)); });
    return Object.fromEntries(Object.keys(groups).sort().map((course) => {
      const learners = groups[course];
      return [course, { learner_count: learners.length, average_score: Number((learners.reduce((sum, learner) => sum + learner.average, 0) / learners.length).toFixed(2)), pass_rate: Number((100 * learners.filter((learner) => learner.passed).length / learners.length).toFixed(2)) }];
    }));
  };
  const longestStreak = (days) => {
    const ordered = [...new Set(days)].sort();
    let best = 0, run = 0, previous = null;
    ordered.forEach((day) => { const current = Date.parse(`${day}T00:00:00Z`); run = previous !== null && current - previous === 86400000 ? run + 1 : 1; best = Math.max(best, run); previous = current; });
    return best;
  };
  const RECORD_SETS = [
    [{ name: ' ada lovelace ', course: 'python 1', scores: [90, 80, 100] }, { name: 'BO', course: 'python 1', scores: [60, 70] }, { name: 'cy lin', course: 'data 2+', scores: [95, 95] }],
    [{ name: 'Sam', course: 'java 2', scores: [50, 55] }, { name: 'lee', course: 'java 2', scores: [80, 80] }, { name: 'Ana', course: 'python 1', scores: [80, 80] }],
    [{ name: 'Zed', course: 'cpp 2+', scores: [100] }, { name: ' amy ', course: 'cpp 2+', scores: [100] }, { name: 'mo', course: 'web 1', scores: [0, 100] }],
    []
  ];
  const DAY_SETS = [['2026-01-01', '2026-01-02', '2026-01-04'], ['2025-12-31', '2026-01-01', '2026-01-02'], [], ['2026-03-03', '2026-03-01', '2026-03-02', '2026-03-02']];
  const test = (args, expected) => ({ args: clone(args), expected: clone(expected) });
  const concepts = (...items) => items.map(([label, ...patterns]) => ({ label, patterns }));
  const tasks = [
    {
      title: 'Normalize Learner Names', entry: 'normalize_name', entryType: 'function', course: 'Computer Programming 1',
      prompt: 'Implement normalize_name(name). Strip outside whitespace, collapse repeated internal whitespace, lowercase first, then title-case words and hyphenated parts.',
      requirements: ['Return a string.', 'An empty or whitespace-only name becomes an empty string.', 'Do not mutate inputs.'],
      hint: 'A short chain using strip, split/join, and title is enough.', maxLines: 6, runtimeBudgetMs: 8,
      concepts: concepts(['Function', '^def\\s+normalize_name'], ['String methods', '\\.strip\\s*\\(', '\\.split\\s*\\(', '\\.title\\s*\\(']),
      tests: [['  ada LOVELACE  '], ['mARY-jANE   watson'], [''], ['  ALAN   TURING ']].map((args) => test(args, normalizeName(args[0])))
    },
    {
      title: 'Validate Score Collections', entry: 'validate_scores', entryType: 'function', course: 'Computer Programming 1',
      prompt: 'Implement validate_scores(scores). Return true only for a nonempty list of int/float scores from 0 through 100. Boolean values are invalid.',
      requirements: ['Reject empty lists.', 'Reject booleans even though bool subclasses int in Python.', 'Accept boundary scores 0 and 100.'],
      hint: 'Combine a nonempty check with all(...), and test bool separately.', maxLines: 7, runtimeBudgetMs: 8,
      concepts: concepts(['Function', '^def\\s+validate_scores'], ['Conditionals or boolean logic', '\bif\b', '\band\b', '\ball\\s*\\('], ['Iteration', '\bfor\b', '\ball\\s*\\(']),
      tests: [[[90, 80, 100]], [[]], [[0, 100, 50.5]], [[true, 80]], [[-1, 80]]].map(([scores]) => test([scores], validScores(scores)))
    },
    {
      title: 'Calculate Reliable Averages', entry: 'average_score', entryType: 'function', course: 'Computer Programming 1',
      prompt: 'Implement average_score(scores). Return the arithmetic mean rounded to two decimals, or 0 for an empty list.',
      requirements: ['Handle empty input without division by zero.', 'Round only the final result.', 'Return a number.'],
      hint: 'Guard the empty case, then divide sum(scores) by len(scores).', maxLines: 6, runtimeBudgetMs: 8,
      concepts: concepts(['Function', '^def\\s+average_score'], ['Aggregation', '\bsum\\s*\\(', '\bfor\b'], ['Empty-case branch', '\bif\b', '\bor\s+0']),
      tests: [[90, 80, 100], [1, 2], [], [99.9, 80.25]].map((scores) => test([scores], averageScore(scores)))
    },
    {
      title: 'Assign Course Levels', entry: 'assign_level', entryType: 'function', course: 'Computer Programming 1',
      prompt: 'Implement assign_level(average) using A≥90, B≥80, C≥70, D≥60, otherwise F.',
      requirements: ['Check thresholds from highest to lowest.', 'Boundary values belong to the higher level.', 'Return one uppercase letter.'],
      hint: 'An if/elif chain expresses the rubric directly.', maxLines: 12, runtimeBudgetMs: 8,
      concepts: concepts(['Function', '^def\\s+assign_level'], ['Branching', '\bif\b'], ['Multiple cases', '\belif\b', '\belse\b']),
      tests: [100, 90, 89.99, 80, 70, 60, 0].map((score) => test([score], assignLevel(score)))
    },
    {
      title: 'Build Learner Summaries', entry: 'summarize_learner', entryType: 'function', course: 'Computer Programming 2',
      prompt: 'Implement summarize_learner(record). Return name, uppercase course, average, level, passed, and completion_count using your earlier helpers.',
      requirements: ['Reuse normalize_name, average_score, and assign_level.', 'passed means average is at least 60.', 'Return exactly the required dictionary keys.'],
      hint: 'Calculate average once, then construct one dictionary.', maxLines: 14, runtimeBudgetMs: 12,
      concepts: concepts(['Dictionary construction', '\{[\\s\\S]*\}'], ['Helper reuse', 'normalize_name\\s*\\(', 'average_score\\s*\\(', 'assign_level\\s*\\('], ['Data access', '\[["\'](?:name|course|scores)["\']\]']),
      tests: RECORD_SETS.slice(0, 3).flat().slice(0, 4).map((record) => test([record], summarize(record)))
    },
    {
      title: 'Rank Learners', entry: 'sort_learners', entryType: 'function', course: 'Computer Programming 2',
      prompt: 'Implement sort_learners(records). Summarize every record, then sort by average descending and normalized name ascending.',
      requirements: ['Return a new list of summary dictionaries.', 'Do not mutate records.', 'Name resolves equal-average ties.'],
      hint: 'sorted supports a tuple key; negate average for descending order.', maxLines: 10, runtimeBudgetMs: 15,
      concepts: concepts(['Collection transformation', '\bfor\b', '\bmap\\s*\\(', '\[[^\]]*for\b'], ['Sorting', '\bsorted\\s*\\(', '\\.sort\\s*\\('], ['Helper reuse', 'summarize_learner\\s*\\(']),
      tests: RECORD_SETS.map((records) => test([records], sortLearners(records)))
    },
    {
      title: 'Aggregate Course Performance', entry: 'group_course_performance', entryType: 'function', course: 'Computer Programming 2',
      prompt: 'Implement group_course_performance(records). Group by normalized course and return learner_count, average_score, and percentage pass_rate, both rounded to two decimals.',
      requirements: ['Return course keys in alphabetical insertion order.', 'Reuse learner summaries.', 'Empty input returns an empty dictionary.'],
      hint: 'Build a dictionary of summary lists, then aggregate each group.', maxLines: 24, runtimeBudgetMs: 22,
      concepts: concepts(['Dictionary grouping', '\bdict\\s*\\(', '\{', '\\.setdefault\\s*\\('], ['Iteration', '\bfor\b'], ['Aggregation', '\bsum\\s*\\(', 'average_score'], ['Helper reuse', 'summarize_learner\\s*\\(']),
      tests: RECORD_SETS.map((records) => test([records], coursePerformance(records)))
    },
    {
      title: 'Find Completion Streaks', entry: 'longest_completion_streak', entryType: 'function', course: 'Computer Programming 2+',
      prompt: 'Implement longest_completion_streak(days). Dates are YYYY-MM-DD strings in any order with possible duplicates. Return the longest run of consecutive calendar days.',
      requirements: ['Deduplicate dates.', 'Work across month and year boundaries.', 'Empty input returns 0.'],
      hint: 'Convert with date.fromisoformat after sorting unique values, then compare one-day differences.', maxLines: 18, runtimeBudgetMs: 18,
      concepts: concepts(['Set or deduplication', '\bset\\s*\\(', '\bdict\\.fromkeys'], ['Ordering', '\bsorted\\s*\\(', '\\.sort\\s*\\('], ['Stateful iteration', '\bfor\b', '\bwhile\b'], ['Date handling', 'date\\.fromisoformat', 'timedelta']),
      tests: DAY_SETS.map((days) => test([days], longestStreak(days)))
    },
    {
      title: 'Create a ProgressTracker Class', entry: 'ProgressTracker', entryType: 'class', course: 'Computer Programming 2+',
      classCheck: { addMethod: 'add_learner', outputs: { learners: 'learner_summaries', courses: 'course_report' } },
      prompt: 'Complete ProgressTracker. __init__ creates record storage, add_learner appends a record, learner_summaries returns ranked summaries, and course_report returns grouped performance.',
      requirements: ['Keep state on self.records.', 'Methods must reuse sort_learners and group_course_performance.', 'A new tracker starts empty.'],
      hint: 'The class is a thin stateful wrapper around your tested functions.', maxLines: 18, runtimeBudgetMs: 22,
      concepts: concepts(['Class definition', '^class\\s+ProgressTracker'], ['Constructor', 'def\\s+__init__'], ['Instance state', 'self\\.records'], ['Methods', 'def\\s+add_learner', 'def\\s+learner_summaries', 'def\\s+course_report'], ['Helper reuse', 'sort_learners\\s*\\(', 'group_course_performance\\s*\\(']),
      tests: RECORD_SETS.map((records) => test([records], { learners: sortLearners(records), courses: coursePerformance(records) }))
    },
    {
      title: 'Assemble the Final Progress Report', entry: 'build_progress_report', entryType: 'function', course: 'Computer Programming 2+',
      prompt: 'Implement build_progress_report(records, completion_days). Integrate the full project into one report with learner_count, learners, courses, top_learner, and longest_streak.',
      requirements: ['Reuse earlier functions or ProgressTracker.', 'top_learner is the first ranked summary or None.', 'The empty project still returns every required key.'],
      hint: 'Compose existing helpers; this function should contain little new logic.', maxLines: 16, runtimeBudgetMs: 28,
      concepts: concepts(['Composition', 'sort_learners\\s*\\(', 'ProgressTracker\\s*\\('], ['Course report reuse', 'group_course_performance\\s*\\(', 'course_report\\s*\\('], ['Streak reuse', 'longest_completion_streak\\s*\\('], ['Empty handling', '\bif\b', '\bor\\s+None']),
      tests: RECORD_SETS.map((records, index) => { const learners = sortLearners(records); return test([records, DAY_SETS[index]], { learner_count: records.length, learners, courses: coursePerformance(records), top_learner: learners[0] || null, longest_streak: longestStreak(DAY_SETS[index]) }); })
    }
  ];

  tasks.forEach((task, index) => { task.id = `python-project-task-${index + 1}`; task.number = index + 1; });
  const starter = `from datetime import date, timedelta

def normalize_name(name):
    # Task 1
    pass

def validate_scores(scores):
    # Task 2
    pass

def average_score(scores):
    # Task 3
    pass

def assign_level(average):
    # Task 4
    pass

def summarize_learner(record):
    # Task 5
    pass

def sort_learners(records):
    # Task 6
    pass

def group_course_performance(records):
    # Task 7
    pass

def longest_completion_streak(days):
    # Task 8
    pass

class ProgressTracker:
    # Task 9
    pass

def build_progress_report(records, completion_days):
    # Task 10
    pass
`;

  return {
    id: 'python-progress-engine', title: 'STEM Course Progress Engine', language: 'Python',
    description: 'Build a cumulative learner-progress analytics engine while applying Computer Programming 1, 2, and 2+ concepts.',
    tasks, starter
  };
}));
