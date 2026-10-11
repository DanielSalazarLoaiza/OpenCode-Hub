/** @hub/shared — single source of truth for the BFF <-> Web contract. */
export interface TokenUsageInfo {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}
export type Usd = number
export interface StatsTotals {
  sessions: number
  subagents: number
  prompts: number
  steps: number
  activeDays: number
  streak: number
  tokens: TokenUsageInfo
  cost: Usd
}
export interface MonthStat {
  month: string // "YYYY-MM"
  label: string // "Oct 2026"
  tokens: TokenUsageInfo
  cost: Usd
  sessions: number
  prompts: number
  steps: number
}
export interface ModelStat { model: string; tokens: TokenUsageInfo; cost: Usd; steps: number }
export interface ActivityPoint { date: string; steps: number }
export interface StatsSummary {
  generatedAt: string
  timezone: string
  months: number
  totals: StatsTotals
  byMonth: MonthStat[]
  byModel: ModelStat[]
  activity: ActivityPoint[]
}
export interface CommandDto {
  name: string
  description?: string
  source: string
  agent?: string
  model?: string
  template?: string
}
export interface HealthDto {
  ok: boolean
  opencode: { connected: boolean; version?: string; url?: string }
  time: string
}
/**
 * NOTE: `model` here is a plain "provider/id" (optionally "/variant") string —
 * the BFF normalizes it to the object shape ({providerID, id, variant?}) the
 * upstream API requires.
 */
export interface PromptRequest { text: string; agentID?: string; model?: string }
export interface CreateSessionRequest { title?: string; model?: string; agent?: string }
