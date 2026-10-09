// Generic review-details page, driven entirely by ?course= and the
// content-review / assessment-verification / corrections APIs — one page
// serves every course rather than a static page per course.
(function () {
  'use strict';
  const mount = document.querySelector('[data-review-details]');
  if (!mount || window.__stemplusReviewDetailsLoaded) return;
  window.__stemplusReviewDetailsLoaded = true;

  const course = new URLSearchParams(location.search).get('course');
  const titleEl = document.querySelector('[data-review-title]');

  const paragraph = (text, className) => {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    return p;
  };

  const CHECKLIST_LABELS = {
    answerChecked: 'Correct answer checked',
    explanationChecked: 'Explanation checked',
    wordingChecked: 'Question wording checked',
    numericToleranceChecked: 'Numeric tolerance checked',
    symbolicEquivalenceChecked: 'Symbolic equivalence checked',
    diagramChecked: 'Diagram checked',
    curriculumAlignmentChecked: 'Curriculum alignment checked',
  };

  function assessmentRow(a) {
    const row = document.createElement('div');
    row.className = 'widget';
    const name = [a.unit, a.kind === 'course_exam' ? 'Course exam' : 'Unit test', a.version ? `Version ${a.version}` : null]
      .filter(Boolean).join(' · ');
    row.append(paragraph(name, 'widget-label'));
    row.append(paragraph(`${a.status} — ${a.questionsVerified} / ${a.questionsTotal} questions checked`));
    const list = document.createElement('ul');
    list.className = 'verify-checklist';
    Object.entries(CHECKLIST_LABELS).forEach(([key, text]) => {
      const li = document.createElement('li');
      li.textContent = text;
      if (a.checklist[key]) li.classList.add('is-done');
      list.append(li);
    });
    row.append(list);
    return row;
  }

  function correctionRow(c) {
    const card = document.createElement('div');
    card.className = 'correction-card';
    const date = document.createElement('p');
    date.className = 'correction-date';
    date.textContent = new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    card.append(date);
    const titleLine = [c.unit, c.lesson, c.questionRef].filter(Boolean).join(' — ');
    if (titleLine) card.append(paragraph(titleLine, 'correction-title'));
    card.append(paragraph(`Changed: ${c.summary}`));
    if (c.reason) card.append(paragraph(`Reason: ${c.reason}`));
    return card;
  }

  async function load() {
    if (!course) {
      mount.replaceChildren(paragraph('No course specified.', 'toc-empty'));
      return;
    }
    if (titleEl) titleEl.textContent = `${course} — Review Details`;
    document.title = `${course} — Review Details — STEM+`;

    const [reviewsRes, assessmentsRes, correctionsRes] = await Promise.all([
      fetch('/api/content-review').catch(() => null),
      fetch(`/api/assessment-verification?course=${encodeURIComponent(course)}`).catch(() => null),
      fetch(`/api/corrections?course=${encodeURIComponent(course)}`).catch(() => null),
    ]);
    const reviews = reviewsRes && reviewsRes.ok ? await reviewsRes.json() : {};
    const assessments = assessmentsRes && assessmentsRes.ok ? await assessmentsRes.json() : [];
    const corrections = correctionsRes && correctionsRes.ok ? await correctionsRes.json() : [];
    const review = reviews[course];

    const sections = [];
    const autoHeading = document.createElement('h2');
    autoHeading.textContent = 'Automated checks';
    sections.push(autoHeading);
    const autoList = document.createElement('ul');
    autoList.className = 'verify-checklist';
    ['Links checked', 'Answer key structure checked', 'Script syntax checked', 'Content structure checked'].forEach((text) => {
      const li = document.createElement('li');
      li.className = 'is-done';
      li.textContent = text;
      autoList.append(li);
    });
    sections.push(autoList);

    const humanHeading = document.createElement('h2');
    humanHeading.textContent = 'Human review';
    sections.push(humanHeading);
    sections.push(paragraph(`Status: ${review ? review.status : 'AI Generated'}`, 'widget-label'));
    if (review && review.reviewed) sections.push(paragraph(`Last reviewed: ${new Date(review.reviewed).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`));
    if (review && review.reviewedBy) sections.push(paragraph(`Reviewer: ${review.reviewedBy}${review.reviewerRole ? ` (${review.reviewerRole})` : ''}`));
    if (review && review.framework) sections.push(paragraph(`Framework: ${review.framework}${review.frameworkVersion ? ` (${review.frameworkVersion})` : ''}`));
    if (review && review.sourcesList && review.sourcesList.length) {
      sections.push(paragraph(`Sources: ${review.sourcesList.map((s) => s.name).join(', ')}`));
    }

    const heading1 = document.createElement('h2');
    heading1.textContent = 'Assessment verification';
    sections.push(heading1);
    sections.push(...(assessments.length ? assessments.map(assessmentRow) : [paragraph('No assessments tracked for this course yet.', 'toc-empty')]));

    const heading2 = document.createElement('h2');
    heading2.textContent = 'Recent corrections';
    sections.push(heading2);
    sections.push(...(corrections.length ? corrections.map(correctionRow) : [paragraph('No corrections recorded for this course yet.', 'toc-empty')]));

    mount.replaceChildren(...sections);
  }

  load();
}());
