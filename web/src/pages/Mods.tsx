import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { get } from "../api";
import type { ModInventoryOverview, TrendsResponse } from "../types";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe", "#ff6384", "#36a2eb"];

function mapToChartData(record: Record<string, number>) {
  return Object.entries(record).map(([name, value]) => ({ name, value }));
}

export default function Mods() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mods"],
    queryFn: () => get<ModInventoryOverview>("/api/stats/mods"),
  });

  const { data: trendData } = useQuery({
    queryKey: ["mods-trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/mods/trends?days=30"),
  });

  if (isLoading) return <div style={{ padding: 24 }}>加载中...</div>;
  if (isError || !data) return <div style={{ padding: 24 }}>加载失败</div>;

  const topMods = data.popular_mods.slice(0, 20).map(m => ({
    name: m.name,
    installs: m.installs,
  }));
  const stateData = mapToChartData(data.load_states);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>模组生态</h1>

      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
        <MetricCard label="快照数" value={data.total_snapshots.toLocaleString()} />
        <MetricCard label="平均已加载" value={data.avg_loaded.toFixed(1)} color="#82ca9d" />
        <MetricCard label="平均玩法" value={data.avg_gameplay.toFixed(1)} color="#8884d8" />
        <MetricCard label="平均禁用" value={data.avg_disabled.toFixed(1)} color="#ff8042" />
        <MetricCard label="平均失败" value={data.avg_failed.toFixed(1)} color="#ff6384" />
      </div>

      {trendData?.trend && trendData.trend.length > 0 && (
        <ChartSection title="每日模组快照趋势（近 30 天）">
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

      <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
        <ChartSection title={`热门 Mod TOP 20（共 ${data.popular_mods.length} 个）`}>
          <ResponsiveContainer width="100%" height={Math.max(400, topMods.length * 24)}>
            <BarChart data={topMods} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={260} />
              <Tooltip />
              <Bar dataKey="installs" fill="#8884d8" name="安装数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="加载状态分布">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={stateData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {stateData.map((_, i) => (
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

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: "#f0f0f0", borderRadius: 8, padding: "16px 20px",
      minWidth: 120, textAlign: "center",
    }}>
      <div style={{ fontSize: 28, fontWeight: "bold", color: color || "inherit" }}>{value}</div>
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
