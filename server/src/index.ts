import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Fastify from "fastify"
import type { FastifyInstance } from "fastify"
import fastifyStatic from "@fastify/static"
import { config } from "./config.js"
import { ApiError } from "./opencode.js"
import { stopEvents } from "./events.js"
import { healthRoutes } from "./routes/health.js"
import { statsRoutes } from "./routes/stats.js"
import { sessionsRoutes } from "./routes/sessions.js"
import { catalogRoutes } from "./routes/catalog.js"

const here = dirname(fileURLToPath(import.meta.url))
const webDist = resolve(here, "../../web/dist")
const hasWebDist = existsSync(webDist)

export const app: FastifyInstance = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 })

await app.register(async function hubRoutes(instance: FastifyInstance): Promise<void> {
  instance.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(502).send({
        error: "opencode_upstream_error",
        upstreamStatus: error.status,
        upstreamBody: error.body,
      })
    }
    const statusCode = (error as { statusCode?: unknown }).statusCode
    const status = typeof statusCode === "number" ? statusCode : 500
    const message = error instanceof Error ? error.message : String(error)
    return reply.code(status).send({ error: message })
  })
  await instance.register(healthRoutes)
  await instance.register(statsRoutes)
  await instance.register(sessionsRoutes)
  await instance.register(catalogRoutes)
})

if (hasWebDist) {
  await app.register(fastifyStatic, { root: webDist })
  // SPA wildcard fallback — API paths stay JSON 404s.
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api")) {
      return reply.code(404).send({ error: "not found" })
    }
    return reply.sendFile("index.html")
  })
} else {
  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send({ error: "not found", hint: "web/dist is not built — run the web dev server on :5173 instead" }),
  )
}

const address = await app.listen({ host: config.host, port: config.port })
app.log.info(`opencode-hub BFF ready → ${address} (static web: ${hasWebDist ? webDist : "disabled"})`)

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.log.info(`${signal} received — shutting down`)
    stopEvents()
    void app
      .close()
      .catch((err: unknown) => app.log.error(err))
      .finally(() => process.exit(0))
  })
}
