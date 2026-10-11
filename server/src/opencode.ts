/**
 * Single upstream integration point with the local OpenCode service.
 *
 * Discovery + auth are delegated to @opencode/client's `Service` helper; every
 * JSON API call in this BFF funnels through ocFetch() — the ONE fetch helper.
 * The client package is loaded through a dynamic import with a non-literal
 * specifier so a missing/renamed subpath degrades to the fallback endpoint
 * instead of crashing typecheck or startup.
 */

export interface OpenCodeConnection {
  baseUrl: string
  headers: Record<string, string>
}

export interface OcFetchInit {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
}

export class ApiError extends Error {
  readonly status: number
  readonly body: string
  constructor(status: number, body: string) {
    super(`opencode API error ${status}`)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

type MaybePromise<T> = T | Promise<T>

/** Minimal structural view of Service (verified against @opencode/client 2.0.26 .d.ts):
 *  discover(): Promise<{url: string, auth?: {type:"basic", username, password}} | undefined>
 *  ensure():   Promise<Endpoint>
 *  headers(endpoint): {authorization: string} | undefined  — SYNC, takes the Endpoint OBJECT. */
interface ServiceLike {
  discover?: () => MaybePromise<unknown>
  ensure?: () => MaybePromise<unknown>
  headers?: (endpoint: unknown) => MaybePromise<Record<string, string> | undefined | null>
}

const FALLBACK_BASE_URL = "http://127.0.0.1:49374"
const REQUEST_TIMEOUT_MS = 30_000

let serviceModule: ServiceLike | undefined
let connection: OpenCodeConnection | undefined
let pending: Promise<OpenCodeConnection> | undefined

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function loadService(): Promise<ServiceLike> {
  if (serviceModule !== undefined) return serviceModule
  try {
    // Non-literal specifier: keeps tsc from hard-failing on subpath resolution.
    const specifier = "@opencode/client/service"
    const mod = (await import(specifier)) as { Service?: unknown } | undefined
    serviceModule = ((mod?.Service ?? {}) as unknown) as ServiceLike
  } catch (err) {
    console.warn("[opencode] could not load @opencode/client/service:", describeError(err))
    serviceModule = {}
  }
  return serviceModule
}

/** Accepts string | {url} | {endpoint} | {url, auth} discover()/ensure() results, trims trailing slashes. */
function endpointOf(result: unknown): string | undefined {
  if (typeof result === "string" && result.trim() !== "") {
    return result.trim().replace(/\/+$/, "")
  }
  if (result !== null && typeof result === "object") {
    const record = result as { url?: unknown; endpoint?: unknown }
    for (const key of ["url", "endpoint"] as const) {
      const value = record[key]
      if (typeof value === "string" && value.trim() !== "") {
        return value.trim().replace(/\/+$/, "")
      }
    }
  }
  return undefined
}

/** headers() needs the Endpoint OBJECT (it reads endpoint.auth) — not the URL string. */
function headersOf(svc: ServiceLike, endpoint: unknown): Record<string, string> {
  try {
    const raw = svc.headers?.(endpoint)
    if (raw !== null && typeof raw === "object") {
      const out: Record<string, string> = {}
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string" && value !== "") out[key] = value
      }
      return out
    }
  } catch (err) {
    console.warn("[opencode] headers() threw:", describeError(err))
  }
  return {}
}

async function tryDiscover(): Promise<OpenCodeConnection | undefined> {
  const svc = await loadService()
  const endpoint = await svc.discover?.()
  const baseUrl = endpointOf(endpoint)
  if (baseUrl === undefined) return undefined
  return { baseUrl, headers: headersOf(svc, endpoint) }
}

async function resolveConnection(): Promise<OpenCodeConnection> {
  try {
    const found = await tryDiscover()
    if (found !== undefined) return found
  } catch (err) {
    console.warn("[opencode] discovery failed:", describeError(err))
  }
  try {
    const svc = await loadService()
    await svc.ensure?.()
    const found = await tryDiscover()
    if (found !== undefined) return found
    console.warn("[opencode] ensure() ran but discovery returned no endpoint")
  } catch (err) {
    console.warn("[opencode] ensure + rediscovery failed:", describeError(err))
  }
  console.warn(`[opencode] falling back to ${FALLBACK_BASE_URL} without auth headers`)
  return { baseUrl: FALLBACK_BASE_URL, headers: {} }
}

/** Singleton connection — resolved once, then cached for the process lifetime. */
export async function getOpenCode(): Promise<OpenCodeConnection> {
  if (connection !== undefined) return connection
  if (pending === undefined) {
    pending = resolveConnection().then((resolved) => {
      connection = resolved
      pending = undefined
      return resolved
    })
  }
  return pending
}

/** Normalize Money.USD-ish values (number | {amount|value}) to a plain number. */
export function toUsd(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (value !== null && typeof value === "object") {
    const record = value as { amount?: unknown; value?: unknown }
    const raw = record.amount ?? record.value
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

/** The ONLY JSON fetch helper against the OpenCode service. */
export async function ocFetch<T = unknown>(path: string, init: OcFetchInit = {}): Promise<T> {
  const { baseUrl, headers } = await getOpenCode()
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`
  const signals: AbortSignal[] = [AbortSignal.timeout(REQUEST_TIMEOUT_MS)]
  if (init.signal !== undefined) signals.push(init.signal)
  const requestHeaders: Record<string, string> = { ...headers, ...init.headers }
  if (init.body !== undefined) requestHeaders["content-type"] ??= "application/json"
  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: requestHeaders,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.any(signals),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new ApiError(response.status, body)
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (text === "") return undefined as T
  return JSON.parse(text) as T
}
