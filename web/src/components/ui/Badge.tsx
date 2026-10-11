import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "err";

const toneClass: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-3 text-secondary",
  accent: "border-accent-border bg-accent-soft text-accent",
  ok: "border-ok/30 bg-ok-soft text-ok",
  warn: "border-warn/30 bg-warn-soft text-warn",
  err: "border-err/30 bg-err-soft text-err",
};

export function Badge({
  tone = "neutral",
  title,
  className,
  children,
}: {
  tone?: BadgeTone;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-4 ${toneClass[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
