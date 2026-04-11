import { sql } from 'drizzle-orm';
import { db } from '../db';
import {
  events,
  issues,
  type EventMetadata,
  type Event,
  type Issue,
} from '../db/schema';
import { computeFingerprint } from './fingerprint';

export interface IngestEventInput {
  correlationId: string;
  timestamp: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string | null;
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

function buildTitle(errorType: string, errorMessage: string): string {
  const raw = errorMessage ? `${errorType}: ${errorMessage}` : errorType;
  return raw.length > TITLE_MAX ? raw.slice(0, TITLE_MAX - 1) + '…' : raw;
}

export async function ingestEvent(
  projectId: string,
  input: IngestEventInput,
): Promise<IngestEventResult> {
  const fingerprint = computeFingerprint(input);
  const title = buildTitle(input.errorType, input.errorMessage);

  return db.transaction(async (tx) => {
    const [issue] = await tx
      .insert(issues)
      .values({ projectId, fingerprint, title })
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
        release: input.release ?? null,
        environment: input.environment ?? null,
        metadata: input.metadata,
      })
      .returning({ id: events.id });

    return { eventId: event!.id, issueId: issue!.id, fingerprint };
  });
}

export type { Event, Issue };
