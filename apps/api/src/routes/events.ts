import { Elysia } from 'elysia';
import { requireApiKey } from '../middleware/api-key';
import { ingestEvent } from '../controllers/events';
import { ingestEventBody } from '../schemas/events';

export const eventRoutes = new Elysia({ prefix: '/api/v1/events' })
  .use(requireApiKey)
  .post(
    '/',
    async ({ project, body, set }) => {
      const result = await ingestEvent(project.id, body);
      set.status = 202;
      return result;
    },
    { body: ingestEventBody },
  );
