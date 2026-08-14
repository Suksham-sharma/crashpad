# Crashpad

Frontend error monitoring with a DevTools-style **docked replay player** as the wedge. When an error fires, the SDK flushes the last 30 seconds of the user's session — DOM mutations, clicks, network, console — alongside the stack trace. The dashboard plays that clip back in a time-travel debugger where the **resolved stack trace and the DOM replay scrub together**, so you watch the bug happen instead of guessing from a stack frame.

---

## Quickstart

```bash
# 1. install deps (Bun workspaces)
bun install

# 2. bring up postgres + redis
bun db:up

# 3. copy env + fill in GitHub OAuth secrets
cp .env.example .env
$EDITOR .env

# 4. run migrations
bun db:migrate

# 5. run the api + web in parallel
bun dev
```

Run them individually if you prefer:

```bash
bun dev:api   # Elysia on :4000
bun dev:web   # Next.js on :3000
```

You'll need a [GitHub OAuth App](https://github.com/settings/developers) with its callback URL set to `http://localhost:3000/api/auth/callback/github`. Drop the client ID/secret into `.env`.

---

## How it works

Crashpad is split into three independently-deployable pieces in one Bun monorepo.

### 1. The SDK (`@crashpad/sdk`) — browser only

`Crashpad.init()` installs four capture channels and never throws into the host app (every public entry point is wrapped in `safe()`):

- **Errors** — `window.onerror` + `unhandledrejection`, plus a manual `captureException()`.
- **Replay** — `rrweb` recording into a **30-second circular buffer**, lazily `import()`ed during an idle frame so it never blocks first paint. Inputs are masked by default.
- **Network** — `fetch` / `XHR` timing, status, and failures.
- **Console** — `log` / `info` / `warn` / `error` / `debug`.

When an error fires, the SDK normalizes it, stamps a fresh **`correlationId`**, and sends **two separate payloads**:

| Payload            | Endpoint               | Why separate                                          |
| ------------------ | ---------------------- | ----------------------------------------------------- |
| **Event** (small)  | `POST /api/v1/events`  | `fetch` `keepalive` so it survives page-unload        |
| **Replay** (large) | `POST /api/v1/replays` | `keepalive` caps bodies at 64 KB; replays exceed that |

Both carry the same `correlationId`. The server joins them on read rather than via a foreign key — this sidesteps the split-payload race where the replay arrives before (or after) the event. Calls to Crashpad's own ingest endpoints are filtered out of the captured session so the SDK never records itself.

### 2. The API (`@crashpad/api`) — Elysia on Bun

On event ingest the server:

1. **Fingerprints** the error — `sha1(errorType | normalizedMessage | topStackFrame)`. The message is normalized (UUIDs, numbers, and quoted strings collapsed to placeholders) and the top frame has its `line:col` stripped, so a shifting minified offset doesn't split one bug into a hundred issues.
2. **Resolves the stack** against uploaded source maps (best-effort, per-frame) — original function/file/line plus ±3 lines of source context.
3. **Upserts the issue** in one transaction: insert-or-bump `eventCount` / `lastSeen`, then insert the event.
4. **Publishes** an `issue:upsert` to the in-process pub/sub, which fans out to any open dashboard SSE stream.

Source maps are uploaded out-of-band via the `crashpad` CLI. Because resolution is best-effort, a **deferred source-map upload re-resolves** any events for that release that came in unresolved.

### 3. The dashboard (`@crashpad/web`) — Next.js 15

App Router, TanStack Query, Zustand, Tailwind v4. Issues stream in **live over SSE** (no polling). Open an issue to get the resolved stack frames, the source-context block, the network/console timeline, and the **docked replay player** scrubbing in lockstep with the error timeline.

---

## "Fix it" — issue → agent → pull request

