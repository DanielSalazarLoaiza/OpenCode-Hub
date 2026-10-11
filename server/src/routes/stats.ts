import type { FastifyInstance } from "fastify"
import type { ActivityPoint, ModelStat, MonthStat, StatsSummary, TokenUsageInfo } from "@hub/shared"
import { ocFetch, toUsd } from "../opencode.js"
import { ttlCache } from "../cache.js"

const STATS_PATH = "/api/experimental/session/stats"
const CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_MONTHS = 12
const MAX_MONTHS = 24

/** Defensive view of the upstream stats payload — every field optional. */
interface RawStats {
  data?: unknown
  sessions?: unknown
  subagents?: unknown
  prompts?: unknown
  steps?: unknown
  activeDays?: unknown
  streak?: unknown
  tokens?: unknown
  cost?: unknown
  models?: unknown
  activity?: unknown
}

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function tokensOf(value: unknown): TokenUsageInfo {
  const raw = (value ?? {}) as {
    input?: unknown
    output?: unknown
    reasoning?: unknown
    cache?: { read?: unknown; write?: unknown }
  }
  return {
    input: num(raw.input),
    output: num(raw.output),
    reasoning: num(raw.reasoning),
    cache: { read: num(raw.cache?.read), write: num(raw.cache?.write) },
  }
}

/** "providerID/id" from the real ModelUsage model shape ({id, providerID, variant?}), or a string. */
function modelIdOf(value: unknown): string {
  if (typeof value === "string" && value.trim() !== "") return value.trim()
  if (value !== null && typeof value === "object") {
    const record = value as { id?: unknown; providerID?: unknown }
    const id = typeof record.id === "string" ? record.id : ""
    const provider = typeof record.providerID === "string" ? record.providerID : ""
    if (id !== "" && provider !== "") return `${provider}/${id}`
    if (id !== "") return id
    if (provider !== "") return provider
  }
  return "unknown"
}

/**
 * from/to are EPOCH MILLISECONDS (verified against opencode v2.0.26 — ISO strings
 * yield a bare 500). The upstream wraps the payload as {"data": {...}} — unwrapped here.
 */
async function fetchStats(fromMs: number, toMs: number, timezone: string): Promise<RawStats> {
  const query = new URLSearchParams({ from: String(fromMs), to: String(toMs), timezone })
  const envelope = await ocFetch<RawStats>(`${STATS_PATH}?${query.toString()}`)
  return envelope.data !== null && typeof envelope.data === "object" && envelope.data !== undefined
    ? (envelope.data as RawStats)
    : envelope
}

interface MonthWindow {
  key: string
  label: string
  fromMs: number
  toMs: number
}

/**
 * Month boundaries are computed in UTC; the IANA timezone is still forwarded so
 * the upstream buckets activity days correctly for the user's locale.
 */
function monthWindows(count: number, now: Date): MonthWindow[] {
  const windows: MonthWindow[] = []
  for (let offset = count - 1; offset >= 0; offset--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 1))
    windows.push({
      key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleString("en", { month: "short", year: "numeric" }),
      fromMs: start.getTime(),
      toMs: end.getTime(),
    })
  }
  return windows
}

async function buildSummary(months: number, timezone: string): Promise<StatsSummary> {
  const now = new Date()
  const allTime = await fetchStats(0, now.getTime(), timezone)
  const windows = monthWindows(months, now)
  const monthly = await Promise.all(windows.map((window) => fetchStats(window.fromMs, window.toMs, timezone)))

  const totals: StatsSummary["totals"] = {
    sessions: num(allTime.sessions),
    subagents: num(allTime.subagents),
    prompts: num(allTime.prompts),
    steps: num(allTime.steps),
    activeDays: num(allTime.activeDays),
    streak: num(allTime.streak),
    tokens: tokensOf(allTime.tokens),
    cost: toUsd(allTime.cost),
  }

  const byMonth: MonthStat[] = windows.map((window, index) => {
    const stat = monthly[index]
    return {
      month: window.key,
      label: window.label,
      tokens: tokensOf(stat?.tokens),
      cost: toUsd(stat?.cost),
      sessions: num(stat?.sessions),
      prompts: num(stat?.prompts),
      steps: num(stat?.steps),
    }
  })

  const byModel: ModelStat[] = Array.isArray(allTime.models)
    ? allTime.models.map((raw) => {
        const model = (raw ?? {}) as { model?: unknown; tokens?: unknown; cost?: unknown; steps?: unknown }
        return {
          model: modelIdOf(model.model),
          tokens: tokensOf(model.tokens),
          cost: toUsd(model.cost),
          steps: num(model.steps),
        }
      })
    : []

  const activity: ActivityPoint[] = Array.isArray(allTime.activity)
    ? allTime.activity.map((raw) => {
        const point = (raw ?? {}) as { date?: unknown; steps?: unknown }
        return {
          date: typeof point.date === "string" ? point.date : "",
          steps: num(point.steps),
        }
      })
    : []

  return { generatedAt: now.toISOString(), timezone, months, totals, byMonth, byModel, activity }
}

const summaryCache = ttlCache((key: string): Promise<StatsSummary> => {
  const [months, timezone] = JSON.parse(key) as [number, string]
  return buildSummary(months, timezone)
}, CACHE_TTL_MS)

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/stats/summary", async (request): Promise<StatsSummary> => {
    const query = (request.query ?? {}) as { months?: unknown; timezone?: unknown }
    const monthsRaw =
      typeof query.months === "string" && query.months.trim() !== ""
        ? Number.parseInt(query.months, 10)
        : DEFAULT_MONTHS
    const months = Number.isFinite(monthsRaw)
      ? Math.min(Math.max(Math.trunc(monthsRaw), 1), MAX_MONTHS)
      : DEFAULT_MONTHS
    const timezone =
      typeof query.timezone === "string" && query.timezone.trim() !== ""
        ? query.timezone.trim()
        : Intl.DateTimeFormat().resolvedOptions().timeZone
    return summaryCache(JSON.stringify([months, timezone]))
  })
}
