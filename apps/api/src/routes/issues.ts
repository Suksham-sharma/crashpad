import { Elysia } from 'elysia';
import { authGuard } from '../middleware/auth-guard';
import { getProjectForUser } from '../controllers/projects';
import {
  listIssuesForProject,
  getIssueDetail,
  updateIssueStatus,
} from '../controllers/issues';
import {
  projectIssuesParams,
  listIssuesQuery,
  issueIdParams,
  updateIssueBody,
} from '../schemas/issues';

export const issueRoutes = new Elysia({ prefix: '/api/v1' })
  .use(authGuard)
  .get(
    '/projects/:id/issues',
    async ({ user, params, query, set }) => {
      const project = await getProjectForUser(params.id, user.id);
      if (!project) {
        set.status = 404;
        return { error: 'not_found' };
      }

      return listIssuesForProject(project.id, {
        page: query.page ?? 1,
        limit: query.limit ?? 25,
        status: query.status,
        kind: query.kind,
        sort: query.sort ?? 'last_seen',
        q: query.q,
        since: query.since,
      });
    },
    { params: projectIssuesParams, query: listIssuesQuery, auth: true },
  )
  .get(
    '/issues/:id',
    async ({ user, params, set }) => {
      const result = await getIssueDetail(params.id, user.id);
      if (!result) {
        set.status = 404;
        return { error: 'not_found' };
      }
      return result;
    },
    { params: issueIdParams, auth: true },
  )
  .patch(
    '/issues/:id',
    async ({ user, params, body, set }) => {
      const updated = await updateIssueStatus(params.id, user.id, body.status);
      if (!updated) {
        set.status = 404;
        return { error: 'not_found' };
      }
      return { issue: updated };
    },
    { params: issueIdParams, body: updateIssueBody, auth: true },
  );
