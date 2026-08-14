# Engineering notes

Constraints, gotchas and rejected alternatives that the source cannot express on
its own. Extracted verbatim-in-substance from code comments when those were
removed from `apps/api` and `apps/web`.

This file exists because the house rule is that code carries no explanatory
prose — the code should read on its own, and the reasoning lives here. Anything
below is a **decision or a trap**, not a description of what the code does. If
you are about to "simplify" something in these areas, read the relevant entry
first.

---

## GitHub App — keys, tokens, dispatch

**The private key arrives in two shapes.** `.env` cannot hold literal newlines,
so a PEM pasted there comes through with backslash-`n`. Both forms have to work.

**Do not probe key formats.** GitHub issues a PKCS#1 key (`BEGIN RSA PRIVATE
KEY`). `node:crypto`'s `createSign` accepts that verbatim; WebCrypto and `jose`
both reject it outright. Do **not** add a try-PKCS#8-catch-PKCS#1 fallback — a
failed `crypto.subtle.importKey` poisons BoringSSL's error queue under Bun and
makes the *next* `node:crypto` call throw spuriously.

**`GET /user/installations` cannot be used.** It demands a token authorized to a
*GitHub App*, and Crashpad signs users in through an *OAuth App*, so it returns
403 regardless. The inverse — list the App's own installations and keep the ones
belonging to this user — needs only read-only user scopes and never asks anyone
for `repo` scope. That listing is `O(installations of the whole App)`, which is
fine at current scale and would need pagination for many tenants.

**Scopes are deliberately read-only.** `read:org` is what lets "Fix it" offer
repos owned by an org the user belongs to, by matching an App installation
against their identities. Requesting `repo` would grant write access to every
repository they have. A missing `read:org` only costs org repos, so failure
there is not fatal.

**A 404 from the dispatch endpoint is ambiguous by design** — a missing workflow
file and a repo the App cannot see return the same status. Checking for the
workflow first is what turns a dead spinner into "you haven't installed the
workflow yet". The workflow file must exist on the **default branch** to be
dispatchable at all, even when dispatching some other ref; that is the most
common first-run failure, which is why the pre-flight check deliberately takes
no ref.

**Read the default branch at dispatch time**, not from a stored column. The
workflow must be dispatched against a ref where it actually exists, and a repo's
default branch can be renamed at any time.

**A 204 from dispatch** means that GitHub deployment predates
`return_run_details`. The workflow stamps the fix-run id into its `run-name` so
the run can be located by name in that case.

**A run's `pull_requests` field does not carry PRs created *by* that run**, so
the head branch name is the only reliable handle. Query with `state=all`, since
a run can finish after its PR is already merged or closed.

**An unknown `kid`** when verifying OIDC tokens is the normal signal that GitHub
rotated its keys, not an attack.

GitHub repository names are case-insensitive.

---

## Fix-it authorization

**Brief delivery is authenticated by the run's own Actions OIDC token**, and its
route sits deliberately outside `authGuard` — the caller is a GitHub Actions
runner, not a signed-in browser. The token's `repository` claim is checked
against the repo the run was dispatched to.

**A shared secret passed as a workflow input cannot do this.**
`workflow_dispatch` inputs are recorded permanently in the run's event payload
and are world-readable on a public repo. That same property is why the brief
itself is fetched rather than sent inline. An OIDC token is minted inside the
run, is short-lived, and binds the request cryptographically to the one repo
allowed to read it.

**`repository_visibility` is read from the token, never from
`projects.repo_private`** — that column goes stale the instant someone flips a
repo public.

**`fix_runs.repoFullName` is snapshotted, not read through `projectId` at
verification time.** Otherwise re-pointing a project mid-run could authorize a
different repo to read the brief.

**`installationId` from the client is not trustworthy on its own** — it is an
unsigned value, and the App's post-install redirect carries no `state` to
round-trip. Re-deriving the user's installations server-side is what stops
someone pointing their project at a repo they do not control and spending its
CI minutes.

**Rate limiting is on dispatches, not request volume**, because every press
spends the user's CI minutes and model tokens. Pressing the button twice must
not dispatch twice — an already-active run is the *answer* to the second press,
not an error.

**Polling, not webhooks, is deliberate for v1.** It needs no public callback
URL, no signature verification and no delivery retries, and the UI already has
an SSE channel to push results down. The client's GET is what actually drives
progress; the server refreshes from the Actions API on that GET and republishes
over SSE so other open tabs stay in step.

**Stale runs are swept on a deliberately long window** — longer than any
plausible agent run. An in-process dispatch dies with the process, so a row left
`running` across a deploy would spin in the UI forever; anything younger is
still resolvable by a poll.

---

## Brief generation and redaction

**Everything the browser sent is attacker-controllable.** An end user's page can
print anything to the console and put anything in a URL or DOM text. The brief
is handed to a coding agent holding a write-scoped token, so these strings are
neutralized before they are ever framed as prose.

**Query strings never leave Crashpad.** They routinely carry auth tokens,
presigned signatures and OAuth codes. In redacted mode the origin goes too — a
tenant subdomain names the customer.

**Console arguments are the widest PII channel in the payload** — apps log
session objects, emails and ids freely. On a public repo the levels and timings
still locate the failure; the text does not survive the trip.

**Element labels and DOM structure deliberately survive redaction.** They are
the developer's own UI strings, already present in the public source, and they
are the brief's primary search key. Removing them would leave the agent with
nothing to work from.

**Input values are never reported, only their shape.** `maskInputs` is on by
default, so rrweb has already replaced the value with asterisks — report the
shape, never the asterisks themselves.

**Two passes over the event stream, not one.** rrweb's mirror is not reset on
re-snapshot, so node ids stay stable and a click recorded *before* a mid-buffer
checkout still resolves against a `FullSnapshot` that arrives after it. Indexing
first is what makes that ordering work.

**Climb the DOM the same way the SDK does.** rrweb records the deepest target
from `composedPath()`; `deriveSelector` in the SDK climbs to the interactive
ancestor. Climb differently and the two disagree about which element was
clicked. (One level down catches `<button><span>Save</span></button>`.)

**The selector is the grouping key, not a search key.** Classifying it is what
stops the agent burning turns grepping for `nth-of-type`.

rrweb wire constants are inlined rather than imported: the API has no rrweb
dependency and needs only those six numbers (pinned to `2.0.0-alpha.18`).

---

## Ingest, fingerprinting and source maps

**The top frame's `line:col` is dropped from the fingerprint** so shifting
minified offsets don't split one bug into many issues.

**Signals group by where the interaction happened**, not by the rendered
message — the message embeds a click count, which would split one broken button
into a new issue per rage burst. Signal messages already read as a sentence
("Click on X produced no effect"), so prefixing the detector name would be
redundant.

**`kind` is deliberately absent from the upsert path** — an existing issue keeps
the kind it was created with.

**Source-map resolution is best-effort and must never block ingest.** Resolution
is per-frame: when a map is missing or a position isn't mapped, the resolved
fields are null but the raw fields are filled.

**Deferred re-resolution only writes back when resolution produced at least one
mapped frame**, so a wrong-release upload can't lock in an all-null result and
block a later corrected upload from helping. The catch-up scan is capped per
upload so a long-quiet release can't pin the event loop, and it is
fire-and-forget so it never slows the CLI. That query is unindexed on
`(project_id, release)`; revisit if profiling shows the scan is hot.

`MAX_FRAMES` bounds memory — the source-map content cap is 20 MB, and that
product is reachable via SDK-controlled stack text.

---

## Data model

**`events` and `replays` are linked by `correlation_id`, NOT a foreign key.**
The SDK stamps the same UUID on both payloads and the server joins on read. This
is what sidesteps the split-payload race where the replay arrives before — or
after — the event. Do not "fix" this into a foreign key.

**`kind`**: `'error'` is a thrown exception; `'signal'` is a silent failure
detected from user interaction (dead click, rage click) that never raised one.
Signal events carry evidence in place of a stack trace, because they never
threw. That evidence mirrors `SignalDetail` in
`packages/sdk/src/core/types.ts` — it is a wire contract, so the two must move
together.

**The four repo columns are all-set or all-null.** `repoFullName` is carried for
display and for the OIDC `repository` claim comparison; `repoId` is the stable
identity that survives a rename; `repoPrivate` drives redaction defaults in the
UI but is never trusted at fetch time.

`pgcrypto` is required for `gen_random_uuid()`, which Drizzle's
`defaultRandom()` emits.

---

## Real-time: pub/sub and SSE

**The pub/sub is in-process and single-instance only.** When scaling past one
API node, swap the in-memory `Map` for Redis pub/sub — the
`subscribe`/`publish` surface stays the same. Subscribers are keyed by
`projectId` so one SSE connection only sees its own project's events. A bad
subscriber must never break the publisher, because the publisher is the ingest
path.

**The dashboard SSE route is deliberately NOT under `/api/`.** The catch-all
`/api/:path*` rewrite in `next.config.mjs` beats app-router route handlers *and*
buffers the response, so an event stream proxied through it opens and then sits
silent forever — no `hello`, no `issue:upsert`, no live updates. Serving it from
its own path keeps it out of the rewrite's reach while staying same-origin, so
the session cookie still flows. Everything else proxies through the rewrite
unchanged. **Do not move this back under `/api/`.**

**`X-Accel-Buffering: no` is set on both ends** to stop nginx-style proxies
(Fly.io included) from buffering the stream, and a first flush is sent so
`EventSource` fires `onopen` even when no events follow immediately.

**The web's `PubSubMessage` type is a hand-rolled mirror** of the one in
`apps/api/src/lib/pubsub.ts`. Adding a variant there without adding it here
drops the message on the floor — the client switch only acts on types it knows.

`EventSource` auto-reconnects; the next `onopen` restores the connected state.

---

## Web specifics

**The issue-list SSE subscription is always on.** Gating it behind the
onboarding button meant any project with at least one issue never subscribed, so
live updates silently stopped working after the first event.

**Fix-run progress arrives on the *project* channel**, and is subscribed before
the component's early returns so hook order stays stable.

**Kind filtering is one toggle, not a chip per value.** Three kind chips put a
second control labelled "All" next to the time range's "All" and pushed the row
to six chips; collapsing to "Silent only" keeps it at four and leaves the status
dots as the only coloured vocabulary in the bar. **Trade-off:** errors-only is
not reachable from the UI. `kind=error` still works on the API — restore a third
state here if filtering to just exceptions turns out to matter.

**The docked player's init is imperative.** `Replayer` must bind to the mounted
host div, so `ready` flips once per `rrwebData` identity, not per render.

**`MIN_REPLAY_EVENTS` in the issue page mirrors the SDK's** value in
`core/capture.ts`. A replay shorter than that is empty by definition — just the
rrweb meta event.

**The brief is linked from the UI on purpose.** It is the product; letting the
user read exactly what leaves Crashpad before it does is worth the extra link.

**`useGithubApp` returning null means the check itself failed** — distinct from
a confirmed absence.

**The empty `catch {}` in `NewProjectFlow`** is intentional: the failure is
surfaced through `createProject.error` in the render path below it.

**Project names require a non-whitespace character.** `minLength: 1` alone lets
`"   "` through, storing a project that renders as a blank row everywhere.

**CORS is split by route class.** Ingest routes accept any origin (SDK customers
run anywhere); dashboard routes lock to `WEB_URL` because they ride on the
session cookie.

**`GITHUB_APP_*` env vars are deliberately optional, not `required()`.** That
module validates eagerly at import, so a `required()` would hard-crash boot for
every deploy predating the feature. `services/github-app.ts` checks at call time
and returns a typed "not configured" error instead. `PUBLIC_API_URL` must be
publicly resolvable for a real run — localhost only works for local tests.
