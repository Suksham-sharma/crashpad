import { Elysia } from 'elysia';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { projects, session, user } from '../db/schema';
import { env } from '../env';

export const devLoginEnabled = env.NODE_ENV !== 'production' && env.DEV_LOGIN;

const SESSION_COOKIE = 'better-auth.session_token';
const SESSION_TTL_DAYS = 30;

function randomId(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  );
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return encodeURIComponent(`${value}.${b64}`);
}

async function resolveDevUser() {
  if (env.DEV_LOGIN_EMAIL) {
    const [found] = await db
      .select()
      .from(user)
      .where(eq(user.email, env.DEV_LOGIN_EMAIL))
      .limit(1);
    if (found) return found;
  }

  const [withProject] = await db
    .select({ u: user })
    .from(projects)
    .innerJoin(user, eq(user.id, projects.userId))
    .orderBy(desc(projects.createdAt))
    .limit(1);
  if (withProject) return withProject.u;

  const [anyUser] = await db.select().from(user).limit(1);
  if (anyUser) return anyUser;

  const [created] = await db
    .insert(user)
    .values({
      id: randomId(16),
      name: 'Dev User',
      email: 'dev@crashpad.local',
      emailVerified: true,
    })
    .returning();
  return created!;
}

export const devRoutes = new Elysia({ prefix: '/api/v1/dev' }).get(
  '/login',
  async ({ set }) => {
    if (!devLoginEnabled) {
      set.status = 404;
      return { message: 'Not found' };
    }

    const target = await resolveDevUser();
    const token = randomId(32);
    const expiresAt = new Date(
      Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await db.insert(session).values({
      id: randomId(16),
      token,
      userId: target.id,
      expiresAt,
      ipAddress: '127.0.0.1',
      userAgent: 'crashpad-dev-login',
    });

    const signed = await signCookieValue(token, env.BETTER_AUTH_SECRET);
    const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;

    set.headers['set-cookie'] =
      `${SESSION_COOKIE}=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
    set.status = 302;
    set.headers['location'] = `${env.WEB_URL}/dashboard`;
    return null;
  },
);
