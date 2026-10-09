// Developer-only assessment-verification editor (content/developer-panel.html).
// Keep STATUSES in sync with lib/content-trust.js's ASSESSMENT_STATUSES —
// checked by scripts/check-content-trust.js.
(function () {
  'use strict';
  const mount = document.querySelector('[data-assessment-review-panel]');
  if (!mount || window.__stemplusAssessmentReviewPanelLoaded) return;
  window.__stemplusAssessmentReviewPanelLoaded = true;

  const STATUSES = ['not-verified', 'in-progress', 'verified'];
  const CHECKLIST = [
    ['answerChecked', 'Correct answer checked'],
    ['explanationChecked', 'Explanation checked'],
    ['wordingChecked', 'Question wording checked'],
    ['numericToleranceChecked', 'Numeric tolerance checked'],
    ['symbolicEquivalenceChecked', 'Symbolic equivalence checked'],
    ['diagramChecked', 'Diagram checked'],
    ['curriculumAlignmentChecked', 'Curriculum alignment checked'],
  ];

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  function assessmentRow(a) {
    const row = document.createElement('div');
    row.className = 'widget';
    const name = [a.unit, a.kind === 'course_exam' ? 'Course exam' : 'Unit test', a.version ? `Version ${a.version}` : null]
      .filter(Boolean).join(' · ');
    row.append(paragraph(name, 'widget-label'));

    const select = document.createElement('select');
    STATUSES.forEach((s) => {
      const option = document.createElement('option');
      option.value = s;
      option.textContent = s;
      if (a.status === s) option.selected = true;
      select.append(option);
    });

    const totalInput = document.createElement('input');
    totalInput.type = 'number';
    totalInput.min = '0';
    totalInput.value = a.questionsTotal;
    totalInput.style.width = '5rem';

    const verifiedInput = document.createElement('input');
    verifiedInput.type = 'number';
    verifiedInput.min = '0';
    verifiedInput.value = a.questionsVerified;
    verifiedInput.style.width = '5rem';

    const countsRow = document.createElement('div');
    countsRow.className = 'fm-row';
    const totalLabel = document.createElement('label');
    totalLabel.append('Total ', totalInput);
    const verifiedLabel = document.createElement('label');
    verifiedLabel.append('Verified ', verifiedInput);
    countsRow.append(select, totalLabel, verifiedLabel);
    row.append(countsRow);

    const checklistWrap = document.createElement('div');
    checklistWrap.style.display = 'grid';
    checklistWrap.style.gap = '0.3rem';
    checklistWrap.style.margin = '0.6rem 0';
    const checkboxes = {};
    CHECKLIST.forEach(([key, text]) => {
      const checkboxLabel = document.createElement('label');
      checkboxLabel.className = 'fm-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(a.checklist[key]);
      checkboxes[key] = checkbox;
      checkboxLabel.append(checkbox, ` ${text}`);
      checklistWrap.append(checkboxLabel);
    });
    row.append(checklistWrap);

    const notesInput = document.createElement('textarea');
    notesInput.rows = 2;
    notesInput.placeholder = 'Notes (optional)';
    notesInput.value = a.notes || '';
    row.append(notesInput);

    const verifiedByInput = document.createElement('input');
    verifiedByInput.type = 'text';
    verifiedByInput.placeholder = 'Verified by (if marking verified)';
    verifiedByInput.value = a.verifiedBy || '';
    row.append(verifiedByInput);

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
      const checklist = {};
      CHECKLIST.forEach(([key]) => { checklist[key] = checkboxes[key].checked; });
      const res = await fetch('/api/assessment-verification', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId: a.assessmentId,
          course: a.course,
          unit: a.unit,
          kind: a.kind,
          version: a.version,
          status: select.value,
          questionsTotal: Number(totalInput.value) || 0,
          questionsVerified: Number(verifiedInput.value) || 0,
          checklist,
          notes: notesInput.value,
          verifiedBy: verifiedByInput.value,
        }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res && res.ok) {
        button.textContent = 'Saved';
        setTimeout(() => { button.textContent = 'Save'; button.disabled = false; }, 1500);
      } else {
        errorLine.textContent = data.error || 'Could not save.';
        errorLine.hidden = false;
        button.textContent = 'Try again';
        button.disabled = false;
      }
    });
    row.append(button, errorLine);
    return row;
  }

  async function loadCourse(course) {
    mount.replaceChildren(paragraph('Loading…', 'toc-empty'));
    const res = await fetch(`/api/assessment-verification?course=${encodeURIComponent(course)}`).catch(() => null);
    if (!res || !res.ok) {
      mount.replaceChildren(paragraph('Could not load assessments.', 'toc-empty'));
      return;
    }
    const assessments = await res.json();
    mount.replaceChildren(...(assessments.length
      ? assessments.map(assessmentRow)
      : [paragraph('No assessments tracked for this course yet.', 'toc-empty')]));
  }

  async function init() {
    const account = window.STEMPlusAccount;
    const me = account ? await account.ready : null;
    if (!me || !me.isDeveloper) return;

    const catalogRes = await fetch('/assets/skill-catalog.json').catch(() => null);
    if (!catalogRes || !catalogRes.ok) return;
    const catalog = await catalogRes.json();
    const courses = [...new Set(catalog.skills.map((skill) => skill.course))].sort();

    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Course');
    courses.forEach((course) => {
      const option = document.createElement('option');
      option.value = course;
      option.textContent = course;
      select.append(option);
    });
    select.addEventListener('change', () => loadCourse(select.value));
    mount.before(select);
    loadCourse(select.value);
  }

  init();
}());
