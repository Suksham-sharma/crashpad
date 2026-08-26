import { ApiError } from '@/lib/api';

export function maskApiKey(k: string): string {
  if (!k) return '—';
  const prefix = k.startsWith('cp_') ? 'cp_' : '';
  const tail = k.slice(-4);
  return `${prefix}${'•'.repeat(12)}${tail}`;
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatError(
  err: unknown,
  opts: { notFound?: string; fallback?: string } = {},
): string {
  const fallback = opts.fallback ?? 'Something went wrong.';
  if (err instanceof ApiError) {
    const body = err.body;
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : null;
    if (message) return message;
    if (err.status === 404) return opts.notFound ?? fallback;
    return `Request failed (${err.status}).`;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname + (u.search || '');
    return `${u.host}${path}`;
  } catch {
    return url;
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatOffset(ms: number): string {
  const total = ms / 1000;
  return `+${total.toFixed(2)}s`;
}

export function cleanPath(file: string): string {
  return file.replace(/^\.\/+/, '').replace(/^\/+/, '');
}

export function shortenFile(file: string): string {
  try {
    const url = new URL(file);
    return url.pathname.split('/').pop() || url.pathname;
  } catch {
    return file.split('/').pop() || file;
  }
}

export function parseBrowser(ua: string): string {
  const m =
    ua.match(/(Edg|OPR|Chrome|Safari|Firefox)\/(\d+)/) ||
    ua.match(/(Version)\/(\d+)/);
  if (!m) return ua;
  const name = m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1];
  return `${name} ${m[2]}`;
}

export function parseOS(ua: string): string {
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X ([\d_.]+)/.test(ua)) {
    const v = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.');
    return v ? `macOS ${v}` : 'macOS';
  }
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return ua;
}

export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}
