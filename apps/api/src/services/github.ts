import { env } from '../env';

const GITHUB_OAUTH_BASE = 'https://github.com/login/oauth';
const GITHUB_API_BASE = 'https://api.github.com';

// Scopes we need: read:user for the profile, user:email to grab the primary
// email even when it's set to private.
const SCOPES = 'read:user user:email';

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

interface AccessTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_OAUTH_REDIRECT,
    scope: SCOPES,
    state,
    allow_signup: 'true',
  });
  return `${GITHUB_OAUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_OAUTH_REDIRECT,
    }),
  });

  if (!res.ok) {
    throw new Error(`github token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as AccessTokenResponse;
  if (data.error || !data.access_token) {
    throw new Error(
      `github token exchange rejected: ${data.error ?? 'missing access_token'}`,
    );
  }
  return data.access_token;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const [userRes, emailsRes] = await Promise.all([
    fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'crashpad-api',
      },
    }),
    fetch(`${GITHUB_API_BASE}/user/emails`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'crashpad-api',
      },
    }),
  ]);

  if (!userRes.ok) {
    throw new Error(`github /user failed: ${userRes.status}`);
  }

  const user = (await userRes.json()) as GitHubUser;

  // Prefer the primary verified email from /user/emails over the public
  // email on /user — the /user endpoint returns null if the user has
  // hidden their email in settings.
  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as GitHubEmail[];
    const primary = emails.find((e) => e.primary && e.verified);
    if (primary) {
      user.email = primary.email;
    }
  }

  return user;
}
