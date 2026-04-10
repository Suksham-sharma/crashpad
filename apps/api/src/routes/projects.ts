import { Elysia, t } from 'elysia';
import { requireAuth } from '../middleware/auth';
import {
  createProject,
  deleteProjectForUser,
  getProjectForUser,
  listProjectsForUser,
} from '../services/projects';

export const projectRoutes = new Elysia({ prefix: '/api/v1/projects' })
  .use(requireAuth)
  .get('/', async ({ currentUser }) => {
    const rows = await listProjectsForUser(currentUser.id);
    return { projects: rows };
  })
  .post(
    '/',
    async ({ currentUser, body }) => {
      const project = await createProject(currentUser.id, body.name);
      return { project };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
      }),
    },
  )
  .get(
    '/:id',
    async ({ currentUser, params, set }) => {
      const project = await getProjectForUser(params.id, currentUser.id);
      if (!project) {
        set.status = 404;
        return { error: 'not_found' };
      }
      return { project };
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )
  .delete(
    '/:id',
    async ({ currentUser, params, set }) => {
      const ok = await deleteProjectForUser(params.id, currentUser.id);
      if (!ok) {
        set.status = 404;
        return { error: 'not_found' };
      }
      return { ok: true };
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  );
