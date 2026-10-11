import type { ReactNode } from "react";
import { NavLink } from "react-router";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: ReactNode;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    end: true,
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </Icon>
    ),
  },
  {
    to: "/sessions",
    label: "Sessions",
    icon: (
      <Icon>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
      </Icon>
    ),
  },
  {
    to: "/commands",
    label: "Commands",
    icon: (
      <Icon>
        <path d="m4 17 6-6-6-6" />
        <path d="M12 19h8" />
      </Icon>
    ),
  },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-14 shrink-0 flex-col border-r border-line bg-surface/40 lg:w-56">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-3 lg:px-4">
        <span className="text-lg leading-none text-emerald-400" aria-hidden="true">
          ◆
        </span>
        <span className="hidden text-sm font-semibold tracking-tight text-zinc-100 lg:inline">
          OpenCode Hub
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`
            }
          >
            {item.icon}
            <span className="hidden lg:inline">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="hidden border-t border-line px-4 py-3 font-mono text-[10px] text-zinc-600 lg:block">
        bff · 127.0.0.1:4141
      </div>
    </aside>
  );
}
