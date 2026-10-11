export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400 ${className ?? ""}`}
    />
  );
}
