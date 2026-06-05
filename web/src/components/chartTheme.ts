export const chartColors = {
  orange: "#ff6b1a",
  green: "#0aa66a",
  purple: "#7c3cff",
  blue: "#156fff",
  red: "#e03c31",
  yellow: "#f3c623",
  ink: "#0a0a0a",
  muted: "#5c5548",
  paper: "#fffaf0",
  grid: "rgba(10, 10, 10, 0.22)",
};

export const palette = [
  chartColors.orange,
  chartColors.green,
  chartColors.purple,
  chartColors.blue,
  chartColors.red,
  chartColors.yellow,
];

export const axisProps = {
  tick: { fill: chartColors.ink, fontSize: 11, fontWeight: 800 },
  axisLine: { stroke: chartColors.ink, strokeWidth: 2 },
  tickLine: { stroke: chartColors.ink, strokeWidth: 2 },
};

export const gridProps = {
  stroke: chartColors.grid,
  strokeDasharray: "0",
};

export const tooltipProps = {
  cursor: { fill: "rgba(10, 10, 10, 0.08)" },
  contentStyle: {
    background: chartColors.ink,
    border: `2px solid ${chartColors.ink}`,
    borderRadius: 0,
    color: chartColors.paper,
    fontWeight: 800,
  },
  labelStyle: {
    color: chartColors.paper,
    fontWeight: 900,
  },
  itemStyle: {
    color: chartColors.paper,
    fontWeight: 800,
  },
};

export type ChartDatum = {
  name: string;
  value: number;
};

export function mapToChartData(record: Record<string, number>, limit?: number): ChartDatum[] {
  const data = Object.entries(record)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  return typeof limit === "number" ? data.slice(0, limit) : data;
}
