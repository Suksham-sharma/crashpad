import { safe } from './safe';
import type { NetworkSessionEvent } from './types';

const BUFFER_WINDOW_MS = 30_000;
const MAX_URL_LENGTH = 2_048;
const MAX_BUFFER = 500;

let buffer: NetworkSessionEvent[] = [];
let originalFetch: typeof fetch | null = null;
let originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
let originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
let installed = false;

function pruneByTime(): void {
  if (buffer.length === 0) return;
  const cutoff = Date.now() - BUFFER_WINDOW_MS;
  // Filter (not while-shift) — entries land in resolve order, not start
  // order, so the buffer isn't strictly sorted by timestamp.
  buffer = buffer.filter((e) => e.timestamp >= cutoff);
}

function enforceCap(): void {
  if (buffer.length > MAX_BUFFER) {
    buffer = buffer.slice(buffer.length - MAX_BUFFER);
  }
}

function record(entry: NetworkSessionEvent): void {
  safe(() => {
    buffer.push(entry);
    // Cap-prune only on insert; time-prune happens on snapshot. A fetch that
    // started 35s ago and just resolved would otherwise be dropped on push.
    enforceCap();
  });
}

function truncateUrl(url: string): string {
  return url.length > MAX_URL_LENGTH ? url.slice(0, MAX_URL_LENGTH) : url;
}

function resolveUrl(input: RequestInfo | URL): string {
  try {
    if (typeof input === 'string') return truncateUrl(input);
    if (input instanceof URL) return truncateUrl(input.toString());
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return truncateUrl(input.url);
    }
    return truncateUrl(String(input));
  } catch {
    return '';
  }
}

function resolveMethod(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): string {
  try {
    if (init?.method) return init.method.toUpperCase();
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return input.method.toUpperCase();
    }
  } catch {
    // ignore
  }
  return 'GET';
}

function wrapFetch(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }
  originalFetch = window.fetch.bind(window);
  const orig = originalFetch;

  const patched = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const startedAt = Date.now();
    const url = resolveUrl(input);
    const method = resolveMethod(input, init);

    return orig(input, init).then(
      (response) => {
        record({
          type: 'network',
          timestamp: startedAt,
          method,
          url,
          status: response.status,
          durationMs: Date.now() - startedAt,
          initiator: 'fetch',
        });
        return response;
      },
      (err: unknown) => {
        record({
          type: 'network',
          timestamp: startedAt,
          method,
          url,
          status: null,
          durationMs: Date.now() - startedAt,
          initiator: 'fetch',
          failed: true,
        });
        throw err;
      },
    );
  };
  window.fetch = patched as typeof fetch;
}

interface PatchedXhr extends XMLHttpRequest {
  __crashpadMethod?: string;
  __crashpadUrl?: string;
  __crashpadStartedAt?: number;
  __crashpadRecorded?: boolean;
}

function wrapXhr(): void {
  if (typeof XMLHttpRequest === 'undefined') return;

  originalXhrOpen = XMLHttpRequest.prototype.open;
  originalXhrSend = XMLHttpRequest.prototype.send;
  const origOpen = originalXhrOpen;
  const origSend = originalXhrSend;

  XMLHttpRequest.prototype.open = function patchedOpen(
    this: PatchedXhr,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    safe(() => {
      this.__crashpadMethod = String(method ?? 'GET').toUpperCase();
      this.__crashpadUrl = truncateUrl(
        typeof url === 'string' ? url : url.toString(),
      );
    });
    return (
      origOpen as unknown as (
        this: XMLHttpRequest,
        m: string,
        u: string | URL,
        ...r: unknown[]
      ) => void
    ).call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(
    this: PatchedXhr,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    safe(() => {
      this.__crashpadStartedAt = Date.now();
      this.__crashpadRecorded = false;
      const finish = (status: number | null, failed: boolean) => {
        if (this.__crashpadRecorded) return;
        this.__crashpadRecorded = true;
        record({
          type: 'network',
          timestamp: this.__crashpadStartedAt ?? Date.now(),
          method: this.__crashpadMethod ?? 'GET',
          url: this.__crashpadUrl ?? '',
          status,
          durationMs: Date.now() - (this.__crashpadStartedAt ?? Date.now()),
          initiator: 'xhr',
          ...(failed ? { failed: true } : {}),
        });
      };
      this.addEventListener('load', () =>
        safe(() => finish(this.status, false)),
      );
      this.addEventListener('error', () => safe(() => finish(null, true)));
      this.addEventListener('abort', () => safe(() => finish(null, true)));
      this.addEventListener('timeout', () => safe(() => finish(null, true)));
    });
    return (
      origSend as unknown as (
        this: XMLHttpRequest,
        b?: Document | XMLHttpRequestBodyInit | null,
      ) => void
    ).call(this, body ?? null);
  };
}

export function installNetworkCapture(): void {
  if (installed) return;
  if (typeof window === 'undefined') return;
  safe(() => wrapFetch());
  safe(() => wrapXhr());
  installed = true;
}

export function uninstallNetworkCapture(): void {
  if (!installed) return;
  installed = false;
  safe(() => {
    if (originalFetch && typeof window !== 'undefined') {
      window.fetch = originalFetch;
    }
    originalFetch = null;
    if (originalXhrOpen) XMLHttpRequest.prototype.open = originalXhrOpen;
    if (originalXhrSend) XMLHttpRequest.prototype.send = originalXhrSend;
    originalXhrOpen = null;
    originalXhrSend = null;
    buffer = [];
  });
}

export function snapshotNetworkEvents(): NetworkSessionEvent[] {
  pruneByTime();
  enforceCap();
  return buffer.slice();
}

export function isNetworkCaptureRunning(): boolean {
  return installed;
}
