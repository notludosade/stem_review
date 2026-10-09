// Public correction log (content/corrections.html) — every course, newest first.
(function () {
  'use strict';
  const mount = document.querySelector('[data-corrections-log]');
  if (!mount || window.__stemplusCorrectionsLoaded) return;
  window.__stemplusCorrectionsLoaded = true;

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  function correctionCard(c) {
    const card = document.createElement('div');
    card.className = 'correction-card';
    const date = document.createElement('p');
    date.className = 'correction-date';
    date.textContent = `${new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · ${c.course}`;
    card.append(date);
    const titleLine = [c.unit, c.lesson, c.questionRef].filter(Boolean).join(' — ');
    if (titleLine) card.append(paragraph(titleLine, 'correction-title'));
    card.append(paragraph(`Changed: ${c.summary}`));
    if (c.reason) card.append(paragraph(`Reason: ${c.reason}`));
    return card;
  }

  async function load() {
    const res = await fetch('/api/corrections').catch(() => null);
    if (!res || !res.ok) {
      mount.replaceChildren(paragraph('Could not load the correction log.', 'toc-empty'));
      return;
    }
    const corrections = await res.json();
    mount.replaceChildren(...(corrections.length ? corrections.map(correctionCard) : [paragraph('No corrections recorded yet.', 'toc-empty')]));
  }

  load();
}());
