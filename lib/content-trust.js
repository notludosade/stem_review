'use strict';

const ASSESSMENT_STATUSES = ['not-verified', 'in-progress', 'verified'];
const REPORT_STATUSES = ['RECEIVED', 'UNDER_REVIEW', 'CONFIRMED', 'CORRECTED', 'CLOSED'];
const SOURCE_ROLES = ['primary', 'reference', 'supporting'];

function isValidAssessmentStatus(status) {
  return typeof status === 'string' && ASSESSMENT_STATUSES.includes(status);
}

function isValidReportStatus(status) {
  return typeof status === 'string' && REPORT_STATUSES.includes(status);
}

// Sources are stored as one "role|name" pair per line in content_reviews.sources,
// e.g. "primary|College Board AP Calculus BC Course and Exam Description". A
// line with no "|" is treated as a bare name with the default role.
function parseSources(sourcesText) {
  if (typeof sourcesText !== 'string' || !sourcesText.trim()) return [];
  return sourcesText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('|');
      if (i === -1) return { role: 'reference', name: line };
      const role = line.slice(0, i).trim().toLowerCase();
      const name = line.slice(i + 1).trim();
      return { role: SOURCE_ROLES.includes(role) ? role : 'reference', name };
    })
    .filter((source) => source.name);
}

function formatSources(sources) {
  return sources.map((s) => `${s.role}|${s.name}`).join('\n');
}

// Enforces the content-trust spec's hard rule: Human Reviewed/Human Verified
// can't be claimed without the work those statuses imply actually being on
// record. `assessments` is that course's assessment_verifications rows
// (status field only is enough) — may be [].
//
// A course with zero assessment rows can never reach Human Verified. This is
// a deliberate, conservative default: it's safer to require someone to seed
// assessment rows first than to let "no data yet" silently read as "nothing
// to verify."
function validateContentReviewUpdate({ status, reviewedBy, reviewedAt, sources, assessments }) {
  const hasReviewer = typeof reviewedBy === 'string' && reviewedBy.trim().length > 0;
  const hasDate = Boolean(reviewedAt);
  const hasSource = parseSources(sources || '').length > 0;

  if (status === 'Human Reviewed' && (!hasReviewer || !hasDate)) {
    return { ok: false, error: 'Human Reviewed requires a reviewer name and a review date.' };
  }
  if (status === 'Human Verified') {
    if (!hasReviewer || !hasDate || !hasSource) {
      return { ok: false, error: 'Human Verified requires a reviewer, a review date, and at least one source.' };
    }
    const list = Array.isArray(assessments) ? assessments : [];
    const allVerified = list.length > 0 && list.every((a) => a.status === 'verified');
    if (!allVerified) {
      return { ok: false, error: 'Human Verified requires every assessment for this course to be marked verified first.' };
    }
  }
  return { ok: true };
}

module.exports = {
  ASSESSMENT_STATUSES,
  REPORT_STATUSES,
  SOURCE_ROLES,
  isValidAssessmentStatus,
  isValidReportStatus,
  parseSources,
  formatSources,
  validateContentReviewUpdate,
};
