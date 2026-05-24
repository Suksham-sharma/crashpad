import { Elysia, sse, t } from 'elysia';
import { authGuard } from '../middleware/auth-guard';
import { getProjectForUser } from '../controllers/projects';
import { subscribeStream } from '../lib/pubsub';

export const streamRoutes = new Elysia({ prefix: '/api/v1' })
  .use(authGuard)
  .get(
    '/projects/:id/stream',
    async ({ user, params, set, request }) => {
      const project = await getProjectForUser(params.id, user.id);
      if (!project) {
        set.status = 404;
        return { error: 'not_found' };
      }
      // Disable buffering on nginx-style proxies (Fly.io etc).
      set.headers['X-Accel-Buffering'] = 'no';
      return projectEventStream(project.id, request.signal);
    },
    { params: t.Object({ id: t.String() }), auth: true },
  );

async function* projectEventStream(projectId: string, signal: AbortSignal) {
  // First flush so EventSource fires onopen even if no events arrive immediately.
  yield sse({ event: 'hello', data: {} });

  for await (const ev of subscribeStream(projectId, signal)) {
    if (ev.kind === 'heartbeat') {
      yield sse({ event: 'heartbeat', data: '' });
    } else {
      yield sse({ data: ev.msg });
    }
  }
}
