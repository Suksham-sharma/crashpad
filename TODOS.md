# Crashpad TODOs

Deferred work. Not in v1 scope. Each entry has enough context that someone (including future-you) picking it up knows what and why.

---

## [v1.5] Compressed replay storage

**What:** Migrate `replays.rrweb_data` from Postgres JSONB to a compressed format or external blob storage.

**Why:** rrweb session data is large (often 100KB–2MB per replay). Stored as JSONB in Postgres, replays bloat the table quickly, slow down VACUUM, and blow out shared buffers. Fine at dogfood scale (one user, ~tens of replays a day). Painful the first time real traffic lands.

**Pros:** Lower storage cost. Faster table scans. Better VACUUM behavior. Enables longer retention at equal cost.

**Cons:** Adds a compression/decompression path on read. If external blob storage, adds a network hop and a new dependency (S3, R2, or pg_largeobject).

**Context:** v1 chose JSONB deliberately to keep the stack simple — one database, no new infra. The choice was made with full awareness that it wouldn't scale. `replays.rrweb_data` is currently `JSONB NOT NULL`. Migration path: add `replays.rrweb_data_compressed BYTEA` and `replays.compression TEXT` columns, dual-write for a week, backfill, flip reads, drop the old column.

**Depends on / blocked by:** v1 shipping and having enough dogfood traffic to feel the pain.

**Signals to prioritize:** Postgres table size for `replays` grows past ~1GB, or VACUUM starts showing up in slow query logs.

---

## [v1.5] Real-time dashboard updates (SSE)

**What:** Replace the 10-second dashboard polling loop with Server-Sent Events (SSE) pushing new issues as they arrive.

**Why:** The issue list polls `GET /api/v1/issues?project_id=...` every 10 seconds. At one user in one tab this is fine. But the first time you watch an error land in real time and there's a 10-second delay between the crash and it appearing in the dashboard, it feels sluggish. Also: 10s polling from N tabs is N\*6 req/min to the API for data that hasn't changed 95% of the time.

**Pros:** Sub-second latency from error → dashboard visibility. Lower API load. Feels live in a way polling never does.

**Cons:** Adds an SSE endpoint + connection management on the server. Reconnection handling. Works poorly behind some proxies. Slightly more complex than polling.

**Context:** Elysia has built-in SSE support, so the server side is maybe a day of work. The dashboard component needs an `EventSource` subscription and merge-into-list logic. The polling fallback should stay as a safety net for environments where SSE is blocked.

**Depends on / blocked by:** v1 shipping. This is a polish pass, not load-bearing.

**Signals to prioritize:** Dogfooding shows the polling delay is the most noticeable "this feels slow" moment, OR the API starts seeing meaningful traffic from polling.

---

## [v1.5] Deferred source map re-resolution

**What:** Re-resolve minified stack traces retroactively when source maps arrive after their corresponding events.

**Why:** In v1, if an event is captured BEFORE its source maps are uploaded, the stack trace is permanently minified. The only fix is "upload source maps before deploying the release." This is fine when you're disciplined, miserable when you forget. Sentry does deferred re-resolution for exactly this reason.

**Pros:** Source map uploads work regardless of timing. Events captured during the upload race become readable the moment the map arrives. Removes a documented gotcha from the DX.

