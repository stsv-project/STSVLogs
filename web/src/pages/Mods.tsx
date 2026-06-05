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
import type { ModInventoryOverview, TrendsResponse } from "../types";

export default function Mods() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mods"],
    queryFn: () => get<ModInventoryOverview>("/api/stats/mods"),
  });

  const { data: trendData } = useQuery({
    queryKey: ["mods-trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/mods/trends?days=30"),
  });

  const { data: updateTrend } = useQuery({
    queryKey: ["version-updates-trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/version-updates/trends?days=30"),
  });

  if (isLoading) return <StatusBlock>加载中...</StatusBlock>;
  if (isError || !data) return <StatusBlock>加载失败</StatusBlock>;

  const topMods = data.popular_mods.slice(0, 20).map((mod) => ({
    name: mod.name,
    installs: mod.installs,
  }));
  const stateData = mapToChartData(data.load_states);

  return (
    <PageShell title="模组生态" subtitle="安装、加载状态和版本更新的模组生态视图。">
      <MetricGrid>
        <MetricCard label="快照数" value={data.total_snapshots.toLocaleString()} accent="orange" />
        <MetricCard label="平均已加载" value={data.avg_loaded.toFixed(1)} accent="green" />
        <MetricCard label="平均玩法" value={data.avg_gameplay.toFixed(1)} accent="purple" />
        <MetricCard label="平均禁用" value={data.avg_disabled.toFixed(1)} accent="yellow" />
        <MetricCard label="平均失败" value={data.avg_failed.toFixed(1)} accent="red" />
      </MetricGrid>

      <PanelGrid>
        {trendData?.trend && trendData.trend.length > 0 && (
          <ChartPanel title="每日模组快照趋势" note="近 30 天" span={6} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData.trend}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="count" stroke={chartColors.purple} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}

        {updateTrend?.trend && updateTrend.trend.length > 0 && (
          <ChartPanel title="每日 STSVWB 版本更新" note="近 30 天" span={6} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={updateTrend.trend}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="count" stroke={chartColors.orange} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}

        <ChartPanel title="热门 Mod" note={`TOP 20 / ${data.popular_mods.length}`} span={8} height={Math.max(620, topMods.length * 34)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topMods} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={260} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="installs" fill={chartColors.orange} name="安装数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="加载状态" span={4} height={Math.max(320, stateData.length * 44)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stateData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={120} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.green} name="快照数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </PanelGrid>
    </PageShell>
  );
}
