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
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
        {icon != null ? <span className="text-zinc-500">{icon}</span> : null}
      </div>
      <div className="mt-1.5 font-mono text-2xl leading-8 text-zinc-100">{value}</div>
      {sub != null ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}
