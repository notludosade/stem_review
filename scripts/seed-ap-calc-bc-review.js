// One-off seed for the AP Calculus BC pilot (content-trust system,
// 2026-10-08 spec). Inserts real, mechanically-counted assessment rows
// (10 units x versions A/B x 10 questions, course exam x 20 questions —
// counted directly from content/AP STEM+/AP_CALC/**/*.html's
// data-test-item attributes) and the course's target framework.
//
// It does NOT set status to Human Reviewed or Human Verified — only a real
// human reviewer does that, through the developer panel, after actually
// reviewing. Safe to re-run: the on-conflict clauses never touch status,
// reviewed_by, or reviewed_at, so a later human edit is never clobbered by
// re-running this script.
const { getDb } = require('../lib/db');

const COURSE = 'AP Calculus BC';
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6', 'Unit 7', 'Unit 8', 'Unit 9', 'Unit 10'];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  const sql = getDb();

  await sql`
    insert into content_reviews (course, status, reviewed_at, framework, framework_version, updated_at)
    values (${COURSE}, 'AI Generated', now(), 'College Board AP Calculus BC Course and Exam Description', '2026', now())
    on conflict (course) do update set
      framework = excluded.framework,
      framework_version = excluded.framework_version,
      updated_at = now()
  `;

  const assessments = [];
  UNITS.forEach((unit) => {
    ['A', 'B'].forEach((version) => {
      assessments.push({
        assessmentId: `${slug(COURSE)}:${slug(unit)}:unit_test:${version.toLowerCase()}`,
        unit, kind: 'unit_test', version, questionsTotal: 10,
      });
    });
  });
  assessments.push({ assessmentId: `${slug(COURSE)}:course_exam`, unit: null, kind: 'course_exam', version: null, questionsTotal: 20 });

  for (const a of assessments) {
    await sql`
      insert into assessment_verifications (assessment_id, course, unit, kind, version, status, questions_total, questions_verified, updated_at)
      values (${a.assessmentId}, ${COURSE}, ${a.unit}, ${a.kind}, ${a.version}, 'not-verified', ${a.questionsTotal}, 0, now())
      on conflict (assessment_id) do update set
        questions_total = excluded.questions_total,
        updated_at = now()
    `;
  }

  console.log(`seed-ap-calc-bc-review: content_reviews framework set, ${assessments.length} assessment rows upserted (0 verified — honest default)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
