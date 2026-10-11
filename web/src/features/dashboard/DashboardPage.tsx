import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActivityPoint, ModelStat, MonthStat, StatsSummary } from "@hub/shared";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { StatTile } from "../../components/ui/StatTile";
import { api, errorMessage } from "../../lib/api";
import {
  formatModel,
  formatRelative,
  formatTokens,
  formatUsd,
  sessionCreatedMs,
  toNum,
  totalTokens,
} from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import type { SessionDto } from "../../lib/types";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-zinc-500"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const icons = {
  tokens: (
    <Icon>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </Icon>
  ),
  cost: (
    <Icon>
      <path d="M12 2v20" />
      <path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Icon>
  ),
  sessions: (
    <Icon>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </Icon>
  ),
  prompts: (
    <Icon>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    </Icon>
  ),
  days: (
    <Icon>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </Icon>
  ),
  streak: (
    <Icon>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </Icon>
  ),
};

/** Dark-theme recharts tooltip — fully defensive against injected props. */
function ChartTip(raw: unknown) {
  const props = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const active = props.active === true;
  const payload = Array.isArray(props.payload) ? props.payload : [];
  if (!active || payload.length === 0) return null;
  const label = props.label;
  return (
    <div className="rounded-lg border border-line bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-mono text-zinc-400">
        {typeof label === "string" ? label : String(label ?? "")}
      </div>
      {payload.map((item, i) => {
        const it = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
        const name =
          typeof it.name === "string" ? it.name : typeof it.dataKey === "string" ? it.dataKey : "value";
        const value = it.value;
        const isCost = it.dataKey === "cost";
        return (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: typeof it.color === "string" ? it.color : "#52525b" }}
            />
            <span className="text-zinc-400">{name}</span>
            <span className="ml-auto pl-4 font-mono text-zinc-100">
              {typeof value === "number"
                ? isCost
                  ? formatUsd(value)
                  : formatTokens(value)
                : typeof value === "string"
                  ? value
                  : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Last 90 days of activity as {date, steps}, zero-filled for gap days. */
function buildActivityDays(activity: ActivityPoint[] | undefined): Array<{ date: string; steps: number }> {
  const byDate = new Map<string, number>();
  if (Array.isArray(activity)) {
    for (const p of activity) {
      if (typeof p?.date === "string") byDate.set(p.date, toNum(p.steps));
    }
  }
  const days: Array<{ date: string; steps: number }> = [];
  const now = new Date();
  for (let i = 89; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ date: key, steps: byDate.get(key) ?? 0 });
  }
  return days;
}

export function DashboardPage() {
  const stats = useQuery({
    queryKey: queryKeys.stats.summary(12),
    queryFn: () => api<StatsSummary>("/api/stats/summary?months=12"),
  });

  const recent = useQuery({
    queryKey: queryKeys.sessions.list(8),
    queryFn: () => api<{ data?: SessionDto[] }>("/api/sessions?limit=8"),
  });

  if (stats.isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex h-28 items-center justify-center rounded-xl border border-line bg-surface"
            >
              <Spinner />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stats.isError) {
    return (
      <div className="h-full overflow-y-auto p-4 lg:p-6">
        <ErrorState message={errorMessage(stats.error)} onRetry={() => void stats.refetch()} />
      </div>
    );
  }

  const data = stats.data;
  const totals = data?.totals;
  const tokens = totals?.tokens;
  const grandTokens = totalTokens(tokens);

  const byMonth: MonthStat[] = data?.byMonth ?? [];
  const chartData = byMonth.map((m) => ({
    label: m.label ?? m.month ?? "",
    tokens: totalTokens(m.tokens),
    cost: toNum(m.cost),
  }));

  const byModel: ModelStat[] = data?.byModel ?? [];
  const modelRows = [...byModel].sort((a, b) => totalTokens(b.tokens) - totalTokens(a.tokens));
  const modelTokenTotal = modelRows.reduce((sum, m) => sum + totalTokens(m.tokens), 0);

  const sessions = [...(recent.data?.data ?? [])]
    .sort((a, b) => sessionCreatedMs(b) - sessionCreatedMs(a))
    .slice(0, 8);

  const activityDays = buildActivityDays(data?.activity);
  const activityMax = Math.max(1, ...activityDays.map((d) => d.steps));
  const activityTotal = activityDays.reduce((sum, d) => sum + d.steps, 0);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Dashboard</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          Last 12 months
          {typeof data?.timezone === "string" ? ` · ${data.timezone}` : ""}
          {typeof data?.generatedAt === "string" ? ` · updated ${formatRelative(data.generatedAt)}` : ""}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Tokens"
          value={formatTokens(grandTokens)}
          sub={`in ${formatTokens(tokens?.input)} · out ${formatTokens(tokens?.output)}`}
          icon={icons.tokens}
        />
        <StatTile label="Est. cost" value={formatUsd(totals?.cost)} sub="USD" icon={icons.cost} />
        <StatTile label="Sessions" value={formatTokens(toNum(totals?.sessions))} icon={icons.sessions} />
        <StatTile label="Prompts" value={formatTokens(toNum(totals?.prompts))} icon={icons.prompts} />
        <StatTile label="Active days" value={formatTokens(toNum(totals?.activeDays))} icon={icons.days} />
        <StatTile label="Streak" value={`${formatTokens(toNum(totals?.streak))} d`} icon={icons.streak} />
      </div>

      <Card title="Usage by month" className="mt-6">
        {chartData.length === 0 ? (
          <EmptyState title="No usage recorded yet" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="#1c1c1f" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={{ stroke: "#27272a" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="tokens"
                width={44}
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatTokens}
              />
              <YAxis
                yAxisId="cost"
                orientation="right"
                width={52}
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatUsd(v)}
              />
              <Tooltip content={ChartTip} cursor={{ fill: "rgba(63, 63, 70, 0.12)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
              <Bar
                yAxisId="tokens"
                dataKey="tokens"
                name="tokens"
                fill="#34d399"
                fillOpacity={0.8}
                radius={[3, 3, 0, 0]}
                maxBarSize={26}
              />
              <Line
                yAxisId="cost"
                dataKey="cost"
                name="cost (usd)"
                type="monotone"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card title="Models by usage">
          {modelRows.length === 0 ? (
            <EmptyState title="No model usage recorded" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-3 font-medium">Model</th>
                  <th className="pb-2 pr-3 text-right font-medium">Steps</th>
                  <th className="pb-2 pr-3 text-right font-medium">Tokens</th>
                  <th className="pb-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((m, i) => {
                  const share =
                    modelTokenTotal > 0
                      ? Math.min(100, (totalTokens(m.tokens) / modelTokenTotal) * 100)
                      : 0;
                  return (
                    <tr key={m.model ?? i} className="border-b border-line/50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="truncate font-mono text-xs text-zinc-300">{m.model ?? "—"}</div>
                        <div className="mt-1.5 h-1 w-full max-w-56 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-emerald-400/80"
                            style={{ width: `${share.toFixed(1)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-600">{share.toFixed(1)}% of tokens</div>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs text-zinc-400">
                        {formatTokens(toNum(m.steps))}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs text-zinc-400">
                        {formatTokens(totalTokens(m.tokens))}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs text-zinc-400">
                        {formatUsd(m.cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Activity"
          actions={
            <span className="font-mono text-[11px] text-zinc-500">
              {formatTokens(activityTotal)} steps · 90d
            </span>
          }
        >
          <div className="flex h-20 items-end gap-[2px]">
            {activityDays.map((d) => (
              <div
                key={d.date}
                title={`${d.date} · ${d.steps} steps`}
                className={`flex-1 rounded-[2px] ${d.steps === 0 ? "bg-zinc-800/70" : "bg-emerald-400/75"}`}
                style={{
                  height: d.steps === 0 ? "10%" : `${Math.max(12, (d.steps / activityMax) * 100)}%`,
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-zinc-600">
            <span>{activityDays[0]?.date ?? ""}</span>
            <span>today</span>
          </div>
        </Card>
      </div>

      <Card
        title="Recent sessions"
        className="mt-6"
        actions={
          <Link to="/sessions" className="text-xs text-emerald-400 hover:text-emerald-300">
            View all →
          </Link>
        }
      >
        {recent.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState title="No sessions yet" hint="Sessions appear here once you chat." />
        ) : (
          <ul>
            {sessions.map((s) => {
              const model = formatModel(s.model);
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 border-b border-line/50 py-2 last:border-0"
                >
                  <Link
                    to={`/sessions/${s.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-emerald-300"
                  >
                    {s.title != null && s.title.length > 0 ? (
                      s.title
                    ) : (
                      <span className="italic text-zinc-500">Untitled</span>
                    )}
                    <span className="ml-2 font-mono text-[10px] text-zinc-600">
                      {s.id.length > 12 ? `${s.id.slice(0, 12)}...` : s.id}
                    </span>
                  </Link>
                  {model !== "—" ? <Badge tone="violet">{model}</Badge> : null}
                  <span className="w-14 shrink-0 text-right font-mono text-xs text-zinc-400">
                    {formatTokens(totalTokens(s.tokens))}
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-xs text-zinc-500">
                    {formatUsd(s.cost)}
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[11px] text-zinc-600">
                    {formatRelative(s.time?.created)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
