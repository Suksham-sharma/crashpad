import { Elysia } from 'elysia';
import { authGuard } from '../middleware/auth-guard';
import {
  fetchBriefForRun,
  isActive,
  latestFixRunForIssue,
  refreshFixRun,
  startFixRun,
  type FixError,
} from '../controllers/fix';
import {
  connectRepo,
  disconnectRepo,
  listConnectableRepos,
  repoStatus,
  type RepoError,
} from '../controllers/repo';
import { appInstallUrl, isAppConfigured } from '../services/github-app';
import { issueIdParams } from '../schemas/issues';
import { projectIdParams } from '../schemas/projects';
import { connectRepoBody, fixRunIdParams } from '../schemas/fix';

function fixStatusFor(error: FixError): number {
  switch (error.code) {
    case 'not_found':
      return 404;
    case 'repo_not_connected':
      return 409;
    case 'rate_limited':
      return 429;
    case 'github':
      return error.failure.code === 'workflow_missing' ? 409 : 502;
  }
}

function fixBodyFor(error: FixError): Record<string, unknown> {
  switch (error.code) {
    case 'not_found':
      return { error: 'not_found' };
    case 'repo_not_connected':
      return {
        error: 'repo_not_connected',
        message:
          'Connect a GitHub repository in project settings before running a fix.',
      };
    case 'rate_limited':
      return {
        error: 'rate_limited',
        message: `Too many fix runs for this project in the last hour. Each run spends your CI minutes and model tokens, so Crashpad caps them. Try again in ${error.retryAfterMinutes} minutes.`,
      };
    case 'github':
      return { error: error.failure.code, message: error.failure.message };
  }
}

function repoStatusFor(error: RepoError): number {
  switch (error.code) {
    case 'not_found':
      return 404;
    case 'no_github_token':
    case 'installation_not_yours':
    case 'repo_not_in_installation':
      return 400;
    case 'github':
      return 502;
  }
}

function repoBodyFor(error: RepoError): Record<string, unknown> {
  switch (error.code) {
    case 'not_found':
      return { error: 'not_found' };
    case 'no_github_token':
      return {
        error: 'no_github_token',
        message:
          'No GitHub token is stored for your account. Sign out and sign back in with GitHub.',
      };
    case 'installation_not_yours':
      return {
        error: 'installation_not_yours',
        message:
          'That GitHub App installation is not one you have access to. Install the Crashpad app on the account that owns the repository.',
      };
    case 'repo_not_in_installation':
      return {
        error: 'repo_not_in_installation',
        message:
          'That repository is not covered by the installation. Grant the Crashpad app access to it on GitHub, then try again.',
      };
    case 'github':
      return { error: error.failure.code, message: error.failure.message };
  }
}

export const fixRoutes = new Elysia({ prefix: '/api/v1' })
  .use(authGuard)
  .get(
    '/github/app',
    () => ({
      configured: isAppConfigured(),
      installUrl: appInstallUrl(),
    }),
    { auth: true },
  )
  .get(
    '/github/installations',
    async ({ user, set }) => {
      const result = await listConnectableRepos(user.id);
      if (!result.ok) {
        set.status = repoStatusFor(result.error);
        return repoBodyFor(result.error);
      }
      return { installations: result.data };
    },
    { auth: true },
  )
  .get(
    '/projects/:id/repo',
    async ({ user, params, set }) => {
      const result = await repoStatus(params.id, user.id);
      if (!result.ok) {
        set.status = repoStatusFor(result.error);
        return repoBodyFor(result.error);
      }
      return result.data;
    },
    { params: projectIdParams, auth: true },
  )
  .put(
    '/projects/:id/repo',
    async ({ user, params, body, set }) => {
      const result = await connectRepo(
        params.id,
        user.id,
        body.installationId,
        body.repoFullName,
      );
      if (!result.ok) {
        set.status = repoStatusFor(result.error);
        return repoBodyFor(result.error);
      }
      return {
        project: result.data.project,
        workflowInstalled: result.data.workflowInstalled,
      };
    },
    { params: projectIdParams, body: connectRepoBody, auth: true },
  )
  .delete(
    '/projects/:id/repo',
    async ({ user, params, set }) => {
      const result = await disconnectRepo(params.id, user.id);
      if (!result.ok) {
        set.status = repoStatusFor(result.error);
        return repoBodyFor(result.error);
      }
      return { project: result.data };
    },
    { params: projectIdParams, auth: true },
  )
  .post(
    '/issues/:id/fix',
    async ({ user, params, set }) => {
      const result = await startFixRun(params.id, user.id);
      if (!result.ok) {
        set.status = fixStatusFor(result.error);
        return fixBodyFor(result.error);
      }
      return { run: result.data };
    },
    { params: issueIdParams, auth: true },
  )
  .get(
    '/issues/:id/fix',
    async ({ user, params, set }) => {
      const result = await latestFixRunForIssue(params.id, user.id);
      if (!result.ok) {
        set.status = fixStatusFor(result.error);
        return fixBodyFor(result.error);
      }
      if (!result.data) return { run: null };

      const run = isActive(result.data.status)
        ? await refreshFixRun(result.data)
        : result.data;
      return { run };
    },
    { params: issueIdParams, auth: true },
  );

export const briefDeliveryRoutes = new Elysia({ prefix: '/api/v1' }).get(
  '/fix-runs/:id/brief',
  async ({ params, headers, set }) => {
    const auth = headers['authorization'] ?? '';
    const token = auth.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : '';
    if (!token) {
      set.status = 401;
      return { error: 'unauthorized', message: 'Missing bearer token.' };
    }

    const result = await fetchBriefForRun(params.id, token);
    if (!result.ok) {
      set.status =
        result.error.code === 'not_found'
          ? 404
          : result.error.code === 'expired'
            ? 410
            : 401;
      return { error: result.error.code };
    }

    set.headers['content-type'] = 'text/markdown; charset=utf-8';
    set.headers['x-crashpad-redacted'] = result.redacted ? 'true' : 'false';
    return result.markdown;
  },
  { params: fixRunIdParams },
);
