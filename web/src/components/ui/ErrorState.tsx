import { Warning2 } from "iconsax-react";
import { Icon } from "./Icon";

export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-err/25 bg-err-soft px-6 py-10 text-center">
      <span className="text-err" aria-hidden="true">
        <Icon icon={Warning2} size={22} />
      </span>
      <p className="max-w-xl break-words font-mono text-sm leading-relaxed text-err">{message}</p>
      {onRetry != null ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-accent-border px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
