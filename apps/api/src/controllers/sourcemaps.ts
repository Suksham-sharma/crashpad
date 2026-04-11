import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { sourceMaps, type SourceMap } from '../db/schema';

export interface UploadSourceMapInput {
  release: string;
  filename: string;
  content: string;
}

export async function uploadSourceMap(
  projectId: string,
  input: UploadSourceMapInput,
): Promise<SourceMap> {
  const [row] = await db
    .insert(sourceMaps)
    .values({
      projectId,
      release: input.release,
      filename: input.filename,
      content: input.content,
    })
    .onConflictDoUpdate({
      target: [sourceMaps.projectId, sourceMaps.release, sourceMaps.filename],
      set: { content: input.content },
    })
    .returning();
  return row!;
}

export async function findSourceMap(
  projectId: string,
  release: string,
  filename: string,
): Promise<SourceMap | null> {
  const rows = await db
    .select()
    .from(sourceMaps)
    .where(
      and(
        eq(sourceMaps.projectId, projectId),
        eq(sourceMaps.release, release),
        eq(sourceMaps.filename, filename),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
