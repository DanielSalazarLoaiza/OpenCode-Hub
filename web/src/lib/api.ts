/**
 * The ONLY fetch wrapper in the app. Every network call goes through `api()`.
 * - Sends JSON content type when a body is present.
 * - Throws ApiError with status + best-effort message extracted from the body.
 * - Treats 204 / empty bodies as `undefined`.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init?.body != null) headers["Content-Type"] = "application/json";

  const res = await fetch(path, { ...init, headers });

  if (!res.ok) {
    const statusText = res.statusText.length > 0 ? ` ${res.statusText}` : "";
    let message = `Request failed (${res.status}${statusText})`;
    try {
      const body: unknown = await res.json();
      if (typeof body === "string" && body.length > 0) {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const rec = body as Record<string, unknown>;
        for (const key of ["error", "message", "detail"]) {
          const v = rec[key];
          if (typeof v === "string" && v.length > 0) {
            message = v;
            break;
          }
        }
      }
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (text.length === 0) return undefined as T;
  return JSON.parse(text) as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message.length > 0) return e.message;
  return "Unexpected error";
}
