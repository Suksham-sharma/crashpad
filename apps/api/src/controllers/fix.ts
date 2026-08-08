import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  fixRuns,
  issues,
  projects,
  type FixRun,
  type FixRunStatus,
  type Project,
} from '../db/schema';
import { env } from '../env';
import { publish } from '../lib/pubsub';
import { getIssueDetail } from './issues';
import { buildBrief } from './brief';
import {
  dispatchFixWorkflow,
  findPullRequestByBranch,
  findRunByName,
  getRepo,
  getWorkflowRun,
  isAppConfigured,
  verifyActionsOidcToken,
  type GitHubFailure,
} from '../services/github-app';

const MAX_RUNS_PER_HOUR = 10;
const STALE_RUN_MS = 60 * 60_000;
const BRIEF_FETCH_WINDOW_MS = 60 * 60_000;

export type FixError =
  | { code: 'not_found' }
  | { code: 'repo_not_connected' }
  | { code: 'rate_limited'; retryAfterMinutes: number }
  | { code: 'github'; failure: GitHubFailure };

export type FixResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: FixError };

export function branchForRun(runId: string): string {
  return `crashpad/fix-${runId}`;
}

export function runNameForRun(runId: string): string {
  return `Crashpad fix ${runId}`;
}

function briefUrlForRun(runId: string): string {
  return `${env.PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/fix-runs/${runId}/brief`;
}

function announce(run: FixRun): void {
  publish({
    type: 'fix:progress',
    projectId: run.projectId,
    issueId: run.issueId,
    runId: run.id,
    status: run.status,
    runUrl: run.runUrl,
    prUrl: run.prUrl,
    error: run.error,
  });
}

async function patchRun(
  runId: string,
  patch: Partial<Omit<FixRun, 'id'>>,
): Promise<FixRun> {
  const [updated] = await db
    .update(fixRuns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(fixRuns.id, runId))
    .returning();
  return updated!;
}

async function projectForIssue(
  issueId: string,
  userId: string,
): Promise<Project | null> {
  const rows = await db
    .select({ project: projects })
    .from(issues)
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .where(and(eq(issues.id, issueId), eq(projects.userId, userId)))
    .limit(1);
  return rows[0]?.project ?? null;
}

export async function latestFixRunForIssue(
  issueId: string,
  userId: string,
): Promise<FixResult<FixRun | null>> {
  const project = await projectForIssue(issueId, userId);
  if (!project) return { ok: false, error: { code: 'not_found' } };

  const rows = await db
    .select()
    .from(fixRuns)
    .where(eq(fixRuns.issueId, issueId))
    .orderBy(desc(fixRuns.createdAt))
    .limit(1);

  return { ok: true, data: rows[0] ?? null };
}

export function isActive(status: FixRunStatus): boolean {
  return status === 'pending' || status === 'running';
}

export async function startFixRun(
  issueId: string,
  userId: string,
): Promise<FixResult<FixRun>> {
  const project = await projectForIssue(issueId, userId);
  if (!project) return { ok: false, error: { code: 'not_found' } };

  if (
    !isAppConfigured() ||
    !project.repoFullName ||
    !project.githubInstallationId
  ) {
    return { ok: false, error: { code: 'repo_not_connected' } };
  }

  const active = await db
    .select()
    .from(fixRuns)
    .where(
      and(
        eq(fixRuns.issueId, issueId),
        inArray(fixRuns.status, ['pending', 'running']),
      ),
    )
    .orderBy(desc(fixRuns.createdAt))
    .limit(1);
  if (active[0]) return { ok: true, data: active[0] };

  const since = new Date(Date.now() - 60 * 60_000);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fixRuns)
    .where(
      and(eq(fixRuns.projectId, project.id), gte(fixRuns.createdAt, since)),
    );
  if (count >= MAX_RUNS_PER_HOUR) {
    return {
      ok: false,
      error: { code: 'rate_limited', retryAfterMinutes: 60 },
    };
  }

  const installationId = project.githubInstallationId;
  const repoFullName = project.repoFullName;

  const [created] = await db
    .insert(fixRuns)
    .values({ projectId: project.id, issueId, repoFullName, status: 'pending' })
    .returning();
  const run = created!;
  announce(run);

  const repo = await getRepo(installationId, repoFullName);
  if (!repo.ok)
    return { ok: false, error: await markFailed(run, repo.failure) };

  const dispatched = await dispatchFixWorkflow(
    installationId,
    repoFullName,
    repo.data.defaultBranch,
    {
      crashpad_run_id: run.id,
      brief_url: briefUrlForRun(run.id),
      branch: branchForRun(run.id),
    },
  );
  if (!dispatched.ok) {
    return { ok: false, error: await markFailed(run, dispatched.failure) };
  }

  const updated = await patchRun(run.id, {
    status: 'running',
    githubRunId: dispatched.data.runId,
    runUrl: dispatched.data.runUrl,
  });
  announce(updated);
  return { ok: true, data: updated };
}

