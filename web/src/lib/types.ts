/**
 * Local defensive view types for upstream (opencode via BFF) payloads.
 * Upstream shapes may omit or vary fields — everything optional where the
 * contract allows it. Never trust these blindly; narrow at the edge.
 */

export interface TokenUsageLike {
  input?: number;
  output?: number;
  reasoning?: number;
  cache?: { read?: number; write?: number };
}

export interface ModelRef {
  id?: string;
  providerID?: string;
  variant?: string;
}

/** Epoch milliseconds (real opencode v2 wire shape — NOT ISO strings). */
export interface TimeInfo {
  created?: number;
  streamed?: number;
  completed?: number;
  updated?: number;
  idle?: number;
  viewed?: number;
}

export interface SessionDto {
  id: string;
  title?: string;
  parentID?: string;
  projectID?: string;
  agent?: string;
  location?: { directory?: string };
  model?: string | ModelRef;
  tokens?: TokenUsageLike;
  cost?: number;
  outcome?: string;
  time?: TimeInfo;
}

export interface MessagePart {
  type?: string;
  text?: string;
  name?: string;
  id?: string;
  state?: unknown;
  [key: string]: unknown;
}

export interface MessageDto {
  id?: string;
  /** real discriminator: "user" | "assistant" | "idle" (lifecycle rows) */
  type?: string;
  agent?: string;
  model?: string | ModelRef;
  tokens?: TokenUsageLike;
  cost?: number;
  time?: TimeInfo;
  /** user messages carry their text at the top level */
  text?: string;
  /** assistant messages carry parts here */
  content?: MessagePart[];
  parts?: MessagePart[];
  outcome?: string;
}

export interface ModelDto {
  providerID?: string;
  modelID?: string;
  [key: string]: unknown;
}

/** "provider/id" for string, {id, providerID} (real shape), or legacy {modelID}/{model} shapes; null when unusable. */
export function modelLabel(v: unknown): string | null {
  if (typeof v === "string") return v.length > 0 ? v : null;
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : undefined;
  const providerID = typeof r.providerID === "string" ? r.providerID : undefined;
  if (id != null) return providerID != null ? `${providerID}/${id}` : id;
  const modelID = typeof r.modelID === "string" ? r.modelID : undefined;
  if (modelID != null) return providerID != null ? `${providerID}/${modelID}` : modelID;
  const model = typeof r.model === "string" ? r.model : undefined;
  if (model != null) {
    const nested =
      typeof r.provider === "object" && r.provider !== null
        ? (r.provider as Record<string, unknown>)
        : undefined;
    const nestedId = nested != null && typeof nested.id === "string" ? nested.id : undefined;
    return nestedId != null ? `${nestedId}/${model}` : model;
  }
  return null;
}

/**
 * Normalizes /api/models defensively: accepts a plain array, {models: [...]},
 * or items shaped as {providerID, modelID} | {model} | nested provider.
 * Returns unique sorted "provider/model" strings.
 */
export function asModelList(raw: unknown): string[] {
  const out: string[] = [];
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "object" && raw !== null) {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.models)) arr = rec.models;
    else if (Array.isArray(rec.data)) arr = rec.data;
  }
  for (const item of arr) {
    const label = modelLabel(item);
    if (label != null && !out.includes(label)) out.push(label);
  }
  return out.sort();
}
