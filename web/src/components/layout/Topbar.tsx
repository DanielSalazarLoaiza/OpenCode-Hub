import { useQuery } from "@tanstack/react-query";
import type { HealthDto } from "@hub/shared";
import { useLocation } from "react-router";
import { LanguageSquare, Moon, Sun1 } from "iconsax-react";
import type { Icon as IconsaxIcon } from "iconsax-react";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useTheme } from "../../lib/theme";
import { useI18n, type MessageKey } from "../../lib/i18n";

function titleKeyFor(pathname: string): MessageKey {
  if (pathname.startsWith("/sessions")) return "nav.sessions";
  if (pathname.startsWith("/commands")) return "nav.commands";
  return "nav.dashboard";
}

function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label={t("topbar.languageToggle")}
    >
      <span className="text-muted" aria-hidden="true">
        <Icon icon={LanguageSquare} size={16} />
      </span>
      <div className="flex items-center rounded-lg border border-line p-0.5">
        {(["es", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={locale === l}
            className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${
              locale === l ? "bg-accent-soft text-accent" : "text-muted hover:text-primary"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const TargetIcon: IconsaxIcon = theme === "dark" ? Sun1 : Moon;
  return (
    <IconButton label={t("topbar.themeToggle")} onClick={toggle}>
      <Icon icon={TargetIcon} size={17} />
    </IconButton>
  );
}

export function Topbar() {
  const { t } = useI18n();
  const { pathname } = useLocation();

  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api<HealthDto>("/api/health"),
    refetchInterval: 30_000,
    retry: 1,
  });

  const data = health.data;
  const opencode =
    typeof data?.opencode === "object" && data.opencode !== null ? data.opencode : undefined;
  const connected = data?.ok === true && opencode?.connected === true;
  const version =
    typeof opencode?.version === "string" && opencode.version.length > 0
      ? opencode.version
      : undefined;
  const url = typeof opencode?.url === "string" && opencode.url.length > 0 ? opencode.url : undefined;

  const dotClass = health.isLoading ? "bg-muted" : connected ? "bg-ok" : "bg-err";
  const labelClass = health.isLoading ? "text-muted" : connected ? "text-ok" : "text-err";
  const label = health.isLoading
    ? t("topbar.checking")
    : connected
      ? t("topbar.connected")
      : t("topbar.offline");
  const tooltipParts: string[] = [];
  if (version != null) tooltipParts.push(t("topbar.version", { version }));
  if (url != null) tooltipParts.push(url);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-4 lg:px-6">
      <h1 className="truncate font-display text-base font-bold tracking-tight text-primary">
        {t(titleKeyFor(pathname))}
      </h1>

      <div className="flex items-center gap-2.5">
        <span
          className={`flex items-center gap-1.5 font-mono text-[11px] ${labelClass}`}
          title={tooltipParts.join(" · ")}
        >
          <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
          {label}
        </span>
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
