export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line p-8 text-center">
      <p className="text-sm text-zinc-400">{title}</p>
      {hint != null ? <p className="text-xs text-zinc-600">{hint}</p> : null}
    </div>
  );
}
