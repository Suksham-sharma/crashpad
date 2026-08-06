# Crashpad Roadmap

Sequenced plan of record: what we build next and in what order.

**Relationship to `TODOS.md`:** `TODOS.md` is the *detail store* — every deferred item
there carries its own what / why / pros / cons / signals-to-prioritize. This file is the
*ordering* layer. It does not repeat that context; it points into it. When an item here
says "see TODOS.md", the reasoning lives there and is not duplicated.

---

## Where we are

`main` is at `517578f`. Nine PRs merged. The v1 loop is closed end to end:

```
SDK capture ─→ ingest ─→ fingerprint ─→ source-map resolution ─→ issue list
     │                                                              │
     └─ rrweb replay ─────────────────────────────────────→ docked player
                                                                    │
                              network / console panels ─────────────┘
                              silent-failure detection (dead + rage clicks)
                              live updates over SSE
```

**Shipped:** ingest + fingerprinting, GitHub OAuth (better-auth), project CRUD + API keys,
issue list with search / time / kind filters, issue detail, docked replay player with
click-to-seek, network panel, console panel, source-map upload CLI + server-side stack
resolution + deferred re-resolution, SSE live updates, dead-click / rage-click detection.

**The v1 success criterion has not been met.** It is: *one real bug in the builder's own
production app, debugged through a Crashpad replay.* Not users, not stars — one real bug.
Everything below is ordered against that.

---

## Critical path to v1

Four things stand between here and the success criterion. Nothing else on this page is
on the critical path.

| # | Gate | State |
|---|------|-------|
| 1 | Land the in-flight QA fixes | uncommitted on `main` |
| 2 | Ingest rate limiting | not started — `lib/` has only `pubsub.ts` |
| 3 | Deploy to Fly.io | not started — no `fly.toml`, no Dockerfile |
| 4 | Instrument the real prod app and catch a real bug | blocked on 3 |

The "Fix it" feature (P1 below) is the *differentiator* and the portfolio story, but it is
**not** on the critical path to v1. It can be built in parallel because its most valuable
half — the brief builder — needs no deploy and no GitHub plumbing at all.

---

## P0 — Land the in-flight work

Six modified files plus one new route, sitting uncommitted on `main`. Two of them are a
real bug fix, not polish: **the SSE stream never reached the browser.**

- `apps/web/src/app/live/projects/[id]/stream/route.ts` (new) — serves the event stream
  outside the `/api/*` rewrite. The catch-all rewrite in `next.config.mjs` both beats
  app-router route handlers *and* buffers streaming responses, so the `EventSource` opened
  and then sat silent forever. **Do not move this back under `/api/`.**
- `queries/use-project-stream.ts` — points at `/live/...`, and the subscription is no
  longer gated on the onboarding button. It was `useProjectStream(id, listening)`, and
  `listening` only flipped true from the waiting state — so any project with at least one
  issue never subscribed at all.

Either bug alone kills live updates. The feature has been dead since `1d22b07` shipped it.

Plus four QA fixes: project-name whitespace validation (`pattern: '\\S'` + `.trim()` on
create and update), `SEEN 1 TIME` pluralization, dead/rage-click messages reworded to lead
with the outcome rather than the selector.

**Open item:** the FilterBar change collapses three kind chips (`All / Errors / Silent`)
into a single `Silent only` toggle. It typechecks but was never looked at in a browser, and
it drops errors-only filtering from the UI — `kind=error` still works on the API. Verify
visually, then commit. Do not build on top of unverified UI.

---

## P1 — "Fix it": issue → agent → PR

One button on an issue page. Click it, and a coding agent opens a PR that fixes the bug.

**Crashpad does not run the agent.** It triggers a `workflow_dispatch` in the user's own
repo through a GitHub App. The agent runs in *their* CI, with *their* model key, on *their*
checkout, and opens the PR with the workflow's own `GITHUB_TOKEN`. Chosen deliberately over
a hosted sandbox: no sandbox infra, no repo clone on Crashpad servers, no long-lived write
token in our database. The App needs `actions:write` + `contents:read` only — never write
access to user code.

### Why this is worth building

An agent that opens a PR from a stack trace is a commodity in 2026 — Sentry Seer, Cursor
background agents, Copilot all do it. **What is not a commodity is the input.**

Crashpad detects silent failures. For a dead click there is no exception, no stack trace,
nothing for a conventional monitor to hand an agent. The brief instead reconstructs a
behavioural bug report from the session replay: which element was clicked, what did *not*
happen in the 800ms after, the interaction trail leading up to it, and the network/console
activity around it. Nothing else can produce that, because nothing else captures it.

