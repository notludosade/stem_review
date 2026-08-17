// Free-response question grading widget for Applications pages. Markup
// contract: <div class="frq" data-frq="<questionId>"> containing a
// data-frq-input textarea, a data-frq-submit button, and a data-frq-status
// span. questionId maps to a rubric defined server-side in
// lib/frq-questions.js — nothing about grading criteria ships to the client.
(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    }[character]));
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value));
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (err) {
      return '';
    }
  }

  // Server-verified developer status — see the detailed comment in
  // assets/tests.js. Guarded so a page that also loads quiz.js/tests.js
  // (the roller coaster page loads quiz.js before this file) only fires
  // one /api/me request between them.
  if (typeof window !== 'undefined' && !window.STEMPlusDevReady) {
    window.STEMPlusDev = { isDeveloper: false };
    window.STEMPlusDevReady = fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        window.STEMPlusDev.isDeveloper = !!(me && me.isDeveloper);
        return window.STEMPlusDev.isDeveloper;
      })
      .catch(() => false);
  }

  function addSampleAnswerButton(container) {
    if (container.querySelector('[data-frq-sample-btn]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'widget-btn';
    btn.setAttribute('data-frq-sample-btn', '');
    btn.textContent = 'Show Sample Answer (Developer)';
    btn.style.marginLeft = '0.6rem';
    const actions = container.querySelector('.reflection-actions');
    if (actions) actions.appendChild(btn);
    else container.appendChild(btn);
  }

  async function handleShowSample(container) {
    const questionId = container.getAttribute('data-frq');
    const btn = container.querySelector('[data-frq-sample-btn]');
    const status = container.querySelector('[data-frq-status]');
    btn.disabled = true;
    try {
      const res = await fetch('/api/frq-sample?questionId=' + encodeURIComponent(questionId));
      const data = await res.json();
      if (!res.ok) {
        if (status) status.textContent = data.error || 'Could not load sample answer.';
        btn.disabled = false;
        return;
      }
      let box = container.querySelector('[data-frq-sample-box]');
      if (!box) {
        box = document.createElement('div');
        box.setAttribute('data-frq-sample-box', '');
        box.className = 'box example';
        container.appendChild(box);
      }
      box.innerHTML = '<span class="box-label">Sample Answer (Developer)</span><p>' + escapeHtml(data.sampleAnswer) + '</p>';
      btn.disabled = false;
    } catch (err) {
      if (status) status.textContent = 'Network error loading sample answer.';
      btn.disabled = false;
    }
  }

  function maybeAddSampleAnswerButton(container) {
    if (window.STEMPlusDev && window.STEMPlusDev.isDeveloper) {
      addSampleAnswerButton(container);
    } else if (window.STEMPlusDevReady) {
      window.STEMPlusDevReady.then((isDeveloper) => {
        if (isDeveloper) addSampleAnswerButton(container);
      });
    }
  }

  function renderResult(container, result) {
    const scoreColor = result.score >= 70 ? 'var(--correct)' : 'var(--incorrect)';
    let html = '<div class="box">'
      + '<span class="box-label" style="color:' + scoreColor + '">Score: ' + escapeHtml(result.score) + '/100 — ' + escapeHtml(result.verdict) + '</span>'
      + '<p>' + escapeHtml(result.feedback) + '</p>';

    if (result.strengths.length > 0) {
      html += '<p><strong>What worked:</strong></p><ul>' + result.strengths.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>';
    }
    if (result.gaps.length > 0) {
      html += '<p><strong>What’s missing:</strong></p><ul>' + result.gaps.map((g) => '<li>' + escapeHtml(g) + '</li>').join('') + '</ul>';
    }
    if (result.sources.length > 0) {
      html += '<p><strong>Sources checked:</strong></p><ul>' + result.sources.map((s) => {
        const url = safeHttpUrl(s.url);
        const label = escapeHtml(s.title || s.url);
        return url
          ? '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + label + '</a></li>'
          : '<li>' + label + '</li>';
      }).join('') + '</ul>';
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
    const submitBtn = e.target.closest('[data-frq-submit]');
    if (submitBtn) {
      const container = submitBtn.closest('[data-frq]');
      if (container) handleSubmit(container);
      return;
    }
    const sampleBtn = e.target.closest('[data-frq-sample-btn]');
    if (sampleBtn) {
      const container = sampleBtn.closest('[data-frq]');
      if (container) handleShowSample(container);
    }
  });

  function initFrq() {
    document.querySelectorAll('[data-frq]').forEach((el) => {
      // Only marks containers as seen for renderResult's benefit; the
      // submit/sample-answer interactions are delegated above and need no
      // per-element mount.
      el.dataset.mounted = '1';
      maybeAddSampleAnswerButton(el);
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initFrq);
    } else {
      initFrq();
    }
  }
})();
