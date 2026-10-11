import { useQuery } from "@tanstack/react-query";
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
import {
  CalendarTick,
  Chart2,
  Data,
  DollarCircle,
  Flash,
  MessageProgramming,
  MessageSquare,
} from "iconsax-react";
import type { ActivityPoint, ModelStat, MonthStat, StatsSummary } from "@hub/shared";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Icon } from "../../components/ui/Icon";
import { StatTile } from "../../components/ui/StatTile";
import { api, errorMessage } from "../../lib/api";
import { useChartTheme } from "../../lib/chartTheme";
import {
  formatDate,
  formatModel,
  formatRelative,
  formatTokens,
  formatUsd,
  sessionCreatedMs,
  toNum,
  totalTokens,
} from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { useI18n } from "../../lib/i18n";
import type { SessionDto } from "../../lib/types";

/** Themed recharts tooltip — fully defensive against injected props. */
function ChartTip(raw: unknown) {
  const { locale } = useI18n();
  const ct = useChartTheme();
  const props = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const active = props.active === true;
  const payload = Array.isArray(props.payload) ? props.payload : [];
  if (!active || payload.length === 0) return null;
  const label = props.label;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-xl"
      style={{ background: ct.tooltipBg, borderColor: ct.tooltipBorder, color: ct.tooltipText }}
    >
      <div className="mb-1 font-mono" style={{ color: ct.tooltipMuted }}>
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
              style={{ background: typeof it.color === "string" ? it.color : ct.tooltipMuted }}
            />
            <span style={{ color: ct.tooltipMuted }}>{name}</span>
            <span className="ml-auto pl-4 font-mono" style={{ color: ct.tooltipText }}>
              {typeof value === "number"
                ? isCost
                  ? formatUsd(value, locale)
                  : formatTokens(value, locale)
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
  const { t, locale } = useI18n();
  const ct = useChartTheme();

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
        <div className="mb-6 space-y-2">
          <div className="hub-skeleton h-3.5 w-56" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="hub-skeleton h-28" />
          ))}
        </div>
        <div className="hub-skeleton mt-6 h-72" />
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="hub-skeleton h-56" />
          <div className="hub-skeleton h-56" />
        </div>
      </div>
    );
  }

  if (stats.isError) {
    return (
      <div className="h-full overflow-y-auto p-4 lg:p-6">
        <ErrorState
          message={errorMessage(stats.error)}
          retryLabel={t("common.retry")}
          onRetry={() => void stats.refetch()}
        />
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
  const hasCost = chartData.some((m) => m.cost > 0);

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
      <p className="mb-6 text-xs text-muted">
        {t("dashboard.subtitle.range")}
        {typeof data?.timezone === "string" && data.timezone.length > 0 ? ` · ${data.timezone}` : ""}
        {typeof data?.generatedAt === "string"
          ? ` · ${t("dashboard.subtitle.updated", { relative: formatRelative(data.generatedAt, locale) })}`
          : ""}
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label={t("dashboard.stats.tokens")}
          value={formatTokens(grandTokens, locale)}
          sub={t("dashboard.stats.inOut", {
            input: formatTokens(tokens?.input, locale),
            output: formatTokens(tokens?.output, locale),
          })}
          icon={<Icon icon={Data} size={17} />}
        />
        <StatTile
          label={t("dashboard.stats.cost")}
          value={formatUsd(totals?.cost, locale)}
          sub={t("dashboard.stats.usd")}
          icon={<Icon icon={DollarCircle} size={17} />}
        />
        <StatTile
          label={t("dashboard.stats.sessions")}
          value={formatTokens(toNum(totals?.sessions), locale)}
          icon={<Icon icon={MessageSquare} size={17} />}
        />
        <StatTile
          label={t("dashboard.stats.prompts")}
          value={formatTokens(toNum(totals?.prompts), locale)}
          icon={<Icon icon={MessageProgramming} size={17} />}
        />
        <StatTile
          label={t("dashboard.stats.activeDays")}
          value={formatTokens(toNum(totals?.activeDays), locale)}
          icon={<Icon icon={CalendarTick} size={17} />}
        />
        <StatTile
          label={t("dashboard.stats.streak")}
          value={`${formatTokens(toNum(totals?.streak), locale)} ${t("dashboard.stats.streakUnit")}`}
          icon={<Icon icon={Flash} size={17} />}
        />
      </div>

      <Card title={t("dashboard.chart.title")} className="mt-6">
        {chartData.length === 0 ? (
          <EmptyState
            icon={<Icon icon={Chart2} size={22} />}
            title={t("dashboard.chart.empty")}
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid stroke={ct.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: ct.tick, fontSize: 11 }}
                  axisLine={{ stroke: ct.axis }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="tokens"
                  width={44}
                  tick={{ fill: ct.tick, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatTokens(v, locale)}
                />
                {hasCost ? (
                  <YAxis
                    yAxisId="cost"
                    orientation="right"
                    width={52}
                    tick={{ fill: ct.tick, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatUsd(v, locale)}
                  />
                ) : null}
                <Tooltip content={ChartTip} cursor={{ fill: ct.cursor }} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconSize={9}
                  formatter={(value) => (
                    <span style={{ color: ct.tooltipMuted }}>{String(value)}</span>
                  )}
                />
                <Bar
                  yAxisId="tokens"
                  dataKey="tokens"
                  name={t("dashboard.chart.tokens")}
                  fill={ct.accent}
                  fillOpacity={0.85}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={26}
                />
                {hasCost ? (
                  <Line
                    yAxisId="cost"
                    dataKey="cost"
                    name={t("dashboard.chart.cost")}
                    type="monotone"
                    stroke={ct.line}
                    strokeWidth={2}
                    dot={false}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
            {!hasCost ? (
              <p className="mt-2 text-center font-mono text-[11px] text-muted">
                {t("dashboard.chart.noCost")}
              </p>
            ) : null}
          </>
        )}
      </Card>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card title={t("dashboard.models.title")}>
          {modelRows.length === 0 ? (
            <EmptyState
              icon={<Icon icon={Data} size={22} />}
              title={t("dashboard.models.empty")}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-2 pr-3 font-semibold">{t("dashboard.models.model")}</th>
                  <th className="pb-2 pr-3 text-right font-semibold">{t("dashboard.models.steps")}</th>
                  <th className="pb-2 pr-3 text-right font-semibold">{t("dashboard.models.tokens")}</th>
                  <th className="pb-2 text-right font-semibold">{t("dashboard.models.cost")}</th>
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
                        <div className="truncate font-mono text-xs text-primary">{m.model ?? "—"}</div>
                        <div className="mt-1.5 h-1 w-full max-w-56 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full rounded-full bg-accent/80"
                            style={{ width: `${share.toFixed(1)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[10px] text-muted">
                          {t("dashboard.models.share", { share: share.toFixed(1) })}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs text-secondary">
                        {formatTokens(toNum(m.steps), locale)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-xs text-secondary">
                        {formatTokens(totalTokens(m.tokens), locale)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs text-secondary">
                        {formatUsd(m.cost, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title={t("dashboard.activity.title")}
          actions={
            <span className="font-mono text-[11px] text-muted">
              {t("dashboard.activity.total", { steps: formatTokens(activityTotal, locale) })}
            </span>
          }
        >
          <div className="flex h-20 items-end gap-[2px]">
            {activityDays.map((d) => (
              <div
                key={d.date}
                title={t("dashboard.activity.day", {
                  date: formatDate(d.date, locale),
                  steps: formatTokens(d.steps, locale),
                })}
                className={`flex-1 rounded-[2px] ${d.steps === 0 ? "bg-surface-3" : "bg-accent/75"}`}
                style={{
                  height: d.steps === 0 ? "10%" : `${Math.max(12, (d.steps / activityMax) * 100)}%`,
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
            <span>{activityDays[0]?.date ?? ""}</span>
            <span>{t("dashboard.activity.today")}</span>
          </div>
        </Card>
      </div>

      <Card
        title={t("dashboard.recent.title")}
        className="mt-6"
        actions={
          <Link to="/sessions" className="text-xs font-medium text-accent hover:text-accent-strong">
            {t("dashboard.recent.viewAll")} →
          </Link>
        }
      >
        {recent.isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="hub-skeleton h-9" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<Icon icon={MessageSquare} size={22} />}
            title={t("dashboard.recent.empty")}
            hint={t("dashboard.recent.emptyHint")}
          />
        ) : (
          <ul>
            {sessions.map((s) => {
              const model = formatModel(s.model);
              return (
                <li
                  key={s.id}
                  className="-mx-2 flex items-center gap-3 rounded-lg border-b border-line/50 px-2 py-2 transition-colors last:border-0 hover:bg-surface-3/60"
                >
                  <Link
                    to={`/sessions/${s.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-primary hover:text-accent"
                  >
                    {s.title != null && s.title.length > 0 ? (
                      s.title
                    ) : (
                      <span className="italic text-muted">{t("common.untitled")}</span>
                    )}
                    <span className="ml-2 font-mono text-[10px] text-muted">
                      {s.id.length > 12 ? `${s.id.slice(0, 12)}...` : s.id}
                    </span>
                  </Link>
                  {model !== "—" ? <Badge tone="accent">{model}</Badge> : null}
                  <span className="w-14 shrink-0 text-right font-mono text-xs text-secondary">
                    {formatTokens(totalTokens(s.tokens), locale)}
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-xs text-muted">
                    {formatUsd(s.cost, locale)}
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted">
                    {formatRelative(s.time?.created, locale)}
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
