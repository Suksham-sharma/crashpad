import { Elysia } from 'elysia';
import { authGuard } from '../middleware/auth-guard';
import {
  createProject,
  deleteProjectForUser,
  getProjectForUser,
  listProjectsForUser,
  regenerateApiKeyForUser,
  updateProjectForUser,
} from '../controllers/projects';
import {
  createProjectBody,
  projectIdParams,
  updateProjectBody,
} from '../schemas/projects';

export const projectRoutes = new Elysia({ prefix: '/api/v1/projects' })
  .use(authGuard)
  .get(
    '/',
    async ({ user }) => {
      const rows = await listProjectsForUser(user.id);
      return { projects: rows };
    },
    { auth: true },
  )
  .post(
    '/',
    async ({ user, body }) => {
      const project = await createProject(user.id, body.name);
      return { project };
    },
    { body: createProjectBody, auth: true },
  )
  .get(
    '/:id',
    async ({ user, params, set }) => {
      const project = await getProjectForUser(params.id, user.id);
      if (!project) {
        set.status = 404;
        return { error: 'not_found' };
      }
      return { project };
    },
    { params: projectIdParams, auth: true },
  )
  .patch(
    '/:id',
    async ({ user, params, body, set }) => {
      const updated = await updateProjectForUser(params.id, user.id, body);
      if (!updated) {
        set.status = 404;
        return { error: 'not_found' };
      }
      return { project: updated };
    },
    {
      params: projectIdParams,
      body: updateProjectBody,
      auth: true,
    },
  )
  .post(
    '/:id/regenerate-key',
    async ({ user, params, set }) => {
      const updated = await regenerateApiKeyForUser(params.id, user.id);
      if (!updated) {
        set.status = 404;
        return { error: 'not_found' };
      }
      return { project: updated };
    },
    { params: projectIdParams, auth: true },
  )
  .delete(
    '/:id',
    async ({ user, params, set }) => {
      const ok = await deleteProjectForUser(params.id, user.id);
      if (!ok) {
        set.status = 404;
        return { error: 'not_found' };
      }
      return { ok: true };
    },
    { params: projectIdParams, auth: true },
  );
