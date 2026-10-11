import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import type { CreateSessionRequest } from "@hub/shared";
import { Messages1, SearchNormal1, Trash } from "iconsax-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Icon } from "../../components/ui/Icon";
import { api, errorMessage } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import {
  formatModel,
  formatRelative,
  formatTokens,
  formatUsd,
  sessionCreatedMs,
  totalTokens,
} from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { useI18n } from "../../lib/i18n";
import type { SessionDto } from "../../lib/types";

export function SessionListPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");

  const sessionsQ = useQuery({
    queryKey: queryKeys.sessions.list(100),
    queryFn: () => api<{ data?: SessionDto[] }>("/api/sessions?limit=100"),
  });

  const create = useMutation({
    mutationFn: () =>
      api<SessionDto>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ title: t("sessions.new") } satisfies CreateSessionRequest),
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
      if (created != null && typeof created.id === "string" && created.id.length > 0) {
        navigate(`/sessions/${created.id}`);
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<unknown>(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });

  const rows = useMemo(() => {
    const all = [...(sessionsQ.data?.data ?? [])].sort(
      (a, b) => sessionCreatedMs(b) - sessionCreatedMs(a),
    );
    const needle = filter.trim().toLowerCase();
    if (needle.length === 0) return all;
    return all.filter((s) =>
      [s.title ?? "", s.id, formatModel(s.model), s.location?.directory ?? ""].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [sessionsQ.data, filter]);

  function handleDelete(s: SessionDto) {
    const label = s.title != null && s.title.length > 0 ? s.title : s.id;
    if (confirmAction(t("sessions.confirmDelete", { label }))) {
      remove.mutate(s.id);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted">
          {t("sessions.count", {
            shown: formatTokens(rows.length, locale),
            total: formatTokens(sessionsQ.data?.data?.length ?? rows.length, locale),
          })}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
              <Icon icon={SearchNormal1} size={14} />
            </span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("sessions.filter")}
              aria-label={t("sessions.filter")}
              className="w-56 rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-3 text-sm text-primary placeholder:text-muted focus:border-accent-border focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-50"
          >
            {create.isPending ? t("sessions.creating") : t("sessions.new")}
          </button>
        </div>
      </header>

      {create.isError ? (
        <p className="mb-3 rounded-lg border border-err/25 bg-err-soft px-3 py-2 text-xs text-err">
          {errorMessage(create.error)}
        </p>
      ) : null}

      {sessionsQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="hub-skeleton h-12" />
          ))}
        </div>
      ) : sessionsQ.isError ? (
        <ErrorState
          message={errorMessage(sessionsQ.error)}
          retryLabel={t("common.retry")}
          onRetry={() => void sessionsQ.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Messages1} size={22} />}
          title={filter.length > 0 ? t("sessions.empty.filterTitle") : t("sessions.empty.title")}
          hint={filter.length > 0 ? t("sessions.empty.filterHint") : t("sessions.empty.hint")}
        />
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">{t("sessions.col.title")}</th>
                <th className="px-3 py-3 font-semibold">{t("sessions.col.model")}</th>
                <th className="px-3 py-3 text-right font-semibold">{t("sessions.col.tokens")}</th>
                <th className="px-3 py-3 text-right font-semibold">{t("sessions.col.cost")}</th>
                <th className="px-3 py-3 text-right font-semibold">{t("sessions.col.created")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const model = formatModel(s.model);
                const deleting = remove.isPending && remove.variables === s.id;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-line/50 transition-colors last:border-0 hover:bg-surface-3/50"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/sessions/${s.id}`}
                        className="block max-w-md truncate text-primary hover:text-accent"
                      >
                        {s.title != null && s.title.length > 0 ? (
                          s.title
                        ) : (
                          <span className="italic text-muted">{t("common.untitled")}</span>
                        )}
                      </Link>
                      <div className="mt-0.5 font-mono text-[10px] text-muted">
                        {s.id.length > 18 ? `${s.id.slice(0, 18)}...` : s.id}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {model !== "—" ? (
                        <Badge tone="accent">{model}</Badge>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-secondary">
                      {formatTokens(totalTokens(s.tokens), locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-secondary">
                      {formatUsd(s.cost, locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px] text-muted">
                      {formatRelative(s.time?.created, locale)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        disabled={deleting}
                        aria-label={t("common.delete")}
                        title={t("common.delete")}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-err-soft hover:text-err disabled:opacity-40"
                      >
                        <Icon icon={Trash} size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
