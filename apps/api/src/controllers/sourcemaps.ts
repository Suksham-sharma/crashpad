import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../db';
import { events, sourceMaps, type SourceMap } from '../db/schema';
import { resolveStack } from '../services/sourcemap-resolver';

export interface UploadSourceMapInput {
  release: string;
  filename: string;
  content: string;
}

// Cap the catch-up scan per upload so a long-quiet release doesn't pin the
// event loop. Realistic dogfood scale won't touch this; raise if it bites.
const DEFERRED_RESOLVE_LIMIT = 500;

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

  // Fire-and-forget: don't slow the CLI upload. Any error stays local.
  void resolveDeferredEvents(projectId, input.release).catch((err) => {
    console.warn('[sourcemaps] deferred resolve failed', {
      projectId,
      release: input.release,
      error: err instanceof Error ? err.message : String(err),
    });
  });

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

/**
 * Re-resolve previously-unresolved events for a release after new source maps
 * arrive. No-op for events that already have `resolvedFrames`, and only
 * writes back when resolution actually produced at least one mapped frame —
 * so a wrong-release upload won't lock in an all-null result and block a
 * later corrected upload from helping.
 *
 * Query is unindexed on (project_id, release); at dogfood scale the existing
 * (project_id, timestamp) index plus the `release` filter is fine. Revisit
 * if profiling shows the scan as hot.
 */
async function resolveDeferredEvents(
  projectId: string,
  release: string,
): Promise<void> {
  const candidates = await db
    .select({ id: events.id, stackTrace: events.stackTrace })
    .from(events)
    .where(
      and(
        eq(events.projectId, projectId),
        eq(events.release, release),
        isNotNull(events.stackTrace),
        isNull(events.resolvedFrames),
      ),
    )
    .limit(DEFERRED_RESOLVE_LIMIT + 1);

  if (candidates.length === 0) return;

  const cappedHit = candidates.length > DEFERRED_RESOLVE_LIMIT;
  const work = cappedHit
    ? candidates.slice(0, DEFERRED_RESOLVE_LIMIT)
    : candidates;

  let updated = 0;
  for (const ev of work) {
    if (!ev.stackTrace) continue;
    try {
      const resolved = await resolveStack(ev.stackTrace, projectId, release);
      if (!resolved) continue;
      const helped = resolved.some(
        (f) => f.function != null || f.file != null,
      );
      if (!helped) continue;
      await db
        .update(events)
        .set({ resolvedFrames: resolved })
        .where(eq(events.id, ev.id));
      updated++;
    } catch (err) {
      console.warn('[sourcemaps] failed to re-resolve event', {
        eventId: ev.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log('[sourcemaps] deferred resolve', {
    projectId,
    release,
    scanned: work.length,
    updated,
    cappedAt: cappedHit ? DEFERRED_RESOLVE_LIMIT : null,
  });
}
