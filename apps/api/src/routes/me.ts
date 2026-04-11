import { Elysia } from 'elysia';
import { authGuard } from '../middleware/auth-guard';

export const meRoute = new Elysia({ prefix: '/api/v1' })
  .use(authGuard)
  .get('/me', ({ user }) => ({ user }), { auth: true });
