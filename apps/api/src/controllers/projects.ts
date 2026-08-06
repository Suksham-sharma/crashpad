import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { projects, type Project } from '../db/schema';

const API_KEY_PREFIX = 'cp_';

function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return `${API_KEY_PREFIX}${hex}`;
}

export async function createProject(
  userId: string,
  name: string,
): Promise<Project> {
  const apiKey = generateApiKey();
  const [created] = await db
    .insert(projects)
    .values({ userId, name: name.trim(), apiKey })
    .returning();
  return created!;
}

export async function listProjectsForUser(userId: string): Promise<Project[]> {
  return db.select().from(projects).where(eq(projects.userId, userId));
}

export async function getProjectForUser(
  id: string,
  userId: string,
): Promise<Project | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteProjectForUser(
  id: string,
  userId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  return deleted.length > 0;
}

export async function updateProjectForUser(
  id: string,
  userId: string,
  patch: { name: string },
): Promise<Project | null> {
  const [updated] = await db
    .update(projects)
    .set({ name: patch.name.trim(), updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function regenerateApiKeyForUser(
  id: string,
  userId: string,
): Promise<Project | null> {
  const apiKey = generateApiKey();
  const [updated] = await db
    .update(projects)
    .set({ apiKey, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function findProjectByApiKey(
  apiKey: string,
): Promise<Project | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.apiKey, apiKey))
    .limit(1);
  return rows[0] ?? null;
}
