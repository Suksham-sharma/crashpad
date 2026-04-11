function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] ${name} is not set. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  PORT: Number(optional('API_PORT', '4000')),
  NODE_ENV: optional('NODE_ENV', 'development') as
    | 'development'
    | 'production'
    | 'test',
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: optional('BETTER_AUTH_URL', 'http://localhost:4000'),
  GITHUB_CLIENT_ID: required('GITHUB_CLIENT_ID'),
  GITHUB_CLIENT_SECRET: required('GITHUB_CLIENT_SECRET'),
  WEB_URL: optional('WEB_URL', 'http://localhost:3000'),
} as const;

export type Env = typeof env;
