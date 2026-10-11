/** Minimal TTL memoizer — the single cache utility of the BFF. */

export interface CachedFetch<T> {
  (key: string, opts?: { force?: boolean }): Promise<T>
}

interface Entry<T> {
  value: T
  fetchedAt: number
}

export function ttlCache<T>(fn: (key: string) => Promise<T>, ttlMs: number): CachedFetch<T> {
  const entries = new Map<string, Entry<T>>()
  const inflight = new Map<string, Promise<T>>()
  return async (key, opts = {}) => {
    const hit = entries.get(key)
    if (!opts.force && hit !== undefined && Date.now() - hit.fetchedAt < ttlMs) {
      return hit.value
    }
    const running = inflight.get(key)
    if (running !== undefined) return running
    const promise = fn(key)
      .then((value) => {
        entries.set(key, { value, fetchedAt: Date.now() })
        return value
      })
      .finally(() => {
        inflight.delete(key)
      })
    inflight.set(key, promise)
    return promise
  }
}
