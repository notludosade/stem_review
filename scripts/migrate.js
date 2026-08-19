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
  console.log('migrate: users table ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
