// Pathway diagnostic (revision Phase 2b, content/diagnostic.html): a short
// test built from the Problem Set questions of a Pathway's skills. Results
// show readiness and raise unit mastery up to Proficient (mastery.js).
(function () {
  'use strict';

  const MAX_QUESTIONS = 30;
  const TWO_PER_SKILL_UP_TO = 15;

  // Skills the diagnostic can test: the Pathway's units that have Problem
  // Set questions, in Pathway course order, then unit order.
  const testableSkills = (catalog, pathway) => pathway.courses.flatMap((course) => (
    catalog.skills.filter((skill) => skill.course === course && skill.problemTopics.length)
  ));

  const pick = (items, count, random) => {
    const copy = items.slice();
    for (let i = 0; i < count && i < copy.length; i += 1) {
      const j = i + Math.floor(random() * (copy.length - i));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  };

  function buildDiagnostic(catalog, pathway, banks, random = Math.random) {
    let skills = testableSkills(catalog, pathway);
    if (skills.length > MAX_QUESTIONS) {
      skills = Array.from({ length: MAX_QUESTIONS }, (_, i) => skills[Math.floor(i * skills.length / MAX_QUESTIONS)]);
    }
    const perSkill = skills.length <= TWO_PER_SKILL_UP_TO ? 2 : 1;
    return skills.flatMap((skill) => {
      const pool = banks.getCourse(skill.problemSet).questions.filter((question) => skill.problemTopics.includes(question.topic));
      return pick(pool, perSkill, random).map((question) => ({ skillId: skill.id, question }));
    });
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { buildDiagnostic, testableSkills };
    return;
  }
}());
