import { Elysia } from 'elysia';
import { dashboardJwt, AUTH_COOKIE_NAME } from '../services/jwt';
import { getUserById } from '../services/users';
import type { User } from '../db/schema';

// 401 on missing/malformed cookie OR on a valid token pointing at a deleted user.
export const requireAuth = new Elysia({ name: 'require-auth' })
  .use(dashboardJwt)
  .derive({ as: 'scoped' }, async ({ cookie, jwt, set }) => {
    const rawToken = cookie[AUTH_COOKIE_NAME].value;
    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      set.status = 401;
      throw new Error('unauthenticated');
    }

    const payload = await jwt.verify(rawToken);
    if (!payload || typeof payload.sub !== 'string') {
      set.status = 401;
      throw new Error('invalid_token');
    }

    const user = await getUserById(payload.sub);
    if (!user) {
      set.status = 401;
      throw new Error('user_not_found');
    }

    return { currentUser: user as User };
  });
