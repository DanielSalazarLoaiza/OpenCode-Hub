export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-900/60 bg-red-500/5 p-8 text-center">
      <p className="max-w-xl break-words font-mono text-sm text-red-300">{message}</p>
      {onRetry != null ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-800 bg-red-500/10 px-3 py-1 text-xs text-red-200 transition-colors hover:bg-red-500/20"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
