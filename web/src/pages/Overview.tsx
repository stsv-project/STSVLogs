import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { get } from "../api";
import type { StatsOverview, TrendsResponse } from "../types";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe", "#ff6384", "#36a2eb"];

function mapToChartData(record: Record<string, number>) {
  return Object.entries(record).map(([name, value]) => ({ name, value }));
}

export default function Overview() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats"],
    queryFn: () => get<StatsOverview>("/api/stats/overview"),
  });

  const { data: trendData } = useQuery({
    queryKey: ["trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/trends?days=30"),
  });

  if (isLoading) return <div style={{ padding: 24 }}>加载中...</div>;
  if (isError || !data) return <div style={{ padding: 24 }}>加载失败</div>;

  const pieData = mapToChartData(data.categories);
  const versionData = mapToChartData(data.game_versions);
  const platformData = mapToChartData(data.platforms);
  const languageData = mapToChartData(data.languages);
  const osData = mapToChartData(data.os_names);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>STSVWB 遥测仪表盘</h1>

      {/* 关键指标卡片 */}
      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
        <MetricCard label="总事件数" value={data.total_events.toLocaleString()} />
        <MetricCard label="独立安装数" value={data.unique_installs.toLocaleString()} />
        {Object.entries(data.categories).map(([cat, cnt]) => (
          <MetricCard key={cat} label={cat} value={cnt.toLocaleString()} />
        ))}
      </div>

      {/* 每日事件趋势 */}
      {trendData?.trend && trendData.trend.length > 0 && (
        <ChartSection title="每日事件趋势（近 30 天）">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* 图表行：版本 + 平台 */}
      <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
        <ChartSection title="游戏版本分布">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={versionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="平台分布">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={platformData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {platformData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* 图表行：语言 + OS */}
      <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
        <ChartSection title="语言分布">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={languageData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {languageData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="操作系统分布">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={osData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {osData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* 事件类别分布（原有饼图保留） */}
      <div style={{ marginTop: 32 }}>
        <ChartSection title="事件类别分布">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "#f0f0f0", borderRadius: 8, padding: "16px 20px",
      minWidth: 120, textAlign: "center",
    }}>
      <div style={{ fontSize: 28, fontWeight: "bold" }}>{value}</div>
      <div style={{ color: "#666", fontSize: 13 }}>{label}</div>
    </div>
  );
}

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: "1 1 400px", minWidth: 320 }}>
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}
