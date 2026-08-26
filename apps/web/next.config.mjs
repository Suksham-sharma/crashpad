import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A verification build must not write into the dev server's .next. They share
  // the directory, and a production build replaces chunks the running dev
  // server has already mapped, so the next request 404s on a chunk id that no
  // longer exists. `bun run build:check` sets this.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@crashpad/sdk'],
  // Pin the workspace root to the crashpad monorepo. Without this, Next.js
  // walks up the tree and picks up stray lockfiles (e.g. ~/pnpm-lock.yaml)
  // as the workspace root, which breaks file tracing for the build output.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  env: {
    NEXT_PUBLIC_API_URL: API_URL,
  },
  // Proxy /api/* to the Elysia API so browser requests are same-origin.
  // Avoids cross-origin cookie gymnastics (SameSite=None + HTTPS) in dev.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
