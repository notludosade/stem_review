// Free-response question grading widget for Applications pages. Markup
// contract: <div class="frq" data-frq="<questionId>"> containing a
// data-frq-input textarea, a data-frq-submit button, and a data-frq-status
// span. questionId maps to a rubric defined server-side in
// lib/frq-questions.js — nothing about grading criteria ships to the client.
(function () {
  function renderResult(container, result) {
    const scoreColor = result.score >= 70 ? 'var(--correct)' : 'var(--incorrect)';
    let html = '<div class="box">'
      + '<span class="box-label" style="color:' + scoreColor + '">Score: ' + result.score + '/100 — ' + result.verdict + '</span>'
      + '<p>' + result.feedback + '</p>';

    if (result.strengths.length > 0) {
      html += '<p><strong>What worked:</strong></p><ul>' + result.strengths.map((s) => '<li>' + s + '</li>').join('') + '</ul>';
    }
    if (result.gaps.length > 0) {
      html += '<p><strong>What’s missing:</strong></p><ul>' + result.gaps.map((g) => '<li>' + g + '</li>').join('') + '</ul>';
    }
    if (result.sources.length > 0) {
      html += '<p><strong>Sources checked:</strong></p><ul>' + result.sources.map((s) =>
        '<li><a href="' + s.url + '" target="_blank" rel="noopener">' + (s.title || s.url) + '</a></li>'
      ).join('') + '</ul>';
    }
    html += '</div>';
    container.innerHTML = html;
    container.hidden = false;
  }

  async function handleSubmit(container) {
    const questionId = container.getAttribute('data-frq');
    const input = container.querySelector('[data-frq-input]');
    const submitBtn = container.querySelector('[data-frq-submit]');
    const status = container.querySelector('[data-frq-status]');
    const result = container.querySelector('[data-frq-result]');
    const response = input.value.trim();

    if (response.length < 20) {
      status.textContent = 'Write a bit more before submitting.';
      return;
    }

    submitBtn.disabled = true;
    status.textContent = 'Grading — this checks real sources, so it can take 10–20 seconds…';
    if (result) result.hidden = true;

    try {
      const res = await fetch('/api/grade-frq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, response }),
      });
      const data = await res.json();
      if (!res.ok) {
        status.textContent = data.error || 'Something went wrong, try again.';
        submitBtn.disabled = false;
        return;
      }
      status.textContent = '';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Again';
      if (result) renderResult(result, data);
    } catch (err) {
      status.textContent = 'Network error, try again.';
      submitBtn.disabled = false;
    }
  }

  // Delegated on document rather than bound to the button directly: the
  // shell (components/LegacyContent.tsx) can replace this page's whole
  // content subtree once, shortly after mount, as part of its own
  // hydration bootstrap (same issue worked around in login.html) — a
  // listener bound straight to the button would silently vanish if that
  // happens before the click. A document-level listener survives any
  // subtree replacement because document itself is never replaced.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-frq-submit]');
    if (!btn) return;
    const container = btn.closest('[data-frq]');
    if (container) handleSubmit(container);
  });

  function initFrq() {
    // Only marks containers as seen for renderResult's benefit; actual
    // interaction is delegated above and needs no per-element mount.
    document.querySelectorAll('[data-frq]').forEach((el) => { el.dataset.mounted = '1'; });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initFrq);
    } else {
      initFrq();
    }
  }
})();
