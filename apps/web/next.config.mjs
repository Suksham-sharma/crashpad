import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crashpad/sdk'],
  // Pin the workspace root to the crashpad monorepo. Without this, Next.js
  // walks up the tree and picks up stray lockfiles (e.g. ~/pnpm-lock.yaml)
  // as the workspace root, which breaks file tracing for the build output.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  },
};

export default nextConfig;
