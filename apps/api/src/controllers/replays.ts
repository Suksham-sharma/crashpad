import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  events,
  replays,
  type RrwebEventStream,
  type EventMetadata,
  type SessionEvent,
} from '../db/schema';
import { publish } from '../lib/pubsub';

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

const RRWEB_FULL_SNAPSHOT = 2;
const RRWEB_INCREMENTAL = 3;
const RRWEB_META = 4;

const SOURCE_MOUSE_INTERACTION = 2;
const SOURCE_INPUT = 5;

const CLICK_INTERACTIONS = new Set([2, 4, 7]);

interface MaybeRrwebEvent {
  type?: unknown;
  timestamp?: unknown;
  data?: { source?: unknown; type?: unknown };
}

function timestampOf(ev: unknown): number | null {
  if (!ev || typeof ev !== 'object') return null;
  const ts = (ev as MaybeRrwebEvent).timestamp;
  return typeof ts === 'number' ? ts : null;
}

function isTimelineMarker(ev: unknown): boolean {
  const e = ev as MaybeRrwebEvent;
  if (e.type === RRWEB_META || e.type === RRWEB_FULL_SNAPSHOT) return true;
  if (e.type !== RRWEB_INCREMENTAL) return false;
  const source = e.data?.source;
  if (source === SOURCE_INPUT) return true;
  if (source !== SOURCE_MOUSE_INTERACTION) return false;
  return CLICK_INTERACTIONS.has(e.data?.type as number);
}

function computeTimelineMarkers(
  stream: RrwebEventStream,
  errorTimestamp: number,
): TimelineMarkers {
  let bufferStartTimestamp: number | null = null;
  const markerTimestamps: number[] = [];

  for (const ev of stream) {
    const ts = timestampOf(ev);
    if (ts === null) continue;
    if (bufferStartTimestamp === null || ts < bufferStartTimestamp) {
      bufferStartTimestamp = ts;
    }
    if (isTimelineMarker(ev)) markerTimestamps.push(ts);
  }

  const origin = bufferStartTimestamp ?? errorTimestamp;
  const eventOffsets = markerTimestamps
    .map((t) => t - origin)
    .sort((a, b) => a - b);

  return {
    errorTimestamp,
    bufferStartTimestamp: origin,
    eventOffsets,
  };
}

export async function ingestReplay(
  projectId: string,
  input: IngestReplayInput,
): Promise<IngestReplayResult> {
  const markers = computeTimelineMarkers(input.rrwebData, input.errorTimestamp);

  const result = await db.transaction(async (tx) => {
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

  publish({
    type: 'replay:upsert',
    projectId,
    correlationId: input.correlationId,
  });

  return result;
}