**The agent is table stakes. The brief is the product.** Effort goes there.

### Build order

**1. `controllers/brief.ts` — pure function, issue → markdown.**
Plus `GET /api/v1/issues/:id/brief` so the output can be eyeballed before any GitHub
plumbing exists. This is the valuable half and the shared substrate if an MCP server is
ever added. Build and iterate against the local `Signal Test` project, which has four real
signal issues and one error.

Two branches, both matter:
- *Errors* — resolved frames + `preContext`/`contextLine`/`postContext` source context from
  `events.resolvedFrames`, plus the network/console tail from `replays.sessionEvents`.
- *Signals* — the behavioural report: selector, click count, the interaction path leading
  in, what did not happen, and the DOM state at that instant.

Raw material available from `getIssueDetail(issueId, userId)` → `{ issue, latestEvent, replay }`:

| Source | Fields |
|---|---|
| `issues` | `kind` (`error`\|`signal`), `title`, `fingerprint`, `eventCount`, `firstSeen`, `lastSeen`, `status` |
| `events` | `errorType`, `errorMessage`, `stackTrace`, `release`, `environment`, `resolvedFrames`, `signal` (`SignalDetail`), `metadata` (`url`, `userAgent`, `viewport`, `timelineMarkers`) |
| `replays` | `rrwebData` (interaction trail lives in `type:3` IncrementalSnapshot events), `sessionEvents`, `durationMs` |

**2. Schema.** `projects.repo_full_name` + `projects.github_installation_id`. New `fix_runs`
table: issue FK, `status` (`pending`\|`running`\|`complete`\|`failed`), `prUrl`, timestamps.
New Drizzle migration.

**3. `services/github-app.ts`** — App JWT → installation token → dispatch. It goes in
`services/` because that folder is for **external adapters only**; `controllers/` is
internal domain logic. This convention is locked.

**4. Endpoints.** `POST /api/v1/issues/:id/fix` builds the brief, dispatches, writes a
`fix_runs` row. `GET /api/v1/issues/:id/fix` polls the Actions run and publishes progress
through `lib/pubsub.ts` `publish()` so it streams to the UI over the SSE channel that
already exists — no inbound webhook in v1.

**5. Reference workflow.** A `.github/workflows/crashpad-fix.yml` users drop into their repo.

**6. UI.** "Connect repository" on project settings; a Fix it button on the issue page with
run status streaming into a panel.

### Risks — read before designing the brief

- **Selector → source is make-or-break.** The brief identifies elements by CSS selector and
  the agent must grep for it. `deriveSelector` in `packages/sdk/src/core/signals.ts` prefers
  `data-testid`, then `id`, then `aria-label`, then role+text — and falls back to a
  structural `nth-of-type` path that is effectively ungreppable. The brief needs a real
  answer for what it says when all it has is a structural path.
- **Public repos expose workflow inputs and Actions logs to the world.** A brief carries
  real end-user session data — URLs, console output. This does not go to a public repo
  without a deliberate decision.
- **Prompt injection.** The brief contains data captured from end users' browsers —
  attacker-influenced console output and URLs — and it is fed to an agent holding a
  `GITHUB_TOKEN` with write access. This is a genuine injection vector and needs a real
  mitigation, not a note.
- **Cost per click.** Every press burns the user's CI minutes and model tokens. Needs a
  per-project rate limit before this is real (distinct from ingest limiting — see P2).
- **Missing workflow file returns 404 on dispatch.** Surface "you haven't installed the
  workflow yet", never a dead spinner.
- GitHub only. No GitLab/Bitbucket path.

---

## P2 — Rate limiting

Two different limits, often conflated. Both are needed; they protect different things.

**Ingest limiting** — protects *Crashpad* from junk floods. The ingest key ships in the
browser bundle by design (`NEXT_PUBLIC_CRASHPAD_API_KEY`); anyone can lift it and flood
`/events`, `/replays`, `/sourcemaps`. Today `middleware/api-key.ts` only checks that the key
is valid — there is no backpressure at all. Full context in `TODOS.md`.

**Fix-dispatch limiting** — protects the *user's wallet*. Per-project cap on Fix it presses.
Independent of ingest volume.

