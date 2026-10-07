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

  function render(apps) {
    const footer = document.querySelector('.lesson-footer');
    if (!footer || !apps.length || document.querySelector('[data-lesson-applications]')) return;
    const label = apps.length > 1 ? 'See these concepts in action' : 'See this concept in action';
    const links = apps
      .map((app) => `<a class="nav-toc" href="/Applications/${encodeURIComponent(app.slug)}.html">${escapeHtml(app.title)} →</a>`)
      .join(' ');
    const box = document.createElement('div');
    box.className = 'box';
    box.setAttribute('data-lesson-applications', '');
    box.innerHTML = `<span class="box-label">${label}</span><p class="nav-links">${links}</p>`;
    footer.parentNode.insertBefore(box, footer);
  }

  function init() {
    fetch('/assets/skill-catalog.json').then((res) => res.json()).then((catalog) => {
      const skill = currentSkill(catalog);
      if (!skill) return;
      render(catalog.applications.filter((app) => app.skills.includes(skill.id)));
    }).catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
