import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill it in.',
  );
  process.exit(1);
}

async function main() {
  console.log('[migrate] connecting to postgres...');
  const sql = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(sql);

  // pgcrypto is required for gen_random_uuid() which Drizzle's defaultRandom() emits.
  console.log('[migrate] ensuring pgcrypto extension...');
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  console.log('[migrate] applying migrations from ./drizzle/...');
  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('[migrate] done');
  await sql.end();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
