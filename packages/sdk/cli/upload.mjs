#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { argv, env, exit, stdout } from 'node:process';

function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      opts[key] = next;
      i++;
    } else {
      opts[key] = true;
    }
  }
  return opts;
}

async function* walkMaps(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMaps(full);
    } else if (entry.isFile() && entry.name.endsWith('.js.map')) {
      yield full;
    }
  }
}

async function uploadMap({ filePath, release, apiKey, apiUrl }) {
  const content = await readFile(filePath, 'utf8');
  const filename = basename(filePath).replace(/\.map$/, '');
  const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/v1/sourcemaps`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ release, filename, content }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
}

function usage() {
  console.error(
    `Usage: crashpad upload-sourcemaps --dir <path> --release <id> [--api-key <key>] [--api-url <url>]

  --dir        Directory to recursively scan for *.js.map files (required)
  --release    Release identifier matching Crashpad.init({ release }) (required)
  --api-key    Crashpad project API key, or set CRASHPAD_API_KEY
  --api-url    Crashpad API base URL (default https://api.crashpad.dev, or set CRASHPAD_API_URL)
`,
  );
}

function strArg(v) {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

async function uploadCommand(rest) {
  const opts = parseArgs(rest);
  const dir = strArg(opts.dir);
  const release = strArg(opts.release);
  const apiKey = strArg(opts['api-key']) ?? strArg(env.CRASHPAD_API_KEY);
  const apiUrl =
    strArg(opts['api-url']) ??
    strArg(env.CRASHPAD_API_URL) ??
    'https://api.crashpad.dev';

  const missing = [];
  if (!dir) missing.push('--dir');
  if (!release) missing.push('--release');
  if (!apiKey) missing.push('--api-key (or CRASHPAD_API_KEY)');
  if (missing.length > 0) {
    console.error(`Missing required: ${missing.join(', ')}\n`);
    usage();
    exit(1);
  }

  if (!apiKey.startsWith('cp_')) {
    console.error(
      `--api-key must be a Crashpad project key starting with "cp_" (got: ${apiKey.slice(0, 8)}…)`,
    );
    exit(1);
  }

  try {
    const s = await stat(dir);
    if (!s.isDirectory()) throw new Error('not a directory');
  } catch {
    console.error(`Cannot read --dir: ${dir}`);
    exit(1);
  }

  let ok = 0;
  let failed = 0;
  for await (const filePath of walkMaps(dir)) {
    stdout.write(`uploading ${basename(filePath)} ... `);
    try {
      await uploadMap({ filePath, release, apiKey, apiUrl });
      console.log('OK');
      ok++;
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
      failed++;
    }
  }

  if (ok + failed === 0) {
    console.error(`No .js.map files found under ${dir}`);
    exit(1);
  }

  console.log(`\nDone. ${ok} uploaded, ${failed} failed.`);
  if (failed > 0) exit(1);
}

const [, , cmd, ...rest] = argv;
if (cmd === 'upload-sourcemaps') {
  await uploadCommand(rest);
} else {
  if (cmd && cmd !== '--help' && cmd !== '-h') {
    console.error(`Unknown command: ${cmd}\n`);
  }
  usage();
  exit(cmd ? 1 : 0);
}