async function markFailed(
  run: FixRun,
  failure: GitHubFailure,
): Promise<FixError> {
  const updated = await patchRun(run.id, {
    status: 'failed',
    error: failure.message,
  });
  announce(updated);
  return { code: 'github', failure };
}

export async function refreshFixRun(run: FixRun): Promise<FixRun> {
  if (!isActive(run.status)) return run;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, run.projectId))
    .limit(1);

  const installationId = project?.githubInstallationId;
  if (!installationId) return run;

  let githubRunId = run.githubRunId;
  if (githubRunId === null) {
    const found = await findRunByName(
      installationId,
      run.repoFullName,
      runNameForRun(run.id),
    );
    if (!found.ok || !found.data) return run;
    githubRunId = found.data.id;
  }

  const remote = await getWorkflowRun(
    installationId,
    run.repoFullName,
    githubRunId,
  );
  if (!remote.ok) return run;

  const { status, conclusion, htmlUrl } = remote.data;
  if (status !== 'completed') {
    if (run.githubRunId === githubRunId && run.runUrl === htmlUrl) return run;
    const updated = await patchRun(run.id, {
      status: 'running',
      githubRunId,
      runUrl: htmlUrl,
    });
    announce(updated);
    return updated;
  }

  if (conclusion !== 'success') {
    const updated = await patchRun(run.id, {
      status: 'failed',
      githubRunId,
      runUrl: htmlUrl,
      error: `The workflow finished with conclusion "${conclusion ?? 'unknown'}". Open the run for its logs.`,
    });
    announce(updated);
    return updated;
  }

  const pr = await findPullRequestByBranch(
    installationId,
    run.repoFullName,
    branchForRun(run.id),
  );

  const updated = await patchRun(run.id, {
    status: 'complete',
    githubRunId,
    runUrl: htmlUrl,
    prUrl: pr.ok ? pr.data : null,
    error:
      pr.ok && pr.data === null
        ? 'The workflow succeeded but opened no pull request — the agent may have decided no safe fix was available. Check the run log.'
        : null,
  });
  announce(updated);
  return updated;
}

export async function sweepStuckFixRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS);
  const swept = await db
    .update(fixRuns)
    .set({
      status: 'failed',
      error:
        'Crashpad lost track of this run — it was still in progress when the server restarted. Check GitHub Actions for the outcome, or run the fix again.',
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(fixRuns.status, ['pending', 'running']),
        lt(fixRuns.createdAt, cutoff),
      ),
    )
    .returning();

  for (const run of swept) announce(run);
  return swept.length;
}

export type BriefFetchError =
  | { code: 'unauthorized'; reason: string }
  | { code: 'not_found' }
  | { code: 'expired' };

export async function fetchBriefForRun(
  runId: string,
  oidcToken: string,
): Promise<
  | { ok: true; markdown: string; redacted: boolean }
  | { ok: false; error: BriefFetchError }
> {
  const verified = await verifyActionsOidcToken(oidcToken);
  if (!verified.ok) {
    return {
      ok: false,
      error: { code: 'unauthorized', reason: verified.reason },
    };
  }

  const [run] = await db
    .select()
    .from(fixRuns)
    .where(eq(fixRuns.id, runId))
    .limit(1);
  if (!run) return { ok: false, error: { code: 'not_found' } };

  if (
    verified.claims.repository.toLowerCase() !== run.repoFullName.toLowerCase()
  ) {
    return {
      ok: false,
      error: {
        code: 'unauthorized',
        reason: 'repository claim does not match this run',
      },
    };
  }

  if (Date.now() - run.createdAt.getTime() > BRIEF_FETCH_WINDOW_MS) {
    return { ok: false, error: { code: 'expired' } };
  }

  const [issueRow] = await db
    .select({ projectUserId: projects.userId })
    .from(issues)
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .where(eq(issues.id, run.issueId))
    .limit(1);
  if (!issueRow) return { ok: false, error: { code: 'not_found' } };

  const detail = await getIssueDetail(run.issueId, issueRow.projectUserId);
  if (!detail) return { ok: false, error: { code: 'not_found' } };

  const redacted = verified.claims.repositoryVisibility === 'public';
  await patchRun(run.id, { briefFetchedAt: new Date() });

  return {
    ok: true,
    markdown: buildBrief(detail, { redact: redacted }),
    redacted,
  };
}
