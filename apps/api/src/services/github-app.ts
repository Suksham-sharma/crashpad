import { createSign, createVerify, createPublicKey } from 'node:crypto';
import { env } from '../env';

const API = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const UA = 'crashpad';

export const FIX_WORKFLOW_FILE = 'crashpad-fix.yml';

const TOKEN_TTL_MARGIN_MS = 60_000;
const JWKS_TTL_MS = 10 * 60_000;
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const OIDC_JWKS_URL = `${OIDC_ISSUER}/.well-known/jwks`;
const OIDC_AUDIENCE = 'crashpad';
const OIDC_MAX_SKEW_S = 60;

export type GitHubFailure =
  | { code: 'not_configured'; message: string }
  | { code: 'workflow_missing'; message: string }
  | { code: 'no_access'; message: string }
  | { code: 'github_error'; message: string; status: number };

export type GitHubResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: GitHubFailure };

function fail(failure: GitHubFailure): { ok: false; failure: GitHubFailure } {
  return { ok: false, failure };
}

export function isAppConfigured(): boolean {
  return Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY);
}

export function appInstallUrl(): string | null {
  if (!env.GITHUB_APP_SLUG) return null;
  return `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;
}

const notConfigured: GitHubFailure = {
  code: 'not_configured',
  message:
    'The Crashpad GitHub App is not configured on this server. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.',
};

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function privateKeyPem(): string {
  return env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n').trim();
}

function appJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID }),
  );
  const signingInput = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  return `${signingInput}.${signer.sign(privateKeyPem(), 'base64url')}`;
}

interface GhRequest {
  token: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}

async function gh<T>(
  path: string,
  { token, method = 'GET', body }: GhRequest,
): Promise<GitHubResult<{ status: number; data: T }>> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': API_VERSION,
        'user-agent': UA,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return fail({
      code: 'github_error',
      status: 0,
      message: `Could not reach GitHub: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  if (res.status === 204) {
    return { ok: true, data: { status: 204, data: undefined as T } };
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (!res.ok) {
    const message =
      (isRecord(parsed) && typeof parsed.message === 'string'
        ? parsed.message
        : null) ?? `GitHub returned ${res.status}`;
    return fail({ code: 'github_error', status: res.status, message });
  }

  return { ok: true, data: { status: res.status, data: parsed as T } };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const tokenCache = new Map<number, { token: string; expiresAt: number }>();

export async function installationToken(
  installationId: number,
): Promise<GitHubResult<string>> {
  if (!isAppConfigured()) return fail(notConfigured);

  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - TOKEN_TTL_MARGIN_MS > Date.now()) {
    return { ok: true, data: cached.token };
  }

  const res = await gh<{ token: string; expires_at: string }>(
    `/app/installations/${installationId}/access_tokens`,
    { token: appJwt(), method: 'POST' },
  );
  if (!res.ok) {
    if (res.failure.code === 'github_error' && res.failure.status === 404) {
      return fail({
        code: 'no_access',
        message:
          'The Crashpad GitHub App is no longer installed on this repository. Reconnect it from project settings.',
      });
    }
    return res;
  }

  const { token, expires_at } = res.data.data;
  tokenCache.set(installationId, {
    token,
    expiresAt: Date.parse(expires_at),
  });
  return { ok: true, data: token };
}

export function forgetInstallationToken(installationId: number): void {
  tokenCache.delete(installationId);
}

export interface GitHubInstallation {
  id: number;
  account: string;
}

export async function userIdentities(
  userAccessToken: string,
): Promise<GitHubResult<string[]>> {
  const me = await gh<{ login: string }>('/user', { token: userAccessToken });
  if (!me.ok) return me;

  const orgs = await gh<{ login: string }[]>('/user/orgs?per_page=100', {
    token: userAccessToken,
  });

  const identities = [me.data.data.login];
  if (orgs.ok) {
    for (const org of orgs.data.data ?? []) identities.push(org.login);
  }
  return { ok: true, data: identities.map((s) => s.toLowerCase()) };
}

export async function listInstallationsForUser(
  identities: string[],
): Promise<GitHubResult<GitHubInstallation[]>> {
  if (!isAppConfigured()) return fail(notConfigured);

  const res = await gh<{ id: number; account: { login?: string } | null }[]>(
    '/app/installations?per_page=100',
    { token: appJwt() },
  );
  if (!res.ok) return res;

  const owned = (res.data.data ?? []).filter((i) =>
    identities.includes((i.account?.login ?? '').toLowerCase()),
  );
  return {
    ok: true,
    data: owned.map((i) => ({
      id: i.id,
      account: i.account?.login ?? 'unknown',
    })),
  };
}

export interface GitHubRepo {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

export async function listInstallationRepos(
  installationId: number,
): Promise<GitHubResult<GitHubRepo[]>> {
  const token = await installationToken(installationId);
  if (!token.ok) return token;

  const res = await gh<{
    repositories: {
      id: number;
      full_name: string;
      private: boolean;
      default_branch: string;
    }[];
  }>('/installation/repositories?per_page=100', { token: token.data });
  if (!res.ok) return res;

  return {
    ok: true,
    data: (res.data.data.repositories ?? []).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
    })),
  };
}

