const { getDb } = require('../../lib/db');
const { verify } = require('../../lib/session');
const { isValidAssessmentStatus } = require('../../lib/content-trust');
const catalog = require('../../public/assets/skill-catalog.json');

const KNOWN_COURSES = new Set(catalog.skills.map((skill) => skill.course));
const CHECKLIST_FIELDS = [
  'answerChecked', 'explanationChecked', 'wordingChecked', 'numericToleranceChecked',
  'symbolicEquivalenceChecked', 'diagramChecked', 'curriculumAlignmentChecked',
];

function toAssessment(row) {
  return {
    assessmentId: row.assessment_id,
    course: row.course,
    unit: row.unit || undefined,
    kind: row.kind,
    version: row.version || undefined,
    status: row.status,
    questionsTotal: row.questions_total,
    questionsVerified: row.questions_verified,
    checklist: {
      answerChecked: row.answer_checked,
      explanationChecked: row.explanation_checked,
      wordingChecked: row.wording_checked,
      numericToleranceChecked: row.numeric_tolerance_checked,
      symbolicEquivalenceChecked: row.symbolic_equivalence_checked,
      diagramChecked: row.diagram_checked,
      curriculumAlignmentChecked: row.curriculum_alignment_checked,
    },
    lastVerified: row.last_verified || undefined,
    verifiedBy: row.verified_by || undefined,
    notes: row.notes || undefined,
  };
}

// Public read (course trust panel / review details), developer-only write
// (public/assets/assessment-review-panel.js on content/developer-panel.html).
module.exports = async (req, res) => {
  try {
    const sql = getDb();

    if (req.method === 'GET') {
      const course = typeof req.query?.course === 'string' ? req.query.course : null;
      const rows = course
        ? await sql`select * from assessment_verifications where course = ${course} order by unit, kind, version`
        : await sql`select * from assessment_verifications order by course, unit, kind, version`;
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      res.statusCode = 200;
      return res.json(rows.map(toAssessment));
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.json({ error: 'GET or POST only' });
    }

    const session = verify(req.cookies?.session, process.env.SESSION_SECRET);
    if (!session || !session.isDeveloper) {
      res.statusCode = 403;
      return res.json({ error: 'developer accounts only' });
    }

    const body = req.body || {};
    const assessmentId = typeof body.assessmentId === 'string' ? body.assessmentId.trim() : '';
    const course = typeof body.course === 'string' ? body.course.trim() : '';
    const unit = typeof body.unit === 'string' ? body.unit.trim() || null : null;
    const kind = body.kind === 'unit_test' || body.kind === 'course_exam' ? body.kind : null;
    const version = typeof body.version === 'string' ? body.version.trim() || null : null;
    const status = body.status;
    const questionsTotal = Number.isInteger(body.questionsTotal) ? body.questionsTotal : 0;
    const questionsVerified = Number.isInteger(body.questionsVerified) ? body.questionsVerified : 0;
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    const verifiedBy = typeof body.verifiedBy === 'string' ? body.verifiedBy.trim() || null : null;
    const checklist = body.checklist && typeof body.checklist === 'object' ? body.checklist : {};

    if (!assessmentId || !KNOWN_COURSES.has(course) || !kind || !isValidAssessmentStatus(status)) {
      res.statusCode = 400;
      return res.json({ error: 'assessmentId, a known course, kind, and a valid status are required' });
    }
    if (questionsTotal < 0 || questionsVerified < 0 || questionsVerified > questionsTotal) {
      res.statusCode = 400;
      return res.json({ error: 'questionsVerified cannot exceed questionsTotal' });
    }

    const flags = CHECKLIST_FIELDS.map((field) => Boolean(checklist[field]));
    const lastVerified = status === 'verified' ? new Date() : null;

    await sql`
      insert into assessment_verifications (
        assessment_id, course, unit, kind, version, status, questions_total, questions_verified,
        answer_checked, explanation_checked, wording_checked, numeric_tolerance_checked,
        symbolic_equivalence_checked, diagram_checked, curriculum_alignment_checked,
        last_verified, verified_by, notes, updated_at
      ) values (
        ${assessmentId}, ${course}, ${unit}, ${kind}, ${version}, ${status}, ${questionsTotal}, ${questionsVerified},
        ${flags[0]}, ${flags[1]}, ${flags[2]}, ${flags[3]}, ${flags[4]}, ${flags[5]}, ${flags[6]},
        ${lastVerified}, ${verifiedBy}, ${notes}, now()
      )
      on conflict (assessment_id) do update set
        course = excluded.course, unit = excluded.unit, kind = excluded.kind, version = excluded.version,
        status = excluded.status, questions_total = excluded.questions_total, questions_verified = excluded.questions_verified,
        answer_checked = excluded.answer_checked, explanation_checked = excluded.explanation_checked,
        wording_checked = excluded.wording_checked, numeric_tolerance_checked = excluded.numeric_tolerance_checked,
        symbolic_equivalence_checked = excluded.symbolic_equivalence_checked, diagram_checked = excluded.diagram_checked,
        curriculum_alignment_checked = excluded.curriculum_alignment_checked,
        last_verified = excluded.last_verified, verified_by = excluded.verified_by, notes = excluded.notes, updated_at = now()
    `;
    res.statusCode = 200;
    return res.json({ ok: true });
  } catch (err) {
    console.error('assessment-verification endpoint failed', err);
    res.statusCode = 500;
    return res.json({ error: 'Could not load or save assessment verification.' });
  }
};
