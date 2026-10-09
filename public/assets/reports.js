// Developer review page for Report a Problem (content/reports.html). Every
// report field comes from anonymous visitors, so it is only ever written
// with textContent. Status and category lists come from /api/reports'
// response rather than being hardcoded here, so there's nothing to drift.
(function () {
  'use strict';
  const mount = document.querySelector('[data-reports]');
  if (!mount || window.__stemplusReportsLoaded) return;
  window.__stemplusReportsLoaded = true;

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  function correctionForm(report, categories, onDone) {
    const form = document.createElement('div');
    form.className = 'fm-row';
    form.style.flexDirection = 'column';
    form.style.alignItems = 'stretch';
    form.style.gap = '0.5rem';

    const category = document.createElement('select');
    categories.forEach((c) => {
      const option = document.createElement('option');
      option.value = c;
      option.textContent = c;
      if (c === report.category) option.selected = true;
      category.append(option);
    });
    const summary = document.createElement('textarea');
    summary.rows = 2;
    summary.placeholder = 'What changed (shown publicly)';
    const reason = document.createElement('textarea');
    reason.rows = 2;
    reason.placeholder = 'Why (shown publicly, optional)';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'widget-btn';
    submit.textContent = 'Save correction & mark Corrected';
    submit.addEventListener('click', async () => {
      if (!summary.value.trim()) return;
      submit.disabled = true;
      const res = await fetch('/api/corrections', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course: report.course, unit: report.unit, lesson: report.lesson, questionRef: report.questionId,
          category: category.value, summary: summary.value, reason: reason.value, reportId: report.id,
        }),
      }).catch(() => null);
      if (res && res.ok) {
        await fetch('/api/reports', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: report.id, status: 'CORRECTED' }),
        }).catch(() => null);
        onDone();
      } else {
        submit.disabled = false;
      }
    });
    form.append(category, summary, reason, submit);
    return form;
  }

  function reportCard(report, statuses, categories, reload) {
    const card = document.createElement('div');
    card.className = 'widget';
    const meta = [new Date(report.createdAt).toLocaleString(), report.category, report.course, report.unit, report.reporter || 'guest'];
    card.append(paragraph(meta.filter(Boolean).join(' · '), 'widget-label'));

    const where = document.createElement('p');
    const link = document.createElement('a');
    link.href = report.page;
    link.textContent = report.pageTitle || report.page;
    where.append(link);
    if (report.questionId) where.append(` · question ${report.questionId}`);
    card.append(where, paragraph(report.description));

    const statusRow = document.createElement('div');
    statusRow.className = 'fm-row';
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Status for report ${report.id}`);
    statuses.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (report.status === status) option.selected = true;
      select.append(option);
    });
    const saveStatus = document.createElement('button');
    saveStatus.type = 'button';
    saveStatus.className = 'widget-btn';
    saveStatus.textContent = 'Update status';
    saveStatus.addEventListener('click', async () => {
      saveStatus.disabled = true;
      const res = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, status: select.value }),
      }).catch(() => null);
      if (res && res.ok) reload();
      else saveStatus.disabled = false;
    });
    statusRow.append(select, saveStatus);
    card.append(statusRow);

    const correctionToggle = document.createElement('button');
    correctionToggle.type = 'button';
    correctionToggle.className = 'widget-btn';
    correctionToggle.textContent = 'Log correction';
    correctionToggle.addEventListener('click', () => {
      correctionToggle.replaceWith(correctionForm(report, categories, reload));
    });
    card.append(correctionToggle);

    return card;
  }

  const section = (title, reports, empty, statuses, categories, reload) => {
    const heading = document.createElement('h2');
    heading.textContent = `${title} (${reports.length})`;
    return [heading, ...(reports.length ? reports.map((r) => reportCard(r, statuses, categories, reload)) : [paragraph(empty, 'toc-empty')])];
  };

  async function load() {
    const res = await fetch('/api/reports', { credentials: 'same-origin' }).catch(() => null);
    if (!res || !res.ok) {
      mount.replaceChildren(paragraph(res && res.status === 403
        ? 'Reports are only visible to developer accounts.'
        : 'Could not load reports.', 'toc-empty'));
      return;
    }
    const { open, resolved, statuses, categories } = await res.json();
    mount.replaceChildren(
      ...section('Open issues', open, 'No open issues.', statuses, categories, load),
      ...section('Recently closed', resolved, 'No closed issues yet.', statuses, categories, load)
    );
  }

  load();
}());
