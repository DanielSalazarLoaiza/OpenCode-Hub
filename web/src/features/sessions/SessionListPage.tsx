import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import type { CreateSessionRequest } from "@hub/shared";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { api, errorMessage } from "../../lib/api";
import {
  formatModel,
  formatRelative,
  formatTokens,
  formatUsd,
  sessionCreatedMs,
  totalTokens,
} from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import type { SessionDto } from "../../lib/types";

export function SessionListPage() {
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
        body: JSON.stringify({ title: "New session" } satisfies CreateSessionRequest),
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
    if (window.confirm(`Delete session "${label}"? This cannot be undone.`)) {
      remove.mutate(s.id);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Sessions</h1>
          <p className="text-xs text-zinc-500">
            {rows.length} of {sessionsQ.data?.data?.length ?? rows.length} sessions
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter title / id / model..."
            className="w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {create.isPending ? "Creating..." : "+ New session"}
          </button>
        </div>
      </header>

      {create.isError ? (
        <p className="mb-3 rounded-lg border border-red-900/60 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          {errorMessage(create.error)}
        </p>
      ) : null}

      {sessionsQ.isLoading ? (
        <Card>
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        </Card>
      ) : sessionsQ.isError ? (
        <ErrorState message={errorMessage(sessionsQ.error)} onRetry={() => void sessionsQ.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={filter.length > 0 ? "No sessions match the filter" : "No sessions yet"}
          hint={filter.length > 0 ? "Try a different search term." : "Create one to get started."}
        />
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-3 py-3 font-medium">Model</th>
                <th className="px-3 py-3 text-right font-medium">Tokens</th>
                <th className="px-3 py-3 text-right font-medium">Cost</th>
                <th className="px-3 py-3 text-right font-medium">Created</th>
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
                    className="border-b border-line/50 transition-colors last:border-0 hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/sessions/${s.id}`}
                        className="block max-w-md truncate text-zinc-200 hover:text-emerald-300"
                      >
                        {s.title != null && s.title.length > 0 ? (
                          s.title
                        ) : (
                          <span className="italic text-zinc-500">Untitled</span>
                        )}
                      </Link>
                      <div className="mt-0.5 font-mono text-[10px] text-zinc-600">
                        {s.id.length > 18 ? `${s.id.slice(0, 18)}...` : s.id}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {model !== "—" ? (
                        <Badge tone="violet">{model}</Badge>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-400">
                      {formatTokens(totalTokens(s.tokens))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-400">
                      {formatUsd(s.cost)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px] text-zinc-500">
                      {formatRelative(s.time?.created)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        disabled={deleting}
                        className="rounded-md border border-red-900/60 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                      >
                        {deleting ? "..." : "Delete"}
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
