import { useEffect, useRef } from "react";

/**
 * Subscribes to a session's SSE event stream. Any data frame triggers the
 * callback (typically a query invalidation). Heartbeats arrive as comments,
 * so they never fire `onmessage`. EventSource reconnects natively — we never
 * manage retry loops ourselves. The callback ref stays fresh across renders
 * without resubscribing the stream.
 */
export function useSessionEvents(sessionId: string, onEvent: () => void): void {
  const cb = useRef(onEvent);

  useEffect(() => {
    cb.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (sessionId.length === 0) return;
    const es = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
    es.onmessage = () => {
      cb.current();
    };
    return () => {
      es.close();
    };
  }, [sessionId]);
}
