(function () {
  'use strict';

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function scenario(course, title, subtitle) {
    const name = `<strong>${title}</strong>`;
    if (/physics|engineering|robot|thermodynamics|mechatronics/i.test(course)) return `An engineering team must predict, measure, or improve a physical system governed by ${name}. Their recommendation must connect the lesson's model to measurements, operating limits, and the behavior they expect to observe.`;
    if (/calculus|algebra|math|analysis|topology|equations|precalculus/i.test(course)) return `A modeler must turn real measurements into a defensible decision using ${name}. They need to define the quantities clearly, choose a method that matches the situation, and explain what the result means outside the calculation.`;
    if (/program|software|comput|network|cloud|data|ai|game/i.test(course)) return `A technical team must build, inspect, or debug a real system involving ${name}. They must identify the relevant input and expected behavior, choose the lesson's technique, and verify the result rather than relying on a guess.`;
    if (/ethic|career/i.test(course)) return `A project team faces a real decision involving ${name} and must justify its choice to the people affected. A strong response identifies the stakeholders, weighs the evidence, and explains both the benefit and the possible harm.`;
    return `A team must investigate a real situation using ${name}, then explain what the evidence supports. Their response should connect the lesson idea to an observable result and acknowledge what the available information cannot prove.`;
  }

  function wrapConcepts(learn) {
    const headings = [...learn.children].filter((node) => /H[23]/.test(node.tagName) && !node.classList.contains('lesson-stage-title'));
    headings.forEach((heading, index) => {
      const wrapper = document.createElement('section');
      wrapper.className = 'lesson-concept-block';
      wrapper.id = `concept-${index + 1}-${slug(heading.textContent).slice(0, 36)}`;
      learn.insertBefore(wrapper, heading);
      let node = heading;
      while (node && (node === heading || !/H[23]/.test(node.tagName))) {
        const next = node.nextElementSibling;
        wrapper.appendChild(node);
        node = next;
      }
    });

    [...learn.querySelectorAll('.box')].forEach((box) => {
      if (box.querySelector('.concept-kind')) return;
      const kind = document.createElement('span');
      kind.className = 'concept-kind';
      kind.textContent = box.classList.contains('example') || box.classList.contains('why') ? 'Good to know' : 'Key concept';
      box.insertBefore(kind, box.firstChild);
    });

    const items = [...learn.querySelectorAll('.lesson-concept-block > h2:first-child, .lesson-concept-block > h3:first-child, .box-label')]
      .map((heading) => ({ label: clean(heading.textContent), target: heading.closest('[id]') || heading.closest('.box') }))
      .filter((item, index, all) => item.label && all.findIndex((other) => other.label === item.label) === index)
      .slice(0, 10);
    if (!items.length) return [];
    const map = document.createElement('nav');
    map.className = 'lesson-concept-map';
    map.setAttribute('aria-label', 'Key concepts in this lesson');
    items.forEach((item, index) => {
      if (!item.target.id) item.target.id = `key-concept-${index + 1}`;
      const link = document.createElement('a');
      link.href = `#${item.target.id}`;
      link.textContent = item.label;
      map.appendChild(link);
    });
    learn.querySelector('.lesson-stage-intro').after(map);
    return items.map((item) => item.label);
  }

  function stage(id, title, intro) {
    const section = document.createElement('section');
    section.className = 'lesson-stage';
    section.id = id;
    section.innerHTML = `<h2 class="lesson-stage-title">${title}</h2><p class="lesson-stage-intro">${intro}</p>`;
    return section;
  }

  function init() {
    const page = document.querySelector('.page');
    if (!page || page.dataset.lessonExperience === 'ready' || page.querySelector('[data-test]')) return;
    const footer = page.querySelector('.lesson-footer');
    const title = clean(page.querySelector('h1')?.textContent);
    const kicker = clean(page.querySelector('.kicker')?.textContent);
    const nav = page.querySelector(':scope > .nav-links');
    if (!footer || !title || !nav || !/\bLesson\b/i.test(kicker)) return;
    page.dataset.lessonExperience = 'ready';

    const course = kicker.split('·')[1]?.trim() || 'this course';
    const subtitle = clean(page.querySelector(':scope > .subtitle')?.textContent);
    const children = [...page.children];
    const start = children.indexOf(nav) + 1;
    const recall = children.findIndex((node, index) => index >= start && /^H2$/.test(node.tagName) && /check your (recall|understanding)/i.test(clean(node.textContent)));
    const source = children.findIndex((node, index) => index >= start && /^H2$/.test(node.tagName) && /go to the source/i.test(clean(node.textContent)));
    const end = children.indexOf(footer);

    const path = document.createElement('nav');
    path.className = 'lesson-path';
    path.setAttribute('aria-label', 'Lesson stages');
    path.innerHTML = '<a href="#learn-it"><span>Step 1</span>Learn it</a><a href="#study-it"><span>Step 2</span>Study it</a><a href="#apply-it"><span>Step 3</span>Apply it</a>';
    nav.after(path);

    const learn = stage('learn-it', 'Learn it', 'Begin with the lesson in plain language, then move into the details. Each highlighted block keeps one key concept or useful supporting idea together, so you can understand what it means, when it is used, and how it connects to the rest of the lesson.');
    const study = stage('study-it', 'Study it', 'Decide what you must remember and what you must learn by doing. Work from memory, practice choosing the correct method, and use every mistake to identify the exact idea that needs another look.');
    const apply = stage('apply-it', 'Apply it', 'Place the lesson inside a realistic situation without turning it into a full exam. Focus on identifying the goal, selecting useful information, choosing the lesson concept that fits, and explaining what the result would mean in practice.');
    apply.dataset.lessonApply = '';
    path.after(learn);
    footer.before(study, apply);

    const learnStop = recall >= 0 ? recall : (source >= 0 ? source : end);
    children.slice(start, learnStop).forEach((node) => learn.appendChild(node));
    const studyStop = source >= 0 ? source : end;
    if (recall >= 0) children.slice(recall, studyStop).forEach((node) => study.appendChild(node));
    if (source >= 0) children.slice(source, end).forEach((node) => apply.appendChild(node));

    const concepts = wrapConcepts(learn);
    const guide = document.createElement('div');
    guide.className = 'box why';
    guide.innerHTML = `<span class="box-label">What to remember</span><ul class="lesson-study-list"><li>Explain ${title} in your own words and name the type of problem or question it helps you solve.</li><li>For each key concept, state when it applies, what information it needs, the main reasoning step, and one common mistake.</li><li>Try one representative problem by first identifying what is known, what is being asked, and why this lesson provides an appropriate method.</li><li>Work the recall questions closed-note. For each miss, revisit only the connected explanation, describe why your first answer failed, and try again.</li>${concepts.length ? `<li>Give the most attention to these lesson anchors: ${concepts.slice(0, 4).join('; ')}.</li>` : ''}</ul>`;
    study.insertBefore(guide, study.children[2] || null);
    const oldRecall = [...study.querySelectorAll('h2')].find((heading) => /check your/i.test(clean(heading.textContent)));
    if (oldRecall) { oldRecall.textContent = 'Practice from memory'; oldRecall.className = 'lesson-concept-heading'; }

    const application = document.createElement('div');
    application.className = 'box lesson-apply-scenario';
    application.innerHTML = `<span class="box-label">Real-world scenario</span><p>${scenario(course, title, subtitle)}</p>${subtitle ? `<p><strong>Lesson connection:</strong> ${subtitle}</p>` : ''}<ul class="lesson-apply-list"><li>Restate the team's goal in one clear sentence before choosing a method.</li><li>Identify the information that must be known, measured, or observed, including any important units or constraints.</li><li>Choose the lesson concept that fits and explain why it is more useful than an unrelated method.</li><li>Use the evidence to predict a result or recommend an action, then explain what that result means for the team.</li><li>Name one assumption, source of uncertainty, or limitation that could change the conclusion.</li></ul>`;
    apply.insertBefore(application, apply.children[2] || null);

    const linked = page.querySelector('[data-lesson-applications]');
    if (linked) apply.appendChild(linked);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
