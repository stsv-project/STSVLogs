import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartPanel, MetricCard, MetricGrid, PageShell, PanelGrid, StatusBlock } from "../components/Dashboard";
import { axisProps, chartColors, gridProps, mapToChartData, tooltipProps } from "../components/chartTheme";
import { get } from "../api";
import type { DiagnosticsOverview, TrendsResponse } from "../types";

export default function Diagnostics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => get<DiagnosticsOverview>("/api/stats/diagnostics"),
  });

  const { data: trendData } = useQuery({
    queryKey: ["diagnostics-trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/diagnostics/trends?days=30"),
  });

  if (isLoading) return <StatusBlock>加载中...</StatusBlock>;
  if (isError || !data) return <StatusBlock>加载失败</StatusBlock>;

  const exceptionData = mapToChartData(data.exception_types, 15);
  const captureData = mapToChartData(data.capture_sources);
  const versionData = mapToChartData(data.by_game_version, 12);

  return (
    <PageShell title="诊断面板" subtitle="异常、捕获来源和版本分布，以排行优先暴露最重风险。">
      <MetricGrid>
        <MetricCard label="异常总数" value={data.total_diagnostics.toLocaleString()} accent="red" />
        <MetricCard label="异常类型数" value={Object.keys(data.exception_types).length.toLocaleString()} accent="orange" />
        <MetricCard label="捕获来源数" value={Object.keys(data.capture_sources).length.toLocaleString()} accent="purple" />
      </MetricGrid>

      <PanelGrid>
        {trendData?.trend && trendData.trend.length > 0 && (
          <ChartPanel title="每日异常趋势" note="近 30 天" span={12} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData.trend}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="count" stroke={chartColors.red} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}

        <ChartPanel title="异常类型排行" note="TOP 15" span={12} height={Math.max(520, exceptionData.length * 36)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={exceptionData} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={300} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.red} name="异常数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="捕获来源" span={6} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={captureData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={160} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.orange} name="异常数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="游戏版本异常" span={6} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={versionData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={140} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.purple} name="异常数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </PanelGrid>
    </PageShell>
  );
}
