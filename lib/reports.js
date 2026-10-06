const crypto = require('crypto');
const CATEGORIES = require('./report-categories');

const LIMITS = { page: 300, pageTitle: 200, course: 100, questionId: 100 };
const MIN_DESCRIPTION = 5;
const MAX_DESCRIPTION = 2000;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Anyone can send a report (no sign-in), so everything is bounded here
// before it reaches the reports table.
function validateReport(body) {
  const input = body && typeof body === 'object' ? body : {};
  const report = {
    page: text(input.page),
    pageTitle: text(input.pageTitle) || null,
    course: text(input.course) || null,
    questionId: text(input.questionId) || null,
    category: text(input.category),
    description: text(input.description),
  };
  if (!/^\/(?!\/)/.test(report.page)) return { ok: false, error: 'Missing page.' };
  for (const [field, max] of Object.entries(LIMITS)) {
    if (report[field] && report[field].length > max) return { ok: false, error: `That ${field} is too long.` };
  }
  if (!CATEGORIES.includes(report.category)) return { ok: false, error: 'Choose a category.' };
  if (report.description.length < MIN_DESCRIPTION) return { ok: false, error: 'Describe the problem in a few words.' };
  if (report.description.length > MAX_DESCRIPTION) return { ok: false, error: `Keep the description under ${MAX_DESCRIPTION} characters.` };
  return { ok: true, report };
}

// Rate limiting needs a stable per-visitor key, but the raw IP is never stored.
function hashIp(ip, secret) {
  return crypto.createHmac('sha256', secret).update(String(ip)).digest('hex');
}

module.exports = { CATEGORIES, validateReport, hashIp };
