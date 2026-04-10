import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';

const PORT = Number(process.env.API_PORT ?? 4000);

const app = new Elysia()
  .use(cors())
  .get('/health', () => ({
    status: 'ok',
    service: 'crashpad-api',
    version: '0.0.1',
    timestamp: new Date().toISOString(),
  }))
  .get('/', () => ({
    name: 'crashpad-api',
    docs: 'https://github.com/suksham/crashpad',
  }))
  .listen(PORT);

console.log(
  `crashpad-api listening at http://${app.server?.hostname}:${app.server?.port}`,
);
