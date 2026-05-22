import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { get } from "../api";
import type { StatsOverview } from "../types";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe"];

export default function Overview() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats"],
    queryFn: () => get<StatsOverview>("/api/stats/overview"),
  });

  if (isLoading) return <div style={{ padding: 24 }}>加载中...</div>;
  if (isError || !data) return <div style={{ padding: 24 }}>加载失败</div>;

  const pieData = Object.entries(data.categories).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div style={{ padding: 24 }}>
      <h1>STSVWB 遥测仪表盘</h1>

      <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
        <div style={{
          background: "#f0f0f0", borderRadius: 8, padding: 20, minWidth: 140, textAlign: "center"
        }}>
          <div style={{ fontSize: 32, fontWeight: "bold" }}>{data.total_events}</div>
          <div style={{ color: "#666" }}>总事件数</div>
        </div>
        {Object.entries(data.categories).map(([cat, cnt]) => (
          <div key={cat} style={{
            background: "#f0f0f0", borderRadius: 8, padding: 20, minWidth: 120, textAlign: "center"
          }}>
            <div style={{ fontSize: 32, fontWeight: "bold" }}>{cnt}</div>
            <div style={{ color: "#666" }}>{cat}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>事件类别分布</h2>
        <PieChart width={400} height={300}>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </div>
    </div>
  );
}
