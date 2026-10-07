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
  console.log('migrate: users, reports, and content_reviews tables ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
