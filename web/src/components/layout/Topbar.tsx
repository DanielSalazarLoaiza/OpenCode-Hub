import { useQuery } from "@tanstack/react-query";
import type { HealthDto } from "@hub/shared";
import { Badge } from "../ui/Badge";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";

export function Topbar() {
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api<HealthDto>("/api/health"),
    refetchInterval: 30_000,
    retry: 1,
  });

  const data = health.data;
  const opencode =
    typeof data?.opencode === "object" && data.opencode !== null ? data.opencode : undefined;
  const connected = data?.ok === true && opencode?.connected === true;
  const version =
    typeof opencode?.version === "string" && opencode.version.length > 0
      ? opencode.version
      : undefined;
  const url = typeof opencode?.url === "string" && opencode.url.length > 0 ? opencode.url : undefined;

  const dot = health.isLoading ? "bg-zinc-600" : connected ? "bg-emerald-400" : "bg-red-500";
  const label = health.isLoading ? "checking..." : connected ? "connected" : "disconnected";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/40 px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-mono text-xs text-zinc-500">opencode-hub</span>
        {version != null ? <Badge title={url ?? undefined}>{`v${version.replace(/^v/, "")}`}</Badge> : null}
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
        <span className="font-mono">{label}</span>
      </div>
    </header>
  );
}
