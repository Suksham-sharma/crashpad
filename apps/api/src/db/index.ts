import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill it in.',
  );
}

export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: process.env.NODE_ENV !== 'test',
});

export const db = drizzle(sql, { schema });

export type Database = typeof db;

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