export async function getRepo(
  installationId: number,
  fullName: string,
): Promise<GitHubResult<GitHubRepo>> {
  const token = await installationToken(installationId);
  if (!token.ok) return token;

  const res = await gh<{
    id: number;
    full_name: string;
    private: boolean;
    default_branch: string;
  }>(`/repos/${fullName}`, { token: token.data });
  if (!res.ok) return res;

  const r = res.data.data;
  return {
    ok: true,
    data: {
      id: r.id,
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
    },
  };
}

export async function fixWorkflowExists(
  installationId: number,
  fullName: string,
): Promise<GitHubResult<boolean>> {
  const token = await installationToken(installationId);
  if (!token.ok) return token;

  const res = await gh<{ state?: string }>(
    `/repos/${fullName}/actions/workflows/${FIX_WORKFLOW_FILE}`,
    { token: token.data },
  );

  if (!res.ok) {
    if (res.failure.code === 'github_error' && res.failure.status === 404) {
      return { ok: true, data: false };
    }
    return res;
  }
  return { ok: true, data: true };
}

export interface DispatchedRun {
  runId: number | null;
  runUrl: string | null;
}

export async function dispatchFixWorkflow(
  installationId: number,
  fullName: string,
  ref: string,
  inputs: Record<string, string>,
): Promise<GitHubResult<DispatchedRun>> {
  const exists = await fixWorkflowExists(installationId, fullName);
  if (!exists.ok) return exists;
  if (!exists.data) {
    return fail({
      code: 'workflow_missing',
      message: `\`.github/workflows/${FIX_WORKFLOW_FILE}\` was not found on the default branch of ${fullName}. Add the Crashpad fix workflow and merge it before running a fix.`,
    });
  }

  const token = await installationToken(installationId);
  if (!token.ok) return token;

  const res = await gh<{
    workflow_run_id?: number;
    html_url?: string;
  }>(`/repos/${fullName}/actions/workflows/${FIX_WORKFLOW_FILE}/dispatches`, {
    token: token.data,
    method: 'POST',
    body: { ref, inputs, return_run_details: true },
  });
  if (!res.ok) return res;

  const body = res.data.data;
  return {
    ok: true,
    data: {
      runId:
        typeof body?.workflow_run_id === 'number' ? body.workflow_run_id : null,
      runUrl: typeof body?.html_url === 'string' ? body.html_url : null,
    },
  };
}

export interface WorkflowRun {
  id: number;
  status: string | null;
  conclusion: string | null;
  htmlUrl: string;
  name: string | null;
}

export async function getWorkflowRun(
  installationId: number,
  fullName: string,
  runId: number,
): Promise<GitHubResult<WorkflowRun>> {
  const token = await installationToken(installationId);
  if (!token.ok) return token;

  const res = await gh<{
    id: number;
    status: string | null;
    conclusion: string | null;
    html_url: string;
    name: string | null;
  }>(`/repos/${fullName}/actions/runs/${runId}`, { token: token.data });
  if (!res.ok) return res;

  const r = res.data.data;
  return {
    ok: true,
    data: {
      id: r.id,
      status: r.status,
      conclusion: r.conclusion,
      htmlUrl: r.html_url,
      name: r.name,
    },
  };
}

