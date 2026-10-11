import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        {icon != null ? (
          <span className="text-accent" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold leading-8 tracking-tight text-primary">
        {value}
      </div>
      {sub != null ? <div className="mt-1 font-mono text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
}
