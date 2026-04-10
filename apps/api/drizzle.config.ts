// drizzle-kit config. Used only for schema diffing and migration generation.
// The runtime connection pool lives in src/db/index.ts.
import { defineConfig } from 'drizzle-kit';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://crashpad:crashpad_dev@localhost:5432/crashpad';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
