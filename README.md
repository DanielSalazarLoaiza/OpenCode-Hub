<div align="center">

# ◆ OpenCode Hub

**Web dashboard and control panel for OpenCode V2** — token usage analytics, live session chat, and a command explorer.

**English** · [Español](#español)

</div>

---

## English

A local-first web dashboard for **OpenCode V2**: usage stats (tokens/cost by month and by model),
session browsing with full message transcripts, and a live prompt console that streams assistant
output over SSE. It never reads the multi-GB SQLite database directly — everything goes through the
official local HTTP service, discovered and authenticated via `@opencode/client`.

Your terminal TUI is never touched: the web app is just **another parallel client** of the same
background service.

> **Verified against opencode v2.0.26 on 2026-10-10** (Node v24.11.0, npm 11.6.1, Windows/PowerShell):
> `tsc --noEmit` clean in shared/server/web; live smoke tests against the running background service
> (see [Smoke test results](#smoke-test-results-2026-10-10)).

### Features

- **Dashboard** — total tokens (input/output/reasoning/cache), cost, sessions, prompts, active days
  and streak; monthly composed chart (tokens + cost), per-model breakdown with share %, 90-day
  activity strip, recent sessions.
- **Sessions & Chat** — search/create/delete sessions, full transcripts (text, collapsed reasoning,
  tool parts with state), model picker, `Ctrl/Cmd+Enter` to send, interrupt button, live updates
  over SSE.
- **Commands** — all your custom commands (`/sdd-*`, `/init`, `/review`, ...) with description, source
  (global/project), agent/model badges and template preview.
- **DragonJAR brand UI** — official visual identity with dark/light theme and a full ES/EN interface.

### Architecture

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

### Upstream API facts (verified against v2.0.26)

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

### Prerequisites

- Node.js 22+ (developed on 24.x)
- OpenCode v2 installed and running (`opencode service status` must print a URL)

### Quickstart

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

### Scripts

| Script | Workspace | What it does |
| --- | --- | --- |
| `npm run dev` | root | BFF (tsx watch) + web (Vite) concurrently |
| `npm run dev:server` | root | BFF only — http://127.0.0.1:4141 |
| `npm run dev:web` | root | Vite dev server — http://localhost:5173 |
| `npm run typecheck` | root | `tsc --noEmit` for shared, server and web |
| `npm run start -w @hub/server` | server | Run the BFF without watch (serves `web/dist` if built) |

### Security

The BFF binds to `127.0.0.1` by default (`HUB_HOST` / `HUB_PORT` to change). It proxies an
authenticated local service that can send prompts to your models — keep it localhost-only. Do not
expose it to a network or place it behind a public reverse proxy. Credentials are obtained at
runtime from `@opencode/client`'s discovery and never logged or persisted by this repo.

### Smoke test results (2026-10-10)

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

### Troubleshooting

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

---

## Español

Panel web local para **OpenCode V2**: estadísticas de uso (tokens/costo por mes y por modelo),
exploración de sesiones con transcripciones completas de mensajes, y una consola de prompts en vivo
que transmite la salida del asistente por SSE. Nunca lee directamente la base de datos SQLite de
varios GB — todo pasa por el servicio HTTP local oficial, descubierto y autenticado vía
`@opencode/client`.

Tu TUI de terminal no se toca para nada: la aplicación web es simplemente **otro cliente paralelo**
del mismo servicio en background.

> **Verificado contra opencode v2.0.26 el 2026-10-10** (Node v24.11.0, npm 11.6.1,
> Windows/PowerShell): `tsc --noEmit` limpio en shared/server/web; pruebas de humo en vivo contra
> el servicio en background (ver [Resultados de las pruebas](#resultados-de-las-pruebas-de-humo-2026-10-10)).

### Características

- **Dashboard** — tokens totales (entrada/salida/razonamiento/caché), costo, sesiones, prompts,
  días activos y racha; gráfica compuesta mensual (tokens + costo), desglose por modelo con % de
  participación, franja de actividad de 90 días, sesiones recientes.
- **Sesiones y Chat** — buscar/crear/eliminar sesiones, transcripciones completas (texto,
  razonamiento colapsado, partes de herramientas con su estado), selector de modelo,
  `Ctrl/Cmd+Enter` para enviar, botón de interrupción, actualizaciones en vivo por SSE.
- **Comandos** — todos tus comandos personalizados (`/sdd-*`, `/init`, `/review`, ...) con
  descripción, origen (global/proyecto), insignias de agente/modelo y vista previa del template.
- **Interfaz con marca DragonJAR** — identidad visual oficial, tema claro/oscuro e interfaz completa ES/EN.

### Arquitectura

```text
Navegador ──HTTP──▶ web (Vite dev :5173, /api con proxy) ──▶ BFF Fastify (:4141) ──▶ Servicio OpenCode (:49374)
    │                                                              │                    │
    └── producción: web/dist lo sirve el propio BFF                 ocFetch + hub SSE    descubierto/autenticado
       (un solo origen, sin CORS)                                 + caché TTL de stats  por @opencode/client Service
```

- `shared/` — el contrato TypeScript BFF ↔ web (fuente única de verdad).
- `server/` — BFF con Fastify: un único helper `ocFetch()` hacia arriba, un hub SSE que distribuye
  `/api/event`, agregación de estadísticas con caché TTL, rutas passthrough de sesiones/prompts y
  hosting estático del SPA.
- `web/` — frontend (Vite).

### Datos verificados de la API upstream (v2.0.26)

Estos son los detalles no obvios del protocolo que el BFF normaliza — todos confirmados leyendo los
tipos generados de `@opencode/client` y probando el servicio en vivo:

| Dato | Detalle |
| --- | --- |
| Subpath de `@opencode/client` | `@opencode/client/service` existe; exporta `Service.discover()/ensure()/stop()/headers()`. |
| `Service.discover()` | → `Promise<{url: string, auth?: {type:"basic", username, password}} \| undefined>` |
| `Service.headers(endpoint)` | **Síncrono**, recibe el **objeto Endpoint completo** (lee `endpoint.auth`) → `{authorization: "Basic ..."} \| undefined`. Pasarle el string de la URL devuelve silenciosamente sin auth. |
| Parámetros de rango en stats | `GET /api/experimental/session/stats?from&to&timezone` — `from`/`to` son **milisegundos epoch**. Strings ISO devuelven un 500 pelado. |
| Envelope de stats | La respuesta es `{"data": {sessions, tokens, cost, models[], activity[], ...}}` — desenvolver `.data`. |
| `Money.USD` | Un **número** plano en el protocolo (con brand `Finite`), no `{amount, currency}`. |
| `models[].model` | Es un **objeto** `{id, providerID, variant?}` — se normaliza a `"providerID/id"`. |
| Forma de los mensajes | Filas: `{id, type: "user"\|"assistant"\|"idle", time, content[]?, text?, tokens?, cost?, model?}` — el texto del usuario va en `text` de primer nivel; las partes del asistente viven en `content` (no en `parts`); las filas `idle` son eventos de ciclo de vida. |
| Timestamps | `time.created/streamed/completed` (sesiones y mensajes) son **números epoch-ms**, no strings ISO. |
| Refs de modelo en POST | `/api/session` y `/api/session/:id/prompt` exigen `model` como **objeto** `{providerID, id, variant?}`; el BFF convierte los strings `"provider/id"` por vos. |
| `/api/models` | `{location, data: [{id, modelID, providerID, name, ...}]}`. |
| `/api/info` | `{version, pid, urls: string[], ...}` — `urls` es un array de strings plano. |

### Requisitos previos

- Node.js 22+ (desarrollado sobre 24.x)
- OpenCode v2 instalado y corriendo (`opencode service status` debe imprimir una URL)

### Inicio rápido

```powershell
npm install
npm run dev
# abrir http://localhost:5173
```

Solo el BFF (sin Vite): `npm run dev:server` → http://127.0.0.1:4141.

Modo de un solo servidor (el BFF sirve el SPA compilado en http://127.0.0.1:4141):

```powershell
npm run build -w @hub/web
npm run start -w @hub/server
```

### Scripts

| Script | Workspace | Qué hace |
| --- | --- | --- |
| `npm run dev` | root | BFF (tsx watch) + web (Vite) en simultáneo |
| `npm run dev:server` | root | Solo el BFF — http://127.0.0.1:4141 |
| `npm run dev:web` | root | Servidor dev de Vite — http://localhost:5173 |
| `npm run typecheck` | root | `tsc --noEmit` para shared, server y web |
| `npm run start -w @hub/server` | server | Ejecutar el BFF sin watch (sirve `web/dist` si está compilado) |

### Seguridad

El BFF se enlaza a `127.0.0.1` por defecto (`HUB_HOST` / `HUB_PORT` para cambiarlo). Hace proxy de
un servicio local autenticado que puede enviar prompts a tus modelos — manténelo solo en localhost.
No lo expongas a una red ni lo pongas detrás de un reverse proxy público. Las credenciales se
obtienen en runtime desde el discovery de `@opencode/client` y este repo nunca las registra ni las
persiste.

### Resultados de las pruebas de humo (2026-10-10)

Contra opencode v2.0.26 corriendo en `http://127.0.0.1:49374` (servicio en background):

| Endpoint | Resultado | Valores clave |
| --- | --- | --- |
| `GET /api/health` | ✅ | `ok:true`, `opencode.connected:true`, `version:"2.0.26"` |
| `GET /api/stats/summary?months=6` | ✅ | 6 entradas byMonth; totales: 255 sesiones, 3,363 prompts, 46,838 pasos, 130 días activos, racha de 13 días; tokens in 924.2M / out 21.9M / cache-read 2.91B; costo numérico (`0` — modelos con plan); 9 modelos incl. `zai-coding-plan/glm-5-turbo`, `dragonjar/DragonJAR-IA` |
| `GET /api/sessions?limit=5` | ✅ | 5 elementos, ids `ses_*`, títulos, tokens/costo por sesión |
| `GET /api/commands` | ✅ | 10 comandos: 8 × `sdd-*` + `init` + `review`, todos con descripción |
| `POST /api/sessions` → roundtrip de prompt → `DELETE` | ✅ | creada `ses_ed7169cd9ffe...`, 0 mensajes → prompt "reply with the single word: pong" → mensaje del asistente con `tokens.input 13,976 / output 4` (≈ "pong") → DELETE devolvió 204 y la sesión desapareció de la lista |
| `GET /api/sessions/:id/events` (SSE) | ✅ | `200`, `content-type: text/event-stream; charset=utf-8`, comentarios heartbeat (verificado con `curl.exe --max-time 3`) |
| `GET /api/agents` / `GET /api/providers` | ✅ | 11 agentes / 4 providers |

### Solución de problemas

- **`opencode_upstream_error` con upstreamStatus 500 en stats** — el BFF envía `from`/`to` como
  epoch ms (los strings ISO dan 500 upstream). Si bifurcas la lógica de stats, conserva números.
- **401 upstream / `connected:false`** — credenciales del servicio vencidas. Ejecuta
  `opencode service restart` y reinicia el BFF (cachea el discovery una vez por proceso). Confirma
  también que `Service.headers(endpoint)` reciba el **objeto Endpoint**, no el string de la URL
  (con un string devuelve silenciosamente sin header de Authorization).
- **Stats vacías** — las estadísticas derivan del historial de sesiones; abre una sesión y envía un
  prompt primero.
- **Sin eventos en vivo** — el hub SSE se reconecta solo (backoff 2s→30s). Revisa
  `GET /api/health` → `opencode.connected`.
- **PowerShell se cuelga probando SSE** — `Invoke-WebRequest` bloquea con respuestas en stream;
  usa `curl.exe -N --max-time 3 -D - <url>` para verificar headers y abortar.
- **El costo muestra $0** — los modelos facturados vía planes de suscripción reportan `cost: 0`
  upstream; el dashboard muestra fielmente lo que reporta el servicio.
- **Bloques `<think>` visibles en el chat** — algunos modelos locales filtran tags think crudos en
  las partes de texto; la UI los limpia en el cliente (`stripThink`).
