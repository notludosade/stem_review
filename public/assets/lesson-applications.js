// Cross-links a lesson to the real-world Applications that use its skill
// (revision doc Section 28: "see this concept in action"). catalog.applications[]
// comes from scripts/build-skill-catalog.js's APPLICATION_SKILLS map.
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function currentSkill(catalog) {
    const page = decodeURIComponent(window.location.pathname);
    return catalog.skills.find((skill) => skill.lessons.some((lesson) => lesson.page === page));
  }

  function render(apps, concepts) {
    const footer = document.querySelector('.lesson-footer');
    if (!footer || (!apps.length && !concepts.length) || document.querySelector('[data-lesson-applications]')) return;
    const applicationLinks = apps
      .map((app) => `<a class="nav-toc" href="/Applications/${encodeURIComponent(app.slug)}.html">${escapeHtml(app.title)} →</a>`)
      .join(' ');
    const practiceLinks = concepts
      .filter((concept) => concept.questionCount)
      .map((concept) => `<a class="nav-toc" href="/problem-set.html?course=${encodeURIComponent(concept.problemSet)}&skill=${encodeURIComponent(concept.id)}">Practice ${escapeHtml(concept.name)} →</a>`)
      .join(' ');
    const box = document.createElement('div');
    box.className = 'box';
    box.setAttribute('data-lesson-applications', '');
    box.innerHTML = concepts.length
      ? `<span class="box-label">Concept skills</span><p>${concepts.map((concept) => escapeHtml(concept.name)).join(' · ')}</p>${practiceLinks ? `<p class="nav-links">${practiceLinks}</p>` : ''}`
      : '';
    if (apps.length) {
      const label = apps.length > 1 ? 'See these concepts in action' : 'See this concept in action';
      box.innerHTML += `<span class="box-label">${label}</span><p class="nav-links">${applicationLinks}</p>`;
    }
    footer.parentNode.insertBefore(box, footer);
  }

  function init() {
    fetch('/assets/skill-catalog.json').then((res) => res.json()).then((catalog) => {
      const skill = currentSkill(catalog);
      if (!skill) return;
      const page = decodeURIComponent(window.location.pathname);
      const concepts = (catalog.concepts || []).filter((concept) => concept.lessons.includes(page));
      render(catalog.applications.filter((app) => app.skills.includes(skill.id)), concepts);
    }).catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
