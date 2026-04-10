# Crashpad

Frontend error monitoring with a DevTools-style docked replay player as the wedge. When an error fires, the SDK flushes the last 30 seconds of the user's session (DOM, clicks, network, console) alongside the stack trace. The dashboard plays that 30-second clip in a time-travel debugger where the stack trace and the DOM replay scrub together.

Status: **pre-v1, building week 1.**

## Quickstart

```bash
# 1. install deps
bun install

# 2. bring up postgres + redis
bun db:up

# 3. copy env + fill in GitHub OAuth secrets
cp .env.example .env
$EDITOR .env

# 4. run the api + web in parallel
bun dev

# or run them individually:
bun dev:api   # Elysia on :4000
bun dev:web   # Next.js on :3000
```

## Layout

```
crashpad/
├── apps/
│   ├── api/     # Elysia.js on Bun — ingestion, grouping, dashboard API
│   └── web/     # Next.js 15 App Router — dashboard
├── packages/
│   └── sdk/     # @crashpad/sdk — browser SDK (window.onerror + rrweb)
├── docker-compose.yml   # Postgres 16 + Redis 7
└── TODOS.md             # Deferred work (v1.5+)
```

## Tech stack

| Layer | Choice |
|-------|--------|
| API | Elysia.js on Bun |
| Database | PostgreSQL 16 (single DB for metadata + events + replays) |
| ORM | Drizzle |
| Cache | Redis 7 (rate limiting, dedup) |
| Frontend | Next.js 15 App Router + Tailwind v4 |
| Auth | GitHub OAuth only |
| Replay capture | rrweb (dynamic import, 30s circular buffer) |
| Replay playback | rrweb-player (v1 weeks 1–2) → custom docked player (v1 week 3) |
| Monorepo | Bun workspaces |
| Testing | bun test + Playwright |

## Goals for v1

**Success criterion:** Crashpad catches a real bug in the builder's own production web app and the replay materially shortens debugging time.

Not "10 users." One real bug, debugged from a replay, by the builder.

## License

TBD (private during v1 dogfooding).
