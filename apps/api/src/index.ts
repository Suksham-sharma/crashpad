import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { env } from './env';
import { sql, closeDb } from './db';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { meRoute } from './routes/me';

// Fast SELECT 1 so Better Uptime catches db outages, not just http outages. Never throws.
async function dbHealthy(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const app = new Elysia()
  .use(
    // Dashboard routes need credentials (the session cookie). The SDK ingest
    // routes use Authorization headers, which don't need credentials:true but
    // happily work under it too. For now we allow any origin in dev — we'll
    // tighten to the configured WEB_URL in prod once deploy is wired up.
    cors({
      origin: true,
      credentials: true,
    }),
  )
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
  .use(authRoutes)
  .use(meRoute)
  .use(projectRoutes)
  .listen(env.PORT);

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