**Recommendation, and a departure from the earlier plan:** `TODOS.md` specs ingest limiting
as Redis-backed. Redis-backed only buys anything once there are 2+ API instances — the exact
same condition that gates the Redis pub/sub item. A single-instance Fly deploy is fully
covered by an in-memory token bucket in `middleware/api-key.ts`: about an hour of work, no
new infra on the ingest hot path, no Redis round-trip per event. Ship that, deploy, and let
the Redis version land *with* the pub/sub swap when there is genuinely a second instance.

Note that `README.md` currently lists Redis as "rate limiting / dedup — wiring in progress".
It is provisioned in `docker-compose.yml` and used by nothing. Either wire it or correct the
README.

---

## P3 — Deploy

No deploy configuration exists anywhere: no `fly.toml`, no Dockerfile for either app. This
is the longest pole on the critical path, and the unknowns are in prod migrations and env
management rather than in the app code.

- Dockerfile for `apps/api` (Bun) and `apps/web` (Next.js standalone output —
  `outputFileTracingRoot` is already pinned in `next.config.mjs` for this).
- Fly config, secrets, managed Postgres.
- Migration strategy against a live database.
- Health check is already there: `GET /health` probes the DB.
- Uptime heartbeat.
- **Verify SSE survives the deploy.** The `/live/*` route exists specifically because one
  proxy layer buffered the stream. A second proxy in production is exactly the same class of
  bug. `X-Accel-Buffering: no` is set on both hops; confirm it holds end to end.

Then: instrument the real production app, and go find a real bug.

---

## P4 — Deferred backlog (v1.5+)

Full context for each in `TODOS.md`. Ordered here by when the trigger is likely to fire.

**Privacy — ship before anyone else's users are recorded**
- `maskUrls` — URLs are captured verbatim including query strings, so auth tokens, presigned
  signatures and OAuth codes land in the replay payload. Currently a JSDoc warning.
- `maskConsole` — same exposure through captured `console.*` arguments.

Both become urgent the moment Crashpad runs on an app that is not the builder's own. The
Fix it feature raises the stakes further: this data would leave Crashpad entirely and land
in someone's CI logs.

**Alerting**
- New-issue and spike alerting, webhook first, then email/Slack. Today you only see errors
  if the dashboard is open, which makes Crashpad a pull tool. `issue:upsert` already fires
  at the right moment. Note that `DESIGN.md` §12 flags the `Bell` control in the nav as
  implying a feature that does not exist — it should be deleted until this ships.

**Scale — each gated on a real signal, not a calendar**
- Redis-backed pub/sub for multi-node SSE (gate: a second API instance).
- Compressed replay storage (gate: `replays` past ~1GB, or VACUUM in the slow log).
- Data retention / auto-pruning (gate: disk growth, or someone asks to delete old errors).

**Reach**
- SDK via CDN / script tag (gate: a concrete user whose app has no bundler).

**Source-map and CLI refinements** — small, cheap, all flagged in review
- Skip pseudo-source frames (`<anonymous>`, `eval`) before the DB lookup.
- Prefer the raw function name when `pos.name` is a weak identifier token.
- Project the source-map `SELECT` to `content` only.
- Retry with exponential backoff in the upload CLI.
- `ResolvedFrame.schemaVersion` for forward-compat.

---

## P5 — Housekeeping

- **Un-ignore `DESIGN.md`** (`.gitignore:56`). It is currently one `git clean` from being
  lost, which has already happened once.
- **Spec the Docked Player.** `DockedPlayer.tsx` is the only source of truth for panel
  ratios, scrub bar construction, and the player's loading / no-replay / broken-replay
  states. `DESIGN.md` §12 tracks this.
- Resolve the remaining `DESIGN.md` §12 open decisions: the off-scale `13px`/`15px` uses,
  the near-dead `--color-accent-hover` token, and the `h-11` → `h-12` primary CTA.
- Playwright E2E for onboarding, error investigation, and SDK-failure flows — **only once
  CI is actually wired.** Until then tests are cost without benefit, since nothing runs them.
- README: correct the Redis line, and document the `/live/*` stream route, which is absent
  from the API surface table.

---

## Decisions that are locked

Do not re-litigate these without updating this file:

- `services/` is for external adapters only. `controllers/` is internal domain logic.
- Fix it dispatches to the user's CI. No hosted sandbox, no repo clone, no stored write token.
- The SSE stream is served from `app/live/...`, outside the `/api/*` rewrite.
- Events and signals share the `events` table. There is no `signals` table.
- One database. Postgres holds metadata, events, replays and source maps.
- Replays join to events on `correlationId`, not a foreign key — the two payloads race.
