import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { get } from "../api";
import type { DiagnosticsOverview, TrendsResponse } from "../types";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe", "#ff6384", "#36a2eb"];

function mapToChartData(record: Record<string, number>, top?: number) {
  const entries = Object.entries(record).map(([name, value]) => ({ name, value }));
  if (top && entries.length > top) {
    return entries.slice(0, top);
  }
  return entries;
}

export default function Diagnostics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => get<DiagnosticsOverview>("/api/stats/diagnostics"),
  });

  const { data: trendData } = useQuery({
    queryKey: ["diagnostics-trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/diagnostics/trends?days=30"),
  });

  if (isLoading) return <div style={{ padding: 24 }}>加载中...</div>;
  if (isError || !data) return <div style={{ padding: 24 }}>加载失败</div>;

  const exceptionData = mapToChartData(data.exception_types, 15);
  const captureData = mapToChartData(data.capture_sources);
  const versionData = mapToChartData(data.by_game_version);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>诊断面板</h1>

      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
        <MetricCard label="异常总数" value={data.total_diagnostics.toLocaleString()} />
        <MetricCard label="异常类型数" value={Object.keys(data.exception_types).length.toLocaleString()} />
        <MetricCard label="捕获来源数" value={Object.keys(data.capture_sources).length.toLocaleString()} />
      </div>

      {/* 每日异常趋势 */}
      {trendData?.trend && trendData.trend.length > 0 && (
        <ChartSection title="每日异常趋势（近 30 天）">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#ff6384" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* 异常类型排行 */}
      <div style={{ marginTop: 32 }}>
        <ChartSection title="异常类型排行（TOP 15）">
          <ResponsiveContainer width="100%" height={Math.max(300, exceptionData.length * 28)}>
            <BarChart data={exceptionData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={280} />
              <Tooltip />
              <Bar dataKey="value" fill="#ff6384" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* 捕获来源 + 版本分布 */}
      <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
        <ChartSection title="捕获来源分布">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={captureData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {captureData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="异常按游戏版本分布">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={versionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#ffc658" />
            </BarChart>
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
