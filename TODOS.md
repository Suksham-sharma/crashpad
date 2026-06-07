# Crashpad TODOs

Deferred work. Not in v1 scope. Each entry has enough context that someone (including future-you) picking it up knows what and why.

---

## [v2] AI root-cause analysis per issue

**What:** Populate the `analyses` table — an LLM-generated explanation, root cause, and suggested fix per issue, computed from its resolved stack trace, source context, and the network/console timeline.

**Why:** The schema already models `analyses` in full (`explanation`, `rootCause`, `suggestedFix`, `model`, `promptVersion`, `status: pending|complete|failed`) but nothing writes to it. It's scaffolding for Crashpad's real differentiator: not just "here's the error and the replay" but "here's what went wrong and how to fix it." The resolved frames + source context + session events are exactly the inputs an LLM needs — and they're already captured and persisted.

**Pros:** Turns a passive monitor into an active debugger. The analysis is pure value-add on data already collected. The `promptVersion` column anticipates iterating the prompt without invalidating old analyses.

**Cons:** LLM cost + latency per issue (run it async on first-seen, not per event). Hallucinated fixes erode trust — needs a grounding/confidence story and explicit "suggestion, not gospel" framing. Adds an LLM provider dependency + key management.

**Context:** On a newly-created issue, gather the latest event's `resolvedFrames` plus a sample replay's `sessionEvents`, build a prompt, call the model, and write a row with `status = complete | failed`. `status = pending` lets the dashboard show a spinner. Schema is ready; this is a net-new worker/controller plus a read route. Wire it off the same `issue:upsert` moment the pub/sub already fires.

**Depends on / blocked by:** v1 shipping, and resolved frames being reliably good (source-map pipeline solid).

**Signals to prioritize:** The builder debugs a real bug and wishes the tool had just told them the answer; OR the replay loop feels complete and `analyses` is the obvious next surface.

---

## [v1.5] Redis-backed pub/sub for multi-node SSE

**What:** Replace the in-process `Map` in `apps/api/src/lib/pubsub.ts` with Redis pub/sub so dashboard SSE survives more than one API instance.

**Why:** `pubsub.ts` is explicitly single-instance — `publish()` only reaches subscribers on the same Node process. The moment the API runs behind a load balancer with 2+ instances (the obvious first scaling step on Fly.io), an SSE client connected to instance A never sees an `issue:upsert` published on instance B. Half your dashboard tabs silently stop updating.

**Pros:** SSE survives horizontal scaling. The `subscribe`/`publish` surface stays identical — the swap is contained to one file. Reuses the Redis already provisioned in `docker-compose.yml`.

**Cons:** Adds a Redis hop to the real-time path (currently zero-infra, in-memory). Dropped-message semantics need a glance, though SSE clients already re-fetch on reconnect so at-most-once delivery is fine.

**Context:** `pubsub.ts` already documents this exact migration in its header comment. `publish()` becomes `PUBLISH crashpad:{projectId}`; `subscribeStream` `SUBSCRIBE`s and yields. Keep the in-memory path as the single-node default behind an env flag — no point paying the hop until there's a second instance.

**Depends on / blocked by:** Running more than one API instance. Until then in-process is strictly better.

**Signals to prioritize:** First time the API scales past one instance, OR SSE updates go missing in a multi-instance deploy.

---

## [v1.5] New-issue + spike alerting

**What:** Notify on a newly-created issue and on an issue spiking — via webhook first, then email/Slack.

**Why:** Today you only see errors if the dashboard is open. The core loop of every error monitor is "something broke → you get pinged." Without it, Crashpad is a pull tool; alerting makes it push. The `issue:upsert` pub/sub already fires at exactly the right moment, and first-seen is detectable from the upsert (insert vs. on-conflict update / `eventCount === 1`).

**Pros:** Closes the "I didn't know it was broken" gap. Reuses the existing `publish()` hook. Webhook-first keeps infra minimal — no outbound email provider needed for the first cut.

