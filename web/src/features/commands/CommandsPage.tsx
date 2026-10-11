import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CommandDto } from "@hub/shared";
import { CommandSquare, SearchNormal1 } from "iconsax-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Icon } from "../../components/ui/Icon";
import { api, errorMessage } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useI18n } from "../../lib/i18n";
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
  const { t } = useI18n();
  const lines = template.split("\n");
  const overflow = lines.length > 8;
  const shown = expanded || !overflow ? lines : lines.slice(0, 8);
  return (
    <div className="mt-3">
      <pre className="overflow-x-auto rounded-lg border border-line bg-surface-3/60 p-3 font-mono text-xs leading-relaxed text-secondary">
        {shown.join("\n")}
        {overflow && !expanded ? "\n..." : ""}
      </pre>
      {overflow ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 text-[11px] font-medium text-accent hover:text-accent-strong"
        >
          {expanded ? t("commands.showLess") : t("commands.showAll", { count: lines.length })}
        </button>
      ) : null}
    </div>
  );
}

export function CommandsPage() {
  const { t } = useI18n();
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
        <p className="text-xs text-muted">{t("commands.count", { count: commands.length })}</p>
        <div className="relative ml-auto">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
            <Icon icon={SearchNormal1} size={14} />
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("commands.filter")}
            aria-label={t("commands.filter")}
            className="w-56 rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-3 text-sm text-primary placeholder:text-muted focus:border-accent-border focus:outline-none"
          />
        </div>
      </header>

      {commandsQ.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="hub-skeleton h-44" />
          ))}
        </div>
      ) : commandsQ.isError ? (
        <ErrorState
          message={errorMessage(commandsQ.error)}
          retryLabel={t("common.retry")}
          onRetry={() => void commandsQ.refetch()}
        />
      ) : commands.length === 0 ? (
        <EmptyState
          icon={<Icon icon={CommandSquare} size={22} />}
          title={filter.length > 0 ? t("commands.empty.filterTitle") : t("commands.empty.title")}
          hint={filter.length > 0 ? t("commands.empty.filterHint") : t("commands.empty.hint")}
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
                  <h3 className="font-mono text-sm font-medium text-accent">/{c.name ?? "unknown"}</h3>
                  <Badge tone={src.global ? "accent" : "neutral"} title={src.label}>
                    {src.global ? t("commands.source.global") : t("commands.source.project")}
                  </Badge>
                </div>
                {c.description != null && c.description.length > 0 ? (
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{c.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {agent != null ? <Badge>{t("commands.agent", { agent })}</Badge> : null}
                  {model != null ? <Badge tone="accent">{model}</Badge> : null}
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
