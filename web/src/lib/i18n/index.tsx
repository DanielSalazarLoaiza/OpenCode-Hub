import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./en";
import { es } from "./es";
import type { Locale, MessageKey, Messages, TranslateParams } from "./types";

export type { Locale, MessageKey, Messages, TranslateParams };

const STORAGE_KEY = "hub-lang";

const dictionaries: Record<Locale, Messages> = { en, es };

/** `{name}` placeholder interpolation; unknown params stay literal. */
function interpolate(template: string, params?: TranslateParams): string {
  if (params == null) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Initial locale comes from the <html lang> attribute set by the inline
 * bootstrap script in index.html (localStorage → navigator.language) — the
 * same priority chain, resolved exactly once with no flicker.
 */
function readInitialLocale(): Locale {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.getAttribute("lang");
    if (lang === "es" || lang === "en") return lang;
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage blocked — in-memory locale still works.
    }
  }, []);

  // Keep <html lang> in sync with the active locale.
  useEffect(() => {
    document.documentElement.setAttribute("lang", locale);
  }, [locale]);

  const t = useCallback(
    (key: MessageKey, params?: TranslateParams): string =>
      interpolate(dictionaries[locale][key] ?? en[key], params),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx == null) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
