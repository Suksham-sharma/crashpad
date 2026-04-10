import { Elysia } from 'elysia';
import { requireAuth } from '../middleware/auth';

export const meRoute = new Elysia({ prefix: '/api/v1' })
  .use(requireAuth)
  .get('/me', ({ currentUser }) => ({
    user: {
      id: currentUser.id,
      githubId: currentUser.githubId,
      name: currentUser.name,
      email: currentUser.email,
      avatarUrl: currentUser.avatarUrl,
    },
  }));
