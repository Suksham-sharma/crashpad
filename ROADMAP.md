# Crashpad Roadmap

Sequenced plan of record: what we build next and in what order.

**Relationship to `TODOS.md`:** `TODOS.md` is the _detail store_ — every deferred item
there carries its own what / why / pros / cons / signals-to-prioritize. This file is the
_ordering_ layer. It does not repeat that context; it points into it. When an item here
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

**The v1 success criterion has not been met.** It is: _one real bug in the builder's own
production app, debugged through a Crashpad replay._ Not users, not stars — one real bug.
Everything below is ordered against that.

---

## Critical path to v1

Four things stand between here and the success criterion. Nothing else on this page is
on the critical path.

| #   | Gate                                              | State                                      |
| --- | ------------------------------------------------- | ------------------------------------------ |
| 1   | Land the in-flight QA fixes                       | uncommitted on `main`                      |
| 2   | Ingest rate limiting                              | not started — `lib/` has only `pubsub.ts`  |
| 3   | Deploy to Fly.io                                  | not started — no `fly.toml`, no Dockerfile |
| 4   | Instrument the real prod app and catch a real bug | blocked on 3                               |

The "Fix it" feature (P1 below) is the _differentiator_ and the portfolio story, but it is
**not** on the critical path to v1. It can be built in parallel because its most valuable
half — the brief builder — needs no deploy and no GitHub plumbing at all.

---

## P0 — Land the in-flight work

Six modified files plus one new route, sitting uncommitted on `main`. Two of them are a
real bug fix, not polish: **the SSE stream never reached the browser.**

- `apps/web/src/app/live/projects/[id]/stream/route.ts` (new) — serves the event stream
  outside the `/api/*` rewrite. The catch-all rewrite in `next.config.mjs` both beats
  app-router route handlers _and_ buffers streaming responses, so the `EventSource` opened
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
repo through a GitHub App. The agent runs in _their_ CI, with _their_ model key, on _their_
checkout, and opens the PR with the workflow's own `GITHUB_TOKEN`. Chosen deliberately over
a hosted sandbox: no sandbox infra, no repo clone on Crashpad servers, no long-lived write
token in our database. The App needs `actions:write` + `contents:read` only — never write
access to user code.

### Why this is worth building

An agent that opens a PR from a stack trace is a commodity in 2026 — Sentry Seer, Cursor
background agents, Copilot all do it. **What is not a commodity is the input.**

Crashpad detects silent failures. For a dead click there is no exception, no stack trace,
nothing for a conventional monitor to hand an agent. The brief instead reconstructs a
behavioural bug report from the session replay: which element was clicked, what did _not_
happen in the 800ms after, the interaction trail leading up to it, and the network/console
activity around it. Nothing else can produce that, because nothing else captures it.

**The agent is table stakes. The brief is the product.** Effort goes there.

### Build order

**1. `controllers/brief.ts` — pure function, issue → markdown. ✅ SHIPPED.**
Plus `GET /api/v1/issues/:id/brief`. This is the valuable half and the shared substrate if
an MCP server is ever added. Verified against the local `Signal Test` project: both
branches render, the degradation ladder holds when `replay` is null, and a 10-case
prompt-injection suite passes.

Two branches, both matter:

- _Errors_ — resolved frames + `preContext`/`contextLine`/`postContext` source context from
  `events.resolvedFrames`, plus the network/console tail from `replays.sessionEvents`.
- _Signals_ — the behavioural report: selector, click count, the interaction path leading
  in, what did not happen, and the DOM state at that instant.

Raw material available from `getIssueDetail(issueId, userId)` → `{ issue, latestEvent, replay }`:

