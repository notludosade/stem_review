// Builds the AI-plan catalog by parsing the site's own hub pages — the same
// toc-item/toc-title/toc-sub cards students already see — instead of
// maintaining a separate hand-typed course/project/application list that
// could drift out of sync. Built once at module load (Node caches
// `require`), not per-request.
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(process.cwd(), 'content');

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Matches a real, clickable <a class="toc-item" href="..."> card and pulls
// its href, title, and sub text. "Coming Soon" placeholders use
// <div class="toc-item is-soon"> (no href, not an <a>), so this pattern
// never matches them — no separate is-soon check needed.
const ITEM_RE = /<a class="toc-item"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<p class="toc-title">([^<]*)<\/p>\s*<p class="toc-sub">([\s\S]*?)<\/p>[\s\S]*?<\/a>/g;

function parseTocItems(fileName) {
  const html = fs.readFileSync(path.join(CONTENT_DIR, fileName), 'utf8');
  const items = [];
  let match;
  ITEM_RE.lastIndex = 0;
  while ((match = ITEM_RE.exec(html)) !== null) {
    items.push({
      href: match[1],
      title: decodeEntities(match[2]).trim(),
      sub: decodeEntities(match[3].replace(/<[^>]+>/g, '')).trim(),
    });
  }
  return items;
}

function buildCourses() {
  const hubs = ['math.html', 'technology.html', 'science.html', 'engineering.html', 'advanced.html'];
  const courses = [];
  const seen = new Set();
  hubs.forEach((hub) => {
    parseTocItems(hub).forEach((item) => {
      if (seen.has(item.title)) return; // a course can be cross-listed on more than one hub
      seen.add(item.title);
      courses.push({ name: item.title, blurb: item.sub });
    });
  });
  return courses;
}

function buildProjects() {
  return parseTocItems('projects.html')
    .map((item) => {
      const idMatch = item.href.match(/Projects\/([^/]+)\.html$/);
      return idMatch ? { id: idMatch[1], title: item.title, blurb: item.sub } : null;
    })
    .filter((p) => p && p.id !== 'mathematics-capstone');
}

function buildApplications() {
  return parseTocItems('applications.html')
    .map((item) => {
      const idMatch = item.href.match(/Applications\/([^/]+)\.html$/);
      return idMatch ? { id: idMatch[1], title: item.title } : null;
    })
    .filter(Boolean);
}

function buildProblemSets() {
  return parseTocItems('problem-sets.html')
    .map((item) => {
      const slugMatch = item.href.match(/[?&]course=([^&]+)/);
      return slugMatch ? { course: item.title, slug: slugMatch[1], blurb: item.sub } : null;
    })
    .filter(Boolean);
}

const CATALOG = {
  courses: buildCourses(),
  projects: buildProjects(),
  applications: buildApplications(),
  problemSets: buildProblemSets(),
};

// Drops anything the model referenced that isn't real, and enriches every
// surviving reference with its real display data (title, problem-set slug,
// project title) so the client never needs a second lookup table. A
// hallucinated course/project/problem-set/application is silently dropped,
// never surfaced and never a request-level failure.
function validatePlan(rawPlan, catalog) {
  const courseNames = new Set(catalog.courses.map((c) => c.name));
  const projectById = new Map(catalog.projects.map((p) => [p.id, p]));
  const applicationById = new Map(catalog.applications.map((a) => [a.id, a]));
  const problemSetByCourse = new Map(catalog.problemSets.map((p) => [p.course, p]));

  const courses = (rawPlan.courses || [])
    .filter((c) => c && courseNames.has(c.name))
    .map((c) => ({ name: c.name, reason: String(c.reason || '') }));

  let project = null;
  if (rawPlan.project && rawPlan.project.id && projectById.has(rawPlan.project.id)) {
    const catalogProject = projectById.get(rawPlan.project.id);
    project = { id: catalogProject.id, title: catalogProject.title, reason: String(rawPlan.project.reason || '') };
  }

  const problemSets = (rawPlan.problemSets || [])
    .filter((p) => p && problemSetByCourse.has(p.course))
    .map((p) => {
      const catalogEntry = problemSetByCourse.get(p.course);
      return { course: catalogEntry.course, slug: catalogEntry.slug, reason: String(p.reason || '') };
    });

  const applications = (rawPlan.applications || [])
    .filter((a) => a && applicationById.has(a.id))
    .map((a) => {
      const catalogEntry = applicationById.get(a.id);
      return { id: catalogEntry.id, title: catalogEntry.title, reason: String(a.reason || '') };
    });

  return { summary: String(rawPlan.summary || ''), courses, project, problemSets, applications };
}

module.exports = { CATALOG, validatePlan };
