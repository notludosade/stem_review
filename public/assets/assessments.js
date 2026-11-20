// STEM+ Assessments: course, track, and goal assessments.
// The engine (draw, grade, score) is pure and exported for
// scripts/check-assessments.js; the UI further down only runs in a browser.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const api = factory(isNode ? require('./problem-sets.js') : root.STEMProblemAnswers);
  if (isNode) module.exports = api;
  else root.STEMAssessments = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (numbers) {
  'use strict';

  const TYPES = {
    single: { badge: 'Multiple choice', icon: '◉', how: 'Pick the one best answer.' },
    multi: { badge: 'Select all that apply', icon: '▣', how: 'Tick every correct option. You need all of them, and no wrong ones, to score.' },
    truefalse: { badge: 'True / False', icon: '⇄', how: 'Decide whether the statement is true or false.' },
    number: { badge: 'Type a number', icon: '#', how: 'Type a number. Fractions like 3/4, decimals, and percents are accepted. Leave off units.' },
    text: { badge: 'Type a short answer', icon: '✎', how: 'Type a word or short phrase. Capital letters and extra spaces don’t matter.' },
    order: { badge: 'Put in order', icon: '⇅', how: 'Use the ↑ and ↓ buttons to put the items in order, first at the top. The whole order must be right to score.' },
    match: { badge: 'Match pairs', icon: '⇔', how: 'Choose the partner for each item on the left. Each correct pair earns part of the point.' },
    written: { badge: 'Written answer', icon: '¶', how: 'Write a few sentences. After you submit, compare with a model answer and score yourself with a checklist.' },
    code: { badge: 'Code it up', icon: '</>', how: 'Write the function, then press Run tests. Each passing test earns part of the point.' },
  };

  const GOALS = [
    { slug: 'get-ahead', title: 'Get Ahead in School', courses: ['Algebra/Geometry Fundamentals Review', 'Precalculus', 'AP Calculus BC', 'Multivariable Calculus'] },
    { slug: 'prepare-for-college', title: 'Prepare for College', courses: ['Precalculus', 'AP Calculus BC', 'AP Physics 1', 'Computer Programming 1'] },
    { slug: 'stronger-at-math', title: 'Become Stronger at Math', courses: ['Algebra/Geometry Fundamentals Review', 'Discrete Math', 'Mathematical Proofs', 'Linear Algebra A'] },
    { slug: 'challenge-myself', title: 'Challenge Myself', courses: ['Real Analysis A', 'Real Analysis B', 'Topology: Fundamentals', 'Linear Algebra B', 'Advanced Algorithms'] },
    { slug: 'review-and-test', title: 'Review & Test Myself', courses: null, summary: 'Covers every course you’ve started in this browser.' },
  ];

  const SUBJECTS = ['Math', 'Science', 'Technology', 'Engineering', 'Advanced+'];
  const SUBJECT_OF = {
    'Algebra/Geometry Fundamentals Review': 'Math', 'Precalculus': 'Math', 'AP Calculus BC': 'Math',
    'Multivariable Calculus': 'Math', 'Differential Equations': 'Math', 'Discrete Math': 'Math',
    'Linear Algebra A': 'Math', 'Mathematical Proofs': 'Math',
    'AP Physics 1': 'Science', 'AP Physics 2': 'Science', 'AP Physics C: Mechanics': 'Science',
    'AP Physics C: Electricity and Magnetism': 'Science', 'Quantum Physics & Optics': 'Science',
    'Computer Programming 1': 'Technology', 'Computer Programming 2': 'Technology',
    'Computer Programming 2+': 'Technology', 'Computer Programming Ethics': 'Technology',
    'Software Engineering': 'Technology', 'Data Handling CB': 'Technology', 'AI Developer': 'Technology',
    'Applied Machine/Deep Learning': 'Technology', 'Programming with Packages': 'Technology',
    'Computer Networking Fundamentals': 'Technology', 'Systems Programming & Architecture: CS': 'Technology',
    'Cloud Computing A': 'Technology', 'Cloud Computing B / DevOps': 'Technology',
    'Cybersecurity+': 'Technology', 'Bash for Cybersecurity': 'Technology',
    'Game Engine Architecture': 'Technology', 'Video Game Modding': 'Technology',
    'Engineering 1': 'Engineering', 'Career Applied Engineering': 'Engineering', 'CAD & Prototyping': 'Engineering',
    'Mechatronics': 'Engineering', 'Advanced Robotics': 'Engineering', 'Thermodynamics': 'Engineering',
    'Advanced Algorithms': 'Advanced+', 'Real Analysis A': 'Advanced+', 'Real Analysis B': 'Advanced+',
    'Topology: Fundamentals': 'Advanced+', 'Linear Algebra B': 'Advanced+', 'Quantum Computing': 'Advanced+',
  };

  const shuffle = (list, rng = Math.random) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  // A "Put in order" question must never start already solved.
  const scramble = (list, rng = Math.random) => {
    const out = shuffle(list, rng);
    return list.length > 1 && out.every((item, i) => item === list[i]) ? list.slice(1).concat(list[0]) : out;
  };

  const unitsOf = (pool) => [...new Set(pool.questions.map((question) => question.unit))].sort((a, b) => a - b);
  const pick = (pool, perUnit, rng) => unitsOf(pool).flatMap((unit) => (
    shuffle(pool.questions.filter((question) => question.unit === unit), rng).slice(0, perUnit)
  ));
  const drawCourse = (pool, rng = Math.random) => pick(pool, 2, rng);
  const drawSections = (pools, rng = Math.random) => pools.map((pool) => ({ course: pool.course, slug: pool.slug, questions: pick(pool, 1, rng) }));

  // One trailing "." or "!" doesn't change a short answer ("entry point." = "entry point").
  const normalizeText = (value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*[.!]$/, '');

  const isAnswered = (question, response) => {
    if (response === undefined || response === null) return false;
    switch (question.type) {
      case 'number': return Number.isFinite(numbers.parseNumber(String(response)));
      case 'text': return String(response).trim() !== '';
      case 'multi': return response.length > 0;
      case 'match': return Object.keys(response).length > 0;
      case 'written': return String(response.text || '').trim() !== '';
      case 'code': return String(response.code || '').trim() !== String(question.starter || '').trim();
      default: return true;
    }
  };

  const grade = (question, response) => {
    if (!isAnswered(question, response)) return 0;
    switch (question.type) {
      case 'single': case 'truefalse': return response === question.answer ? 1 : 0;
      case 'multi': {
        const wanted = new Set(question.answers);
        return response.length === wanted.size && response.every((choice) => wanted.has(choice)) ? 1 : 0;
      }
      case 'number': {
        // An explicit tolerance is the whole window; otherwise use the shared problem-set rule.
        const close = (value) => Number.isFinite(value) && (question.tolerance !== undefined
          ? Math.abs(value - question.answer) <= question.tolerance
          : numbers.answersClose(value, question.answer, 0.001));
        const raw = String(response).trim();
        // "87%" reads as 0.87 first; if that misses, the bare 87 is tried too.
        return close(numbers.parseNumber(raw)) || (raw.endsWith('%') && close(numbers.parseNumber(raw.slice(0, -1)))) ? 1 : 0;
      }
      case 'text': return question.answers.some((answer) => normalizeText(answer) === normalizeText(response)) ? 1 : 0;
      case 'order': return response.length === question.items.length && response.every((item, i) => item === question.items[i]) ? 1 : 0;
      case 'match': return question.pairs.filter(([left, right]) => response[left] === right).length / question.pairs.length;
      case 'written': return Array.isArray(response.rubric) ? response.rubric.filter(Boolean).length / question.rubric.length : 0;
      case 'code': return response.total ? Math.min(1, response.passed / response.total) : 0;
      default: return 0;
    }
  };

  const scoreAttempt = (entries) => {
    const units = {};
    const courses = {};
    let points = 0;
    entries.forEach(({ question, slug, response }) => {
      const value = grade(question, response);
      const unitId = `${slug}.u${question.unit}`;
      points += value;
      units[unitId] = units[unitId] || { points: 0, total: 0 };
      units[unitId].points += value;
      units[unitId].total += 1;
      courses[slug] = courses[slug] || { points: 0, total: 0 };
      courses[slug].points += value;
      courses[slug].total += 1;
    });
    return { points, total: entries.length, units, courses };
  };

  const label = (fraction) => (fraction >= 0.85 ? 'Strong' : fraction >= 0.6 ? 'Developing' : 'Review');

  const api = { TYPES, GOALS, SUBJECTS, SUBJECT_OF, shuffle, scramble, drawCourse, drawSections, normalizeText, isAnswered, grade, scoreAttempt, label };
  if (typeof document === 'undefined') return api;

  const KEY = 'stemplus:assessments:v1';
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (value) => esc(value).replace(/`([^`]+)`/g, '<code>$1</code>');
  const pct = (fraction) => `${Math.round(fraction * 100)}%`;
  // Test values written the way the question's language writes them (Python: True/False/None).
  const literal = (x, value) => {
    if (x.language !== 'python') return JSON.stringify(value);
    if (value === null) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (Array.isArray(value)) return `[${value.map((v) => literal(x, v)).join(', ')}]`;
    return JSON.stringify(value);
  };
  const canSave = () => !window.STEMPlusAccount || window.STEMPlusAccount.canSave();
  const loadStore = () => {
    try {
      const data = JSON.parse(window.localStorage.getItem(KEY) || '{}');
      return { results: data.results || {}, inProgress: data.inProgress || {} };
    } catch (err) { return { results: {}, inProgress: {} }; }
  };
  const saveStore = (store) => {
    if (!canSave()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch (err) { console.error('Could not save assessment progress', err); }
  };
  const startedCourses = () => {
    try { return [...new Set(JSON.parse(window.localStorage.getItem('stemplus:results:v1') || '[]').map((r) => r.course))]; } catch (err) { return []; }
  };

  const courseList = (catalog) => [...new Set(catalog.skills.map((s) => s.course))].map((name) => {
    const skills = catalog.skills.filter((s) => s.course === name);
    return { name, slug: skills[0].id.split('.')[0], units: skills.length };
  });
  const unitCount = (catalog, names) => names.reduce((n, name) => n + catalog.skills.filter((s) => s.course === name).length, 0);
  const skillFor = (catalog, slug, unit) => catalog.skills.find((s) => s.id === `${slug}.u${unit}`);
  const pools = {};
  const loadPool = (slug) => {
    pools[slug] = pools[slug] || fetch(`/assets/assessments/${encodeURIComponent(slug)}.json`).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
    return pools[slug];
  };

  // ---------- Hub ----------
  function renderHub(mount, catalog) {
    const store = loadStore();
    const best = (id) => (store.results[id] ? ` · Best ${pct(store.results[id].best)}` : '');
    const card = (href, num, title, sub, id) => `<a class="toc-item" href="${href}"><span class="toc-num">${esc(num)}</span><p class="toc-title">${esc(title)}</p><p class="toc-sub">${esc(sub)}${best(id)}</p></a>`;
    const courses = courseList(catalog);
    let html = '<h2 id="courses">Courses</h2><p class="subtitle">Two questions from every unit, in mixed formats. Each retake draws a new mix.</p>';
    SUBJECTS.forEach((subject) => {
      const list = courses.filter((c) => SUBJECT_OF[c.name] === subject);
      if (!list.length) return;
      html += `<h3>${esc(subject)}</h3><div class="toc-list">${list.map((c) => card(`assessments.html?course=${encodeURIComponent(c.slug)}`, subject, c.name, `${c.units * 2} questions · ${c.units} units`, `course:${c.slug}`)).join('')}</div>`;
    });
    html += '<h2 id="tracks">Tracks</h2><p class="subtitle">One question from every unit of every course in the track, grouped into a section per course. Your answers save as you go.</p><div class="toc-list">';
    html += catalog.pathways.map((t) => card(`assessments.html?track=${encodeURIComponent(t.slug)}`, 'Track', t.name, `${unitCount(catalog, t.courses)} questions · ${t.courses.length} course sections`, `track:${t.slug}`)).join('');
    html += '</div><h2 id="goals">Goals</h2><p class="subtitle">Assessments built around the goals on the Choose a Goal page.</p><div class="toc-list">';
    html += GOALS.map((g) => card(`assessments.html?goal=${encodeURIComponent(g.slug)}`, 'Goal', g.title, g.courses ? `${unitCount(catalog, g.courses)} questions · ${g.courses.length} course sections` : g.summary, `goal:${g.slug}`)).join('');
    html += '</div>';
    mount.innerHTML = html;
    if (window.location.hash) {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  // ---------- Target resolution ----------
  function resolveTarget(catalog, params) {
    const course = params.get('course');
    const track = params.get('track');
    const goal = params.get('goal');
    if (course) {
      const found = courseList(catalog).find((c) => c.slug === course);
      return found && { id: `course:${found.slug}`, kind: 'course', title: `${found.name} Assessment`, courses: [found.name] };
    }
    if (track) {
      const found = catalog.pathways.find((t) => t.slug === track);
      return found && { id: `track:${found.slug}`, kind: 'track', title: `${found.name} Track Assessment`, courses: found.courses };
    }
    if (goal) {
      const found = GOALS.find((g) => g.slug === goal);
      if (!found) return null;
      const names = courseList(catalog).map((c) => c.name);
      const courses = found.courses || startedCourses().filter((name) => names.includes(name));
      return { id: `goal:${found.slug}`, kind: 'goal', title: `${found.title} — Goal Assessment`, courses, pickable: !found.courses };
    }
    return null;
  }

  function renderPicker(mount, catalog, target, start) {
    const courses = courseList(catalog);
    mount.innerHTML = `<div class="box"><span class="box-label">Choose courses to review</span><p>You haven’t started a course in this browser yet. Pick the courses you want this assessment to cover.</p>${SUBJECTS.map((subject) => {
      const list = courses.filter((c) => SUBJECT_OF[c.name] === subject);
      return list.length ? `<fieldset class="assess-fieldset"><legend>${esc(subject)}</legend>${list.map((c) => `<label class="assess-option"><input type="checkbox" value="${esc(c.name)}"> ${esc(c.name)}</label>`).join('')}</fieldset>` : '';
    }).join('')}<p><button type="button" class="widget-btn" data-pick-start>Start assessment</button> <span class="assess-hint" data-pick-hint></span></p></div>`;
    mount.querySelector('[data-pick-start]').addEventListener('click', () => {
      const chosen = [...mount.querySelectorAll('input[type=checkbox]:checked')].map((box) => box.value);
      if (!chosen.length) { mount.querySelector('[data-pick-hint]').textContent = 'Pick at least one course.'; return; }
      start(Object.assign({}, target, { courses: chosen }));
    });
  }

  // ---------- Code runners ----------
  let pyReady = null;
  let pyWorker = null;
  let pyId = 0;
  const pyPending = new Map();
  let pyQueue = Promise.resolve();
  const startPython = () => {
    if (pyReady) return pyReady;
    pyReady = new Promise((resolve, reject) => {
      pyWorker = new Worker('/assets/python-worker.js', { type: 'module' });
      const worker = pyWorker;
      const fail = (message) => { window.clearTimeout(loadTimer); worker.terminate(); reject(new Error(message)); };
      // Same limit as python-sandbox.js, so a stalled Pyodide download can't hang submit.
      const loadTimer = window.setTimeout(() => fail('Python took too long to load. Check your connection and try again.'), 30000);
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready') { window.clearTimeout(loadTimer); resolve(worker); }
        else if (data.type === 'fatal') fail(`Python could not load: ${data.error}`);
        else if (data.type === 'result' && pyPending.has(data.id)) {
          const entry = pyPending.get(data.id);
          pyPending.delete(data.id);
          window.clearTimeout(entry.timer);
          entry.resolve(data.payload);
        }
      };
      worker.onerror = () => fail('Python could not start. Check your connection and try again.');
    });
    pyReady.catch(() => { pyReady = null; });
    return pyReady;
  };
  const sendPython = async (payload) => {
    const worker = await startPython();
    return new Promise((resolve, reject) => {
      const id = ++pyId;
      const timer = window.setTimeout(() => {
        pyPending.delete(id);
        worker.terminate();
        pyReady = null;
        reject(new Error('Program stopped after 5 seconds. Check for an infinite loop.'));
      }, 5000);
      pyPending.set(id, { resolve, timer });
      worker.postMessage(Object.assign({ id }, payload));
    });
  };
  // One run at a time: a timeout kills the shared worker, so it must never take another run down with it.
  const runPython = (payload) => {
    pyQueue = pyQueue.catch(() => {}).then(() => sendPython(payload));
    return pyQueue;
  };
  const runCode = (question, code) => {
    const payload = { mode: 'problem', code, functionName: question.functionName, tests: question.tests };
    if (question.language === 'python') return runPython(payload);
    if (!window.STEMJavaScriptRunner) return Promise.reject(new Error('The JavaScript runner did not load. Refresh to try again.'));
    return window.STEMJavaScriptRunner(payload);
  };

  // ---------- Runner ----------
  function newAttempt(target, loaded) {
    const sections = target.kind === 'course'
      ? [{ course: loaded[0].course, slug: loaded[0].slug, questions: drawCourse(loaded[0]) }]
      : drawSections(loaded);
    const layout = {};
    sections.forEach((s) => s.questions.forEach((x) => {
      if (x.type === 'single' || x.type === 'multi') layout[x.id] = shuffle(x.choices);
      if (x.type === 'order') layout[x.id] = scramble(x.items);
      if (x.type === 'match') layout[x.id] = shuffle(x.pairs.map((p) => p[1]));
    }));
    return {
      id: target.id, kind: target.kind, title: target.title,
      sections: sections.map((s) => ({ course: s.course, slug: s.slug, ids: s.questions.map((x) => x.id) })),
      layout, responses: {}, index: 0, at: new Date().toISOString(),
    };
  }

  async function mountRunner(mount, catalog, target) {
    document.title = `${target.title} — STEM+`;
    const heading = document.querySelector('.page h1');
    if (heading) heading.textContent = target.title;
    const subtitle = document.querySelector('.page .subtitle');
    if (subtitle) subtitle.textContent = target.kind === 'course'
      ? 'Two questions from every unit. Answer in any order, then submit to see your results.'
      : 'One question from every unit of every course, grouped by course. Your answers save as you go.';
    if (window.STEMPlusAccount) window.STEMPlusAccount.noteIfGuest('Assessment results aren’t saved for guests.');
    mount.innerHTML = '<p class="toc-empty">Loading questions…</p>';
    const slugs = target.courses.map((name) => courseList(catalog).find((c) => c.name === name).slug);
    const loaded = await Promise.all(slugs.map((slug) => loadPool(slug).catch(() => null)));
    const available = loaded.filter(Boolean);
    const skipped = target.courses.filter((_, i) => !loaded[i]);
    if (!available.length) {
      mount.innerHTML = '<p class="toc-empty">These questions couldn’t load. <a href="assessments.html">Back to Assessments</a></p>';
      return;
    }
    const byId = {};
    available.forEach((pool) => pool.questions.forEach((x) => { byId[x.id] = x; }));
    const notice = skipped.length ? `<p class="assess-hint">Skipped (questions couldn’t load): ${esc(skipped.join(', '))}.</p>` : '';
    const saved = loadStore().inProgress[target.id];
    const begin = (attempt) => runAttempt(mount, catalog, target, attempt, byId, notice);
    if (saved && saved.sections.every((s) => s.ids.every((id) => byId[id]))) {
      const answered = Object.keys(saved.responses).length;
      mount.innerHTML = `${notice}<div class="box"><span class="box-label">Saved progress</span><p>You answered ${answered} question${answered === 1 ? '' : 's'} on ${esc(new Date(saved.at).toLocaleDateString())}.</p><p><button type="button" class="widget-btn" data-resume>Resume</button> <button type="button" class="widget-btn" data-restart>Start over</button></p></div>`;
      mount.querySelector('[data-resume]').addEventListener('click', () => begin(saved));
      mount.querySelector('[data-restart]').addEventListener('click', () => begin(newAttempt(target, available)));
    } else {
      begin(newAttempt(target, available));
    }
  }

  function runAttempt(mount, catalog, target, attempt, byId, notice) {
    const order = attempt.sections.flatMap((s, si) => s.ids.map((id) => ({ id, si, slug: s.slug })));
    let saveTimer = null;
    let submitted = false;
    const persist = (now) => {
      window.clearTimeout(saveTimer);
      const write = () => { attempt.at = new Date().toISOString(); const store = loadStore(); store.inProgress[attempt.id] = attempt; saveStore(store); };
      if (now) write(); else saveTimer = window.setTimeout(write, 400);
    };
    const setResponse = (id, value, now) => { attempt.responses[id] = value; persist(now); renderMap(); };

    function answerArea(x) {
      const r = attempt.responses[x.id];
      const lay = attempt.layout[x.id];
      switch (x.type) {
        case 'single':
          return `<fieldset class="assess-fieldset"><legend class="assess-sr">Choices</legend>${lay.map((c, i) => `<label class="assess-option"><input type="radio" name="assess-${esc(x.id)}" data-choice="${i}"${r === c ? ' checked' : ''}> <span>${fmt(c)}</span></label>`).join('')}</fieldset>`;
        case 'multi':
          return `<fieldset class="assess-fieldset"><legend class="assess-sr">Choices</legend>${lay.map((c, i) => `<label class="assess-option"><input type="checkbox" data-choice="${i}"${(r || []).includes(c) ? ' checked' : ''}> <span>${fmt(c)}</span></label>`).join('')}</fieldset>`;
        case 'truefalse':
          return `<div class="assess-tf">${[true, false].map((v) => `<button type="button" class="assess-tf-btn" data-tf="${v}" aria-pressed="${r === v}">${v ? 'True' : 'False'}</button>`).join('')}</div>`;
        case 'number': case 'text':
          return `<label class="assess-field"><span>Your answer</span><input type="text" data-input autocomplete="off" spellcheck="false"${x.type === 'number' ? ' inputmode="decimal"' : ''} value="${esc(r || '')}"></label>`;
        case 'order': {
          const items = r || lay;
          return `<ol class="assess-order">${items.map((item, i) => `<li><span>${fmt(item)}</span><span class="assess-order-btns"><button type="button" data-move="${i}" data-dir="-1" aria-label="Move ${esc(item)} up"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" data-move="${i}" data-dir="1" aria-label="Move ${esc(item)} down"${i === items.length - 1 ? ' disabled' : ''}>↓</button></span></li>`).join('')}</ol>`;
        }
        case 'match':
          return `<div class="assess-match">${x.pairs.map(([left], i) => `<label class="assess-match-row"><span>${fmt(left)}</span><select data-match="${i}"><option value="">Choose…</option>${lay.map((right, j) => `<option value="${j}"${r && r[left] === right ? ' selected' : ''}>${esc(right)}</option>`).join('')}</select></label>`).join('')}</div>`;
        case 'written':
          return `<label class="assess-field"><span>Your answer</span><textarea class="reflection-textarea" data-input rows="6">${esc((r && r.text) || '')}</textarea></label>`;
        case 'code': {
          const code = (r && r.code) || x.starter;
          return `<p class="assess-hint">Language: ${x.language === 'python' ? 'Python' : 'JavaScript'} · write <code>${esc(x.functionName)}</code></p><textarea class="assess-code" data-input spellcheck="false" rows="10" aria-label="Your code">${esc(code)}</textarea><p class="assess-hint">Tests:</p><ul class="assess-tests">${x.tests.map((t) => `<li><code>${esc(x.functionName)}(${esc(t.args.map((a) => literal(x, a)).join(', '))})</code> → <code>${esc(literal(x, t.expected))}</code></li>`).join('')}</ul><p><button type="button" class="widget-btn" data-run>Run tests</button></p><div class="assess-run-out" data-run-out aria-live="polite">${r && r.total && r.ranCode === r.code ? `${r.passed} of ${r.total} tests passed.` : ''}</div>`;
        }
        default: return '';
      }
    }

    function renderMap() {
      const map = mount.querySelector('[data-map]');
      if (!map) return;
      map.innerHTML = order.map((o, i) => `<button type="button" data-goto="${i}" class="assess-map-btn${i === attempt.index ? ' is-current' : ''}${isAnswered(byId[o.id], attempt.responses[o.id]) ? ' is-answered' : ''}" aria-label="Question ${i + 1}${isAnswered(byId[o.id], attempt.responses[o.id]) ? ', answered' : ''}">${i + 1}</button>`).join('');
    }

    function render() {
      const o = order[attempt.index];
      const x = byId[o.id];
      const section = attempt.sections[o.si];
      const skill = skillFor(catalog, o.slug, x.unit);
      const type = TYPES[x.type];
      const sectionLine = attempt.sections.length > 1 || attempt.kind !== 'course' ? `<p class="assess-section">Section ${o.si + 1} of ${attempt.sections.length} · ${esc(section.course)}</p>` : '';
      mount.innerHTML = `${notice}${sectionLine}<div class="assess-progress" aria-hidden="true"><div style="width:${((attempt.index + 1) / order.length) * 100}%"></div></div><p class="assess-count">Question ${attempt.index + 1} of ${order.length}</p>
