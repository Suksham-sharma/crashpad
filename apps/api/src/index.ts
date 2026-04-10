import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { sql, closeDb } from './db';

const PORT = Number(process.env.API_PORT ?? 4000);

async function dbHealthy(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const app = new Elysia()
  .use(cors())
  .get('/health', async ({ set }) => {
    const db = await dbHealthy();
    if (!db) {
      set.status = 503;
      return {
        status: 'degraded',
        service: 'crashpad-api',
        version: '0.0.1',
        db: 'down',
        timestamp: new Date().toISOString(),
      };
    }
    return {
      status: 'ok',
      service: 'crashpad-api',
      version: '0.0.1',
      db: 'up',
      timestamp: new Date().toISOString(),
    };
  })
  .get('/', () => ({
    name: 'crashpad-api',
    docs: 'https://github.com/suksham/crashpad',
  }))
  .listen(PORT);

console.log(
  `crashpad-api listening at http://${app.server?.hostname}:${app.server?.port}`,
);

const shutdown = async (signal: string) => {
  console.log(`\n[${signal}] shutting down gracefully...`);
  try {
    await app.stop();
    await closeDb();
    console.log('[shutdown] done');
    process.exit(0);
  } catch (err) {
    console.error('[shutdown] failed:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
