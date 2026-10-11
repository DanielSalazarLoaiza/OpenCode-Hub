import type { TokenUsageInfo } from "@hub/shared";
import type { ModelRef } from "./types";
import type { Locale } from "./i18n/types";

/**
 * Locale-aware formatting. `locale` comes from the i18n hook; every default
 * keeps the previous behavior ("en") for unmodified call sites.
 * es is pinned to es-CO (DragonJAR is Colombian): "US$ 12,34" style.
 */
function intlLocale(locale: Locale): string {
  return locale === "es" ? "es-CO" : "en-US";
}

const compactFormatters = new Map<string, Intl.NumberFormat>();

function numFormatter(locale: Locale): Intl.NumberFormat {
  const tag = intlLocale(locale);
  let nf = compactFormatters.get(tag);
  if (nf == null) {
    nf = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
    compactFormatters.set(tag, nf);
  }
  return nf;
}

/** Coerce anything into a finite number (0 when missing/invalid). */
export function toNum(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** 1.2k / 3.4M / 1.2B style shortening for token and step counts (locale decimal separator). */
export function formatTokens(n: unknown, locale: Locale = "en"): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const fmt = numFormatter(locale);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${fmt.format(n / 1e9)}B`;
  if (abs >= 1e6) return `${fmt.format(n / 1e6)}M`;
  if (abs >= 1e3) return `${fmt.format(n / 1e3)}k`;
  return fmt.format(Math.round(n));
}

/** USD currency formatting, with a sub-cent bucket. "US$ 12,34" es / "$12.34" en. */
export function formatUsd(n: unknown, locale: Locale = "en"): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 0.01) {
    return locale === "es" ? "<US$ 0,01" : "<$0.01";
  }
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/** "12 ago 2026" style date for epoch-ms numbers or ISO strings. */
export function formatDate(value: unknown, locale: Locale = "en"): string {
  const ms = isoMs(value);
  if (ms === 0) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(ms);
}

/** "3m ago" / "hace 3 m" style relative time (Intl.RelativeTimeFormat, narrow). */
export function formatRelative(value: unknown, locale: Locale = "en"): string {
  const then = isoMs(value);
  if (then === 0) return "—";
  const diffSec = Math.floor((Date.now() - then) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
    style: "narrow",
  });
  const abs = Math.abs(diffSec);
  const past = -diffSec;
  if (abs < 45) return rtf.format(past, "second");
  if (abs < 2700) return rtf.format(Math.round(past / 60), "minute");
  if (abs < 79200) return rtf.format(Math.round(past / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(past / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(past / 2592000), "month");
  return rtf.format(Math.round(past / 31536000), "year");
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
