import type { ReactNode } from "react";

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2/60 px-6 py-10 text-center">
      {icon != null ? (
        <span className="text-muted" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="font-display text-sm font-bold text-primary">{title}</p>
      {hint != null ? <p className="max-w-sm text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}