<article class="assess-card" tabindex="-1" aria-labelledby="assess-prompt">
  <p class="assess-unit">Unit ${x.unit}${skill ? ` · ${esc(skill.name)}` : ''}</p>
  <p class="assess-badge"><span aria-hidden="true">${esc(type.icon)}</span> ${esc(type.badge)}</p>
  <p class="assess-how"><strong>How to answer:</strong> ${esc(type.how)}</p>
  <p class="assess-prompt" id="assess-prompt">${fmt(x.prompt)}</p>
  ${x.code ? `<pre class="code-block"><code>${esc(x.code)}</code></pre>` : ''}
  <div class="assess-answer">${answerArea(x)}</div>
  <div class="assess-nav"><button type="button" class="widget-btn" data-prev${attempt.index === 0 ? ' disabled' : ''}>← Previous</button><button type="button" class="widget-btn" data-next${attempt.index === order.length - 1 ? ' disabled' : ''}>Next question →</button></div>
</article>
<nav class="assess-map" aria-label="Question map" data-map></nav>
<p class="assess-submit"><button type="button" class="widget-btn" data-submit>Submit assessment</button></p>`;
      renderMap();
    }

    const go = (index) => { attempt.index = index; persist(true); render(); mount.querySelector('.assess-card').focus(); };

    async function runTests(x, button) {
      const out = mount.querySelector('[data-run-out]');
      const code = mount.querySelector('[data-input]').value;
      button.disabled = true;
      out.textContent = x.language === 'python' && !pyReady ? 'Loading Python (first run takes a few seconds)…' : 'Running tests…';
      try {
        const result = await runCode(x, code);
        if (submitted) return;
        const results = result.results || [];
        const passed = results.filter((t) => t.passed).length;
        // The run's code is the response's code, unless the student kept typing while it ran.
        setResponse(x.id, Object.assign({ code }, attempt.responses[x.id], { passed, total: x.tests.length, ranCode: code }), true);
        if (attempt.responses[x.id].code !== code) return;
        out.innerHTML = result.error && !results.length
          ? `<span class="assess-bad">${esc(result.error)}</span>`
          : `${passed} of ${x.tests.length} tests passed.<ul class="assess-tests">${results.map((t) => `<li class="${t.passed ? 'assess-good' : 'assess-bad'}">${t.passed ? '✓' : '✗'} Test ${t.index}${t.passed ? '' : `: got ${esc(t.error || t.actual)}, expected ${esc(t.expected)}`}</li>`).join('')}</ul>`;
      } catch (err) {
        if (submitted) return;
        // ranCode null: the runner failed, not the code, so submit runs it again.
        setResponse(x.id, Object.assign({ code }, attempt.responses[x.id], { passed: 0, total: x.tests.length, ranCode: null }), true);
        out.innerHTML = `<span class="assess-bad">${esc(err.message)}</span>`;
      } finally { button.disabled = false; }
    }

    async function submit() {
      const unanswered = order.filter((o) => !isAnswered(byId[o.id], attempt.responses[o.id])).length;
      if (unanswered && !window.confirm(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered and will score 0. Submit anyway?`)) return;
      submitted = true;
      mount.innerHTML = '<p class="toc-empty">Checking your code and scoring…</p>';
      for (const o of order) {
        const x = byId[o.id];
        const r = attempt.responses[o.id];
        if (x.type === 'code' && isAnswered(x, r) && r.ranCode !== r.code) {
          try {
            const result = await runCode(x, r.code);
            r.passed = (result.results || []).filter((t) => t.passed).length;
          } catch (err) { r.passed = 0; }
          r.total = x.tests.length;
          r.ranCode = r.code;
        }
      }
      window.clearTimeout(saveTimer);
      showResults(mount, catalog, target, attempt, byId, order);
    }

    mount.onclick = (event) => {
      const el = event.target.closest('button');
      if (!el || !mount.contains(el)) return;
      const x = byId[order[attempt.index].id];
      if (el.dataset.goto !== undefined) go(Number(el.dataset.goto));
      else if (el.hasAttribute('data-prev')) go(attempt.index - 1);
      else if (el.hasAttribute('data-next')) go(attempt.index + 1);
      else if (el.hasAttribute('data-submit')) submit();
      else if (el.dataset.tf !== undefined) { setResponse(x.id, el.dataset.tf === 'true', true); render(); }
      else if (el.dataset.move !== undefined) {
        const items = (attempt.responses[x.id] || attempt.layout[x.id]).slice();
        const i = Number(el.dataset.move);
        const j = i + Number(el.dataset.dir);
        [items[i], items[j]] = [items[j], items[i]];
        setResponse(x.id, items, true);
        render();
        const again = mount.querySelector(`[data-move="${j}"][data-dir="${el.dataset.dir}"]`) || mount.querySelector(`[data-move="${j}"]`);
        if (again) again.focus();
      } else if (el.hasAttribute('data-run')) runTests(x, el);
    };
    mount.onchange = (event) => {
      const x = byId[order[attempt.index].id];
      const el = event.target;
      if (el.dataset.choice !== undefined && x.type === 'single') setResponse(x.id, attempt.layout[x.id][Number(el.dataset.choice)], true);
      if (el.dataset.choice !== undefined && x.type === 'multi') {
        const picked = [...mount.querySelectorAll('[data-choice]:checked')].map((box) => attempt.layout[x.id][Number(box.dataset.choice)]);
        setResponse(x.id, picked, true);
      }
      if (el.dataset.match !== undefined) {
        const r = Object.assign({}, attempt.responses[x.id] || {});
        const left = x.pairs[Number(el.dataset.match)][0];
        if (el.value === '') delete r[left]; else r[left] = attempt.layout[x.id][Number(el.value)];
        setResponse(x.id, r, true);
      }
    };
    mount.oninput = (event) => {
      if (!event.target.hasAttribute('data-input')) return;
      const x = byId[order[attempt.index].id];
      const value = event.target.value;
      if (x.type === 'written') setResponse(x.id, Object.assign({}, attempt.responses[x.id], { text: value }));
      else if (x.type === 'code') {
        setResponse(x.id, Object.assign({ passed: 0, total: 0, ranCode: null }, attempt.responses[x.id], { code: value }));
        mount.querySelector('[data-run-out]').textContent = '';
      }
      else setResponse(x.id, value);
    };
    render();
  }

  // ---------- Results ----------
  function showResponse(x, r) {
    if (!isAnswered(x, r)) return 'No answer';
    switch (x.type) {
      case 'multi': return r.join(', ');
      case 'truefalse': return r ? 'True' : 'False';
      case 'order': return r.join(' → ');
      case 'match': return x.pairs.map(([left]) => `${left} → ${r[left] || '—'}`).join('; ');
      case 'written': return r.text;
      case 'code': return `${r.passed || 0} of ${x.tests.length} tests passed`;
      default: return String(r);
    }
  }
  function showCorrect(x) {
    switch (x.type) {
      case 'single': return x.answer;
      case 'multi': return x.answers.join(', ');
      case 'truefalse': return x.answer ? 'True' : 'False';
      case 'number': return String(x.answer);
      case 'text': return x.answers[0];
      case 'order': return x.items.join(' → ');
      case 'match': return x.pairs.map(([l, r]) => `${l} → ${r}`).join('; ');
      default: return '';
    }
  }

  function showResults(mount, catalog, target, attempt, byId, order) {
    const entries = order.map((o) => ({ question: byId[o.id], slug: o.slug, response: attempt.responses[o.id] }));
    const record = () => {
      const score = scoreAttempt(entries);
      const fraction = score.total ? score.points / score.total : 0;
      const store = loadStore();
      const prev = store.results[attempt.id];
      const units = {};
      Object.entries(score.units).forEach(([id, u]) => { units[id] = u.points / u.total; });
      store.results[attempt.id] = { best: Math.max(fraction, prev ? prev.best : 0), last: fraction, at: new Date().toISOString(), units };
      delete store.inProgress[attempt.id];
      saveStore(store);
      return { score, fraction };
    };
    let { score, fraction } = record();

    const written = entries.filter((e) => e.question.type === 'written');
    const unitRows = (slug) => Object.entries(score.units).filter(([id]) => id.startsWith(`${slug}.u`)).map(([id, u]) => {
      const skill = catalog.skills.find((s) => s.id === id);
      const f = u.points / u.total;
      const l = label(f);
      const links = l === 'Review' && skill ? ` <a href="${encodeURI(skill.lessons[0] ? skill.lessons[0].page : skill.testPage)}">Review lesson</a> · <a href="${encodeURI(skill.testPage)}">Unit test</a>` : '';
      return `<tr><td>${esc(skill ? `${skill.unit} · ${skill.name}` : id)}</td><td>${Math.round(u.points * 10) / 10} / ${u.total}</td><td class="assess-label-${l.toLowerCase()}">${l}${links}</td></tr>`;
    }).join('');
    const summary = () => {
      const sections = attempt.sections.map((s) => {
        const c = score.courses[s.slug] || { points: 0, total: 0 };
        const head = attempt.sections.length > 1 ? `<h3>${esc(s.course)} — ${pct(c.total ? c.points / c.total : 0)}</h3>` : '';
        return `${head}<table class="assess-table"><thead><tr><th>Unit</th><th>Score</th><th>Status</th></tr></thead><tbody>${unitRows(s.slug)}</tbody></table>`;
      }).join('');
      return `<div class="box"><span class="box-label">Your score</span><p class="assess-score">${pct(fraction)} <span>(${Math.round(score.points * 10) / 10} of ${score.total} points) · ${label(fraction)}</span></p>${written.length ? '<p class="assess-hint">Written answers count once you score them below.</p>' : ''}</div>${sections}`;
    };

    const writtenHtml = written.map((e) => {
      const r = e.response || { text: '' };
      return `<div class="box" data-written="${esc(e.question.id)}"><span class="box-label">Score your written answer</span><p>${fmt(e.question.prompt)}</p><p class="assess-hint">Your answer</p><p class="assess-written-text">${esc(r.text || 'No answer')}</p><p class="assess-hint">Model answer</p><p>${fmt(e.question.model)}</p><p class="assess-hint">Tick each point your answer covered:</p>${e.question.rubric.map((point, i) => `<label class="assess-option"><input type="checkbox" data-rubric="${i}"${r.rubric && r.rubric[i] ? ' checked' : ''}${isAnswered(e.question, r) ? '' : ' disabled'}> ${fmt(point)}</label>`).join('')}</div>`;
    }).join('');

    const reviewHtml = entries.map((e, i) => {
      const x = e.question;
      const value = grade(x, e.response);
      const correct = x.type === 'written' ? '' : x.type === 'code'
        ? `<p class="assess-hint">Reference solution</p><pre class="code-block"><code>${esc(x.reference)}</code></pre>`
        : `<p><strong>Correct answer:</strong> ${fmt(showCorrect(x))}</p>`;
      return `<details class="assess-review ${value === 1 ? 'is-right' : value > 0 ? 'is-partial' : 'is-wrong'}"><summary>${i + 1}. ${esc(TYPES[x.type].badge)} · ${Math.round(value * 100) / 100} pt</summary><p>${fmt(x.prompt)}</p>${x.code ? `<pre class="code-block"><code>${esc(x.code)}</code></pre>` : ''}<p><strong>Your answer:</strong> ${fmt(showResponse(x, e.response))}</p>${correct}<p class="assess-explain">${fmt(x.explanation)}</p></details>`;
    }).join('');

    mount.innerHTML = `<div data-summary>${summary()}</div>${writtenHtml}${written.length ? '<p><button type="button" class="widget-btn" data-save-written>Save score</button> <span class="assess-hint" data-saved></span></p>' : ''}<h2>Review your answers</h2>${reviewHtml}<p class="assess-nav"><a class="widget-btn" href="assessments.html?${attempt.kind}=${encodeURIComponent(attempt.id.split(':')[1])}" data-retake>Retake</a> <a class="widget-btn" href="assessments.html">Back to Assessments</a></p>`;
    mount.onclick = (event) => {
      if (event.target.hasAttribute('data-retake') && attempt.kind === 'goal' && target.pickable) {
        event.preventDefault();
        mountRunner(mount, catalog, target); // keeps the picked courses
        return;
      }
      if (!event.target.hasAttribute('data-save-written')) return;
      ({ score, fraction } = record());
      mount.querySelector('[data-summary]').innerHTML = summary();
      mount.querySelector('[data-saved]').textContent = canSave() ? 'Saved.' : 'Sign in to save scores.';
    };
    mount.onchange = (event) => {
      const box = event.target.closest('[data-written]');
      if (!box || event.target.dataset.rubric === undefined) return;
      const entry = written.find((e) => e.question.id === box.dataset.written);
      entry.response = Object.assign({}, entry.response, { rubric: [...box.querySelectorAll('[data-rubric]')].map((b) => b.checked) });
      attempt.responses[entry.question.id] = entry.response;
      score = scoreAttempt(entries);
      fraction = score.total ? score.points / score.total : 0;
      mount.querySelector('[data-summary]').innerHTML = summary();
    };
    mount.oninput = null;
    window.scrollTo(0, 0);
  }

  // ---------- Init ----------
  function init() {
    const mount = document.querySelector('[data-assessments]');
    if (!mount || mount.dataset.mounted) return;
    mount.dataset.mounted = '1';
    fetch('/assets/skill-catalog.json').then((res) => res.json()).then((catalog) => {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('course') && !params.has('track') && !params.has('goal')) { renderHub(mount, catalog); return; }
      const target = resolveTarget(catalog, params);
      if (!target) {
        mount.innerHTML = '<p class="toc-empty">That assessment doesn’t exist. <a href="assessments.html">Back to Assessments</a></p>';
        return;
      }
      if (target.pickable && !target.courses.length) renderPicker(mount, catalog, target, (chosen) => mountRunner(mount, catalog, chosen));
      else mountRunner(mount, catalog, target);
    }).catch((err) => {
      mount.innerHTML = '<p class="toc-empty">Assessments couldn’t load. Refresh to try again.</p>';
      console.error(err);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return api;
}));
