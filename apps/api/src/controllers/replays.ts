import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  events,
  replays,
  type RrwebEventStream,
  type EventMetadata,
  type SessionEvent,
} from '../db/schema';

export interface IngestReplayInput {
  correlationId: string;
  errorTimestamp: number;
  durationMs: number;
  rrwebData: RrwebEventStream;
  sessionEvents?: SessionEvent[];
}

export interface IngestReplayResult {
  replayId: string;
  eventsLinked: number;
}

interface TimelineMarkers {
  errorTimestamp: number;
  bufferStartTimestamp: number;
  eventOffsets: number[];
}

function computeTimelineMarkers(
  stream: RrwebEventStream,
  errorTimestamp: number,
): TimelineMarkers {
  const timestamps: number[] = [];
  for (const ev of stream) {
    if (
      ev &&
      typeof ev === 'object' &&
      'timestamp' in ev &&
      typeof (ev as { timestamp: unknown }).timestamp === 'number'
    ) {
      timestamps.push((ev as { timestamp: number }).timestamp);
    }
  }
  const bufferStartTimestamp = timestamps[0] ?? errorTimestamp;
  const eventOffsets = timestamps.map((t) => t - bufferStartTimestamp);
  return { errorTimestamp, bufferStartTimestamp, eventOffsets };
}

export async function ingestReplay(
  projectId: string,
  input: IngestReplayInput,
): Promise<IngestReplayResult> {
  const markers = computeTimelineMarkers(input.rrwebData, input.errorTimestamp);

  return db.transaction(async (tx) => {
    const [replay] = await tx
      .insert(replays)
      .values({
        projectId,
        correlationId: input.correlationId,
        rrwebData: input.rrwebData,
        durationMs: input.durationMs,
        sessionEvents: input.sessionEvents ?? [],
      })
      .returning({ id: replays.id });

    const updated = await tx
      .update(events)
      .set({
        metadata: sql`${events.metadata} || ${JSON.stringify({
          timelineMarkers: markers,
        } satisfies Partial<EventMetadata>)}::jsonb`,
      })
      .where(
        and(
          eq(events.projectId, projectId),
          eq(events.correlationId, input.correlationId),
        ),
      )
      .returning({ id: events.id });

    return { replayId: replay!.id, eventsLinked: updated.length };
  });
}
