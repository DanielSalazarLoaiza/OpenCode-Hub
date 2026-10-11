import type { ReactNode } from "react";

/** Square ghost icon button (topbar toggles, row actions). */
export function IconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-secondary hover:bg-surface-3 hover:text-primary disabled:opacity-40 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
