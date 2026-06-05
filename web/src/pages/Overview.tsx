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
import type { StatsOverview, TrendsResponse } from "../types";

export default function Overview() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats"],
    queryFn: () => get<StatsOverview>("/api/stats/overview"),
  });

  const { data: trendData } = useQuery({
    queryKey: ["trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/trends?days=30"),
  });

  const { data: newInstallsTrend } = useQuery({
    queryKey: ["new-installs-trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/new-installs/trends?days=30"),
  });

  if (isLoading) return <StatusBlock>加载中...</StatusBlock>;
  if (isError || !data) return <StatusBlock>加载失败</StatusBlock>;

  const categoryData = mapToChartData(data.categories);
  const versionData = mapToChartData(data.game_versions, 12);
  const platformData = mapToChartData(data.platforms);
  const languageData = mapToChartData(data.languages);
  const osData = mapToChartData(data.os_names, 12);
  const ritsulibData = mapToChartData(data.ritsulib_versions, 10);
  const archData = mapToChartData(data.process_architectures);
  const dotnetData = mapToChartData(data.dotnet_runtimes, 10);
  const stsvwbData = mapToChartData(data.stsvwb_versions, 10);

  return (
    <PageShell
      title="STSVWB 遥测仪表盘"
      subtitle="事件、安装、运行环境和版本分布的实时读数。"
    >
      <MetricGrid>
        <MetricCard label="总事件数" value={data.total_events.toLocaleString()} accent="orange" />
        <MetricCard label="独立安装数" value={data.unique_installs.toLocaleString()} accent="green" />
        {categoryData.map((item, index) => (
          <MetricCard
            key={item.name}
            label={item.name}
            value={item.value.toLocaleString()}
            accent={index === 0 ? "purple" : undefined}
          />
        ))}
      </MetricGrid>

      <PanelGrid>
        {trendData?.trend && trendData.trend.length > 0 && (
          <ChartPanel title="每日事件趋势" note="近 30 天" span={6} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData.trend}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="count" stroke={chartColors.orange} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}

        {newInstallsTrend?.trend && newInstallsTrend.trend.length > 0 && (
          <ChartPanel title="每日新增独立安装" note="近 30 天" span={6} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={newInstallsTrend.trend}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="count" stroke={chartColors.green} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}

        <ChartPanel title="事件类别" span={4} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} layout="vertical" margin={{ left: 16, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.orange} name="事件数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="平台分布" span={4} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platformData} layout="vertical" margin={{ left: 16, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.blue} name="事件数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="语言分布" span={4} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={languageData} layout="vertical" margin={{ left: 16, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.purple} name="事件数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="游戏版本" span={6} height={360}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={versionData} margin={{ left: 0, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} {...axisProps} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.orange} name="事件数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="STSVWB 模组版本" span={6} height={360}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stsvwbData} margin={{ left: 0, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} {...axisProps} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.green} name="安装数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="RitsuLib 版本" span={6} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ritsulibData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={150} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.purple} name="事件数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title=".NET 运行时" span={6} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dotnetData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={160} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.yellow} name="事件数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="操作系统" span={6} height={360}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={osData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={180} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.blue} name="事件数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="进程架构" span={6} height={360}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={archData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={120} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.red} name="事件数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </PanelGrid>
    </PageShell>
  );
}
