// Mastery engine (revision Phase 2c): one state per skill — a course unit
// from skill-catalog.json — worked out from the student's saved work each
// time a page loads. Nothing here is stored, so states can't drift from the
// results, Problem Set progress, lesson views, and projects they come from.
(function () {
  'use strict';

  const STATES = ['unseen', 'learning', 'practiced', 'proficient', 'mastered', 'applied'];
  const LABELS = {
    unseen: 'Unseen',
    learning: 'Learning',
    practiced: 'Practiced',
    proficient: 'Proficient',
    mastered: 'Mastered',
    applied: 'Applied',
  };
  const PRACTICED_ATTEMPTS = 5;
  const PROFICIENT_ATTEMPTS = 10;
  const PROFICIENT_ACCURACY = 0.8;
  const PROFICIENT_UNIT_TEST = 0.7;

  // Folder prefixes ("/Course/Unit 3/") match any page inside; course.js
  // lesson pages ("…/lesson.html?id=slug") must match exactly.
  const isLessonOf = (skill, page) => skill.pagePrefixes.some((prefix) => (
    prefix.endsWith('/') ? page.startsWith(prefix) : page === prefix
  ));

  // evidence: { lessons: { page: iso }, results: [saved test rows],
  //   problems: { skillId: { attempted, correct } }, completedProjects: [id] }
  function computeMastery(catalog, evidence) {
    const pages = Object.keys(evidence.lessons || {});
    const results = evidence.results || [];
    const completed = new Set(evidence.completedProjects || []);
    const examPassed = new Set(results.filter((row) => row.kind === 'course_exam' && row.passed).map((row) => row.course));
    const mastery = {};
    catalog.skills.forEach((skill) => {
      const tests = results.filter((row) => row.kind === 'unit_test' && row.course === skill.course && row.unit === skill.unit);
      const best = tests.reduce((max, row) => Math.max(max, row.total ? row.score / row.total : 0), 0);
      const practice = (evidence.problems || {})[skill.id] || { attempted: 0, correct: 0 };
      const lessonsViewed = pages.filter((page) => isLessonOf(skill, page)).length;
      const mastered = tests.some((row) => row.passed) || examPassed.has(skill.course);

      // Each rule raises the state, so the highest one earned wins.
      let state = 'unseen';
      if (lessonsViewed > 0) state = 'learning';
      if (practice.attempted >= PRACTICED_ATTEMPTS || tests.length > 0) state = 'practiced';
      if ((practice.attempted >= PROFICIENT_ATTEMPTS && practice.correct / practice.attempted >= PROFICIENT_ACCURACY)
        || best >= PROFICIENT_UNIT_TEST) state = 'proficient';
      if (mastered) state = 'mastered';
      if (mastered && (catalog.capstones[skill.course] || []).some((id) => completed.has(id))) state = 'applied';

      mastery[skill.id] = { state, lessonsViewed, practice, bestUnitTest: tests.length ? best : null };
    });
    return mastery;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { STATES, LABELS, computeMastery };
    return;
  }
}());
