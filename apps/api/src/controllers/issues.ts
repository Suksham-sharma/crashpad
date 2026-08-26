import { and, eq, desc, gte, ilike, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  issues,
  events,
  replays,
  projects,
  type IssueStatus,
  type IssueKind,
  type Issue,
  type Event,
  type Replay,
} from '../db/schema';

export type IssueTimeWindow = '24h' | '7d' | '30d';

export interface ListIssuesOpts {
  page: number;
  limit: number;
  status?: IssueStatus;
  kind?: IssueKind;
  sort: 'last_seen' | 'event_count' | 'first_seen';
  q?: string;
  since?: IssueTimeWindow;
}

export interface ListIssuesResult {
  issues: Issue[];
  total: number;
  page: number;
  limit: number;
}

const SINCE_INTERVAL: Record<IssueTimeWindow, string> = {
  '24h': '1 day',
  '7d': '7 days',
  '30d': '30 days',
};

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listIssuesForProject(
  projectId: string,
  opts: ListIssuesOpts,
): Promise<ListIssuesResult> {
  const { page, limit, status, kind, sort, q, since } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(issues.projectId, projectId)];
  if (status) conditions.push(eq(issues.status, status));
  if (kind) conditions.push(eq(issues.kind, kind));
  if (q && q.trim()) {
    conditions.push(ilike(issues.title, `%${escapeLike(q.trim())}%`));
  }
  if (since) {
    conditions.push(
      gte(issues.lastSeen, sql`now() - ${SINCE_INTERVAL[since]}::interval`),
    );
  }
  const where = and(...conditions);

  const sortCol = {
    last_seen: issues.lastSeen,
    event_count: issues.eventCount,
    first_seen: issues.firstSeen,
  }[sort];

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(issues)
      .where(where)
      .orderBy(desc(sortCol))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(where),
  ]);

  return { issues: rows, total: countResult[0]?.count ?? 0, page, limit };
}

export interface IssueSearchRow {
  id: string;
  title: string;
  kind: IssueKind;
  status: IssueStatus;
  projectId: string;
  projectName: string;
  lastSeen: Date;
}

const SEARCH_LIMIT = 20;

export async function searchIssuesForUser(
  userId: string,
  q: string,
): Promise<IssueSearchRow[]> {
  const term = q.trim();
  const conditions = [eq(projects.userId, userId)];
  if (term) conditions.push(ilike(issues.title, `%${escapeLike(term)}%`));

  return db
    .select({
      id: issues.id,
      title: issues.title,
      kind: issues.kind,
      status: issues.status,
      projectId: projects.id,
      projectName: projects.name,
      lastSeen: issues.lastSeen,
    })
    .from(issues)
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .where(and(...conditions))
    .orderBy(desc(issues.lastSeen))
    .limit(SEARCH_LIMIT);
}

export interface IssueDetail {
  issue: Issue;
  latestEvent: Event | null;
  replay: Replay | null;
}

export async function getIssueDetail(
  issueId: string,
  userId: string,
): Promise<IssueDetail | null> {
  const issueRows = await db
    .select({ issue: issues, projectUserId: projects.userId })
    .from(issues)
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .where(eq(issues.id, issueId))
    .limit(1);

  const row = issueRows[0];
  if (!row || row.projectUserId !== userId) return null;

  const eventRows = await db
    .select()
    .from(events)
    .where(eq(events.issueId, issueId))
    .orderBy(desc(events.timestamp))
    .limit(1);

  const latestEvent = eventRows[0] ?? null;

  let replay: Replay | null = null;
  if (latestEvent) {
    const replayRows = await db
      .select()
      .from(replays)
      .where(
        and(
          eq(replays.projectId, latestEvent.projectId),
          eq(replays.correlationId, latestEvent.correlationId),
        ),
      )
      .limit(1);
    replay = replayRows[0] ?? null;
  }

  return { issue: row.issue, latestEvent, replay };
}

export async function updateIssueStatus(
  issueId: string,
  userId: string,
  status: IssueStatus,
): Promise<Issue | null> {
  const ownerCheck = await db
    .select({ projectUserId: projects.userId })
    .from(issues)
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!ownerCheck[0] || ownerCheck[0].projectUserId !== userId) return null;

  const [updated] = await db
    .update(issues)
    .set({ status })
    .where(eq(issues.id, issueId))
    .returning();

  return updated!;
}
