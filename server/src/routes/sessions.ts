import type { FastifyInstance, FastifyReply } from "fastify"
import type { PromptRequest } from "@hub/shared"
import { ocFetch } from "../opencode.js"
import { subscribe } from "../events.js"

const HEARTBEAT_MS = 15_000

function forwardQuery(params: { limit?: unknown; cursor?: unknown }): string {
  const search = new URLSearchParams()
  if (typeof params.limit === "string" && params.limit.trim() !== "") search.set("limit", params.limit.trim())
  if (typeof params.cursor === "string" && params.cursor.trim() !== "") search.set("cursor", params.cursor.trim())
  const encoded = search.toString()
  return encoded === "" ? "" : `?${encoded}`
}

/** Whitelists string-valued fields from a JSON body (minimal validation). */
function stringFields(body: unknown): Record<string, string> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim() !== "") out[key] = value
  }
  return out
}

function sessionPath(id: string, suffix = ""): string {
  return `/api/session/${encodeURIComponent(id)}${suffix}`
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return ""
  }
}

/** Forwards an upstream result, mapping empty bodies to 204. */
function sendUpstream(reply: FastifyReply, result: unknown): FastifyReply {
  if (result === undefined) return reply.code(204).send()
  return reply.send(result)
}

/**
 * "provider/id" | "provider/id/variant" -> {providerID, id, variant?}.
 * The upstream POST bodies require model as an OBJECT (verified against
 * @opencode/client 2.0.26 generated types); bare strings are rejected.
 */
function parseModelRef(value: string): { providerID: string; id: string; variant?: string } | undefined {
  const parts = value.split("/").map((p) => p.trim()).filter((p) => p !== "")
  if (parts.length < 2) return undefined
  const [providerID, id, variant] = parts
  return variant !== undefined ? { providerID, id, variant } : { providerID, id }
}

export async function sessionsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/sessions", async (request) => {
    const query = (request.query ?? {}) as { limit?: unknown; cursor?: unknown }
    return ocFetch<unknown>(`/api/session${forwardQuery(query)}`)
  })

  app.post("/api/sessions", async (request, reply) => {
    const body = stringFields(request.body)
    const payload: Record<string, unknown> = {}
    if (body.title !== undefined) payload.title = body.title
    if (body.agent !== undefined) payload.agent = body.agent
    if (body.model !== undefined) {
      const model = parseModelRef(body.model)
      if (model !== undefined) payload.model = model
    }
    if (Object.keys(payload).length === 0) {
      return reply.code(400).send({ error: "empty body" })
    }
    return ocFetch<unknown>("/api/session", { method: "POST", body: payload })
  })

  app.get("/api/sessions/:id/messages", async (request) => {
    const { id } = request.params as { id: string }
    const query = (request.query ?? {}) as { limit?: unknown; cursor?: unknown }
    return ocFetch<unknown>(sessionPath(id, `/message${forwardQuery(query)}`))
  })

  app.delete("/api/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string }
    return sendUpstream(reply, await ocFetch<unknown>(sessionPath(id), { method: "DELETE" }))
  })

  app.post("/api/sessions/:id/prompt", async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = stringFields(request.body)
    if (body.text === undefined) {
      return reply.code(400).send({ error: "text is required" })
    }
    const payload: PromptRequest = { text: body.text }
    if (body.agentID !== undefined) payload.agentID = body.agentID
    if (body.model !== undefined) payload.model = body.model
    // model must be {providerID, id} upstream — normalize "provider/id" strings.
    const upstreamBody: Record<string, unknown> = { text: payload.text }
    if (payload.model !== undefined) {
      const model = parseModelRef(payload.model)
      if (model !== undefined) upstreamBody.model = model
    }
    return sendUpstream(
      reply,
      await ocFetch<unknown>(sessionPath(id, "/prompt"), { method: "POST", body: upstreamBody }),
    )
  })

  app.post("/api/sessions/:id/interrupt", async (request, reply) => {
    const { id } = request.params as { id: string }
    return sendUpstream(
      reply,
      await ocFetch<unknown>(sessionPath(id, "/interrupt?resume=true"), { method: "POST" }),
    )
  })

  app.get("/api/sessions/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string }
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    })
    raw.write(": connected\n\n")

    // Event shapes are opaque upstream — cheap containment check on the id.
    const unsubscribe = subscribe(
      (event) => safeStringify(event).includes(id),
      (event) => {
        const serialized = safeStringify(event)
        if (serialized !== "") raw.write(`data: ${serialized}\n\n`)
      },
    )
    const heartbeat = setInterval(() => {
      raw.write(": ping\n\n")
    }, HEARTBEAT_MS)

    const cleanup = (): void => {
      clearInterval(heartbeat)
      unsubscribe()
    }
    raw.on("error", cleanup)
    request.raw.on("close", cleanup)
  })
}
