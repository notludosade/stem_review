const { neon } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = neon(process.env.DATABASE_URL);
  await sql`
    create table if not exists users (
      id serial primary key,
      email text unique not null,
      password_hash text not null,
      name text,
      created_at timestamptz not null default now()
    )
  `;
  // Site-owner QA flag: bypasses the login gate and every content gate
  // (proxy.ts), and reveals answers in tests/quizzes and FRQ sample
  // answers client-side. Baked into the session token at login time (see
  // pages/api/auth/login.js) rather than checked per-request against the
  // DB, so proxy.ts stays a single fast signature check.
  await sql`alter table users add column if not exists is_developer boolean not null default false`;
  // Server-side cost control for AI plan generation — checked fresh per
  // request in pages/api/generate-plan.js, not embedded in the session
  // token (a token could be stale for up to 30 days).
  await sql`alter table users add column if not exists last_plan_generated_at timestamptz`;
  // Google (and future OAuth providers') identity links — see
  // lib/oauth-google.js and pages/api/auth/google/callback.js. A row here
  // means "this provider account signs in as this STEM+ user"; the unique
  // constraint makes find-or-create race-safe for two concurrent callbacks
  // for the same Google account.
  await sql`
    create table if not exists oauth_accounts (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      provider text not null,
      provider_account_id text not null,
      created_at timestamptz not null default now(),
      unique (provider, provider_account_id)
    )
  `;
  // A Google-only user has no password to hash.
  await sql`alter table users alter column password_hash drop not null`;
  // Report a Problem (pages/api/report.js). Anyone can report, so rows keep
  // an HMAC of the IP for rate limiting, never the IP itself.
  await sql`
    create table if not exists reports (
      id serial primary key,
      created_at timestamptz not null default now(),
      page text not null,
      page_title text,
      course text,
      question_id text,
      category text not null,
      description text not null,
      user_id integer references users(id) on delete set null,
      ip_hash text not null,
      resolved_at timestamptz
    )
  `;
  // Content-trust system (2026-10-08): richer linkage + a real status
  // workflow (RECEIVED/UNDER_REVIEW/CONFIRMED/CORRECTED/CLOSED) replacing
  // the old binary resolved_at toggle. resolved_at is kept and still set
  // automatically (see pages/api/reports.js) so nothing that reads it needs
  // to change.
  await sql`alter table reports add column if not exists unit text`;
  await sql`alter table reports add column if not exists lesson text`;
  await sql`alter table reports add column if not exists status text not null default 'RECEIVED'`;
  // Developer-editable per-course review status (content/developer-panel.html,
  // pages/api/content-review.js). A course with no row defaults to
  // "AI Generated" — see lib/content-review.js for the full list of allowed
  // status values. reviewed_by/verified_against/sources are not written by
  // the panel yet (status-only for now) but exist so they can be set by hand
  // later without another migration.
  await sql`
    create table if not exists content_reviews (
      course text primary key,
      status text not null default 'AI Generated',
      reviewed_at timestamptz,
      reviewed_by text,
      verified_against text,
      sources text,
      updated_at timestamptz not null default now()
    )
  `;
  // Content-trust system (2026-10-08): framework/version/reviewer-role on
  // top of the existing status/reviewer/sources columns above.
  await sql`alter table content_reviews add column if not exists framework text`;
  await sql`alter table content_reviews add column if not exists framework_version text`;
  await sql`alter table content_reviews add column if not exists reviewer_role text`;

  // Per-assessment (unit test / course exam) verification tracking. Keyed by
  // a deterministic slug (course:unit:kind:version), not a DB-generated id,
  // so the seed script and the developer panel can both compute the same
  // key without a round trip. A course with no row here has never had any
  // of its assessments tracked — see lib/content-trust.js's
  // validateContentReviewUpdate for why that blocks Human Verified.
  await sql`
    create table if not exists assessment_verifications (
      assessment_id text primary key,
      course text not null,
      unit text,
      kind text not null,
      version text,
      status text not null default 'not-verified',
      questions_total integer not null default 0,
      questions_verified integer not null default 0,
      answer_checked boolean not null default false,
      explanation_checked boolean not null default false,
      wording_checked boolean not null default false,
      numeric_tolerance_checked boolean not null default false,
      symbolic_equivalence_checked boolean not null default false,
      diagram_checked boolean not null default false,
      curriculum_alignment_checked boolean not null default false,
      last_verified timestamptz,
      verified_by text,
      notes text,
      updated_at timestamptz not null default now()
    )
  `;

  // Public correction log (content/corrections.html). report_id is optional
  // — a correction can come from a review pass with no prior report.
  await sql`
    create table if not exists corrections (
      id serial primary key,
      created_at timestamptz not null default now(),
      course text not null,
      unit text,
      lesson text,
      question_ref text,
      category text not null,
      summary text not null,
      reason text,
      report_id integer references reports(id) on delete set null,
      corrected_by text
    )
  `;
  // Signed-in students' progress, synced across devices
  // (public/assets/progress-sync.js, pages/api/progress.js). Generic
  // key/value shape — `key` is one of the 6 localStorage key patterns
  // progress-sync.js's isSyncedKey() recognizes. Adding a 7th synced key
  // later needs no schema change, only extending that allowlist.
  await sql`
    create table if not exists progress_sync (
      user_id integer not null references users(id) on delete cascade,
      key text not null,
      value jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (user_id, key)
    )
  `;
  console.log('migrate: users, oauth_accounts, reports, content_reviews, progress_sync, assessment_verifications, and corrections tables ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
