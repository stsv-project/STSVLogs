import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { get } from "../api";
import type { RunHistoryOverview, TrendsResponse } from "../types";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe", "#ff6384", "#36a2eb"];

function mapToChartData(record: Record<string, number>) {
  return Object.entries(record).map(([name, value]) => ({ name, value }));
}

export default function Runs() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["runs"],
    queryFn: () => get<RunHistoryOverview>("/api/stats/runs"),
  });

  const { data: trendData } = useQuery({
    queryKey: ["runs-trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/runs/trends?days=30"),
  });

  if (isLoading) return <div style={{ padding: 24 }}>加载中...</div>;
  if (isError || !data) return <div style={{ padding: 24 }}>加载失败</div>;

  const completed = data.total_runs - data.total_abandoned;
  const winRate = completed > 0
    ? ((data.total_victories / completed) * 100).toFixed(1)
    : "0";

  const charMerged = Object.entries(data.characters)
    .sort((a, b) => b[1] - a[1])
    .map(([name, usage]) => {
      const wins = data.character_wins[name] || 0;
      const abandoned = data.character_abandoned[name] || 0;
      const charCompleted = usage - abandoned;
      const charWinRate = charCompleted > 0
        ? ((wins / charCompleted) * 100).toFixed(0)
        : "0";
      return { name, usage, wins, winRate: charWinRate };
    });

  const floorData = mapToChartData(data.floors).filter(d => d.name !== "" && d.name !== "(unknown)");
  const ascData = mapToChartData(data.ascensions);
  const modeData = mapToChartData(data.game_modes);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>对局分析</h1>

      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
        <MetricCard label="总对局数" value={data.total_runs.toLocaleString()} />
        <MetricCard label="有效对局" value={completed.toLocaleString()} color="#82ca9d" />
        <MetricCard label="胜利" value={data.total_victories.toLocaleString()} color="#82ca9d" />
        <MetricCard label="放弃" value={data.total_abandoned.toLocaleString()} color="#ff8042" />
        <MetricCard label="胜率" value={`${winRate}%`} color="#8884d8" />
      </div>

      {trendData?.trend && trendData.trend.length > 0 && (
        <ChartSection title="每日对局趋势（近 30 天）">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#82ca9d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      <div style={{ marginTop: 32 }}>
        <ChartSection title={`角色使用率（STSVWB 本模组 ${charMerged.length} 个角色）`}>
          <ResponsiveContainer width="100%" height={Math.max(350, charMerged.length * 30)}>
            <BarChart data={charMerged} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} />
              <Tooltip />
              <Bar dataKey="usage" fill="#8884d8" name="出场" />
              <Bar dataKey="wins" fill="#82ca9d" name="胜利" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
        <ChartSection title="通关楼层分布">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={floorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#ffc658" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="进阶等级分布">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ascData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#ff6384" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      <div style={{ marginTop: 32, maxWidth: 500 }}>
        <ChartSection title="游戏模式分布">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {modeData.map((_, i) => (
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
