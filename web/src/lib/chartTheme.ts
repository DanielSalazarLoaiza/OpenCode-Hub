import { useMemo } from "react";
import { useTheme } from "./theme";

/**
 * ONE chart-theme factory — reused by every Recharts component.
 * Reads the semantic CSS tokens from :root/.dark so the stylesheet stays
 * the single source of truth; re-reads whenever the theme flips.
 */
export interface ChartTheme {
  grid: string;
  axis: string;
  tick: string;
  cursor: string;
  accent: string;
  line: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipMuted: string;
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string): string => style.getPropertyValue(name).trim();
    return {
      grid: read("--chart-grid"),
      axis: read("--chart-axis"),
      tick: read("--chart-tick"),
      cursor: read("--chart-cursor"),
      accent: read("--accent"),
      line: read("--text-2"),
      tooltipBg: read("--chart-tooltip-bg"),
      tooltipBorder: read("--line"),
      tooltipText: read("--chart-tooltip-text"),
      tooltipMuted: read("--chart-tooltip-muted"),
    };
  }, [theme]);
}
