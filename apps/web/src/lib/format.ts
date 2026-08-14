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
