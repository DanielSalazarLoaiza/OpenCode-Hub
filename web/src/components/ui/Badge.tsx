import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "violet" | "amber" | "red" | "green";

const toneClass: Record<BadgeTone, string> = {
  neutral: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  accent: "border-emerald-700/60 bg-emerald-500/10 text-emerald-300",
  violet: "border-violet-700/60 bg-violet-500/10 text-violet-300",
  amber: "border-amber-700/60 bg-amber-500/10 text-amber-300",
  red: "border-red-800/60 bg-red-500/10 text-red-300",
  green: "border-green-700/60 bg-green-500/10 text-green-300",
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
