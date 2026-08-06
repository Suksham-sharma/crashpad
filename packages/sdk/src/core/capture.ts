import type {
  EventPayload,
  ReplayPayload,
  ResolvedConfig,
  SessionEvent,
  SignalDetail,
} from './types';
import { getConfig } from './config';
import { newCorrelationId } from './session';
import { sendEvent, sendReplay } from './transport';
import { snapshotReplay, isReplayRunning } from './replay';
import { snapshotNetworkEvents } from './network';
import { snapshotConsoleEvents } from './console';
import { safe, safeAsync } from './safe';

interface NormalizedError {
  errorType: string;
  errorMessage: string;
  stackTrace: string | null;
}

interface EmitInput extends NormalizedError {
  signal?: SignalDetail;
}

function normalize(input: unknown): NormalizedError {
  if (input instanceof Error) {
    return {
      errorType: input.name || 'Error',
      errorMessage: input.message || '',
      stackTrace: input.stack ?? null,
    };
  }
  if (typeof input === 'string') {
    return { errorType: 'Error', errorMessage: input, stackTrace: null };
  }
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    return {
      errorType: typeof obj.name === 'string' ? obj.name : 'Error',
      errorMessage:
        typeof obj.message === 'string' ? obj.message : String(input),
      stackTrace: typeof obj.stack === 'string' ? obj.stack : null,
    };
  }
  return { errorType: 'Error', errorMessage: String(input), stackTrace: null };
}

function buildEventPayload(
  config: ResolvedConfig,
  err: EmitInput,
  correlationId: string,
  replayReady: boolean,
): EventPayload {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const loc = typeof location !== 'undefined' ? location : undefined;
  const win = typeof window !== 'undefined' ? window : undefined;
  return {
    correlationId,
    timestamp: new Date().toISOString(),
    errorType: err.errorType,
    errorMessage: err.errorMessage,
    stackTrace: err.stackTrace,
    ...(err.signal ? { signal: err.signal } : {}),
    release: config.release,
    environment: config.environment,
    metadata: {
      url: loc?.href ?? '',
      userAgent: nav?.userAgent ?? '',
      viewport: win
        ? { width: win.innerWidth, height: win.innerHeight }
        : undefined,
      replayReady,
    },
  };
}

function logDebug(config: ResolvedConfig, ...args: unknown[]): void {
  if (!config.debug) return;
  safe(() => {
    // eslint-disable-next-line no-console
    console.debug('[crashpad]', ...args);
  });
}

// Replays without at least the rrweb meta event + one frame after it are
// empty by definition (just the snapshot, no actions). Gating skips them.
const MIN_REPLAY_EVENTS = 2;

function filterIngestNoise(
  events: SessionEvent[],
  apiUrl: string,
): SessionEvent[] {
  if (events.length === 0) return events;
  const base = apiUrl.replace(/\/+$/, '');
  // Path-precise to avoid falsely filtering user-app calls that happen to
  // share an origin with the API in dev (e.g. both on localhost:4000).
  const ingestPaths = [`${base}/api/v1/events`, `${base}/api/v1/replays`];
  return events.filter((e) => {
    if (e.type !== 'network') return true;
    return !ingestPaths.some((p) => e.url.startsWith(p));
  });
}

async function emit(config: ResolvedConfig, input: EmitInput): Promise<void> {
  const correlationId = newCorrelationId();
  const replayReady = isReplayRunning();

  const eventPayload = buildEventPayload(
    config,
    input,
    correlationId,
    replayReady,
  );
  const snapshot = replayReady
    ? snapshotReplay()
    : { events: [], durationMs: 0 };
  const sessionEvents = filterIngestNoise(
    [...snapshotNetworkEvents(), ...snapshotConsoleEvents()],
    config.apiUrl,
  );
  const errorTimestamp = Date.now();

  await safeAsync(async () => {
    const ok = await sendEvent(config, eventPayload);
    logDebug(config, 'event sent', ok);
  });

  if (replayReady && snapshot.events.length >= MIN_REPLAY_EVENTS) {
    const replayPayload: ReplayPayload = {
      correlationId,
      errorTimestamp,
      durationMs: snapshot.durationMs,
      rrwebData: snapshot.events,
      sessionEvents,
    };
    await safeAsync(async () => {
      const ok = await sendReplay(config, replayPayload);
      logDebug(config, 'replay sent', ok);
    });
  }
}

export async function report(input: unknown): Promise<void> {
  const config = getConfig();
  if (!config) return;

  const err = normalize(input);
  logDebug(config, 'capturing', err.errorType, err.errorMessage);
  await emit(config, err);
}

// Lead with the outcome, not the selector. Titles are truncated in the issue
// list, and a long selector would push the part that says what broke off the
// end. The selector is still shown in full on the issue's Evidence panel.
function describeSignal(detail: SignalDetail): NormalizedError {
  const target = detail.targetText
    ? `"${detail.targetText}" (${detail.selector})`
    : detail.selector;

  if (detail.kind === 'rage_click') {
    return {
      errorType: 'RageClick',
      errorMessage: `No response after ${detail.clickCount} rapid clicks on ${target}`,
      stackTrace: null,
    };
  }
  return {
    errorType: 'DeadClick',
    errorMessage: `Nothing happened when clicking ${target}`,
    stackTrace: null,
  };
}

export async function reportSignal(detail: SignalDetail): Promise<void> {
  const config = getConfig();
  if (!config) return;

  const described = describeSignal(detail);
  logDebug(config, 'signal', detail.kind, detail.selector);
  await emit(config, { ...described, signal: detail });
}

let errorHandler: ((event: ErrorEvent) => void) | null = null;
let rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

export function installCapture(): void {
  if (typeof window === 'undefined') return;
  if (errorHandler || rejectionHandler) return;

  errorHandler = (event) => {
    safe(() => {
      const target = event.error ?? event.message ?? 'Unknown error';
      void report(target);
    });
  };

  rejectionHandler = (event) => {
    safe(() => {
      void report(event.reason ?? 'Unhandled promise rejection');
    });
  };

  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectionHandler);
}

export function uninstallCapture(): void {
  if (typeof window === 'undefined') return;
  if (errorHandler) {
    window.removeEventListener('error', errorHandler);
    errorHandler = null;
  }
  if (rejectionHandler) {
    window.removeEventListener('unhandledrejection', rejectionHandler);
    rejectionHandler = null;
  }
}