**Cons:** Adds a source-map-upload hook that walks back through recent events and re-resolves. Needs to be efficient (don't re-resolve every event, only those matching `project_id + release`). Changes the fingerprint computation story — should a re-resolved event keep its old fingerprint or get a new one? (Answer: keep old, or you regroup everything.)

**Context:** v1 documents the gotcha in the SDK README and accepts it. The upload endpoint already exists in v1 (`POST /api/v1/sourcemaps`). The v1.5 change is a hook in the sourcemap upload handler that scans `events` for matching release and re-runs `resolveStack()` on any with `metadata.resolved = false`.

**Depends on / blocked by:** v1 shipping.

**Signals to prioritize:** Dogfooding hits this pain the first time the builder deploys a new release and forgets to upload source maps first.

---

## [v1.5] SDK via CDN / script tag

**What:** Ship a UMD build of `@crashpad/sdk` alongside the ESM build so users can drop `<script src="https://unpkg.com/@crashpad/sdk/dist/crashpad.umd.min.js"></script>` and call `window.Crashpad.init({ apiKey: '...' })` without a bundler.

**Why:** Current SDK only ships as an ESM/TS package, which requires a bundler (Vite, Next.js, etc.). Static sites, WordPress, Shopify, or any "paste this in 5 seconds" install flow can't use it. v1's dogfood target (the builder's own prod app) already has a bundler, so this isn't blocking the v1 success criterion — but it's the obvious next expansion of surface area.

**Pros:** Drop-in install matches Sentry's loader ergonomics. Zero hosting infra — unpkg/jsdelivr auto-serves from npm. `/projects/[id]` waiting-for-event state gains a `script tag` tab next to `npm`, which broadens the onboarding funnel.

**Cons:** Two build targets to keep in sync. rrweb must be **bundled inline** in the UMD build (script-tag users can't resolve the bare `import('rrweb')` specifier in `core/replay.ts`), bloating the bundle to ~200KB gzipped. The dynamic-import-during-requestIdleCallback optimization goes away for CDN users. Version pinning becomes a public concern (stale unpkg cache, etc.).

**Context:** Add a second tsup/rollup entry in `packages/sdk/` with `format: 'iife'` + `globalName: 'Crashpad'` + rrweb inlined (not marked as external). Keep ESM build with rrweb as a peer dep and the current dynamic import so bundler users stay lean. Waiting-for-event state on `/projects/[id]` grows a tabs UI: `npm` | `script tag`, each with its own snippet; the script-tag snippet inlines the API key into `window.Crashpad.init({ apiKey: 'cp_...' })`.

**Depends on / blocked by:** v1 shipping AND a concrete user whose app is script-tag-only. Don't build the second target speculatively.

**Signals to prioritize:** Builder's next dogfood target is a static site / WordPress / Shopify, OR a user asks for a CDN install.

---

## [v1.5+] Data retention / auto-pruning

**What:** Configurable TTL per project on events and replays, with a background prune job (default: 30 days).

**Why:** v1 stores events and replays forever. At one user with tens of errors a day, this is a rounding error on Postgres disk. At 100 users with 1000 errors/day each, it's hundreds of gigabytes in a year. The table never shrinks without an explicit delete. Eventually the builder has to either scale Postgres disk or write the retention logic under pressure.

**Pros:** Predictable storage cost. Keeps Postgres happy. Most error monitoring competitors have this as a free tier default.

**Cons:** Adds a background prune job (Bun's `setInterval` or a cron). Adds a settings UI to the project page. Has to handle cascading deletes correctly (replays reference events via correlation_id, not FK, so manual cleanup is needed).

**Context:** New `projects.retention_days INTEGER DEFAULT 30` column. Prune job runs once a day: `DELETE FROM events WHERE project_id = $1 AND created_at < NOW() - INTERVAL '$2 days'`, then same for replays. Needs to be safe to run concurrently with inserts. Consider partitioning the tables by month once scale justifies it.

**Depends on / blocked by:** v1 shipping. Earlier if dogfood traffic grows faster than expected.

**Signals to prioritize:** Postgres disk usage growth, OR the first time someone asks "can I delete old errors?"

---

## [v1.5] `maskUrls` config option for the network panel

**What:** Add a `CrashpadConfig.maskUrls?: 'strip-query' | 'off' | (url: string) => string` option to control how `NetworkSessionEvent.url` is sanitized before it lands on the wire.

**Why:** The network panel (shipped in the network-capture slice) records URLs verbatim, including query strings. URLs with secrets in the query (auth tokens, S3 presigned signatures, OAuth `code`/`state`, password-reset tokens, email addresses) end up in the replay payload. v1 ships with a JSDoc warning on `NetworkSessionEvent.url` documenting the gap and pointing users at this option as the principled fix. Most production apps shouldn't have to read a JSDoc note to be safe — this should become the default.

**Pros:** Closes the URL-PII vector, parallel to how `maskInputs` closes the form-field one. Custom redactor function gives users an escape hatch for app-specific patterns (`/users/:id` → `/users/:redacted`). Safer-by-default if `'strip-query'` becomes the new default.

**Cons:** Stripping the query removes useful debugging signal — `/api/users?id=42` becomes `/api/users` and you can't tell which user the call was for. The dashboard Network panel becomes less informative for apps that legitimately use query strings for non-secret IDs. The custom-function path complicates the SDK's "never throw" guarantee — the user's redactor must be wrapped in `safe()` and fall back to the raw URL on throw.

**Context:** Default is open: `'off'` ships first, JSDoc continues to warn. Once a real user hits the bug or asks for it, ship `'strip-query'` and consider making it default. The redactor function should run inside `safe()` in `core/network.ts:resolveUrl` (or a new `sanitizeUrl` helper). Truncation to `MAX_URL_LENGTH` happens AFTER the redactor.

**Depends on / blocked by:** v1 shipping. The network panel is in v1; the masking option is the v1.5 follow-up.

**Signals to prioritize:** A user reports a leaked token in a replay URL, OR the builder ships Crashpad on an app that uses query-string auth.
