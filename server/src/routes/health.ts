import type { FastifyInstance } from "fastify"
import type { HealthDto } from "@hub/shared"
import { ocFetch, getOpenCode } from "../opencode.js"
import { connectionState } from "../events.js"

interface UpstreamInfo {
  version?: unknown
  urls?: unknown
}

/** ServerInfo.urls is string[] (verified) — arrays, {http} objects and plain strings all accepted. */
function urlFrom(info: UpstreamInfo | undefined, baseUrl: string | undefined): string | undefined {
  const urls = info?.urls
  if (Array.isArray(urls)) {
    const first = urls.find((value): value is string => typeof value === "string" && value.startsWith("http"))
    return first ?? urlFromValue(urls[0], baseUrl)
  }
  return urlFromValue(urls, baseUrl) ?? (baseUrl !== undefined && baseUrl.startsWith("http") ? baseUrl : undefined)
}

function urlFromValue(value: unknown, _baseUrl: string | undefined): string | undefined {
  if (typeof value === "string" && value.startsWith("http")) return value
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const inner of Object.values(record)) {
      if (typeof inner === "string" && inner.startsWith("http")) return inner
    }
  }
  return undefined
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async (): Promise<HealthDto> => {
    let info: UpstreamInfo | undefined
    let connected = false
    try {
      info = await ocFetch<UpstreamInfo>("/api/info")
      connected = true
    } catch {
      connected = connectionState() === "connected"
    }
    const opencode: HealthDto["opencode"] = { connected }
    if (typeof info?.version === "string") opencode.version = info.version
    const url = urlFrom(info, connected ? (await getOpenCode()).baseUrl : undefined)
    if (url !== undefined) opencode.url = url
    return { ok: connected, opencode, time: new Date().toISOString() }
  })
}
