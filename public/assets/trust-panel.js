// Compact content-trust panel for course hub pages. Mount with
// <div data-trust-panel="Course Name"></div> and load this script — same
// idempotent-mount pattern as developer-panel.js and reports.js.
(function () {
  'use strict';
  const mount = document.querySelector('[data-trust-panel]');
  if (!mount || window.__stemplusTrustPanelLoaded) return;
  window.__stemplusTrustPanelLoaded = true;

  const course = mount.getAttribute('data-trust-panel');
  if (!course) return;

  const STATUS_CLASS = {
    'AI Generated': 'is-ai-generated',
    'Review in Progress': 'is-review-in-progress',
    'Human Reviewed': 'is-human-reviewed',
    'Human Verified': 'is-human-verified',
  };

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function addRow(grid, label, value) {
    const r = document.createElement('div');
    r.className = 'trust-panel-row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    r.append(dt, dd);
    grid.append(r);
  }

  async function load() {
    const [reviewsRes, assessmentsRes] = await Promise.all([
      fetch('/api/content-review').catch(() => null),
      fetch(`/api/assessment-verification?course=${encodeURIComponent(course)}`).catch(() => null),
    ]);
    const reviews = reviewsRes && reviewsRes.ok ? await reviewsRes.json() : {};
    const assessments = assessmentsRes && assessmentsRes.ok ? await assessmentsRes.json() : [];
    const review = reviews[course];
    const status = review ? review.status : 'AI Generated';

    const panel = document.createElement('div');
    panel.className = 'trust-panel';

    // Automated checks are site-wide invariants enforced by npm test on
    // every commit (check-content-links.js, check-answer-keys.js,
    // check-inline-script-syntax.js, check-content.js) — true for every
    // course equally, never a stand-in for the human-review status below.
    // Spec requirement: these two must never be visually merged.
    const autoLabel = document.createElement('p');
    autoLabel.className = 'trust-panel-label';
    autoLabel.textContent = 'Automated checks';
    panel.append(autoLabel);
    const autoList = document.createElement('ul');
    autoList.className = 'verify-checklist';
    ['Links checked', 'Answer key structure checked', 'Script syntax checked', 'Content structure checked'].forEach((text) => {
      const li = document.createElement('li');
      li.className = 'is-done';
      li.textContent = text;
      autoList.append(li);
    });
    panel.append(autoList);

    const label = document.createElement('p');
    label.className = 'trust-panel-label';
    label.style.marginTop = '1rem';
    label.textContent = 'Human review';
    panel.append(label);

    const badge = document.createElement('span');
    badge.className = `trust-status-badge ${STATUS_CLASS[status] || 'is-ai-generated'}`;
    badge.textContent = status;
    panel.append(badge);

    const grid = document.createElement('dl');
    grid.className = 'trust-panel-grid';
    if (review && review.reviewed) addRow(grid, 'Last reviewed', formatDate(review.reviewed));
    if (review && review.framework) {
      addRow(grid, 'Framework', review.frameworkVersion ? `${review.framework} (${review.frameworkVersion})` : review.framework);
    }
    if (assessments.length) {
      const total = assessments.reduce((sum, a) => sum + a.questionsTotal, 0);
      const verified = assessments.reduce((sum, a) => sum + a.questionsVerified, 0);
      addRow(grid, 'Assessment verification', `${verified} / ${total} practice questions checked`);
    }
    if (review && review.sourcesList && review.sourcesList.length) {
      addRow(grid, 'Sources', review.sourcesList.map((s) => s.name).join(', '));
    }
    panel.append(grid);

    const actions = document.createElement('div');
    actions.className = 'trust-panel-actions';
    const detailsLink = document.createElement('a');
    detailsLink.href = `/review-details.html?course=${encodeURIComponent(course)}`;
    detailsLink.textContent = 'View review details';
    const reportBtn = document.createElement('button');
    reportBtn.type = 'button';
    reportBtn.textContent = 'Report an issue';
    reportBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('stemplus:report')));
    actions.append(detailsLink, reportBtn);
    panel.append(actions);

    mount.replaceChildren(panel);
  }

  load();
}());
