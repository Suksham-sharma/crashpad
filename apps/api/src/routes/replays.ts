import { Elysia } from 'elysia';
import { requireApiKey } from '../middleware/api-key';
import { ingestReplay } from '../controllers/replays';
import { ingestReplayBody } from '../schemas/replays';

export const replayRoutes = new Elysia({ prefix: '/api/v1/replays' })
  .use(requireApiKey)
  .post(
    '/',
    async ({ project, body, set }) => {
      const result = await ingestReplay(project.id, body);
      set.status = 202;
      return result;
    },
    { body: ingestReplayBody, parse: 'json' },
  );
