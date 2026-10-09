// Developer panel: set each course's content-review status and metadata
// (pages/api/content-review.js). Course names come from the skill catalog
// — the same file assets/mastery.js already fetches — not a separate
// hardcoded list, so a newly-cataloged course shows up here automatically.
(function () {
  'use strict';
  const mount = document.querySelector('[data-content-review-panel]');
  if (!mount || window.__stemplusContentReviewPanelLoaded) return;
  window.__stemplusContentReviewPanelLoaded = true;

  // Keep in sync with lib/content-review.js's VALID_STATUSES.
  const STATUSES = ['AI Generated', 'Review in Progress', 'Human Reviewed', 'Human Verified'];

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  const field = (labelText, inputEl) => {
    const label = document.createElement('label');
    label.className = 'fm-row';
    const span = document.createElement('span');
    span.textContent = labelText;
    span.style.minWidth = '9rem';
    label.append(span, inputEl);
    return label;
  };

  function courseRow(course, current) {
    const row = document.createElement('div');
    row.className = 'widget';

    const label = document.createElement('p');
    label.className = 'widget-label';
    label.textContent = course;
    row.append(label);

    const statusText = (status, reviewedAt) =>
      reviewedAt ? `${status} · last reviewed ${new Date(reviewedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}` : status;
    const statusLine = paragraph(statusText(current ? current.status : 'AI Generated', current && current.reviewed), 'toc-sub');
    row.append(statusLine);

    const select = document.createElement('select');
    select.setAttribute('aria-label', `Status for ${course}`);
    STATUSES.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (current ? current.status === status : status === 'AI Generated') option.selected = true;
      select.append(option);
    });

    const reviewedByInput = document.createElement('input');
    reviewedByInput.type = 'text';
    reviewedByInput.value = (current && current.reviewedBy) || '';
    reviewedByInput.placeholder = 'e.g. Mathematics Reviewer';

    const reviewerRoleInput = document.createElement('input');
    reviewerRoleInput.type = 'text';
    reviewerRoleInput.value = (current && current.reviewerRole) || '';
    reviewerRoleInput.placeholder = 'e.g. Calculus Reviewer';

    const frameworkInput = document.createElement('input');
    frameworkInput.type = 'text';
    frameworkInput.value = (current && current.framework) || '';
    frameworkInput.placeholder = 'e.g. College Board AP Calculus BC Course and Exam Description';

    const frameworkVersionInput = document.createElement('input');
    frameworkVersionInput.type = 'text';
    frameworkVersionInput.value = (current && current.frameworkVersion) || '';
    frameworkVersionInput.placeholder = 'e.g. 2026';

    const sourcesInput = document.createElement('textarea');
    sourcesInput.rows = 3;
    sourcesInput.value = (current && current.sources) || '';
    sourcesInput.placeholder = 'primary|College Board AP Calculus BC CED\nreference|OpenStax Calculus';

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Reviewer, framework & sources';
    details.append(summary);
    const detailGrid = document.createElement('div');
    detailGrid.style.display = 'grid';
    detailGrid.style.gap = '0.6rem';
    detailGrid.style.marginTop = '0.6rem';
    detailGrid.append(
      field('Reviewed by', reviewedByInput),
      field('Reviewer role', reviewerRoleInput),
      field('Framework', frameworkInput),
      field('Framework version', frameworkVersionInput),
      field('Sources (one per line)', sourcesInput)
    );
    details.append(detailGrid);
    row.append(details);

    const controls = document.createElement('div');
    controls.className = 'fm-row';
    controls.style.gap = '0.6rem';
    controls.style.marginTop = '0.8rem';

    const errorLine = paragraph('', 'toc-empty');
    errorLine.hidden = true;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'widget-btn';
    button.textContent = 'Save';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Saving…';
      errorLine.hidden = true;
      const res = await fetch('/api/content-review', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course,
          status: select.value,
          reviewedBy: reviewedByInput.value,
          reviewerRole: reviewerRoleInput.value,
          framework: frameworkInput.value,
          frameworkVersion: frameworkVersionInput.value,
          sources: sourcesInput.value,
        }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res && res.ok) {
        statusLine.textContent = statusText(select.value, new Date().toISOString());
        button.textContent = 'Saved';
        setTimeout(() => {
          button.textContent = 'Save';
          button.disabled = false;
        }, 1500);
      } else {
        errorLine.textContent = data.error || 'Could not save.';
        errorLine.hidden = false;
        button.textContent = 'Try again';
        button.disabled = false;
      }
    });

    controls.append(select, button);
    row.append(controls, errorLine);
    return row;
  }

  async function load() {
    const account = window.STEMPlusAccount;
    const me = account ? await account.ready : null;
    if (!me || !me.isDeveloper) {
      mount.replaceChildren(paragraph('The Developer Panel is only visible to developer accounts.', 'toc-empty'));
      return;
    }

    const catalogRes = await fetch('/assets/skill-catalog.json').catch(() => null);
    if (!catalogRes || !catalogRes.ok) {
      mount.replaceChildren(paragraph('Could not load the course list.', 'toc-empty'));
      return;
    }
    const catalog = await catalogRes.json();
    const courses = [...new Set(catalog.skills.map((skill) => skill.course))].sort();

    const reviewsRes = await fetch('/api/content-review', { credentials: 'same-origin' }).catch(() => null);
    if (!reviewsRes || !reviewsRes.ok) {
      mount.replaceChildren(paragraph('Could not load content review status.', 'toc-empty'));
      return;
    }
    const reviews = await reviewsRes.json();
    mount.replaceChildren(...courses.map((course) => courseRow(course, reviews[course])));
  }

  load();
}());