**Cons:** Threshold tuning is the hard part — naive "alert on every new issue" trains people to ignore it. Needs per-project alert settings UI and a delivery/retry path. Email/Slack add outbound providers.

**Context:** A new notifier subscribes to `issue:upsert`; on first-seen (or a rate spike vs. a baseline) it POSTs to a project-configured webhook. New `projects.alert_webhook_url` column + a field in the settings page. Start with webhooks; layer email/Slack once a real channel is wanted.

**Depends on / blocked by:** v1 shipping. Spike detection wants a little history first.

**Signals to prioritize:** The builder misses a production error because the dashboard wasn't open.

---

## [v1.5] Ingest rate limiting + per-project quotas

**What:** A token-bucket rate limit on `POST /events`, `/replays`, and `/sourcemaps` keyed by project API key and backed by Redis, plus a daily per-project event quota.

**Why:** The ingest key ships in the browser (`NEXT_PUBLIC_CRASHPAD_API_KEY`) — it's public by design. Anyone can lift it from the bundle and flood ingest, inflating storage and Postgres write load with junk. v1 has no backpressure: `middleware/api-key.ts` only checks the key is valid. Redis is already in `docker-compose.yml` for exactly this.

**Pros:** Caps the blast radius of a leaked/abused key. Protects Postgres write throughput. A quota enables a future free-tier story.

**Cons:** Adds a Redis round-trip on the ingest hot path (mitigate with a small in-memory pre-check). Picking limits without real traffic is guesswork.

**Context:** New `lib/rate-limit.ts` (sliding window or token bucket); `middleware/api-key.ts` checks it right after resolving the key and returns `429` with `Retry-After`. Redis key like `rl:{projectId}:{window}`. No SDK change needed — `core/transport.ts` already treats 4xx as a permanent drop, which is the correct behavior for a throttled event.

**Depends on / blocked by:** v1 shipping. Becomes load-bearing the moment Crashpad runs on a public site.

**Signals to prioritize:** First junk-event flood, OR the API key shows up in a public bundle and someone notices.

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

---

## [v1.5] `maskConsole` config option for the console panel

**What:** Add a `CrashpadConfig.maskConsole?: 'off' | 'errors-only' | (level, args) => unknown[] | null` option to control whether and how `console.*` arguments are captured into the replay payload.

**Why:** The console panel records all `console.log`/`info`/`warn`/`error`/`debug` calls verbatim through the SDK's depth-and-size limited serializer. Apps that print user data — emails, IDs, request/response bodies, tokens — to the console will leak that data into the replay payload. v1 ships with a JSDoc warning on `ConsoleSessionEvent.args` and points users at this option as the principled fix. Parallel to `maskUrls`.

**Pros:** Closes the console-PII vector. `'errors-only'` is a sensible safer default for prod (debugging value is highest for errors). Custom redactor function gives users an escape hatch.

**Cons:** `'errors-only'` reduces the panel's signal in cases where the bug is preceded by `console.log` breadcrumbs — the cost of safety. Custom-function path complicates the SDK's never-throw guarantee — the redactor must run inside `safe()` and fall back to dropping the entry on throw.

**Context:** Default is `'off'` (current behavior, JSDoc warns). Once a real user hits the bug or asks for it, ship `'errors-only'` and consider it as the new default. The redactor should run inside `safe()` in `core/console.ts:wrapLevel`, BEFORE the `serializeArgs` call. Returning `null` skips the entry entirely.

**Depends on / blocked by:** v1 shipping. Console panel landed in v1; the masking option is the v1.5 follow-up.

**Signals to prioritize:** A user reports leaked PII in a console capture, OR the builder ships Crashpad on an app that logs user data to the console.

---

## [v1.5] Source-map resolver — skip pseudo-source frames

**What:** In `apps/api/src/services/sourcemap-resolver.ts`, short-circuit the `findSourceMap` lookup when `bundleName` is a pseudo-source like `<anonymous>`, `eval`, native frames, or anything not ending in `.js`/`.mjs`/`.cjs`.

