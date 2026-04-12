/**
 * Public config accepted by {@link Crashpad.init}.
 *
 * Only `apiKey` is required. Everything else has sensible defaults, but
 * `release` and `environment` are strongly recommended in production so
 * stack traces can be resolved against source maps and errors can be
 * filtered per deploy.
 */
export interface CrashpadConfig {
  /**
   * API key issued when creating a project in the Crashpad dashboard.
   * Format: `cp_...` (48 hex chars after the prefix).
   *
   * Safe to expose in browser bundles — the key is public by design.
   * Write scope is limited to your project's ingestion endpoints.
   */
  apiKey: string;

  /**
   * Base URL of the Crashpad ingestion API. Defaults to the hosted endpoint.
   * Override for self-hosted deployments or local development.
   *
   * Example: `http://localhost:4000`
   */
  apiUrl?: string;

  /**
   * Release identifier for this build — typically a git SHA or semver tag.
   *
   * Crashpad uses `release` as the primary key for source map lookup:
   * when an error arrives, the server resolves its minified stack trace
   * against source maps stored under `(project, release, filename)`.
   * Without a release, source map resolution always misses and stack
   * traces stay minified.
   *
   * Recommended pattern: inject at build time.
   *   `release: process.env.NEXT_PUBLIC_CRASHPAD_RELEASE`
   * where `NEXT_PUBLIC_CRASHPAD_RELEASE=$GIT_SHA` in CI.
   *
   * IMPORTANT: upload source maps to the API BEFORE deploying the build
   * that uses this release. Events captured against a release whose source
   * maps arrive later will have permanently unresolved stack traces in v1
   * (deferred re-resolution is a v1.5 follow-up).
   */
  release?: string;

  /**
   * Environment tag — typically `'production'`, `'staging'`, `'development'`.
   * Used for dashboard filtering. Does not affect capture behavior.
   */
  environment?: string;

  /**
   * Enable session replay capture. Default `true`.
   *
   * When enabled, the SDK dynamically imports rrweb during idle and
   * records the last 30 seconds of DOM, clicks, and scroll into a
   * circular buffer. When an error fires, that 30s clip is flushed
   * alongside the error event.
   *
   * Set to `false` to disable replay entirely — errors still flow,
   * but without a replay clip attached.
   */
  replay?: boolean;

  /**
   * Mask all form input values in the replay stream. Default `true`.
   *
   * When enabled, every `<input>`, `<textarea>`, and `<select>` value
   * is replaced with asterisks in the recorded events — passwords,
   * credit card numbers, and any other text users type into forms
   * never leave the browser.
   *
   * Set to `false` ONLY if you are certain no PII is ever entered into
   * form fields in your app. Flipping this off in a production app
   * that handles real user input is a data-leak risk.
   *
   * Note: this setting controls INPUT values only. Rendered text nodes
   * (e.g. `<div>{user.email}</div>`) are not masked in v1 — if you
   * render PII into the DOM, it will be captured in the replay. Keep
   * PII out of the rendered tree if you need it out of replays.
   */
  maskInputs?: boolean;

  /**
   * Enable debug logging to `console`. Default `false`.
   *
   * Logs init, capture, and transport status messages. Never enable in
   * production — it makes the SDK chatty on every error.
   */
  debug?: boolean;
}

/**
 * Internal resolved config shape. Users don't construct this directly —
 * it's the normalized form produced from {@link CrashpadConfig} at init time.
 */
export interface ResolvedConfig {
  apiKey: string;
  apiUrl: string;
  release: string | null;
  environment: string | null;
  replay: boolean;
  maskInputs: boolean;
  debug: boolean;
}

/**
 * Payload shape sent to `POST /api/v1/events`.
 *
 * This is the wire contract between the SDK and the Crashpad API. Fields
 * must match `apps/api/src/schemas/events.ts`'s `ingestEventBody` exactly.
 * `correlationId` is the join key to the matching {@link ReplayPayload}.
 */
export interface EventPayload {
  /** SDK-generated UUID stamped on both the event and the matching replay. */
  correlationId: string;
  /** ISO 8601 timestamp of when the error fired (client wall clock). */
  timestamp: string;
  /** The error's constructor name — `"TypeError"`, `"ReferenceError"`, etc. */
  errorType: string;
  /** The error's message. Capped to 4KB server-side. */
  errorMessage: string;
  /** Raw stack trace. `null` if the error has no stack (rare). */
  stackTrace: string | null;
  /** Release identifier from {@link CrashpadConfig.release}, or `null`. */
  release: string | null;
  /** Environment tag from {@link CrashpadConfig.environment}, or `null`. */
  environment: string | null;
  metadata: {
    /** Full URL of the page at error time, including query + hash. */
    url: string;
    /** `navigator.userAgent` string. */
    userAgent: string;
    /** Viewport dimensions at error time. Omitted during SSR. */
    viewport?: { width: number; height: number };
    /** `true` if the replay buffer had events at error time. */
    replayReady: boolean;
  };
}

/**
 * Payload shape sent to `POST /api/v1/replays`.
 *
 * Joined to the matching {@link EventPayload} by `correlationId`. The
 * server computes `timeline_markers` from `rrwebData + errorTimestamp`
 * and writes them back into the event's metadata — clients don't need
 * to compute offsets.
 */
export interface ReplayPayload {
  /** Same UUID as the matching {@link EventPayload.correlationId}. */
  correlationId: string;
  /** Wall-clock ms of the error moment, used to position the scrubber. */
  errorTimestamp: number;
  /** Total duration of the buffered clip in ms (first-to-last event). */
  durationMs: number;
  /** Opaque rrweb event stream. Shape owned by rrweb, not the Crashpad API. */
  rrwebData: unknown[];
}
