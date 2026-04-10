/**
 * @crashpad/sdk entry point.
 *
 * Browser-only in v1. Node.js entry is explicitly not in scope until v2+.
 *
 * Usage:
 *   import Crashpad from '@crashpad/sdk';
 *   Crashpad.init({
 *     apiKey: process.env.NEXT_PUBLIC_CRASHPAD_API_KEY!,
 *     release: process.env.NEXT_PUBLIC_CRASHPAD_RELEASE,
 *     environment: process.env.NODE_ENV,
 *   });
 *
 * The init() call is a stub in this scaffold — wire up capture + transport
 * + replay in the next implementation pass.
 */
import type { CrashpadConfig } from './core/types';

export type { CrashpadConfig, EventPayload, ReplayPayload } from './core/types';

const DEFAULT_API_URL = 'https://api.crashpad.dev';

let initialized = false;
let currentConfig: Required<
  Pick<CrashpadConfig, 'apiKey' | 'apiUrl' | 'replay' | 'debug'>
> &
  Pick<CrashpadConfig, 'release' | 'environment'> = {
  apiKey: '',
  apiUrl: DEFAULT_API_URL,
  replay: true,
  debug: false,
};

/**
 * Initialize the Crashpad SDK. Must be called once, as early as possible in
 * your app's lifecycle. Subsequent calls are ignored with a console warning
 * (in debug mode) to avoid double-init bugs.
 *
 * The SDK MUST NOT throw into the host app. Every branch below is wrapped in
 * try/catch. Failures degrade gracefully: the SDK disables itself instead of
 * crashing the page.
 */
function init(config: CrashpadConfig): void {
  try {
    if (initialized) {
      if (currentConfig.debug) {
        // eslint-disable-next-line no-console
        console.warn('[crashpad] init() called twice, ignoring second call');
      }
      return;
    }

    if (!config.apiKey) {
      if (config.debug) {
        // eslint-disable-next-line no-console
        console.warn('[crashpad] init() called without apiKey, disabling SDK');
      }
      return;
    }

    currentConfig = {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl ?? DEFAULT_API_URL,
      replay: config.replay ?? true,
      debug: config.debug ?? false,
      release: config.release,
      environment: config.environment,
    };

    initialized = true;

    if (currentConfig.debug) {
      // eslint-disable-next-line no-console
      console.info('[crashpad] initialized', {
        apiUrl: currentConfig.apiUrl,
        release: currentConfig.release,
        environment: currentConfig.environment,
        replay: currentConfig.replay,
      });
    }

    // TODO(week-1): wire up capture + transport + replay buffer here
    //   - window.onerror + unhandledrejection handlers
    //   - batched HTTP transport with retry + sendBeacon fallback
    //   - rrweb dynamic import (requestIdleCallback) + circular buffer
    //   - PII masking config (maskAllInputs: true)
    //   - correlation UUID generation per error
  } catch (err) {
    // Graceful failure — never throw into the host app.
    if (config.debug) {
      // eslint-disable-next-line no-console
      console.error('[crashpad] init failed', err);
    }
  }
}

/**
 * Manually capture an exception. Useful for try/catch blocks where you want
 * to report a caught error without letting it bubble up.
 *
 * Stub in this scaffold.
 */
function captureException(_error: unknown): void {
  try {
    if (!initialized) return;
    // TODO(week-1): wire up manual capture path
  } catch {
    // swallow
  }
}

const Crashpad = {
  init,
  captureException,
};

export default Crashpad;
export { init, captureException };
