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
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const skillsByCourse = new Map();
  const courseByProblemSet = new Map();
  skills.forEach((skill) => {
    skillsByCourse.set(skill.course, [...(skillsByCourse.get(skill.course) || []), skill]);
    if (skill.problemSet) courseByProblemSet.set(skill.problemSet, skill.course);
  });

  const courseTerms = (course) => (skillsByCourse.get(course) || []).flatMap((skill) => [
    skill.name,
    ...skill.problemTopics,
    ...skill.lessons.map((lesson) => lesson.title),
  ]);
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
  GOAL: 1,
  PAGE: 0,
};

function searchIndex(entries, query, limit = 14) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  const tokens = normalizedQuery.split(' ');
  return entries
    .map((entry) => {
      if (!tokens.every((token) => entry.searchText.includes(token))) return null;
      const title = normalize(entry.title);
      let score = TYPE_PRIORITY[entry.type] || 0;
      if (title === normalizedQuery) score += 200;
      else if (title.startsWith(normalizedQuery)) score += 120;
      else if (title.includes(normalizedQuery)) score += 80;
      tokens.forEach((token) => {
        if (title.split(' ').some((word) => word.startsWith(token))) score += 18;
        else if (title.includes(token)) score += 8;
        else score += 2;
      });
      const related = !tokens.every((token) => title.includes(token))
        && ['APPLICATION', 'PROJECT', 'PATHWAY'].includes(entry.type);
      return { ...entry, label: related ? 'RELATED' : entry.type, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}

module.exports = { buildSearchIndex, searchIndex, normalize };
