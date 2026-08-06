import type { NextRequest } from 'next/server';

/**
 * SSE passthrough for the dashboard issue stream.
 *
 * Deliberately NOT under `/api/`. The catch-all `/api/:path*` rewrite in
 * next.config.mjs wins over app-router route handlers and buffers the response,
 * so an event stream proxied through it opens and then sits silent forever —
 * no `hello`, no `issue:upsert`, no live updates. Serving the stream from its
 * own path keeps it out of the rewrite's reach while staying same-origin, so
 * the session cookie still flows.
 *
 * Everything else continues to proxy through the rewrite unchanged.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const upstream = await fetch(`${API_URL}/api/v1/projects/${id}/stream`, {
    headers: {
      cookie: request.headers.get('cookie') ?? '',
      accept: 'text/event-stream',
    },
    signal: request.signal,
    cache: 'no-store',
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Same reason the API sets it: stop nginx-style proxies buffering us.
      'X-Accel-Buffering': 'no',
    },
  });
}
