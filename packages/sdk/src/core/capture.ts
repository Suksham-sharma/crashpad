import type { EventPayload, ReplayPayload, ResolvedConfig } from './types';
import { getConfig } from './config';
import { newCorrelationId } from './session';
import { sendEvent, sendReplay } from './transport';
import { snapshotReplay, isReplayRunning } from './replay';
import { safe, safeAsync } from './safe';

interface NormalizedError {
  errorType: string;
  errorMessage: string;
  stackTrace: string | null;
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
  err: NormalizedError,
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

export async function report(input: unknown): Promise<void> {
  const config = getConfig();
  if (!config) return;

  const err = normalize(input);
  const correlationId = newCorrelationId();
  const replayReady = isReplayRunning();

  const eventPayload = buildEventPayload(config, err, correlationId, replayReady);
  const snapshot = replayReady ? snapshotReplay() : { events: [], durationMs: 0 };
  const errorTimestamp = Date.now();

  logDebug(config, 'capturing', err.errorType, err.errorMessage);

  await safeAsync(async () => {
    const ok = await sendEvent(config, eventPayload);
    logDebug(config, 'event sent', ok);
  });

  if (replayReady && snapshot.events.length > 0) {
    const replayPayload: ReplayPayload = {
      correlationId,
      errorTimestamp,
      durationMs: snapshot.durationMs,
      rrwebData: snapshot.events,
    };
    await safeAsync(async () => {
      const ok = await sendReplay(config, replayPayload);
      logDebug(config, 'replay sent', ok);
    });
  }
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
