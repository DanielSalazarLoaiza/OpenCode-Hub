import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CommandDto } from "@hub/shared";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { api, errorMessage } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { modelLabel } from "../../lib/types";

/** Accepts a plain array or {commands}/{data} wrappers — defensively. */
function commandList(raw: unknown): CommandDto[] {
  if (Array.isArray(raw)) return raw as CommandDto[];
  if (typeof raw === "object" && raw !== null) {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.commands)) return rec.commands as CommandDto[];
    if (Array.isArray(rec.data)) return rec.data as CommandDto[];
  }
  return [];
}

function sourceLabel(src: unknown): { label: string; global: boolean } {
  if (typeof src === "string") {
    return { label: src, global: src.toLowerCase().includes("global") };
  }
  if (typeof src === "object" && src !== null) {
    const rec = src as Record<string, unknown>;
    const first = [rec.path, rec.name, rec.scope, rec.type, rec.source].find(
      (v) => typeof v === "string" && v.length > 0,
    );
    const global = rec.global === true || rec.scope === "global" || rec.type === "global";
    return { label: typeof first === "string" ? first : "unknown", global };
  }
  return { label: "unknown", global: true };
}

function TemplateBlock({
  template,
  expanded,
  onToggle,
}: {
  template: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lines = template.split("\n");
  const overflow = lines.length > 8;
  const shown = expanded || !overflow ? lines : lines.slice(0, 8);
  return (
    <div className="mt-3">
      <pre className="overflow-x-auto rounded-lg border border-line bg-bg/70 p-3 font-mono text-xs leading-relaxed text-zinc-400">
        {shown.join("\n")}
        {overflow && !expanded ? "\n..." : ""}
      </pre>
      {overflow ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 text-[11px] text-emerald-400 hover:text-emerald-300"
        >
          {expanded ? "Show less" : `Show all ${lines.length} lines`}
        </button>
      ) : null}
    </div>
  );
}

export function CommandsPage() {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const commandsQ = useQuery({
    queryKey: queryKeys.commands,
    queryFn: () => api<unknown>("/api/commands"),
  });

  const commands = useMemo(() => {
    const all = commandList(commandsQ.data);
    const needle = filter.trim().toLowerCase();
    if (needle.length === 0) return all;
    return all.filter((c) =>
      [c.name ?? "", c.description ?? "", sourceLabel(c.source).label, modelLabel(c.model) ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [commandsQ.data, filter]);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Commands</h1>
          <p className="text-xs text-zinc-500">{commands.length} slash commands available</p>
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter commands..."
          className="ml-auto w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
        />
      </header>

      {commandsQ.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : commandsQ.isError ? (
        <ErrorState message={errorMessage(commandsQ.error)} onRetry={() => void commandsQ.refetch()} />
      ) : commands.length === 0 ? (
        <EmptyState
          title={filter.length > 0 ? "No commands match the filter" : "No commands registered"}
          hint={
            filter.length > 0
              ? "Try a different search term."
              : "SDD commands (sdd-init, sdd-propose, ...) appear here once synced from opencode."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {commands.map((c, i) => {
            const key = c.name ?? `cmd-${i}`;
            const src = sourceLabel(c.source);
            const model = modelLabel(c.model);
            const agent = typeof c.agent === "string" ? c.agent : undefined;
            const tpl = typeof c.template === "string" ? c.template : undefined;
            return (
              <Card key={key}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-mono text-sm text-emerald-300">/{c.name ?? "unknown"}</h3>
                  <Badge tone={src.global ? "accent" : "violet"} title={src.label}>
                    {src.global ? "global" : "project"}
                  </Badge>
                </div>
                {c.description != null && c.description.length > 0 ? (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {agent != null ? <Badge>agent: {agent}</Badge> : null}
                  {model != null ? <Badge tone="violet">{model}</Badge> : null}
                </div>
                {tpl != null && tpl.trim().length > 0 ? (
                  <TemplateBlock
                    template={tpl}
                    expanded={open[key] === true}
                    onToggle={() => setOpen((prev) => ({ ...prev, [key]: prev[key] !== true }))}
                  />
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
