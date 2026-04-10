/**
 * Public config accepted by Crashpad.init().
 * Documented in the SDK README.
 */
export interface CrashpadConfig {
  /**
   * API key issued when creating a project in the Crashpad dashboard.
   * Format: cp_live_... or cp_test_...
   */
  apiKey: string;

  /**
   * Base URL of the Crashpad ingestion API. Defaults to the hosted endpoint.
   * Override for self-hosted deployments.
   */
  apiUrl?: string;

  /**
   * Release identifier for this build. Source map lookup is keyed on
   * (project, release, filename). Typical pattern:
   *   release: process.env.NEXT_PUBLIC_CRASHPAD_RELEASE
   * where NEXT_PUBLIC_CRASHPAD_RELEASE=$GIT_SHA at build time.
   *
   * Upload source maps BEFORE deploying the release — events captured
   * against a release whose source maps arrive later will have permanently
   * unresolved stack traces in v1 (no retroactive re-resolution).
   */
  release?: string;

  /**
   * Environment tag, typically 'production' | 'staging' | 'development'.
   */
  environment?: string;

  /**
   * Enable replay capture. Default true. Set false to disable the rrweb
   * circular buffer entirely (errors still flow, just without replays).
   */
  replay?: boolean;

  /**
   * Debug logging to console. Default false. Never enable in production.
   */
  debug?: boolean;
}

/**
 * Payload shape sent to POST /api/v1/events.
 * Kept in sync with apps/api/src/routes/ingest.ts.
 */
export interface EventPayload {
  correlationId: string;
  timestamp: string;
  release?: string;
  environment?: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number };
    replayReady: boolean;
  };
}

/**
 * Payload shape sent to POST /api/v1/replays.
 * correlationId must match the corresponding EventPayload.
 */
export interface ReplayPayload {
  correlationId: string;
  timestamp: string;
  durationMs: number;
  events: unknown[]; // rrweb event stream, shape owned by rrweb
}
