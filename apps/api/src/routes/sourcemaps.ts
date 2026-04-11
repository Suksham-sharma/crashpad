import { Elysia } from 'elysia';
import { requireApiKey } from '../middleware/api-key';
import { uploadSourceMap } from '../controllers/sourcemaps';
import { uploadSourceMapBody } from '../schemas/sourcemaps';

export const sourceMapRoutes = new Elysia({ prefix: '/api/v1/sourcemaps' })
  .use(requireApiKey)
  .post(
    '/',
    async ({ project, body, set }) => {
      const row = await uploadSourceMap(project.id, body);
      set.status = 201;
      return { id: row.id, release: row.release, filename: row.filename };
    },
    { body: uploadSourceMapBody },
  );
