'use strict';

const normalize = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ')
  .toLowerCase()
  .replace(/[^a-z0-9+#]+/g, ' ')
  .trim();

const slugFromHref = (href, folder) => {
  const match = href.match(new RegExp(`/${folder}/([^/?#]+)\\.html`));
  return match ? decodeURIComponent(match[1]) : '';
};

function buildSearchIndex(catalog, seeds) {
  const skills = catalog.skills || [];
  const concepts = catalog.concepts || [];
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const skillsByCourse = new Map();
  const courseByProblemSet = new Map();
  skills.forEach((skill) => {
    skillsByCourse.set(skill.course, [...(skillsByCourse.get(skill.course) || []), skill]);
    if (skill.problemSet) courseByProblemSet.set(skill.problemSet, skill.course);
  });

  const courseTerms = (course) => [
    ...(skillsByCourse.get(course) || []).flatMap((skill) => [
      skill.name,
      ...skill.problemTopics,
      ...skill.lessons.map((lesson) => lesson.title),
    ]),
    ...concepts.filter((concept) => concept.course === course).map((concept) => concept.name),
  ];
  const coursesForProject = new Map();
  Object.entries(catalog.capstones || {}).forEach(([course, projectIds]) => {
    projectIds.forEach((id) => coursesForProject.set(id, [...(coursesForProject.get(id) || []), course]));
  });
  const applications = new Map((catalog.applications || []).map((application) => [application.slug, application]));
  const pathways = new Map((catalog.pathways || []).map((pathway) => [pathway.slug, pathway]));

  const entries = seeds.map((seed) => {
    let keywords = [...(seed.keywords || [])];
    if (seed.type === 'COURSE') keywords.push(...courseTerms(seed.title));
    if (seed.type === 'PRACTICE' && !/\(Timed\)$/.test(seed.title)) {
      const slug = new URL(seed.href, 'https://stemplus.local').searchParams.get('course');
      const course = courseByProblemSet.get(slug);
      if (course) keywords.push(course, ...courseTerms(course));
    }
    if (seed.type === 'APPLICATION') {
      const application = applications.get(slugFromHref(seed.href, 'Applications'));
      (application?.skills || []).forEach((id) => {
        const skill = skillsById.get(id);
        if (skill) keywords.push(skill.course, skill.name, ...skill.lessons.map((lesson) => lesson.title));
      });
    }
    if (seed.type === 'PROJECT') {
      const courses = coursesForProject.get(slugFromHref(seed.href, 'Projects')) || [];
      courses.forEach((course) => keywords.push(course, ...courseTerms(course)));
    }
    if (seed.type === 'PATHWAY') {
      const pathway = pathways.get(slugFromHref(seed.href, 'Pathways'));
      (pathway?.courses || []).forEach((course) => keywords.push(course, ...courseTerms(course)));
    }
    return { ...seed, searchText: normalize([seed.title, seed.context, ...keywords].join(' ')) };
  });

  skills.forEach((skill) => {
    const shared = [skill.course, skill.unit, skill.name, ...skill.problemTopics];
    entries.push({
      type: 'SKILL',
      title: skill.name,
      context: `${skill.course} · ${skill.unit}`,
      href: skill.lessons[0].page,
      searchText: normalize([...shared, ...skill.lessons.map((lesson) => lesson.title)].join(' ')),
    });
    skill.lessons.forEach((lesson) => entries.push({
      type: 'LESSON',
      title: lesson.title,
      context: `${skill.course} · ${skill.unit}`,
      href: lesson.page,
      searchText: normalize([lesson.title, ...shared].join(' ')),
    }));
    skill.problemTopics.forEach((topic) => entries.push({
      type: 'PRACTICE',
      title: `${topic} Questions`,
      context: skill.course,
      href: `/problem-set.html?course=${encodeURIComponent(skill.problemSet)}&topic=${encodeURIComponent(topic)}`,
      searchText: normalize([topic, 'questions practice', ...shared].join(' ')),
    }));
  });

  concepts.forEach((concept) => {
    const unit = skillsById.get(concept.unitSkill);
    const context = unit ? `${concept.course} · ${unit.unit}` : concept.course;
    const searchText = normalize([concept.name, concept.course, unit?.name || '', 'concept skill'].join(' '));
    entries.push({
      type: 'SKILL', title: concept.name, context, href: concept.lessons[0], searchText,
    });
    if (concept.problemSet && concept.questionCount) entries.push({
      type: 'PRACTICE', title: `${concept.name} Questions`, context: concept.course,
      href: `/problem-set.html?course=${encodeURIComponent(concept.problemSet)}&skill=${encodeURIComponent(concept.id)}`,
      searchText: normalize([concept.name, concept.course, 'questions practice'].join(' ')),
    });
  });

  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.type}|${entry.href}|${entry.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const TYPE_PRIORITY = {
  LESSON: 9,
  PRACTICE: 8,
  COURSE: 7,
  SKILL: 6,
  APPLICATION: 5,
  PROJECT: 4,
  PATHWAY: 3,
  SANDBOX: 2,
  CALCULATOR: 2,
  GOAL: 1,
  PAGE: 0,
};

const TOKEN_ALIASES = {
  satellite: ['orbit', 'orbital', 'gravitation'],
  engineer: ['engineering', 'developer'],
  engineering: ['engineer', 'developer'],
  coding: ['programming'],
  code: ['programming'],
};
const vocabularyCache = new WeakMap();

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = left[row - 1] === right[column - 1]
        ? diagonal
        : 1 + Math.min(diagonal, previous[column], previous[column - 1]);
      diagonal = above;
    }
  }
  return previous[right.length];
}