export async function findRunByName(
  installationId: number,
  fullName: string,
  name: string,
): Promise<GitHubResult<WorkflowRun | null>> {
  const token = await installationToken(installationId);
  if (!token.ok) return token;

  const res = await gh<{
    workflow_runs: {
      id: number;
      status: string | null;
      conclusion: string | null;
      html_url: string;
      name: string | null;
    }[];
  }>(
    `/repos/${fullName}/actions/workflows/${FIX_WORKFLOW_FILE}/runs?per_page=30`,
    { token: token.data },
  );
  if (!res.ok) return res;

  const match = (res.data.data.workflow_runs ?? []).find(
    (r) => r.name === name,
  );
  return {
    ok: true,
    data: match
      ? {
          id: match.id,
          status: match.status,
          conclusion: match.conclusion,
          htmlUrl: match.html_url,
          name: match.name,
        }
      : null,
  };
}

export async function findPullRequestByBranch(
  installationId: number,
  fullName: string,
  branch: string,
): Promise<GitHubResult<string | null>> {
  const token = await installationToken(installationId);
  if (!token.ok) return token;

  const owner = fullName.split('/')[0] ?? '';
  const res = await gh<{ html_url: string }[]>(
    `/repos/${fullName}/pulls?state=all&per_page=5&head=${encodeURIComponent(`${owner}:${branch}`)}`,
    { token: token.data },
  );
  if (!res.ok) return res;

  return { ok: true, data: res.data.data[0]?.html_url ?? null };
}

interface Jwk {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

async function jwks(forceRefresh: boolean): Promise<Jwk[]> {
  if (
    !forceRefresh &&
    jwksCache &&
    Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS
  ) {
    return jwksCache.keys;
  }
  const res = await fetch(OIDC_JWKS_URL, {
    headers: { accept: 'application/json', 'user-agent': UA },
  });
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

export interface OidcClaims {
  repository: string;
  repositoryVisibility: string | null;
  repositoryId: string | null;
  runId: string | null;
  workflowRef: string | null;
}

export async function verifyActionsOidcToken(
  token: string,
): Promise<{ ok: true; claims: OidcClaims } | { ok: false; reason: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' };
  const [headerB64, payloadB64, signatureB64] = parts as [
    string,
    string,
    string,
  ];

  let header: { kid?: string; alg?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed token' };
  }

  if (header.alg !== 'RS256') return { ok: false, reason: 'unexpected alg' };
  if (!header.kid) return { ok: false, reason: 'missing kid' };

  let key = (await jwks(false)).find((k) => k.kid === header.kid);
  if (!key) key = (await jwks(true)).find((k) => k.kid === header.kid);
  if (!key) return { ok: false, reason: 'unknown signing key' };

  let verified = false;
  try {
    const publicKey = createPublicKey({
      key: key as import('node:crypto').JsonWebKey,
      format: 'jwk',
    });
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verified = verifier.verify(publicKey, signatureB64, 'base64url');
  } catch {
    return { ok: false, reason: 'signature check failed' };
  }
  if (!verified) return { ok: false, reason: 'bad signature' };

  if (payload.iss !== OIDC_ISSUER) return { ok: false, reason: 'bad issuer' };

  const aud = payload.aud;
  const audMatches = Array.isArray(aud)
    ? aud.includes(OIDC_AUDIENCE)
    : aud === OIDC_AUDIENCE;
  if (!audMatches) return { ok: false, reason: 'bad audience' };

  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : null;
  if (exp + OIDC_MAX_SKEW_S < now)
    return { ok: false, reason: 'token expired' };
  if (nbf !== null && nbf - OIDC_MAX_SKEW_S > now) {
    return { ok: false, reason: 'token not yet valid' };
  }

  if (typeof payload.repository !== 'string') {
    return { ok: false, reason: 'missing repository claim' };
  }

  return {
    ok: true,
    claims: {
      repository: payload.repository,
      repositoryVisibility:
        typeof payload.repository_visibility === 'string'
          ? payload.repository_visibility
          : null,
      repositoryId:
        typeof payload.repository_id === 'string'
          ? payload.repository_id
          : null,
      runId: typeof payload.run_id === 'string' ? payload.run_id : null,
      workflowRef:
        typeof payload.workflow_ref === 'string' ? payload.workflow_ref : null,
    },
  };
}
