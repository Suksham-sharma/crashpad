import { sql } from 'drizzle-orm';
import { db } from '../db';
import {
  events,
  issues,
  type EventMetadata,
  type Event,
  type Issue,
  type ResolvedFrame,
  type SignalDetail,
} from '../db/schema';
import { computeFingerprint } from './fingerprint';
import { resolveStack } from '../services/sourcemap-resolver';
import { publish } from '../lib/pubsub';

export interface IngestEventInput {
  correlationId: string;
  timestamp: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string | null;
  signal?: SignalDetail;
  release?: string | null;
  environment?: string | null;
  metadata: EventMetadata;
}

export interface IngestEventResult {
  eventId: string;
  issueId: string;
  fingerprint: string;
}

const TITLE_MAX = 200;

function buildTitle(input: IngestEventInput): string {
  const raw = input.signal
    ? input.errorMessage
    : input.errorMessage
      ? `${input.errorType}: ${input.errorMessage}`
      : input.errorType;
  return raw.length > TITLE_MAX ? raw.slice(0, TITLE_MAX - 1) + '…' : raw;
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

function fingerprintOf(input: IngestEventInput): string {
  if (input.signal) {
    return computeFingerprint({
      errorType: input.errorType,
      errorMessage: `${input.signal.selector} ${pathnameOf(input.metadata.url)}`,
      stackTrace: null,
    });
  }
  return computeFingerprint(input);
}

export async function ingestEvent(
  projectId: string,
  input: IngestEventInput,
): Promise<IngestEventResult> {
  const fingerprint = fingerprintOf(input);
  const title = buildTitle(input);

  let resolvedFrames: ResolvedFrame[] | null = null;
  if (input.release && input.stackTrace) {
    try {
      resolvedFrames = await resolveStack(
        input.stackTrace,
        projectId,
        input.release,
      );
    } catch (err) {
      console.warn('[ingest] resolveStack threw', {
        projectId,
        release: input.release,
        error: err instanceof Error ? err.message : String(err),
      });
      resolvedFrames = null;
    }
  }

  const result = await db.transaction(async (tx) => {
    const [issue] = await tx
      .insert(issues)
      .values({
        projectId,
        fingerprint,
        title,
        kind: input.signal ? 'signal' : 'error',
      })
      .onConflictDoUpdate({
        target: [issues.projectId, issues.fingerprint],
        set: {
          lastSeen: sql`now()`,
          eventCount: sql`${issues.eventCount} + 1`,
        },
      })
      .returning({ id: issues.id });

    const [event] = await tx
      .insert(events)
      .values({
        projectId,
        issueId: issue!.id,
        correlationId: input.correlationId,
        timestamp: new Date(input.timestamp),
        errorType: input.errorType,
        errorMessage: input.errorMessage,
        stackTrace: input.stackTrace ?? null,
        signal: input.signal ?? null,
        release: input.release ?? null,
        environment: input.environment ?? null,
        resolvedFrames,
        metadata: input.metadata,
      })
      .returning({ id: events.id });

    return { eventId: event!.id, issueId: issue!.id, fingerprint };
  });

  publish({
    type: 'issue:upsert',
    projectId,
    issueId: result.issueId,
    fingerprint: result.fingerprint,
  });

  return result;
}

export type { Event, Issue };