One button on an issue page. Crashpad packages the issue into a bug report and dispatches a `workflow_dispatch` into **your** repository. The agent runs in your CI, with your model key, on your checkout, and opens the pull request with the workflow's own `GITHUB_TOKEN`. Crashpad never clones your code and never holds a write token.

**The brief is the product.** An agent that opens a PR from a stack trace is a commodity. What is not is the input: Crashpad detects _silent failures_ — dead clicks and rage clicks — where there is no exception and no stack trace at all. For those the brief reconstructs a behavioural bug report from the session replay: which element was clicked, what did **not** happen in the 800 ms after, the interaction trail leading in, and the network/console activity around it.

Because the derived CSS selector is often a structural `nth-of-type` path that appears nowhere in source, the brief ranks its search keys — visible label, then a DOM reconstruction from the rrweb snapshot, then the route — and explicitly tells the agent when a selector is _not_ worth grepping for.

### Setting it up

1. Register a GitHub App with **`actions: write`** + **`contents: read`**. Nothing else — it can never write your code.
2. Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG` and `PUBLIC_API_URL` on the API. All four are optional; without them Fix it is simply unavailable and everything else runs as before.
3. Copy [`.github/workflows/crashpad-fix.yml`](.github/workflows/crashpad-fix.yml) into your repo and **merge it to your default branch** — a `workflow_dispatch` target is undispatchable until it lands there.
4. Add an `ANTHROPIC_API_KEY` repository secret.
5. Connect the repository under project **Settings → Repository**.

### Trust model

The brief is built from real end-user browser sessions, so console output, URLs and DOM text in it are attacker-controllable — anyone who can run script on the affected page can put text there. Three things follow, and none of them is optional:

- The brief **fences untrusted sections** behind an explicit `<untrusted-telemetry>` declaration and sanitizes them server-side (HTML comments, zero-width characters, ANSI escapes and fence breakouts are stripped; query strings never leave Crashpad).
- The reference workflow pins the agent to `Read Edit Write Glob Grep`. **No `Bash`, no `WebFetch`** — those are the two tools that turn an injected instruction into execution and exfiltration.
- Briefs for **public** repositories are redacted server-side: console contents and page origins are withheld. Element labels survive, because they are your own UI strings and they are what makes the brief useful.

The brief is fetched by the runner rather than passed as a workflow input, because inputs are size-capped, recorded permanently in the run's event payload, and world-readable on a public repo. The fetch authenticates with the run's **Actions OIDC token**, whose `repository` claim binds the request to the repo entitled to read it.

One caveat worth knowing: a PR opened with the default `GITHUB_TOKEN` **does not trigger your other workflows**, so it arrives with an empty check list that reads like a green CI. Swap in your own token on the PR step if that matters.

---

## Architecture

![Crashpad architecture](docs/architecture.png)

---

## Project layout

```
crashpad/
├── apps/
│   ├── api/                 # Elysia on Bun — ingest, grouping, resolution, SSE
│   │   └── src/
│   │       ├── routes/      # HTTP surface (events, replays, sourcemaps, issues, projects, stream)
│   │       ├── controllers/ # ingest + fingerprint + query logic
│   │       ├── services/    # source-map resolver
│   │       ├── lib/         # in-process pub/sub
│   │       ├── middleware/  # api-key, auth-guard, cors
│   │       └── db/          # Drizzle schema + migrations
│   └── web/                 # Next.js 15 App Router dashboard
│       └── src/
│           ├── app/         # routes (dashboard, projects, issues)
│           ├── components/  # DockedPlayer, modals, nav
│           ├── queries/     # TanStack Query hooks + SSE stream
│           └── stores/      # Zustand UI state
├── packages/
│   └── sdk/                 # @crashpad/sdk — browser SDK + upload CLI
│       ├── src/core/        # capture, replay, network, console, transport
│       └── cli/upload.mjs   # source-map uploader
├── docker-compose.yml       # Postgres 16 + Redis 7
└── TODOS.md                 # Deferred work (v1.5+)
```

---

## API surface

Ingest endpoints authenticate with a project **API key** (`Authorization: Bearer <key>`); dashboard endpoints use the **GitHub session** cookie.

| Method                 | Path                                  | Auth         | Purpose                                           |
| ---------------------- | ------------------------------------- | ------------ | ------------------------------------------------- |
| `GET`                  | `/health`                             | —            | Liveness + DB probe                               |
| `POST`                 | `/api/v1/events`                      | API key      | Ingest an error event                             |
| `POST`                 | `/api/v1/replays`                     | API key      | Ingest a session replay                           |
| `POST`                 | `/api/v1/sourcemaps`                  | API key      | Upload a source map for a release                 |
| `GET`                  | `/api/v1/me`                          | session      | Current user                                      |
| `GET` `POST`           | `/api/v1/projects`                    | session      | List / create projects                            |
| `GET` `PATCH` `DELETE` | `/api/v1/projects/:id`                | session      | Read / rename / delete project                    |
| `POST`                 | `/api/v1/projects/:id/regenerate-key` | session      | Rotate API key                                    |
| `GET`                  | `/api/v1/projects/:id/issues`         | session      | List issues (search + time filter)                |
| `GET` `PATCH`          | `/api/v1/issues/:id`                  | session      | Read issue / change status                        |
| `GET`                  | `/api/v1/issues/:id/brief`            | session      | Agent-ready bug report (markdown)                 |
| `POST` `GET`           | `/api/v1/issues/:id/fix`              | session      | Dispatch a fix run / poll it                      |
| `GET` `PUT` `DELETE`   | `/api/v1/projects/:id/repo`           | session      | Read / connect / disconnect the repo              |
| `GET`                  | `/api/v1/github/app`                  | session      | Is the GitHub App configured, and its install URL |
| `GET`                  | `/api/v1/github/installations`        | session      | Repos you can connect                             |
| `GET`                  | `/api/v1/fix-runs/:id/brief`          | Actions OIDC | Brief delivery to a workflow run                  |
| `GET`                  | `/api/v1/projects/:id/stream`         | session      | SSE live updates                                  |
| `*`                    | `/api/auth/*`                         | —            | better-auth (GitHub OAuth)                        |

---

## Instrumenting an app

```ts
import Crashpad from '@crashpad/sdk';

Crashpad.init({
  apiKey: process.env.NEXT_PUBLIC_CRASHPAD_API_KEY!,
  release: process.env.NEXT_PUBLIC_CRASHPAD_RELEASE, // ties errors to a source-map set
  environment: process.env.NODE_ENV,
  // replay: true,       // default — set false to disable rrweb capture
  // maskInputs: true,   // default — mask text in <input>/<textarea>
});
```

Upload source maps for a release after each production build:

```bash
bunx crashpad upload --dir ./dist --release "$GIT_SHA" --api-key "$CRASHPAD_API_KEY"
```

---

## Tech stack

| Layer           | Choice                                                              |
| --------------- | ------------------------------------------------------------------- |
| API             | Elysia.js on Bun                                                    |
| Database        | PostgreSQL 16 (metadata + events + replays + source maps in one DB) |
| ORM             | Drizzle                                                             |
| Cache           | Redis 7 (rate limiting / dedup — wiring in progress)                |
| Real-time       | Server-Sent Events over an in-process pub/sub                       |
| Frontend        | Next.js 15 App Router + React 19 + Tailwind v4                      |
| Data layer      | TanStack Query + Zustand                                            |
| Auth            | better-auth, GitHub OAuth only                                      |
| Replay capture  | rrweb (lazy import, 30 s circular buffer)                           |
| Replay playback | custom docked player                                                |
| Source maps     | `source-map-js` + `stacktrace-parser`, best-effort per-frame        |
| Monorepo        | Bun workspaces                                                      |
| Testing         | bun test + Playwright                                               |

---

## License

TBD (private during v1 dogfooding).
