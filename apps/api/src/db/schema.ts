import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  bigint,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: bigint('github_id', { mode: 'number' }).notNull(),
  email: text('email'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex('users_github_id_unique').on(table.githubId),
]);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  apiKey: text('api_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex('projects_api_key_unique').on(table.apiKey),
  index('projects_user_id_idx').on(table.userId),
]);

export const issueStatus = ['open', 'resolved', 'ignored'] as const;
export type IssueStatus = (typeof issueStatus)[number];

export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  fingerprint: text('fingerprint').notNull(),
  title: text('title').notNull(),
  status: text('status', { enum: issueStatus }).notNull().default('open'),
  firstSeen: timestamp('first_seen', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true })
    .notNull()
    .defaultNow(),
  eventCount: integer('event_count').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex('issues_project_fingerprint_unique').on(
    table.projectId,
    table.fingerprint,
  ),
  index('issues_project_status_idx').on(table.projectId, table.status),
]);

export const analysisStatus = ['pending', 'complete', 'failed'] as const;
export type AnalysisStatus = (typeof analysisStatus)[number];

// v2 landing slot for AI analysis. Never written to in v1.
export const analyses = pgTable('analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  explanation: text('explanation'),
  rootCause: text('root_cause'),
  suggestedFix: text('suggested_fix'),
  model: text('model'),
  promptVersion: integer('prompt_version').notNull().default(1),
  status: text('status', { enum: analysisStatus }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index('analyses_issue_id_idx').on(table.issueId),
]);

// Populated on POST /events by the SDK payload, then augmented on
// POST /replays with timeline_markers computed from the rrweb stream.
export interface EventMetadata {
  url: string;
  userAgent: string;
  viewport?: { width: number; height: number };
  replayReady: boolean;
  timelineMarkers?: {
    errorTimestamp: number;
    bufferStartTimestamp: number;
    // rrweb event index → wall-clock ms offset from buffer start
    eventOffsets: number[];
  };
}

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  // SDK-generated UUID stamped on both event and replay payloads.
  // Server joins events ↔ replays on this instead of a FK to avoid the
  // split-payload race (event arrives first, replay second).
  correlationId: uuid('correlation_id').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  errorType: text('error_type').notNull(),
  errorMessage: text('error_message').notNull(),
  stackTrace: text('stack_trace'),
  release: text('release'),
  environment: text('environment'),
  metadata: jsonb('metadata').$type<EventMetadata>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index('events_project_ts_idx').on(table.projectId, table.timestamp),
  index('events_issue_id_idx').on(table.issueId),
  index('events_correlation_id_idx').on(table.correlationId),
]);

// Opaque rrweb event stream. Stored as-is, played back in the browser.
// Never parsed server-side — rrweb event shapes change across versions.
export type RrwebEventStream = unknown[];

export const replays = pgTable('replays', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  correlationId: uuid('correlation_id').notNull(),
  rrwebData: jsonb('rrweb_data').$type<RrwebEventStream>().notNull(),
  durationMs: integer('duration_ms').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index('replays_project_id_idx').on(table.projectId),
  index('replays_correlation_id_idx').on(table.correlationId),
]);

export const sourceMaps = pgTable('source_maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  release: text('release').notNull(),
  filename: text('filename').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex('source_maps_project_release_filename_unique').on(
    table.projectId,
    table.release,
    table.filename,
  ),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;

export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type Replay = typeof replays.$inferSelect;
export type NewReplay = typeof replays.$inferInsert;

export type SourceMap = typeof sourceMaps.$inferSelect;
export type NewSourceMap = typeof sourceMaps.$inferInsert;
