/**
 * `@crashpad/sdk` — browser SDK for Crashpad error monitoring with session replay.
 *
 * Browser-only in v1. A Node.js entry point is explicitly out of scope until v2.
 *
 * @example
 * ```ts
 * import Crashpad from '@crashpad/sdk';
 *
 * Crashpad.init({
 *   apiKey: process.env.NEXT_PUBLIC_CRASHPAD_API_KEY!,
 *   release: process.env.NEXT_PUBLIC_CRASHPAD_RELEASE,
 *   environment: process.env.NODE_ENV,
 * });
 * ```
 *
 * The SDK never throws into the host app. Every public entry point is
 * wrapped in a try/catch — failures degrade silently (or log to console
 * when `debug: true`) instead of crashing the page.
 */
import type { CrashpadConfig } from './core/types';
import { setConfig, getConfig, resetConfig } from './core/config';
import {
  installCapture,
  uninstallCapture,
  report,
  reportSignal,
} from './core/capture';
import { startReplay, stopReplay } from './core/replay';
import { installSignalCapture, uninstallSignalCapture } from './core/signals';
import { installNetworkCapture, uninstallNetworkCapture } from './core/network';
import { installConsoleCapture, uninstallConsoleCapture } from './core/console';
import { safe } from './core/safe';

export type {
  CrashpadConfig,
  EventPayload,
  ReplayPayload,
  SessionEvent,
  NetworkSessionEvent,
  ConsoleSessionEvent,
  ConsoleLevel,
  SignalDetail,
  SignalKind,
} from './core/types';

let initialized = false;

/**
 * Initialize the Crashpad SDK. Call once, as early as possible in your
 * app's lifecycle (typically at the top of your entry module).
 *
 * Installs `window.error` and `unhandledrejection` listeners, and — if
 * `config.replay !== false` — starts the rrweb circular buffer during
 * the next idle frame so it doesn't block first paint. Unless
 * `config.signals === false`, a click listener is installed to detect
 * silent failures (dead clicks and rage clicks).
 *
 * Subsequent calls are no-ops. Calling without an `apiKey` is a no-op.
 * The SDK never throws, even if init fails — the host app keeps running.
 */
function init(config: CrashpadConfig): void {
  safe(() => {
    if (initialized) return;
    if (!config || !config.apiKey) return;

    const resolved = setConfig(config);
    installCapture();
    installNetworkCapture();
    installConsoleCapture();
    if (resolved.replay) startReplay(resolved.maskInputs);
    if (resolved.signals) {
      installSignalCapture((detail) => {
        void reportSignal(detail);
      });
    }

    initialized = true;
  });
}

/**
 * Manually capture an exception. Useful for `try`/`catch` blocks where
 * you've handled an error but still want it reported.
 *
 * The error is normalized, assigned a fresh `correlationId`, and sent
 * through the same pipeline as auto-captured errors (event + replay
 * snapshot). No-op if called before {@link init}.
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   Crashpad.captureException(err);
 *   showFallbackUi();
 * }
 * ```
 */
function captureException(error: unknown): void {
  safe(() => {
    if (!initialized) return;
    void report(error);
  });
}

/**
 * Tear down the SDK. Removes error listeners, stops the replay buffer,
 * and clears the active config. Useful for tests and for hot-module
 * reload scenarios. Rarely needed in production code.
 */
function shutdown(): void {
  safe(() => {
    uninstallCapture();
    uninstallNetworkCapture();
    uninstallConsoleCapture();
    uninstallSignalCapture();
    stopReplay();
    resetConfig();
    initialized = false;
  });
}

/**
 * `true` if {@link init} has run successfully and the SDK is active.
 */
function isInitialized(): boolean {
  return initialized && getConfig() !== null;
}

const Crashpad = {
  init,
  captureException,
  shutdown,
  isInitialized,
};

export default Crashpad;
export { init, captureException, shutdown, isInitialized };
