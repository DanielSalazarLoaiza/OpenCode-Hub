import type { TokenUsageInfo } from "@hub/shared";
import type { ModelRef } from "./types";

/** Coerce anything into a finite number (0 when missing/invalid). */
export function toNum(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** 1.2k / 3.4M / 1.2B style shortening for token and step counts. */
export function formatTokens(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** USD currency formatting, with a sub-cent bucket. */
export function formatUsd(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 0.01) return "<$0.01";
  return usdFormatter.format(n);
}

export interface LooseTokens {
  input?: unknown;
  output?: unknown;
  reasoning?: unknown;
}

/** input + output + reasoning (cache excluded — it is not fresh compute). */
export function totalTokens(t: LooseTokens | TokenUsageInfo | null | undefined): number {
  if (t == null) return 0;
  return toNum(t.input) + toNum(t.output) + toNum(t.reasoning);
}

/** "3m ago" style relative time for epoch-ms numbers or ISO strings. */
export function formatRelative(value: unknown): string {
  const then = isoMs(value);
  if (then === 0) return "—";
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 45) return seconds <= 1 ? "just now" : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** "provider/id" from a string or a {id, providerID} ref (real shape; modelID kept as legacy). */
export function formatModel(m: string | ModelRef | null | undefined): string {
  if (typeof m === "string") return m.length > 0 ? m : "—";
  if (typeof m === "object" && m !== null) {
    const id = typeof m.id === "string" ? m.id : undefined;
    const providerID = typeof m.providerID === "string" ? m.providerID : undefined;
    const modelID = typeof (m as { modelID?: unknown }).modelID === "string"
      ? (m as { modelID?: string }).modelID
      : undefined;
    const label = id ?? modelID;
    if (label != null && providerID != null) return `${providerID}/${label}`;
    return label ?? providerID ?? "—";
  }
  return "—";
}

/** Epoch-ms numbers (real shape) or ISO strings; 0 when missing/invalid. */
export function isoMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

interface TimedLike {
  time?: { created?: unknown };
}

/** Sort key helper for sessions (missing dates sort last in desc order). */
export function sessionCreatedMs(s: TimedLike | undefined): number {
  return isoMs(s?.time?.created);
}
