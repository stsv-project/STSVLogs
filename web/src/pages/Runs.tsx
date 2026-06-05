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
import {
  ChartPanel,
  MetricCard,
  MetricGrid,
  PageShell,
  PanelGrid,
  SectionTitle,
  StatusBlock,
} from "../components/Dashboard";
import { axisProps, chartColors, gridProps, mapToChartData, tooltipProps } from "../components/chartTheme";
import { get } from "../api";
import type { CardPickRate, CardWinRate, RunHistoryOverview, TrendsResponse } from "../types";

type CardPickChartPoint = CardPickRate & {
  rate_percent: number;
};

type CardWinChartPoint = CardWinRate & {
  rate_percent: number;
};

export default function Runs() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["runs"],
    queryFn: () => get<RunHistoryOverview>("/api/stats/runs"),
  });

  const { data: trendData } = useQuery({
    queryKey: ["runs-trends"],
    queryFn: () => get<TrendsResponse>("/api/stats/runs/trends?days=30"),
  });

  if (isLoading) return <StatusBlock>加载中...</StatusBlock>;
  if (isError || !data) return <StatusBlock>加载失败</StatusBlock>;

  const defeats = data.total_runs - data.total_victories - data.total_abandoned;
  const completed = data.total_runs - data.total_abandoned;
  const winRate = completed > 0 ? ((data.total_victories / completed) * 100).toFixed(1) : "0";
  const avgMinutes = data.avg_run_time_seconds > 0
    ? `${Math.floor(data.avg_run_time_seconds / 60)}分${Math.round(data.avg_run_time_seconds % 60)}秒`
    : "—";

  const characterData = Object.entries(data.characters)
    .sort((a, b) => b[1] - a[1])
    .map(([name, usage]) => ({
      name,
      usage,
      wins: data.character_wins[name] || 0,
    }));

  const timeData = mapToChartData(data.run_times);
  const ascData = mapToChartData(data.ascensions);
  const modeData = mapToChartData(data.game_modes);

  const cardPickRates = data.card_pick_rates || [];
  const totalCardOffers = cardPickRates.reduce((sum, card) => sum + card.offered_count, 0);
  const totalCardPicks = cardPickRates.reduce((sum, card) => sum + card.picked_count, 0);
  const totalCardPickRate = totalCardOffers > 0 ? ((totalCardPicks / totalCardOffers) * 100).toFixed(1) : "0";
  const cardPickTop = [...cardPickRates]
    .sort((a, b) => b.picked_count - a.picked_count || b.offered_count - a.offered_count)
    .slice(0, 25);
  const cardsWithEnoughPickSamples = cardPickRates.filter((card) => card.offered_count >= 5);
  const highPickRates = [...cardsWithEnoughPickSamples]
    .sort((a, b) => b.pick_rate - a.pick_rate || b.offered_count - a.offered_count)
    .slice(0, 15)
    .map(toPickChartPoint);
  const lowPickRates = [...cardsWithEnoughPickSamples]
    .sort((a, b) => a.pick_rate - b.pick_rate || b.offered_count - a.offered_count)
    .slice(0, 15)
    .map(toPickChartPoint);

  const cardWinRates = data.card_win_rates || [];
  const totalCardRunSamples = cardWinRates.reduce((sum, card) => sum + card.run_count, 0);
  const totalCardWins = cardWinRates.reduce((sum, card) => sum + card.win_count, 0);
  const totalCardWinRate = totalCardRunSamples > 0 ? ((totalCardWins / totalCardRunSamples) * 100).toFixed(1) : "0";
  const cardWinTop = [...cardWinRates]
    .sort((a, b) => b.win_count - a.win_count || b.run_count - a.run_count)
    .slice(0, 25);
  const cardsWithEnoughWinSamples = cardWinRates.filter((card) => card.run_count >= 5);
  const highWinRates = [...cardsWithEnoughWinSamples]
    .sort((a, b) => b.win_rate - a.win_rate || b.run_count - a.run_count)
    .slice(0, 15)
    .map(toWinChartPoint);
  const lowWinRates = [...cardsWithEnoughWinSamples]
    .sort((a, b) => a.win_rate - b.win_rate || b.run_count - a.run_count)
    .slice(0, 15)
    .map(toWinChartPoint);

  return (
    <PageShell title="对局分析" subtitle="角色、对局结果、卡牌选择和最终牌组胜率。">
      <MetricGrid>
        <MetricCard label="总对局数" value={data.total_runs.toLocaleString()} accent="orange" />
        <MetricCard label="胜利" value={data.total_victories.toLocaleString()} accent="green" />
        <MetricCard label="失败" value={defeats.toLocaleString()} accent="red" />
        <MetricCard label="放弃" value={data.total_abandoned.toLocaleString()} accent="yellow" />
        <MetricCard label="有效对局" value={completed.toLocaleString()} />
        <MetricCard label="胜率" value={`${winRate}%`} accent="purple" />
        <MetricCard label="平均用时" value={avgMinutes} accent="blue" />
      </MetricGrid>

      <PanelGrid>
        {trendData?.trend && trendData.trend.length > 0 && (
          <ChartPanel title="每日对局趋势" note="近 30 天" span={12} height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData.trend}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="count" stroke={chartColors.green} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}

        <ChartPanel title="角色使用率" note={`STSVWB ${characterData.length} 个角色`} span={12} height={Math.max(420, characterData.length * 42)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={characterData} layout="vertical" margin={{ left: 12, right: 16 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={150} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="usage" fill={chartColors.purple} name="出场" />
              <Bar dataKey="wins" fill={chartColors.green} name="胜利" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="运行时间分布" span={4} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={90} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.blue} name="对局数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="进阶等级分布" span={4} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ascData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={70} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.red} name="对局数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="游戏模式分布" span={4} height={320}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={modeData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="name" width={100} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" fill={chartColors.orange} name="对局数" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </PanelGrid>

      <SectionTitle>单卡奖励选取率</SectionTitle>
      <MetricGrid>
        <MetricCard label="候选出现" value={totalCardOffers.toLocaleString()} accent="orange" />
        <MetricCard label="选取次数" value={totalCardPicks.toLocaleString()} accent="green" />
        <MetricCard label="总体选取率" value={`${totalCardPickRate}%`} accent="purple" />
      </MetricGrid>

      <PanelGrid>
        {cardPickTop.length > 0 ? (
          <>
            <ChartPanel title="选取次数 / 候选次数" note="TOP 25" span={12} height={Math.max(520, cardPickTop.length * 34)}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cardPickTop} layout="vertical" margin={{ left: 12, right: 16 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis type="number" allowDecimals={false} {...axisProps} />
                  <YAxis type="category" dataKey="card_name" width={220} {...axisProps} />
                  <Tooltip {...tooltipProps} formatter={(value, name) => [value, name === "picked_count" ? "选取" : "候选"]} />
                  <Bar dataKey="offered_count" fill={chartColors.purple} name="候选" />
                  <Bar dataKey="picked_count" fill={chartColors.green} name="选取" />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <CardPickRateChart title="高选取率" data={highPickRates} color={chartColors.green} />
            <CardPickRateChart title="低选取率" data={lowPickRates} color={chartColors.red} />
          </>
        ) : (
          <ChartPanel title="单卡奖励选择数据" span={12} height={110}>
            <div className="panel-empty">暂无单卡奖励选择数据</div>
          </ChartPanel>
        )}
      </PanelGrid>

      <SectionTitle>单卡最终牌组胜率</SectionTitle>
      <MetricGrid>
        <MetricCard label="样本对局" value={totalCardRunSamples.toLocaleString()} accent="blue" />
        <MetricCard label="胜利样本" value={totalCardWins.toLocaleString()} accent="green" />
        <MetricCard label="总体样本胜率" value={`${totalCardWinRate}%`} accent="purple" />
      </MetricGrid>

      <PanelGrid>
        {cardWinTop.length > 0 ? (
          <>
            <ChartPanel title="胜利数 / 样本对局" note="TOP 25" span={12} height={Math.max(520, cardWinTop.length * 34)}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cardWinTop} layout="vertical" margin={{ left: 12, right: 16 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis type="number" allowDecimals={false} {...axisProps} />
                  <YAxis type="category" dataKey="card_name" width={220} {...axisProps} />
                  <Tooltip {...tooltipProps} formatter={(value, name) => [value, name === "win_count" ? "胜利" : "样本"]} />
                  <Bar dataKey="run_count" fill={chartColors.purple} name="样本" />
                  <Bar dataKey="win_count" fill={chartColors.green} name="胜利" />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <CardWinRateChart title="高胜率" data={highWinRates} color={chartColors.green} />
            <CardWinRateChart title="低胜率" data={lowWinRates} color={chartColors.red} />
          </>
        ) : (
          <ChartPanel title="单卡最终牌组胜率数据" span={12} height={110}>
            <div className="panel-empty">暂无单卡最终牌组胜率数据</div>
          </ChartPanel>
        )}
      </PanelGrid>
    </PageShell>
  );
}

function toPickChartPoint(card: CardPickRate): CardPickChartPoint {
  return {
    ...card,
    rate_percent: Number((card.pick_rate * 100).toFixed(1)),
  };
}

function toWinChartPoint(card: CardWinRate): CardWinChartPoint {
  return {
    ...card,
    rate_percent: Number((card.win_rate * 100).toFixed(1)),
  };
}

function CardPickRateChart({ title, data, color }: { title: string; data: CardPickChartPoint[]; color: string }) {
  return (
    <ChartPanel title={title} note="候选 >= 5 / TOP 15" span={6} height={Math.max(360, data.length * 34)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
          <CartesianGrid {...gridProps} />
          <XAxis type="number" domain={[0, 100]} unit="%" {...axisProps} />
          <YAxis type="category" dataKey="card_name" width={190} {...axisProps} />
          <Tooltip
            {...tooltipProps}
            formatter={(value, name, item) => {
              const card = item.payload as CardPickChartPoint;
              return [
                `${value}% (${card.picked_count}/${card.offered_count})`,
                name === "rate_percent" ? "选取率" : name,
              ];
            }}
          />
          <Bar dataKey="rate_percent" fill={color} name="选取率" />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

function CardWinRateChart({ title, data, color }: { title: string; data: CardWinChartPoint[]; color: string }) {
  return (
    <ChartPanel title={title} note="样本 >= 5 / TOP 15" span={6} height={Math.max(360, data.length * 34)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
          <CartesianGrid {...gridProps} />
          <XAxis type="number" domain={[0, 100]} unit="%" {...axisProps} />
          <YAxis type="category" dataKey="card_name" width={190} {...axisProps} />
          <Tooltip
            {...tooltipProps}
            formatter={(value, name, item) => {
              const card = item.payload as CardWinChartPoint;
              return [
                `${value}% (${card.win_count}/${card.run_count})`,
                name === "rate_percent" ? "胜率" : name,
              ];
            }}
          />
          <Bar dataKey="rate_percent" fill={color} name="胜率" />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
