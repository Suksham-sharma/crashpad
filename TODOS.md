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

**Why:** The issue list polls `GET /api/v1/issues?project_id=...` every 10 seconds. At one user in one tab this is fine. But the first time you watch an error land in real time and there's a 10-second delay between the crash and it appearing in the dashboard, it feels sluggish. Also: 10s polling from N tabs is N*6 req/min to the API for data that hasn't changed 95% of the time.

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

## [v1.5+] Data retention / auto-pruning

**What:** Configurable TTL per project on events and replays, with a background prune job (default: 30 days).

**Why:** v1 stores events and replays forever. At one user with tens of errors a day, this is a rounding error on Postgres disk. At 100 users with 1000 errors/day each, it's hundreds of gigabytes in a year. The table never shrinks without an explicit delete. Eventually the builder has to either scale Postgres disk or write the retention logic under pressure.

**Pros:** Predictable storage cost. Keeps Postgres happy. Most error monitoring competitors have this as a free tier default.

**Cons:** Adds a background prune job (Bun's `setInterval` or a cron). Adds a settings UI to the project page. Has to handle cascading deletes correctly (replays reference events via correlation_id, not FK, so manual cleanup is needed).

**Context:** New `projects.retention_days INTEGER DEFAULT 30` column. Prune job runs once a day: `DELETE FROM events WHERE project_id = $1 AND created_at < NOW() - INTERVAL '$2 days'`, then same for replays. Needs to be safe to run concurrently with inserts. Consider partitioning the tables by month once scale justifies it.

**Depends on / blocked by:** v1 shipping. Earlier if dogfood traffic grows faster than expected.

**Signals to prioritize:** Postgres disk usage growth, OR the first time someone asks "can I delete old errors?"
