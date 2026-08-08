import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { account, projects, type Project } from '../db/schema';
import {
  fixWorkflowExists,
  forgetInstallationToken,
  getRepo,
  listInstallationRepos,
  listInstallationsForUser,
  userIdentities,
  type GitHubFailure,
  type GitHubRepo,
} from '../services/github-app';

export type RepoError =
  | { code: 'not_found' }
  | { code: 'no_github_token' }
  | { code: 'installation_not_yours' }
  | { code: 'repo_not_in_installation' }
  | { code: 'github'; failure: GitHubFailure };

export type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RepoError };

async function githubAccessToken(userId: string): Promise<string | null> {
  const rows = await db
    .select({ accessToken: account.accessToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'github')))
    .limit(1);
  return rows[0]?.accessToken ?? null;
}

export interface InstallationWithRepos {
  id: number;
  account: string;
  repos: GitHubRepo[];
}

async function installationsOwnedBy(
  userId: string,
): Promise<RepoResult<{ id: number; account: string }[]>> {
  const token = await githubAccessToken(userId);
  if (!token) return { ok: false, error: { code: 'no_github_token' } };

  const identities = await userIdentities(token);
  if (!identities.ok) {
    return {
      ok: false,
      error: { code: 'github', failure: identities.failure },
    };
  }

  const installations = await listInstallationsForUser(identities.data);
  if (!installations.ok) {
    return {
      ok: false,
      error: { code: 'github', failure: installations.failure },
    };
  }
  return { ok: true, data: installations.data };
}

export async function listConnectableRepos(
  userId: string,
): Promise<RepoResult<InstallationWithRepos[]>> {
  const owned = await installationsOwnedBy(userId);
  if (!owned.ok) return owned;

  const out: InstallationWithRepos[] = [];
  for (const installation of owned.data) {
    const repos = await listInstallationRepos(installation.id);
    out.push({ ...installation, repos: repos.ok ? repos.data : [] });
  }
  return { ok: true, data: out };
}

export async function connectRepo(
  projectId: string,
  userId: string,
  installationId: number,
  repoFullName: string,
): Promise<RepoResult<{ project: Project; workflowInstalled: boolean }>> {
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!existing[0]) return { ok: false, error: { code: 'not_found' } };

  const owned = await installationsOwnedBy(userId);
  if (!owned.ok) return owned;
  if (!owned.data.some((i) => i.id === installationId)) {
    return { ok: false, error: { code: 'installation_not_yours' } };
  }

  const repos = await listInstallationRepos(installationId);
  if (!repos.ok) {
    return { ok: false, error: { code: 'github', failure: repos.failure } };
  }
  const match = repos.data.find(
    (r) => r.fullName.toLowerCase() === repoFullName.toLowerCase(),
  );
  if (!match) return { ok: false, error: { code: 'repo_not_in_installation' } };

  const viaApp = await getRepo(installationId, match.fullName);
  if (!viaApp.ok) {
    return { ok: false, error: { code: 'github', failure: viaApp.failure } };
  }

  const [updated] = await db
    .update(projects)
    .set({
      repoFullName: viaApp.data.fullName,
      repoId: viaApp.data.id,
      repoPrivate: viaApp.data.private,
      githubInstallationId: installationId,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  const workflow = await fixWorkflowExists(
    installationId,
    viaApp.data.fullName,
  );

  return {
    ok: true,
    data: {
      project: updated!,
      workflowInstalled: workflow.ok ? workflow.data : false,
    },
  };
}

export async function disconnectRepo(
  projectId: string,
  userId: string,
): Promise<RepoResult<Project>> {
  const [updated] = await db
    .update(projects)
    .set({
      repoFullName: null,
      repoId: null,
      repoPrivate: null,
      githubInstallationId: null,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning();

  if (!updated) return { ok: false, error: { code: 'not_found' } };
  return { ok: true, data: updated };
}

export async function repoStatus(
  projectId: string,
  userId: string,
): Promise<
  RepoResult<{
    repoFullName: string | null;
    repoPrivate: boolean | null;
    installationId: number | null;
    workflowInstalled: boolean | null;
  }>
> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) return { ok: false, error: { code: 'not_found' } };

  if (!project.repoFullName || !project.githubInstallationId) {
    return {
      ok: true,
      data: {
        repoFullName: null,
        repoPrivate: null,
        installationId: null,
        workflowInstalled: null,
      },
    };
  }

  const workflow = await fixWorkflowExists(
    project.githubInstallationId,
    project.repoFullName,
  );
  if (!workflow.ok && workflow.failure.code === 'no_access') {
    forgetInstallationToken(project.githubInstallationId);
  }

  return {
    ok: true,
    data: {
      repoFullName: project.repoFullName,
      repoPrivate: project.repoPrivate,
      installationId: project.githubInstallationId,
      workflowInstalled: workflow.ok ? workflow.data : null,
    },
  };
}
