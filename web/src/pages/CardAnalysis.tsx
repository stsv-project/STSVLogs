import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
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
import { get } from "../api";
import {
  ChartPanel,
  MetricCard,
  MetricGrid,
  PageShell,
  PanelGrid,
  StatusBlock,
} from "../components/Dashboard";
import { axisProps, chartColors, gridProps, mapToChartData, tooltipProps } from "../components/chartTheme";
import type { CardAnalysis as CardAnalysisData, CardCount } from "../types";

type RatePoint = {
  readonly name: string;
  readonly rate_percent: number;
  readonly runs: number;
  readonly wins: number;
};

type TrendDatum = {
  readonly date: string;
  readonly picks?: number;
  readonly final_decks?: number;
};

export default function CardAnalysis() {
  const params = useParams();
  const cardID = params.cardId ?? "";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["card-analysis", cardID],
    queryFn: () => get<CardAnalysisData>(`/api/stats/cards/${encodeURIComponent(cardID)}`),
    enabled: cardID.length > 0,
  });

  if (cardID.length === 0) return <StatusBlock>缺少卡牌 ID</StatusBlock>;
  if (isLoading) return <StatusBlock>加载中...</StatusBlock>;
  if (isError || !data) return <StatusBlock>加载失败</StatusBlock>;

  const pickRate = toPercent(data.pick_rate);
  const winRate = toPercent(data.win_rate);
  const characterData = Object.entries(data.character_runs)
    .map(([name, runs]) => ({ name, runs, wins: data.character_wins[name] ?? 0 }))
    .sort((a, b) => b.runs - a.runs);
  const characterRateData = characterData
    .filter((character) => character.runs > 0)
    .map((character) => ({
      name: character.name,
      rate_percent: Number(((character.wins / character.runs) * 100).toFixed(1)),
      runs: character.runs,
      wins: character.wins,
    }))
    .sort((a, b) => b.rate_percent - a.rate_percent || b.runs - a.runs);
  const ascensionData = mapToChartData(data.ascensions);
  const modeData = mapToChartData(data.game_modes);
  const trendData = mergeTrends(data);

  return (
    <PageShell
      title={data.card_name}
      subtitle={`${data.card_id} 的奖励选择、最终牌组样本、胜率和共现卡分析。`}
    >
      <div className="page-actions">
        <Link to="/runs" className="text-link">返回对局分析</Link>
      </div>

      <MetricGrid>
        <MetricCard label="候选出现" value={data.offered_count.toLocaleString()} accent="orange" />
        <MetricCard label="选取次数" value={data.picked_count.toLocaleString()} accent="green" />
        <MetricCard label="跳过次数" value={data.skipped_count.toLocaleString()} accent="yellow" />
        <MetricCard label="奖励选取率" value={`${pickRate}%`} accent="purple" />
        <MetricCard label="最终牌组样本" value={data.run_count.toLocaleString()} accent="blue" />
        <MetricCard label="样本胜率" value={`${winRate}%`} accent="green" />
        <MetricCard label="胜利" value={data.win_count.toLocaleString()} accent="green" />
        <MetricCard label="失败" value={data.loss_count.toLocaleString()} accent="red" />
      </MetricGrid>

      <PanelGrid>
        <ChartPanel title="近 30 天趋势" note="选取 / 最终牌组" span={12} height={320}>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Line type="monotone" dataKey="picks" stroke={chartColors.green} strokeWidth={3} dot={false} name="选取" />
                <Line type="monotone" dataKey="final_decks" stroke={chartColors.blue} strokeWidth={3} dot={false} name="最终牌组" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="panel-empty">近 30 天暂无样本</div>
          )}
        </ChartPanel>

        <ChartPanel title="角色样本" note="最终牌组包含该卡" span={6} height={Math.max(340, characterData.length * 38)}>
          {characterData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={characterData} layout="vertical" margin={{ left: 12, right: 16 }}>
                <CartesianGrid {...gridProps} />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="name" width={140} {...axisProps} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="runs" fill={chartColors.purple} name="样本" />
                <Bar dataKey="wins" fill={chartColors.green} name="胜利" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="panel-empty">暂无角色样本</div>
          )}
        </ChartPanel>

        <RateChart title="角色胜率" data={characterRateData} />

        <SimpleBarChart title="进阶分布" data={ascensionData} color={chartColors.red} span={6} />
        <SimpleBarChart title="模式分布" data={modeData} color={chartColors.orange} span={6} />
        <CardCountChart title="最终牌组共现卡" data={data.co_occurring_cards} color={chartColors.blue} />
        <CardCountChart title="同奖励候选卡" data={data.frequent_offer_mates} color={chartColors.purple} />
      </PanelGrid>
    </PageShell>
  );
}

function toPercent(rate: number): string {
  return (rate * 100).toFixed(1);
}

function mergeTrends(data: CardAnalysisData): TrendDatum[] {
  const merged = new Map<string, { date: string; picks?: number; final_decks?: number }>();
  for (const point of data.pick_trend) {
    merged.set(point.date, { ...merged.get(point.date), date: point.date, picks: point.count });
  }
  for (const point of data.final_deck_trend) {
    merged.set(point.date, { ...merged.get(point.date), date: point.date, final_decks: point.count });
  }
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function SimpleBarChart({
  title,
  data,
  color,
  span,
}: {
  readonly title: string;
  readonly data: readonly { readonly name: string; readonly value: number }[];
  readonly color: string;
  readonly span: 6 | 12;
}) {
  return (
    <ChartPanel title={title} span={span} height={Math.max(320, data.length * 34)}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
            <CartesianGrid {...gridProps} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="name" width={120} {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="value" fill={color} name="样本" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="panel-empty">暂无数据</div>
      )}
    </ChartPanel>
  );
}

function RateChart({ title, data }: { readonly title: string; readonly data: readonly RatePoint[] }) {
  return (
    <ChartPanel title={title} note="按样本胜率排序" span={6} height={Math.max(340, data.length * 38)}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
            <CartesianGrid {...gridProps} />
            <XAxis type="number" domain={[0, 100]} unit="%" {...axisProps} />
            <YAxis type="category" dataKey="name" width={140} {...axisProps} />
            <Tooltip
              {...tooltipProps}
              formatter={(value, name, item) => {
                const point = item.payload as RatePoint;
                return [`${value}% (${point.wins}/${point.runs})`, name === "rate_percent" ? "胜率" : name];
              }}
            />
            <Bar dataKey="rate_percent" fill={chartColors.green} name="胜率" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="panel-empty">暂无胜率样本</div>
      )}
    </ChartPanel>
  );
}

function CardCountChart({
  title,
  data,
  color,
}: {
  readonly title: string;
  readonly data: readonly CardCount[];
  readonly color: string;
}) {
  return (
    <ChartPanel title={title} note="TOP 20" span={6} height={Math.max(360, data.length * 34)}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
            <CartesianGrid {...gridProps} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="card_name" width={190} {...axisProps} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="count" fill={color} name="次数" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="panel-empty">暂无共现数据</div>
      )}
    </ChartPanel>
  );
}
