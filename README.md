# opencode-hub

A local-first web dashboard for **OpenCode V2**: usage stats (tokens/cost by month and by model),
session browsing with full message transcripts, and a live prompt console that streams assistant
output over SSE. It never reads the multi-GB SQLite database directly — everything goes through the
official local HTTP service, discovered and authenticated via `@opencode/client`.

> **Verified against opencode v2.0.26 on 2026-10-10** (Node v24.11.0, npm 11.6.1, Windows/PowerShell):
> `tsc --noEmit` clean in shared/server/web; live smoke tests against the running background service
> (see [Smoke test results](#smoke-test-results-2026-10-10)).

## Architecture

```text
Browser ──HTTP──▶ web (Vite dev :5173, /api proxied) ──▶ BFF Fastify (:4141) ──▶ OpenCode service (:49374)
    │                                                        │                      │
    └── production: web/dist is served by the BFF itself      ocFetch + SSE hub     discovered/auth by
       (single origin, no CORS)                              + TTL stats cache     @opencode/client Service
```

- `shared/` — the BFF ↔ web TypeScript contract (single source of truth).
- `server/` — Fastify BFF: one `ocFetch()` upstream helper, one SSE hub fanning out `/api/event`,
  TTL-cached stats aggregation, passthrough session/prompt routes, static SPA hosting.
- `web/` — frontend (Vite).

## Upstream API facts (verified against v2.0.26)

These are the non-obvious wire details the BFF normalizes — all confirmed by reading
`@opencode/client`'s generated types and live-probing the service:

| Fact | Detail |
| --- | --- |
| `@opencode/client` subpath | `@opencode/client/service` exists; exports `Service.discover()/ensure()/stop()/headers()`. |
| `Service.discover()` | → `Promise<{url: string, auth?: {type:"basic", username, password}} \| undefined>` |
| `Service.headers(endpoint)` | **Synchronous**, takes the whole **Endpoint object** (reads `endpoint.auth`) → `{authorization: "Basic ..."} \| undefined`. Passing the URL string silently yields no auth. |
| Stats range params | `GET /api/experimental/session/stats?from&to&timezone` — `from`/`to` are **epoch milliseconds**. ISO strings return a bare 500. |
| Stats envelope | Response is `{"data": {sessions, tokens, cost, models[], activity[], ...}}` — unwrap `.data`. |
| `Money.USD` | A plain **number** on the wire (branded `Finite`), not `{amount, currency}`. |
| `models[].model` | An **object** `{id, providerID, variant?}` — normalized to `"providerID/id"`. |
| Message shape | Rows: `{id, type: "user"\|"assistant"\|"idle", time, content[]?, text?, tokens?, cost?, model?}` — user text is top-level `text`; assistant parts live in `content` (not `parts`); `idle` rows are lifecycle events. |
| Timestamps | `time.created/streamed/completed` (sessions & messages) are **epoch-ms numbers**, not ISO strings. |
| Model refs in POST bodies | `/api/session` and `/api/session/:id/prompt` require `model` as an **object** `{providerID, id, variant?}`; the BFF converts `"provider/id"` strings for you. |
| `/api/models` | `{location, data: [{id, modelID, providerID, name, ...}]}`. |
| `/api/info` | `{version, pid, urls: string[], ...}` — `urls` is a plain string array. |

## Prerequisites

- Node.js 22+ (developed on 24.x)
- OpenCode v2 installed and running (`opencode service status` must print a URL)

## Quickstart

```powershell
npm install
npm run dev
# open http://localhost:5173
```

BFF only (no Vite): `npm run dev:server` → http://127.0.0.1:4141.

Single-server mode (BFF serves the built SPA on http://127.0.0.1:4141):

```powershell
npm run build -w @hub/web
npm run start -w @hub/server
```

## Scripts

| Script | Workspace | What it does |
| --- | --- | --- |
| `npm run dev` | root | BFF (tsx watch) + web (Vite) concurrently |
| `npm run dev:server` | root | BFF only — http://127.0.0.1:4141 |
| `npm run dev:web` | root | Vite dev server — http://localhost:5173 |
| `npm run typecheck` | root | `tsc --noEmit` for shared, server and web |
| `npm run start -w @hub/server` | server | Run the BFF without watch (serves `web/dist` if built) |

## Security

The BFF binds to `127.0.0.1` by default (`HUB_HOST` / `HUB_PORT` to change). It proxies an
authenticated local service that can send prompts to your models — keep it localhost-only. Do not
expose it to a network or place it behind a public reverse proxy. Credentials are obtained at
runtime from `@opencode/client`'s discovery and never logged or persisted by this repo.

## Smoke test results (2026-10-10)

Against opencode v2.0.26 running at `http://127.0.0.1:49374` (background service):

| Endpoint | Result | Key values |
| --- | --- | --- |
| `GET /api/health` | ✅ | `ok:true`, `opencode.connected:true`, `version:"2.0.26"` |
| `GET /api/stats/summary?months=6` | ✅ | 6 byMonth entries; totals: 255 sessions, 3,363 prompts, 46,838 steps, 130 active days, 13-day streak; tokens in 924.2M / out 21.9M / cache-read 2.91B; cost numeric (`0` — plan-billed models); 9 models incl. `zai-coding-plan/glm-5-turbo`, `dragonjar/DragonJAR-IA` |
| `GET /api/sessions?limit=5` | ✅ | 5 items, `ses_*` ids, titles, per-session tokens/cost |
| `GET /api/commands` | ✅ | 10 commands: 8 × `sdd-*` + `init` + `review`, all with descriptions |
| `POST /api/sessions` → prompt roundtrip → `DELETE` | ✅ | created `ses_ed7169cd9ffe...`, 0 messages → prompt "reply with the single word: pong" → assistant msg with `tokens.input 13,976 / output 4` (≈ "pong") → DELETE returned 204 and the session disappeared from the list |
| `GET /api/sessions/:id/events` (SSE) | ✅ | `200`, `content-type: text/event-stream; charset=utf-8`, heartbeat comments (verified with `curl.exe --max-time 3`) |
| `GET /api/agents` / `GET /api/providers` | ✅ | 11 agents / 4 providers |

## Troubleshooting

- **`opencode_upstream_error` with upstreamStatus 500 on stats** — the BFF sends `from`/`to` as
  epoch ms (ISO strings 500 upstream). If you fork the stats logic, keep numbers.
- **401 upstream / `connected:false`** — stale service credentials. Run `opencode service restart`,
  then restart the BFF (it caches discovery once per process). Also confirm
  `Service.headers(endpoint)` receives the **Endpoint object**, not the URL string (a string input
  silently returns no Authorization header).
- **Stats are empty** — stats derive from session history; open a session and send a prompt first.
- **No live events** — the SSE hub reconnects automatically (2s→30s backoff). Check
  `GET /api/health` → `opencode.connected`.
- **PowerShell hangs testing SSE** — `Invoke-WebRequest` blocks on streamed responses; use
  `curl.exe -N --max-time 3 -D - <url>` to verify headers and abort.
- **Cost shows $0** — models billed via subscription plans report `cost: 0` upstream; the dashboard
  faithfully shows what the service reports.
- **`<think>` blocks visible in chat** — some local models leak raw think tags into text parts;
  the UI strips them client-side (`stripThink`).
