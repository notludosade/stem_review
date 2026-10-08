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
  console.log('migrate: users, oauth_accounts, reports, content_reviews, and progress_sync tables ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
