import { jwt } from '@elysiajs/jwt';
import { env } from '../env';

// Keep the payload small — every authenticated request decodes it.
export interface DashboardJwt {
  sub: string;
  gh: number;
  exp?: number;
  iat?: number;
}

// 7 days: long enough to avoid nag, short enough that a leaked token dies fast.
export const JWT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const dashboardJwt = jwt({
  name: 'jwt',
  secret: env.JWT_SECRET,
  exp: `${JWT_MAX_AGE_SECONDS}s`,
});

export const AUTH_COOKIE_NAME = 'crashpad_session';