function vocabularyFor(entries) {
  if (vocabularyCache.has(entries)) return vocabularyCache.get(entries);
  const vocabulary = new Map();
  entries.forEach((entry) => entry.searchText.split(' ').forEach((word) => {
    if (word.length >= 4) vocabulary.set(word, (vocabulary.get(word) || 0) + 1);
  }));
  vocabularyCache.set(entries, vocabulary);
  return vocabulary;
}

function resolveQuery(entries, query) {
  const originalTokens = normalize(query).split(' ').filter(Boolean);
  const vocabulary = vocabularyFor(entries);
  let corrected = false;
  const tokens = originalTokens.map((token) => {
    if (token.length < 4 || vocabulary.has(token)) return token;
    const maxDistance = token.length >= 8 ? 2 : 1;
    let best = token;
    let bestDistance = maxDistance + 1;
    let bestFrequency = 0;
    vocabulary.forEach((frequency, candidate) => {
      if (candidate[0] !== token[0] || Math.abs(candidate.length - token.length) > maxDistance) return;
      const distance = editDistance(token, candidate);
      if (distance < bestDistance || (distance === bestDistance && frequency > bestFrequency)) {
        best = candidate;
        bestDistance = distance;
        bestFrequency = frequency;
      }
    });
    if (best !== token) corrected = true;
    return best;
  });
  return {
    tokens,
    groups: tokens.map((token) => [token, ...(TOKEN_ALIASES[token] || [])]),
    correctedQuery: corrected ? tokens.join(' ') : '',
  };
}

function searchIndex(entries, query, limit = 14) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  const { tokens, groups, correctedQuery } = resolveQuery(entries, query);
  const rankedQuery = tokens.join(' ');
  return entries
    .map((entry) => {
      const matches = groups.map((group) => group.find((term) => entry.searchText.includes(term)));
      if (matches.some((match) => !match)) return null;
      const title = normalize(entry.title);
      const titleWithoutArticle = title.replace(/^(?:the|a|an) /, '');
      let score = TYPE_PRIORITY[entry.type] || 0;
      if (title === rankedQuery || titleWithoutArticle === rankedQuery) score += 200;
      else if (title.startsWith(rankedQuery)) score += 120;
      else if (title.includes(rankedQuery)) score += 80;
      matches.forEach((term) => {
        if (title.split(' ').some((word) => word.startsWith(term))) score += 18;
        else if (title.includes(term)) score += 8;
        else score += 2;
      });
      const directTitleMatch = matches.every((term) => title.includes(term));
      const related = !directTitleMatch && entry.type === 'APPLICATION';
      const context = normalize(entry.context);
      const matchTerms = [...new Set(matches.filter((term) => title.includes(term) || context.includes(term)))];
      return { ...entry, label: related ? 'RELATED' : entry.type, matchTerms, correctedQuery, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}

const api = { buildSearchIndex, searchIndex, normalize, resolveQuery, editDistance };
if (typeof module === 'object' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.STEMPlusSearch = api;
