import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    apiKey: text('api_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('projects_api_key_unique').on(table.apiKey),
    index('projects_user_id_idx').on(table.userId),
  ],
);

export const issueStatus = ['open', 'resolved', 'ignored'] as const;
export type IssueStatus = (typeof issueStatus)[number];

export const issues = pgTable(
  'issues',
  {
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
  },
  (table) => [
    uniqueIndex('issues_project_fingerprint_unique').on(
      table.projectId,
      table.fingerprint,
    ),
    index('issues_project_status_idx').on(table.projectId, table.status),
  ],
);

export const analysisStatus = ['pending', 'complete', 'failed'] as const;
export type AnalysisStatus = (typeof analysisStatus)[number];

export const analyses = pgTable(
  'analyses',
  {
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
  },
  (table) => [index('analyses_issue_id_idx').on(table.issueId)],
);

export interface EventMetadata {
  url: string;
  userAgent: string;
  viewport?: { width: number; height: number };
  replayReady: boolean;
  timelineMarkers?: {
    errorTimestamp: number;
    bufferStartTimestamp: number;
    eventOffsets: number[];
  };
}

// events and replays are linked by correlation_id, NOT a foreign key. The SDK
// stamps the same UUID on both payloads; the server joins on read. This avoids
// the split-payload race where the replay arrives before (or after) the event.
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
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
  },
  (table) => [
    index('events_project_ts_idx').on(table.projectId, table.timestamp),
    index('events_issue_id_idx').on(table.issueId),
    index('events_correlation_id_idx').on(table.correlationId),
  ],
);

export type RrwebEventStream = unknown[];

export const replays = pgTable(
  'replays',
  {
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
  },
  (table) => [
    index('replays_project_id_idx').on(table.projectId),
    index('replays_correlation_id_idx').on(table.correlationId),
  ],
);

export const sourceMaps = pgTable(
  'source_maps',
  {
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
  },
  (table) => [
    uniqueIndex('source_maps_project_release_filename_unique').on(
      table.projectId,
      table.release,
      table.filename,
    ),
  ],
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;

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
