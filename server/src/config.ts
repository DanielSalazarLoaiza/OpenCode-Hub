/** BFF runtime configuration (env-driven, cross-platform, no hardcoded user paths). */

export interface HubConfig {
  readonly host: string
  readonly port: number
}

function readPort(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : 4141
}

export const config: Readonly<HubConfig> = Object.freeze({
  host: process.env.HUB_HOST?.trim() || "127.0.0.1",
  port: readPort(process.env.HUB_PORT),
})
