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
  console.log('migrate: users table ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
