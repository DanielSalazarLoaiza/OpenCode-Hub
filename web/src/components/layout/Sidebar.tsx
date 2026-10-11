import { NavLink } from "react-router";
import type { Icon as IconsaxIcon } from "iconsax-react";
import { Chart2, CommandSquare, Messages1 } from "iconsax-react";
import { Icon } from "../ui/Icon";
import { useI18n } from "../../lib/i18n";

interface NavItem {
  to: string;
  labelKey: "nav.dashboard" | "nav.sessions" | "nav.commands";
  end?: boolean;
  icon: IconsaxIcon;
}

const navItems: NavItem[] = [
  { to: "/", labelKey: "nav.dashboard", end: true, icon: Chart2 },
  { to: "/sessions", labelKey: "nav.sessions", icon: Messages1 },
  { to: "/commands", labelKey: "nav.commands", icon: CommandSquare },
];

/**
 * Brand sidebar. Single project logo (square tile, self-contained
 * background — safe on any theme). Protection space via generous padding.
 */
export function Sidebar() {
  const { t } = useI18n();

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-line bg-surface-2/60 lg:w-60">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-line px-3 lg:justify-start lg:px-5">
        <img
          src="/brand/logo.png"
          alt="DragonJAR"
          className="h-9 w-9 rounded-lg ring-1 ring-line lg:h-10 lg:w-10"
        />
      </div>

      {/* Nav — active state: accent left bar + accent-soft pill */}
      <nav className="flex flex-1 flex-col gap-1 p-2 lg:p-3" aria-label={t("nav.aria")}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={t(item.labelKey)}
            className={({ isActive }) =>
              `relative flex items-center justify-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium lg:justify-start ${
                isActive
                  ? "bg-accent-soft text-accent before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-accent"
                  : "text-secondary hover:bg-surface-3 hover:text-primary"
              }`
            }
          >
            <Icon icon={item.icon} size={18} />
            <span className="hidden lg:inline">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer: dragonjar.org (mono) + version tag */}
      <div className="hidden shrink-0 items-center gap-2 border-t border-line px-5 py-3 lg:flex">
        <a
          href="https://www.dragonjar.org"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] text-muted hover:text-accent"
        >
          dragonjar.org
        </a>
        <span className="ml-auto rounded border border-line px-1 font-mono text-[10px] text-muted">
          {t("sidebar.version")}
        </span>
      </div>
    </aside>
  );
}
