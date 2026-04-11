import { safe, safeAsync } from './safe';

const BUFFER_WINDOW_MS = 30_000;

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

export function startReplay(onError?: (err: unknown) => void): void {
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
          maskAllInputs: true,
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
