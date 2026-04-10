import { Elysia, t } from 'elysia';
import { env } from '../env';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGitHubUser,
} from '../services/github';
import { upsertUserFromGitHub } from '../services/users';
import {
  dashboardJwt,
  AUTH_COOKIE_NAME,
  JWT_MAX_AGE_SECONDS,
} from '../services/jwt';

// CSRF-ish protection on the OAuth flow: we set a random `state` in a
// short-lived cookie before redirecting to GitHub, then verify it matches
// on the callback. Not a full CSRF token system, but enough to block the
// common attacks.
const OAUTH_STATE_COOKIE = 'crashpad_oauth_state';
const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .use(dashboardJwt)
  .get('/github', ({ cookie, redirect }) => {
    const state = randomState();
    cookie[OAUTH_STATE_COOKIE].set({
      value: state,
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: OAUTH_STATE_MAX_AGE,
      path: '/',
    });
    return redirect(buildAuthorizeUrl(state));
  })
  .get(
    '/github/callback',
    async ({ query, cookie, jwt, redirect, set }) => {
      const { code, state } = query;

      const storedState = cookie[OAUTH_STATE_COOKIE].value;
      if (!storedState || storedState !== state) {
        set.status = 400;
        return { error: 'invalid_state' };
      }
      cookie[OAUTH_STATE_COOKIE].remove();

      try {
        const accessToken = await exchangeCodeForToken(code);
        const profile = await fetchGitHubUser(accessToken);
        const user = await upsertUserFromGitHub(profile);

        const token = await jwt.sign({ sub: user.id, gh: user.githubId });

        cookie[AUTH_COOKIE_NAME].set({
          value: token,
          httpOnly: true,
          sameSite: 'lax',
          secure: env.NODE_ENV === 'production',
          maxAge: JWT_MAX_AGE_SECONDS,
          path: '/',
        });

        return redirect(`${env.WEB_URL}/dashboard`);
      } catch (err) {
        console.error('[auth/github/callback]', err);
        set.status = 500;
        return { error: 'oauth_failed' };
      }
    },
    {
      query: t.Object({
        code: t.String(),
        state: t.String(),
      }),
    },
  )
  .post('/logout', ({ cookie }) => {
    cookie[AUTH_COOKIE_NAME].remove();
    return { ok: true };
  });
