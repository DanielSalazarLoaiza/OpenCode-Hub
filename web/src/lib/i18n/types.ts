import type { en } from "./en";

/** Dictionary shape — EN is the source of truth; ES must satisfy it exactly. */
export type Messages = typeof en;

/** Valid dictionary keys (compile-time checked). */
export type MessageKey = keyof Messages;

/** Supported interface locales. */
export type Locale = "es" | "en";

/** Interpolation params: `t("key", { count: 3 })` → "...3...". */
export type TranslateParams = Readonly<Record<string, string | number>>;
