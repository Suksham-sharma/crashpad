import { Elysia } from 'elysia';
import { env } from './env';
import { sql, closeDb } from './db';
import { auth } from './auth';
import { corsMiddleware } from './middleware/cors';
import { projectRoutes } from './routes/projects';
import { meRoute } from './routes/me';
import { eventRoutes } from './routes/events';
import { replayRoutes } from './routes/replays';
import { sourceMapRoutes } from './routes/sourcemaps';
import { issueRoutes } from './routes/issues';
import { streamRoutes } from './routes/stream';
import { briefDeliveryRoutes, fixRoutes } from './routes/fix';
import { sweepStuckFixRuns } from './controllers/fix';

async function dbHealthy(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const app = new Elysia({
  serve: { maxRequestBodySize: 25 * 1024 * 1024 },
})
  .use(corsMiddleware)
  .mount(auth.handler)
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
  .use(meRoute)
  .use(projectRoutes)
  .use(eventRoutes)
  .use(replayRoutes)
  .use(sourceMapRoutes)
  .use(issueRoutes)
  .use(streamRoutes)
  .use(fixRoutes)
  .use(briefDeliveryRoutes)
  .listen(env.PORT);

console.log(
  `crashpad-api listening at http://${app.server?.hostname}:${app.server?.port}`,
);

sweepStuckFixRuns()
  .then((n) => {
    if (n > 0)
      console.log(`[fix] swept ${n} orphaned run(s) left by a restart`);
  })
  .catch((err) => console.error('[fix] sweep failed:', err));

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
