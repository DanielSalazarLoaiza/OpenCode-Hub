/**
 * SSE hub: ONE persistent upstream connection to /api/event, fanned out to
 * per-session subscribers. Starts lazily on the first subscriber, stops when
 * the last one leaves, and reconnects with backoff (2s -> 30s cap).
 */
import { getOpenCode } from "./opencode.js"

export type SseConnectionState = "connected" | "connecting" | "down"

export type EventCallback = (event: unknown) => void
export type EventFilter = (event: unknown) => boolean

interface Subscriber {
  filter: EventFilter
  callback: EventCallback
}

const MIN_BACKOFF_MS = 2_000
const MAX_BACKOFF_MS = 30_000

let subscribers: Subscriber[] = []
let controller: AbortController | undefined
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let backoffMs = MIN_BACKOFF_MS
let state: SseConnectionState = "down"

export function connectionState(): SseConnectionState {
  return state
}

export function subscribe(filter: EventFilter, callback: EventCallback): () => void {
  const subscriber: Subscriber = { filter, callback }
  subscribers = [...subscribers, subscriber]
  if (subscribers.length === 1) void start()
  return () => {
    subscribers = subscribers.filter((s) => s !== subscriber)
    if (subscribers.length === 0) stop()
  }
}

/** Public shutdown hook (graceful SIGINT/SIGTERM path). */
export function stopEvents(): void {
  stop()
}

function stop(): void {
  if (reconnectTimer !== undefined) {
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
  }
  if (controller !== undefined) {
    controller.abort()
    controller = undefined
  }
  state = "down"
  backoffMs = MIN_BACKOFF_MS
}

function scheduleReconnect(): void {
  if (controller === undefined) return // stopped on purpose
  if (subscribers.length === 0) {
    stop()
    return
  }
  if (reconnectTimer !== undefined) return
  console.warn(`[opencode:sse] connection lost — reconnecting in ${backoffMs}ms`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    void start()
  }, backoffMs)
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
}

async function start(): Promise<void> {
  if (controller !== undefined) return
  const localController = new AbortController()
  controller = localController
  state = "connecting"
  try {
    const { baseUrl, headers } = await getOpenCode()
    const response = await fetch(`${baseUrl}/api/event`, {
      headers: { accept: "text/event-stream", ...headers },
      signal: localController.signal,
    })
    if (!response.ok || response.body === null) {
      throw new Error(`upstream SSE refused: HTTP ${response.status}`)
    }
    state = "connected"
    backoffMs = MIN_BACKOFF_MS
    await readStream(response.body)
    // Stream ended upstream (service closed it) — treat as a disconnect.
    state = "down"
    scheduleReconnect()
  } catch (err) {
    if (localController.signal.aborted) return // intentional stop
    state = "down"
    scheduleReconnect()
  }
}

async function readStream(body: ReadableStream<Uint8Array>): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.indexOf("\n\n")
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      dispatchFrame(frame)
      boundary = buffer.indexOf("\n\n")
    }
  }
  const tail = buffer + decoder.decode()
  if (tail.trim() !== "") dispatchFrame(tail)
}

function dispatchFrame(frame: string): void {
  const normalized = frame.replaceAll("\r\n", "\n").replaceAll("\r", "\n")
  const dataLines: string[] = []
  for (const line of normalized.split("\n")) {
    if (line.startsWith(":")) continue // comment / heartbeat
    if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).replace(/^ /, ""))
  }
  if (dataLines.length === 0) return
  const payload = dataLines.join("\n")
  let event: unknown
  try {
    event = JSON.parse(payload) as unknown
  } catch {
    event = payload // keep opaque on parse failure
  }
  // Upstream frames look like {id?, event, data} with data as a JSON string —
  // unwrap the inner payload when possible, else pass the envelope through.
  if (event !== null && typeof event === "object" && "data" in event) {
    const envelope = event as { data?: unknown }
    if (typeof envelope.data === "string") {
      try {
        envelope.data = JSON.parse(envelope.data) as unknown
      } catch {
        // keep the raw string
      }
    }
  }
  for (const subscriber of subscribers) {
    try {
      if (subscriber.filter(event)) subscriber.callback(event)
    } catch {
      // a broken listener must never kill the hub
    }
  }
}
