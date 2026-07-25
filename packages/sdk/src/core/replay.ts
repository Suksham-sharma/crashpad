import { safe, safeAsync } from './safe';

const BUFFER_WINDOW_MS = 30_000;

// rrweb wire constants. EventType.IncrementalSnapshot / IncrementalSource.Mutation.
const INCREMENTAL_SNAPSHOT = 3;
const MUTATION_SOURCE = 0;

interface RrwebEvent {
  timestamp: number;
  [key: string]: unknown;
}

interface RrwebModule {
  record: (options: {
    emit: (event: RrwebEvent) => void;
    maskAllInputs?: boolean;
    maskTextSelector?: string;
    blockClass?: string;
    checkoutEveryNms?: number;
  }) => (() => void) | undefined;
}

let buffer: RrwebEvent[] = [];
let stopFn: (() => void) | null = null;
let starting = false;

function prune(): void {
  if (buffer.length === 0) return;
  const cutoff = Date.now() - BUFFER_WINDOW_MS;
  let drop = 0;
  while (drop < buffer.length && buffer[drop]!.timestamp < cutoff) drop++;
  if (drop > 0) buffer = buffer.slice(drop);
}

function scheduleIdle(fn: () => void): void {
  type IdleCallback = (cb: () => void, opts?: { timeout: number }) => number;
  const ric = (globalThis as unknown as { requestIdleCallback?: IdleCallback })
    .requestIdleCallback;
  if (typeof ric === 'function') {
    ric(fn, { timeout: 2000 });
    return;
  }
  setTimeout(fn, 0);
}

export function startReplay(
  maskInputs: boolean,
  onError?: (err: unknown) => void,
): void {
  if (stopFn || starting) return;
  starting = true;
  scheduleIdle(() => {
    void safeAsync(
      async () => {
        const mod = (await import('rrweb')) as unknown as RrwebModule;
        if (stopFn) return;
        const stop = mod.record({
          emit: (event) => {
            safe(() => {
              buffer.push(event);
              prune();
            }, onError);
          },
          maskAllInputs: maskInputs,
          checkoutEveryNms: BUFFER_WINDOW_MS,
        });
        stopFn = stop ?? null;
        starting = false;
      },
      (err) => {
        starting = false;
        if (onError) onError(err);
      },
    );
  });
}

export function stopReplay(): void {
  safe(() => {
    if (stopFn) stopFn();
    stopFn = null;
    buffer = [];
    starting = false;
  });
}

export function snapshotReplay(): { events: RrwebEvent[]; durationMs: number } {
  prune();
  if (buffer.length === 0) return { events: [], durationMs: 0 };
  const first = buffer[0]!.timestamp;
  const last = buffer[buffer.length - 1]!.timestamp;
  return { events: buffer.slice(), durationMs: Math.max(0, last - first) };
}

export function isReplayRunning(): boolean {
  return stopFn !== null;
}

/**
 * Whether any DOM mutation was recorded at or after `ts`. Reads the buffer
 * rrweb is already filling rather than installing a second MutationObserver.
 * Scans backwards and stops at the first older event — the buffer is in emit
 * order, so timestamps are monotonic.
 */
export function hasMutationsSince(ts: number): boolean {
  for (let i = buffer.length - 1; i >= 0; i--) {
    const event = buffer[i]!;
    if (event.timestamp < ts) break;
    if (event.type !== INCREMENTAL_SNAPSHOT) continue;
    const data = event.data as { source?: number } | undefined;
    if (data?.source === MUTATION_SOURCE) return true;
  }
  return false;
}
