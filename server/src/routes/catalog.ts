import type { FastifyInstance } from "fastify"
import type { CommandDto } from "@hub/shared"
import { ocFetch } from "../opencode.js"

interface UpstreamList {
  data?: unknown
}

function commandSource(raw: Record<string, unknown>): string {
  if (typeof raw.location === "string" && raw.location !== "") return raw.location
  if (typeof raw.directory === "string" && raw.directory !== "") return raw.directory
  return "global"
}

function toCommand(item: unknown): CommandDto {
  const raw = (item ?? {}) as Record<string, unknown>
  const command: CommandDto = {
    name: typeof raw.name === "string" ? raw.name : "",
    source: commandSource(raw),
  }
  if (typeof raw.description === "string") command.description = raw.description
  if (typeof raw.agent === "string") command.agent = raw.agent
  if (typeof raw.model === "string") command.model = raw.model
  if (typeof raw.template === "string") command.template = raw.template
  return command
}

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/models", async () => ocFetch<unknown>("/api/model"))
  app.get("/api/agents", async () => ocFetch<unknown>("/api/agent"))
  app.get("/api/providers", async () => ocFetch<unknown>("/api/provider"))
  app.get("/api/commands", async (): Promise<CommandDto[]> => {
    const response = await ocFetch<UpstreamList>("/api/command")
    const list = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []
    return list.map(toCommand)
  })
}