**Why:** Every browser stack has at least one anonymous or eval frame. Today we issue a DB SELECT per such frame that returns nothing. Wasted roundtrips on the ingest hot path.

**Context:** Add an `isLookupable(bundleName)` guard before the cache check. ~8 LOC. Flagged in the 2026-05-11 senior code review of the sourcemap pipeline as "I3 — not critical but cheap."

**Signals to prioritize:** Profiling shows ingest latency dominated by source-map DB queries, OR a typical 10-frame stack produces 4+ no-op lookups.

---

## [v1.5] Source-map resolver — prefer raw function name when `pos.name` is weak

**What:** In `resolveStack`, change `function: pos.name ?? raw.rawFunction` to a smarter heuristic. `pos.name` from `originalPositionFor` is the original *identifier token* at the position, often a variable like `data` or `result` rather than the enclosing function name.

**Why:** Today a useful minified function name from V8 (`UserForm.handleSubmit`) can get replaced by a less useful original token. Better to prefer `rawFunction` when both are populated, since `rawFunction` reflects the actual call frame.

**Context:** First-pass heuristic: keep `pos.name` only when `rawFunction` looks minified (single letter, starts with `_0x`, etc.). Flagged in the senior review as "I4."

**Signals to prioritize:** Dogfooding shows resolved function names that are worse than the minified originals.

---

## [v1.5] Source-map resolver — project SELECT to only `content`

**What:** In `findSourceMap` (`apps/api/src/controllers/sourcemaps.ts`), drop `SELECT *` and select only the `content` column.

**Why:** Source map content can be up to 20MB. Pulling the full row across the wire when the resolver only consumes `content` doubles per-call allocation on the API server.

**Context:** Switch to `db.select({ content: sourceMaps.content })` and adjust the return type. ~5 LOC. Flagged as "I5 — measurable only with profiling."

**Signals to prioritize:** API server memory pressure correlates with ingest throughput, OR profiling shows source-map row materialization as a hot path.

---

## [v1.5] CLI upload — retry with exponential backoff

**What:** Wrap `uploadMap` in `packages/sdk/cli/upload.mjs` with 3-try exponential backoff for 5xx responses and network errors. Skip retry on 4xx.

**Why:** A single transient 502 or DNS hiccup fails the map upload permanently. In CI this can cost an entire release worth of maps for a 5-second blip. The SDK's transport already does this pattern (one 500ms retry on 5xx in `packages/sdk/src/core/transport.ts`); the CLI should match.

**Context:** ~15 LOC: wrap fetch in a retry helper, sleep `500 * attempt` between attempts. Flagged as "I6 — useful for flaky CI."

**Signals to prioritize:** First CI run that fails on a transient network error, OR builder hits a 502 mid-deploy.

---

## [v1.5] `ResolvedFrame.schemaVersion` for forward-compat

**What:** Add a `v: 1` literal field to the `ResolvedFrame` interface so future shape changes can be detected at read time.

**Why:** v1 resolves stacks at ingest and persists the result. If we ever fix a bug in `normalizeSource` or change the shape, old events render with the old resolution forever — unless we can detect version and either re-resolve or render through a compat path. Pairs naturally with the deferred-resolution v1.5 item above.

**Context:** One line in `db/schema.ts`, one line in the resolver. Web renderer doesn't need to read it yet. Flagged as "S1 — cheap forward insurance."

**Signals to prioritize:** Any change to resolver logic that would alter the shape of an existing field, OR the first time we want to backfill resolution retroactively.

---

## Shipped (graduated from this list)

Started here as deferred work; since landed in `main`:

- **Real-time dashboard updates (SSE)** — `EventSource` issue stream replaced the 10s polling loop. In-process pub/sub → SSE per project with 25s heartbeats. (`apps/api/src/routes/stream.ts`, `apps/api/src/lib/pubsub.ts`, `apps/web/src/queries/use-project-stream.ts`)
- **Deferred source-map re-resolution** — uploading a source map now re-resolves previously-unresolved events for that release. (`apps/api/src/controllers/sourcemaps.ts`)
