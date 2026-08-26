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

const NODE_ENV = optional('NODE_ENV', 'development');

function requiredInProduction(name: string): string {
  return NODE_ENV === 'production' ? required(name) : optional(name, '');
}

export const env = {
  PORT: Number(optional('API_PORT', '4000')),
  NODE_ENV: NODE_ENV as 'development' | 'production' | 'test',
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: optional('BETTER_AUTH_URL', 'http://localhost:4000'),
  GITHUB_CLIENT_ID: requiredInProduction('GITHUB_CLIENT_ID'),
  GITHUB_CLIENT_SECRET: requiredInProduction('GITHUB_CLIENT_SECRET'),
  WEB_URL: optional('WEB_URL', 'http://localhost:3000'),

  GITHUB_APP_ID: optional('GITHUB_APP_ID', ''),
  GITHUB_APP_PRIVATE_KEY: optional('GITHUB_APP_PRIVATE_KEY', ''),
  GITHUB_APP_SLUG: optional('GITHUB_APP_SLUG', ''),
  PUBLIC_API_URL: optional('PUBLIC_API_URL', 'http://localhost:4000'),

  DEV_LOGIN: optional('DEV_LOGIN', '') === '1',
  DEV_LOGIN_EMAIL: optional('DEV_LOGIN_EMAIL', ''),
} as const;

export type Env = typeof env;
