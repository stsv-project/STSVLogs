import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { get } from "../api";
import type { CardPickRate, CardWinRate, RunHistoryOverview, TrendsResponse } from "../types";

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

  const defeats = data.total_runs - data.total_victories - data.total_abandoned;
  const completed = data.total_runs - data.total_abandoned;
  const winRate = completed > 0
    ? ((data.total_victories / completed) * 100).toFixed(1)
    : "0";
  const avgMinutes = data.avg_run_time_seconds > 0
    ? `${Math.floor(data.avg_run_time_seconds / 60)}分${Math.round(data.avg_run_time_seconds % 60)}秒`
    : "—";

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

  const timeData = mapToChartData(data.run_times);
  const ascData = mapToChartData(data.ascensions);
  const modeData = mapToChartData(data.game_modes);
  const cardPickRates = data.card_pick_rates || [];
  const totalCardOffers = cardPickRates.reduce((sum, card) => sum + card.offered_count, 0);
  const totalCardPicks = cardPickRates.reduce((sum, card) => sum + card.picked_count, 0);
  const totalCardPickRate = totalCardOffers > 0
    ? ((totalCardPicks / totalCardOffers) * 100).toFixed(1)
    : "0";
  const cardPickTop = [...cardPickRates]
    .sort((a, b) => b.picked_count - a.picked_count || b.offered_count - a.offered_count)
    .slice(0, 25);
  const cardsWithEnoughSamples = cardPickRates.filter((card) => card.offered_count >= 5);
  const highPickRates = [...cardsWithEnoughSamples]
    .sort((a, b) => b.pick_rate - a.pick_rate || b.offered_count - a.offered_count)
    .slice(0, 15);
  const lowPickRates = [...cardsWithEnoughSamples]
    .sort((a, b) => a.pick_rate - b.pick_rate || b.offered_count - a.offered_count)
    .slice(0, 15);
  const cardWinRates = data.card_win_rates || [];
  const totalCardRunSamples = cardWinRates.reduce((sum, card) => sum + card.run_count, 0);
  const totalCardWins = cardWinRates.reduce((sum, card) => sum + card.win_count, 0);
  const totalCardWinRate = totalCardRunSamples > 0
    ? ((totalCardWins / totalCardRunSamples) * 100).toFixed(1)
    : "0";
  const cardWinTop = [...cardWinRates]
    .sort((a, b) => b.win_count - a.win_count || b.run_count - a.run_count)
    .slice(0, 25);
  const cardWinsWithEnoughSamples = cardWinRates.filter((card) => card.run_count >= 5);
  const highWinRates = [...cardWinsWithEnoughSamples]
    .sort((a, b) => b.win_rate - a.win_rate || b.run_count - a.run_count)
    .slice(0, 15);
  const lowWinRates = [...cardWinsWithEnoughSamples]
    .sort((a, b) => a.win_rate - b.win_rate || b.run_count - a.run_count)
    .slice(0, 15);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>对局分析</h1>

      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
        <MetricCard label="总对局数" value={data.total_runs.toLocaleString()} />
        <MetricCard label="胜利" value={data.total_victories.toLocaleString()} color="#82ca9d" />
        <MetricCard label="失败" value={defeats.toLocaleString()} color="#ff6384" />
        <MetricCard label="放弃" value={data.total_abandoned.toLocaleString()} color="#ff8042" />
        <MetricCard label="有效对局" value={completed.toLocaleString()} />
        <MetricCard label="胜率" value={`${winRate}%`} color="#8884d8" />
        <MetricCard label="平均用时" value={avgMinutes} />
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
          <ResponsiveContainer width="100%" height={Math.max(450, charMerged.length * 45)}>
            <BarChart data={charMerged} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={150} />
              <Tooltip />
              <Bar dataKey="usage" fill="#8884d8" name="出场" />
              <Bar dataKey="wins" fill="#82ca9d" name="胜利" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
        <ChartSection title="运行时间分布">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0088fe" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="进阶等级分布">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ascData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
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

      <div style={{ marginTop: 32 }}>
        <h2>单卡奖励选取率</h2>
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          <MetricCard label="候选出现" value={totalCardOffers.toLocaleString()} />
          <MetricCard label="选取次数" value={totalCardPicks.toLocaleString()} color="#82ca9d" />
          <MetricCard label="总体选取率" value={`${totalCardPickRate}%`} color="#8884d8" />
        </div>

        {cardPickTop.length > 0 ? (
          <>
            <ChartSection title="选取次数 / 候选次数 Top 25">
              <ResponsiveContainer width="100%" height={Math.max(500, cardPickTop.length * 34)}>
                <BarChart data={cardPickTop} layout="vertical" margin={{ left: 30, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="card_name" tick={{ fontSize: 12 }} width={190} />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === "picked_count" ? "选取" : "候选",
                    ]}
                    labelFormatter={(_, payload) => {
                      const card = payload?.[0]?.payload as CardPickRate | undefined;
                      return card ? `${card.card_name}（${card.card_id}，${(card.pick_rate * 100).toFixed(1)}%）` : "";
                    }}
                  />
                  <Legend />
                  <Bar dataKey="offered_count" fill="#8884d8" name="候选" />
                  <Bar dataKey="picked_count" fill="#82ca9d" name="选取" />
                </BarChart>
              </ResponsiveContainer>
            </ChartSection>

            <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
              <CardPickRateTable title="高选取率（候选 ≥ 5）" cards={highPickRates} />
              <CardPickRateTable title="低选取率（候选 ≥ 5）" cards={lowPickRates} />
            </div>
          </>
        ) : (
          <div style={{ marginTop: 16, color: "#666" }}>暂无单卡奖励选择数据</div>
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>单卡最终牌组胜率</h2>
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          <MetricCard label="样本对局" value={totalCardRunSamples.toLocaleString()} />
          <MetricCard label="胜利样本" value={totalCardWins.toLocaleString()} color="#82ca9d" />
          <MetricCard label="总体样本胜率" value={`${totalCardWinRate}%`} color="#8884d8" />
        </div>

        {cardWinTop.length > 0 ? (
          <>
            <ChartSection title="胜利数 / 样本对局 Top 25">
              <ResponsiveContainer width="100%" height={Math.max(500, cardWinTop.length * 34)}>
                <BarChart data={cardWinTop} layout="vertical" margin={{ left: 30, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="card_name" tick={{ fontSize: 12 }} width={190} />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === "win_count" ? "胜利" : "样本",
                    ]}
                    labelFormatter={(_, payload) => {
                      const card = payload?.[0]?.payload as CardWinRate | undefined;
                      return card ? `${card.card_name}（${card.card_id}，${(card.win_rate * 100).toFixed(1)}%）` : "";
                    }}
                  />
                  <Legend />
                  <Bar dataKey="run_count" fill="#8884d8" name="样本" />
                  <Bar dataKey="win_count" fill="#82ca9d" name="胜利" />
                </BarChart>
              </ResponsiveContainer>
            </ChartSection>

            <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" }}>
              <CardWinRateTable title="高胜率（样本 ≥ 5）" cards={highWinRates} />
              <CardWinRateTable title="低胜率（样本 ≥ 5）" cards={lowWinRates} />
            </div>
          </>
        ) : (
          <div style={{ marginTop: 16, color: "#666" }}>暂无单卡最终牌组胜率数据</div>
        )}
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

function CardPickRateTable({ title, cards }: { title: string; cards: CardPickRate[] }) {
  return (
    <div style={{ flex: "1 1 520px", minWidth: 320 }}>
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <TableHeader>中文名</TableHeader>
              <TableHeader>卡牌 ID</TableHeader>
              <TableHeader align="right">候选</TableHeader>
              <TableHeader align="right">选取</TableHeader>
              <TableHeader align="right">跳过</TableHeader>
              <TableHeader align="right">选取率</TableHeader>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={`${title}-${card.card_id}`} style={{ borderBottom: "1px solid #eee" }}>
                <TableCell>{card.card_name}</TableCell>
                <TableCell>{card.card_id.replace("STSVWB_CARD_", "")}</TableCell>
                <TableCell align="right">{card.offered_count.toLocaleString()}</TableCell>
                <TableCell align="right">{card.picked_count.toLocaleString()}</TableCell>
                <TableCell align="right">{card.skipped_count.toLocaleString()}</TableCell>
                <TableCell align="right">{(card.pick_rate * 100).toFixed(1)}%</TableCell>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <TableCell colSpan={6}>暂无满足样本量的数据</TableCell>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardWinRateTable({ title, cards }: { title: string; cards: CardWinRate[] }) {
  return (
    <div style={{ flex: "1 1 520px", minWidth: 320 }}>
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <TableHeader>中文名</TableHeader>
              <TableHeader>卡牌 ID</TableHeader>
              <TableHeader align="right">样本</TableHeader>
              <TableHeader align="right">胜利</TableHeader>
              <TableHeader align="right">失败</TableHeader>
              <TableHeader align="right">胜率</TableHeader>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={`${title}-${card.card_id}`} style={{ borderBottom: "1px solid #eee" }}>
                <TableCell>{card.card_name}</TableCell>
                <TableCell>{card.card_id.replace("STSVWB_CARD_", "")}</TableCell>
                <TableCell align="right">{card.run_count.toLocaleString()}</TableCell>
                <TableCell align="right">{card.win_count.toLocaleString()}</TableCell>
                <TableCell align="right">{card.loss_count.toLocaleString()}</TableCell>
                <TableCell align="right">{(card.win_rate * 100).toFixed(1)}%</TableCell>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <TableCell colSpan={6}>暂无满足样本量的数据</TableCell>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th style={{ padding: "8px 10px", textAlign: align, whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
  colSpan,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} style={{ padding: "8px 10px", textAlign: align, whiteSpace: "nowrap" }}>
      {children}
    </td>
  );
}
