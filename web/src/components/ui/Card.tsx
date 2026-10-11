import type { ReactNode } from "react";

export function Card({
  title,
  actions,
  padded = true,
  className,
  children,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-surface-2 shadow-sm ${padded ? "p-4 lg:p-5" : ""} ${className ?? ""}`}
    >
      {title != null || actions != null ? (
        <header className={`mb-3 flex items-center justify-between gap-3 ${padded ? "" : "px-4 pt-4 lg:px-5 lg:pt-5"}`}>
          {title != null ? (
            <h2 className="font-display text-sm font-bold tracking-tight text-primary">{title}</h2>
          ) : (
            <span />
          )}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}