| Source    | Fields                                                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issues`  | `kind` (`error`\|`signal`), `title`, `fingerprint`, `eventCount`, `firstSeen`, `lastSeen`, `status`                                                                              |
| `events`  | `errorType`, `errorMessage`, `stackTrace`, `release`, `environment`, `resolvedFrames`, `signal` (`SignalDetail`), `metadata` (`url`, `userAgent`, `viewport`, `timelineMarkers`) |
| `replays` | `rrwebData` (interaction trail lives in `type:3` IncrementalSnapshot events), `sessionEvents`, `durationMs`                                                                      |

**2. Schema. ✅ SHIPPED.** Migration `0004_outgoing_preak.sql`. `projects` gained
`repo_full_name`, `repo_id`, `repo_private`, `github_installation_id`. New `fix_runs` table
carries `repo_full_name` snapshotted at dispatch, so the OIDC `repository` claim is checked
against the repo the run actually went to rather than wherever the project points now.

**3. `services/github-app.ts` ✅ SHIPPED.** App JWT → installation token (cached to expiry
− 60 s) → pre-flight → dispatch → poll, plus Actions OIDC verification. It goes in
`services/` because that folder is for **external adapters only**; `controllers/` is
internal domain logic. This convention is locked. Both `node:crypto` paths were verified
under Bun once: PKCS#1 `createSign`, and JWK `createPublicKey` + `createVerify` including
the negative cases (swapped repository claim, foreign signing key).

**4. Endpoints. ✅ SHIPPED.** `POST /api/v1/issues/:id/fix` dispatches and writes a
`fix_runs` row; `GET` polls the Actions run and publishes `fix:progress` through
`lib/pubsub.ts` so it streams over the existing SSE channel — no inbound webhook in v1.
`GET /api/v1/fix-runs/:id/brief` sits **outside `authGuard`** and authenticates with the
run's Actions OIDC token. Rate limit is 10 dispatches per project per rolling hour, plus one
active run per issue. `sweepStuckFixRuns()` runs on boot.

**5. Reference workflow. ✅ SHIPPED.** `.github/workflows/crashpad-fix.yml`. Agent pinned to
`Read Edit Write Glob Grep`.

**6. UI. ✅ SHIPPED.** Repository section on project settings (connect / change / disconnect,
public-repo and missing-workflow warnings); a Fix it button in the issue header and a FIX tab
in the bottom panel carrying run state, the PR link, and a "read the brief" link.
`fix:progress` was added to **both** `lib/pubsub.ts` and the hand-rolled union in
`queries/use-project-stream.ts`.

**Not yet done:** no end-to-end run against a real repository. That needs a registered GitHub
App and a scratch repo, neither of which exists yet.

### What the research changed

Findings that invalidate parts of the original spec. These are settled; don't re-derive.

- **`workflow_dispatch` returns run IDs now.** Pass `return_run_details: true`
  ([changelog, Feb 2026](https://github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids/));
  default from API version `2026-03-10`. The spec's "correlate a dispatch to its run"
  problem is gone. Keep `run-name: Crashpad fix ${{ inputs.crashpad_run_id }}` as a cheap
  fallback for GHES.
- **Never send the brief inline.** Send a `brief_url` the workflow fetches. Inputs are
  capped (~65KB, undocumented), permanently recorded in the run's event payload, and
  world-readable on public repos. A fetched brief is unbounded, revocable and redactable
  server-side. Authenticate the fetch with **Actions OIDC** — its `repository` claim binds
  the request cryptographically and its `repository_visibility` claim lets Crashpad enforce
  public-repo redaction at fetch time rather than trusting a stale DB column.
- **Use `node:crypto` `createSign`, not WebCrypto or `jose`.** GitHub issues a **PKCS#1**
  key; both WebCrypto and `jose` reject that format outright. `createSign` takes it
  verbatim. A failed `crypto.subtle.importKey` also poisons BoringSSL's error queue in Bun,
  making the _next_ `node:crypto` call throw spuriously — so never write a
  try-PKCS#8-catch-fallback auto-detect. Branch on the PEM header string if you must.
- **A `404` on dispatch is ambiguous** — missing workflow file and no-repo-access return the
  same status by design. Pre-flight with
  `GET /repos/{owner}/{repo}/actions/workflows/crashpad-fix.yml` so "you haven't installed
  the workflow yet" is a real diagnosis. Note the file must exist **on the default branch**
  to be dispatchable at all, even when dispatching another ref — that's the most likely
  first-run failure.
- **`installation_id` from the setup callback is spoofable**, and must be re-derived
  server-side or anyone can bind their repo to a victim's project. The setup URL also does
  not preserve a `state` param, so the "which project am I connecting?" round-trip needs a
  session stash or a post-install picker.
  **Correction (verified against the live API, 2026-08-10):** the fix originally recorded
  here — check it against `GET /user/installations` with the signed-in user's OAuth token —
  **does not work.** That endpoint demands a token authorized to a *GitHub App*; Crashpad
  signs users in through an *OAuth App*, so it returns
  `You must authenticate with an access token authorized to a GitHub App`, always. Nor is
  broadening the login an option: listing the user's repos directly would need the `repo`
  scope, i.e. write access to every repository they own — the exact over-permissioning the
  GitHub App design exists to avoid. What ships instead runs the match in reverse:
  `GET /user` + `GET /user/orgs` (read-only) give the user's identities, `GET /app/installations`
  (App JWT) lists the App's own installations, and only those whose account matches an
  identity are offered. Costs one extra read scope, `read:org`, and no write scope at all.
- **Persist `repo_id` and `repo_private` too**, beyond the two columns in the spec.
  `repo_full_name` breaks on rename; `repo_id` is stable and lets tokens be scoped via
  `repository_ids`.
- **`lib/pubsub.ts`'s message union is closed, and
  `apps/web/src/queries/use-project-stream.ts` re-declares it by hand** and hard-filters on
  `msg.type`. A new `fix:progress` variant is silently dropped by the dashboard unless both
  are updated. Easiest thing to miss in the whole feature.
- **`env.ts` validates eagerly at import.** Adding `required('GITHUB_APP_ID')` hard-crashes
  boot for every existing deploy. Use `optional(name, '')` plus a runtime check inside
  `github-app.ts`.
- **A PR opened with the default `GITHUB_TOKEN` does not trigger downstream workflows.** The
  agent's PR arrives with an empty check list, which reads as "CI passed" to a reviewer.
  Document it loudly, or have users supply their own token on the PR step.

### Risks

- 🔴 **Prompt injection is the top risk.** The brief is built from end-user browser data and
  fed to an agent holding a write-scoped token. Microsoft
  [documented this exact attack against `claude-code-action`](https://www.microsoft.com/en-us/security/blog/2026/06/05/securing-ci-cd-in-agentic-world-claude-code-github-action-case/)
  in June 2026 — injection drove the agent to read `/proc/self/environ` and exfiltrate a
  chunked API key past both the model's refusal layer and GitHub's secret scanner. **Our
  vector is worse than the disclosed one:** that required an authenticated, visible,
  rate-limited repo comment; ours needs only a `console.log()` on a page an attacker visits.
  Anonymous, invisible to the repo owner, free.
  Mitigations, in order: fence untrusted data behind an explicit trust declaration
  (done in `brief.ts`); sanitize server-side (done); **pin the workflow's `--allowedTools`
  to `Read,Edit,Write,Glob,Grep` — no `Bash`, no `WebFetch`**; never let the agent's PR
  merge itself.
- 🔴 **Public repos leak end-user data**, and the brief-URL fix only solves half of it. The
  _PR itself_ is public — title, body, diff. Recommendation: warn at connect time, redact
  server-side by default for public repos, but do **not** block. Blocking kills OSS adoption
  and pushes people to throwaway private mirrors, which is strictly worse.
- 🟠 **Selector → source.** Largely solved in `brief.ts` (see below), but the underlying SDK
  defect remains — see P5.
- 🟠 **Cost per click.** Every press burns the user's CI minutes and model tokens. Needs a
  per-project rate limit before this is real (distinct from ingest limiting — see P2).
- 🟠 **An in-process poll loop dies with the process.** Any `fix_runs` row left `running`
  after a deploy never resolves — a permanent stuck spinner. Sweep on boot; ~15 lines.
- GitHub only. No GitLab/Bitbucket path.

### How the brief solves selector → source

Worth recording, because the finding was counterintuitive. `deriveSelector`'s role+text
branch reads `el.getAttribute('role')`, which is `null` on a native `<button>` — implicit
ARIA roles are not attributes. So a plain `<button class="btn">Save</button>` falls through
to the structural `nth-of-type` path. **The ungreppable fallback is the common case for the
most ordinary button in existence, not a rare tail.**

The brief therefore ranks its search keys: `targetText` (it is `textContent`, so it is the
literal string in the JSX) → DOM reconstruction from the rrweb FullSnapshot (classes,
attributes, ancestor chain) → URL pathname → selector, last. Selectors are classified
`greppable` / `informational` / `structural`, and a structural one carries an explicit
**"do NOT search the codebase for this string"** warning. Telling the agent a key is
worthless is worth more than letting it burn turns grepping `nth-of-type`.

---

## P2 — Rate limiting

Two different limits, often conflated. Both are needed; they protect different things.

**Ingest limiting** — protects _Crashpad_ from junk floods. The ingest key ships in the
browser bundle by design (`NEXT_PUBLIC_CRASHPAD_API_KEY`); anyone can lift it and flood
`/events`, `/replays`, `/sourcemaps`. Today `middleware/api-key.ts` only checks that the key
is valid — there is no backpressure at all. Full context in `TODOS.md`.

**Fix-dispatch limiting** — protects the _user's wallet_. Per-project cap on Fix it presses.
Independent of ingest volume.

**Recommendation, and a departure from the earlier plan:** `TODOS.md` specs ingest limiting
as Redis-backed. Redis-backed only buys anything once there are 2+ API instances — the exact
same condition that gates the Redis pub/sub item. A single-instance Fly deploy is fully
covered by an in-memory token bucket in `middleware/api-key.ts`: about an hour of work, no
new infra on the ingest hot path, no Redis round-trip per event. Ship that, deploy, and let
the Redis version land _with_ the pub/sub swap when there is genuinely a second instance.

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

## P5 — Bugs found during Fix-it research

Three defects in shipped code, found while mapping the brief's inputs. None are blocking,
all are real.

1. **`:has-text()` is not valid CSS** — `packages/sdk/src/core/signals.ts:85`. It is
   Playwright syntax; `document.querySelector` throws on it. Harmless as an issue grouping
   key, actively misleading anywhere it is presented as a queryable selector. The
   interpolated text is also un-escaped, unlike every sibling branch.
2. **The role+text branch is near-dead** — same function. `getAttribute('role')` returns
   `null` for native interactive elements, so the branch only fires for
   `<div role="button">`. Fix: fall back to an implicit-role map, or add a text-based branch
   before the structural path. This measurably improves every signal issue's greppability.
3. **A replay can be persisted with no FullSnapshot, which makes it unplayable.**
   `core/replay.ts`'s buffer window and rrweb's checkout interval are both 30s and
   uncoordinated, so `prune()` at flush time can drop the last snapshot with no replacement.
   Estimated ~2% of dead clicks. `DockedPlayer.tsx:126` swallows the resulting Replayer
   throw and renders a blank pane, so it presents as "the player is broken" with no error.
   This one is user-visible and worth fixing regardless of Fix it.

---

## P6 — Housekeeping

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
