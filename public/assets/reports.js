// Developer review page for Report a Problem (content/reports.html). Every
// report field comes from anonymous visitors, so it is only ever written
// with textContent.
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

  const reportCard = (report) => {
    const card = document.createElement('div');
    card.className = 'widget';
    const meta = [new Date(report.createdAt).toLocaleString(), report.category, report.course, report.reporter || 'guest'];
    card.append(paragraph(meta.filter(Boolean).join(' · '), 'widget-label'));

    const where = document.createElement('p');
    const link = document.createElement('a');
    link.href = report.page;
    link.textContent = report.pageTitle || report.page;
    where.append(link);
    if (report.questionId) where.append(` · question ${report.questionId}`);
    card.append(where, paragraph(report.description));

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'widget-btn';
    button.textContent = report.resolvedAt ? 'Reopen' : 'Resolve';
    button.addEventListener('click', async () => {
      button.disabled = true;
      const res = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, resolved: !report.resolvedAt }),
      }).catch(() => null);
      if (res && res.ok) load();
      else {
        button.disabled = false;
        button.textContent = 'Try again';
      }
    });
    card.append(button);
    return card;
  };

  const section = (title, reports, empty) => {
    const heading = document.createElement('h2');
    heading.textContent = `${title} (${reports.length})`;
    return [heading, ...(reports.length ? reports.map(reportCard) : [paragraph(empty, 'toc-empty')])];
  };

  async function load() {
    const res = await fetch('/api/reports', { credentials: 'same-origin' }).catch(() => null);
    if (!res || !res.ok) {
      mount.replaceChildren(paragraph(res && res.status === 403
        ? 'Reports are only visible to developer accounts.'
        : 'Could not load reports.', 'toc-empty'));
      return;
    }
    const { open, resolved } = await res.json();
    mount.replaceChildren(...section('Open', open, 'No open reports.'), ...section('Recently resolved', resolved, 'Nothing resolved yet.'));
  }

  load();
}());
