/**
 * Centralized react-query key factory. Invalidate with the widest key that
 * makes sense (e.g. `queryKeys.sessions.all` covers list + detail + messages).
 */
export const queryKeys = {
  health: ["health"] as const,
  stats: {
    all: ["stats"] as const,
    summary: (months: number) => ["stats", "summary", months] as const,
  },
  sessions: {
    all: ["sessions"] as const,
    list: (limit: number) => ["sessions", "list", { limit }] as const,
    detail: (id: string) => ["sessions", "detail", id] as const,
    messages: (id: string) => ["sessions", "detail", id, "messages"] as const,
  },
  models: ["models"] as const,
  agents: ["agents"] as const,
  commands: ["commands"] as const,
};
