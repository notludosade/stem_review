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

// Only regular problem-set cards: problem-sets.html also links Timed Mastery
// runs (timed-mastery.html?course=…), which aren't separate problem sets and
// would otherwise appear in the AI-plan catalog as duplicates.
function buildProblemSets() {
  return parseTocItems('problem-sets.html')
    .filter((item) => item.href.startsWith('problem-set.html?'))
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

// Course-level prerequisites for the AI plan generator — every *live*
// catalog course with a genuine prerequisite, across all four subject hubs
// plus Advanced+. Excludes "Coming Soon" courses (e.g. AP Chemistry,
// Mechatronics) on purpose: they're not real <a href> cards, so
// buildCourses() never adds them to CATALOG.courses, and the
// check-plan-catalog.js cross-check below would fail if they were listed
// here — add their entries once those courses actually ship. Only used by
// pages/api/generate-plan.js's system prompt and by
// reorderByPrerequisites() below; deliberately kept separate from
// public/assets/tests.js's own PREREQUISITES table (Phase 4's course-context
// "Readiness" UI, scoped to only the 5 Advanced+ courses) — different
// runtime (server vs. browser), different purpose, not worth unifying
// across that boundary for 5 overlapping rows.
const PREREQUISITE_GRAPH = {
  // Math
  'AP Calculus BC': ['Precalculus'],
  'Multivariable Calculus': ['AP Calculus BC'],
  'Linear Algebra A': ['AP Calculus BC'],
  'Differential Equations': ['Multivariable Calculus'],
  'Discrete Math': ['Precalculus'],
  'Mathematical Proofs': ['Precalculus'],
  // Technology / CS
  'Computer Programming 2': ['Computer Programming 1'],
  'Computer Programming 2+': ['Computer Programming 2'],
  'Computer Programming Ethics': ['Computer Programming 1'],
  'Programming with Packages': ['Computer Programming 1'],
  'Data Handling CB': ['Computer Programming 2'],
  'Software Engineering': ['Computer Programming 2'],
  'Systems Programming & Architecture: CS': ['Computer Programming 2'],
  'Computer Networking Fundamentals': ['Computer Programming 1'],
  'Cloud Computing A': ['Computer Programming 1'],
  'Cloud Computing B / DevOps': ['Cloud Computing A'],
  'AI Developer': ['Computer Programming 2', 'Data Handling CB'],
  'Applied Machine/Deep Learning': ['AI Developer'],
  'Game Engine Architecture': ['Computer Programming 2'],
  'Video Game Modding': ['Computer Programming 1'],
  // Science
  'AP Physics 1': ['Precalculus'],
  'AP Physics 2': ['AP Physics 1'],
  'AP Physics C: Mechanics': ['AP Physics 1', 'AP Calculus BC'],
  'AP Physics C: Electricity and Magnetism': ['AP Physics C: Mechanics'],
  'Quantum Physics & Optics': ['AP Physics C: Electricity and Magnetism'],
  // Engineering
  'Engineering 1': ['AP Physics 1'],
  'Career Applied Engineering': ['Engineering 1'],
  'CAD & Prototyping': ['Engineering 1'],
  'Thermodynamics': ['AP Physics 2'],
  'Mechatronics': ['Engineering 1', 'Computer Programming 1'],
  'Advanced Robotics': ['Engineering 1', 'Computer Programming 1'],
  // Advanced+
  'Real Analysis A': ['AP Calculus BC'],
  'Real Analysis B': ['Real Analysis A'],
  'Advanced Algorithms': ['Computer Programming 1', 'Computer Programming 2'],
  'Linear Algebra B': ['Linear Algebra A'],
  'Topology: Fundamentals': ['Real Analysis A'],
  'Quantum Computing': ['Linear Algebra A', 'Linear Algebra B'],
};

// Deterministic reorder (never adds or removes a course) so a prerequisite
// always sorts before its dependent, using only the PREREQUISITE_GRAPH
// edges where BOTH courses are present in this specific plan — a stable
// topological sort (Kahn's algorithm, ties broken by original position) so
// unrelated courses keep the order the model chose. If the graph data ever
// contains a cycle, no course in that cycle can reach in-degree 0 and the
// sort would silently drop it — fails safe by returning the original,
// unsorted list instead of ever dropping a course from a student's plan.
function reorderByPrerequisites(courses, graph) {
  const names = courses.map((c) => c.name);
  const nameSet = new Set(names);
  const indexOf = new Map(names.map((name, i) => [name, i]));

  const inDegree = new Map(names.map((name) => [name, 0]));
  const dependents = new Map(names.map((name) => [name, []]));
  names.forEach((name) => {
    (graph[name] || []).filter((prereq) => nameSet.has(prereq)).forEach((prereq) => {
      dependents.get(prereq).push(name);
      inDegree.set(name, inDegree.get(name) + 1);
    });
  });

  const available = names.filter((name) => inDegree.get(name) === 0);
  available.sort((a, b) => indexOf.get(a) - indexOf.get(b));

  const sortedNames = [];
  while (available.length > 0) {
    const name = available.shift();
    sortedNames.push(name);
    dependents.get(name).forEach((dependent) => {
      inDegree.set(dependent, inDegree.get(dependent) - 1);
      if (inDegree.get(dependent) === 0) {
        const pos = indexOf.get(dependent);
        let i = 0;
        while (i < available.length && indexOf.get(available[i]) < pos) i++;
        available.splice(i, 0, dependent);
      }
    });
  }

  if (sortedNames.length !== names.length) return courses;
  const courseByName = new Map(courses.map((c) => [c.name, c]));
  return sortedNames.map((name) => courseByName.get(name));
}

// Drops anything the model referenced that isn't real, and enriches every
// surviving reference with its real display data (title, problem-set slug,
// project title) so the client never needs a second lookup table. A
// hallucinated course/project/problem-set/application is silently dropped,
// never surfaced and never a request-level failure. The surviving course
// array is also reordered so a prerequisite always precedes its dependent.
function validatePlan(rawPlan, catalog) {
  const courseNames = new Set(catalog.courses.map((c) => c.name));
  const projectById = new Map(catalog.projects.map((p) => [p.id, p]));
  const applicationById = new Map(catalog.applications.map((a) => [a.id, a]));
  const problemSetByCourse = new Map(catalog.problemSets.map((p) => [p.course, p]));

  const courses = reorderByPrerequisites(
    (rawPlan.courses || [])
      .filter((c) => c && courseNames.has(c.name))
      .map((c) => ({ name: c.name, reason: String(c.reason || '') }))
      .filter((c, i, arr) => arr.findIndex((o) => o.name === c.name) === i),
    PREREQUISITE_GRAPH
  );

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

module.exports = { CATALOG, PREREQUISITE_GRAPH, validatePlan };
