import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, type User } from '../db/schema';
import type { GitHubUser } from './github';

// Upsert on every OAuth callback so renames and avatar swaps propagate.
export async function upsertUserFromGitHub(
  profile: GitHubUser,
): Promise<User> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.githubId, profile.id))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(users)
      .set({
        email: profile.email,
        name: profile.name ?? profile.login,
        avatarUrl: profile.avatar_url,
        updatedAt: new Date(),
      })
      .where(eq(users.githubId, profile.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(users)
    .values({
      githubId: profile.id,
      email: profile.email,
      name: profile.name ?? profile.login,
      avatarUrl: profile.avatar_url,
    })
    .returning();
  return created!;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}
