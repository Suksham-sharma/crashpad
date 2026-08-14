import { Elysia } from 'elysia';
import { env } from '../env';

const INGEST = /^\/api\/v1\/(events|replays|sourcemaps)(\/|$)/;

export const corsMiddleware = new Elysia({ name: 'crashpad-cors' }).onRequest(
  ({ request, set }) => {
    const origin = request.headers.get('origin');
    if (origin) {
      const isIngest = INGEST.test(new URL(request.url).pathname);
      if (isIngest || origin === env.WEB_URL) {
        set.headers['Access-Control-Allow-Origin'] = origin;
        set.headers['Vary'] = 'Origin';
        set.headers['Access-Control-Allow-Headers'] =
          'Content-Type, Authorization';
        set.headers['Access-Control-Max-Age'] = '600';
        if (isIngest) {
          set.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
        } else {
          set.headers['Access-Control-Allow-Credentials'] = 'true';
          set.headers['Access-Control-Allow-Methods'] =
            'GET, POST, PATCH, DELETE, OPTIONS';
        }
      }
    }
    if (request.method === 'OPTIONS') {
      set.status = 204;
      return '';
    }
  },
);
