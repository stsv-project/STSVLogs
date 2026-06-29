import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { get } from "../api";
import { MetricCard, MetricGrid, PageShell, StatusBlock } from "../components/Dashboard";
import { characterOptions, costOptions, rarityOptions, type CardMetadata, type CharacterFilter, type CostFilter, type RarityFilter } from "./cardMetadata";
import {
  mergeCardStats,
  selectVisibleCards,
  sortOptions,
  type SortKey,
} from "./cardBrowser";
import type { RunHistoryOverview } from "../types";

export default function Cards() {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("picked");
  const [characterFilter, setCharacterFilter] = useState<CharacterFilter>("all");
  const [costFilter, setCostFilter] = useState<CostFilter>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cards-overview"],
    queryFn: () => get<RunHistoryOverview>("/api/stats/runs"),
  });

  const cards = useMemo(() => mergeCardStats(data), [data]);
  const visibleCards = useMemo(
    () => selectVisibleCards(cards, { query, sortKey, characterFilter, costFilter, rarityFilter }),
    [cards, query, sortKey, characterFilter, costFilter, rarityFilter],
  );

  if (isLoading) return <StatusBlock>加载中...</StatusBlock>;
  if (isError || !data) return <StatusBlock>加载失败</StatusBlock>;

  const totalOffers = cards.reduce((sum, card) => sum + card.offered_count, 0);
  const totalPicks = cards.reduce((sum, card) => sum + card.picked_count, 0);
  const totalRuns = cards.reduce((sum, card) => sum + card.run_count, 0);

  return (
    <PageShell title="卡牌" subtitle="所有 STSVWB 卡牌的奖励选取率、最终牌组样本和单卡详情入口。">
      <MetricGrid>
        <MetricCard label="卡牌数" value={cards.length.toLocaleString()} accent="purple" />
        <MetricCard label="候选出现" value={totalOffers.toLocaleString()} accent="orange" />
        <MetricCard label="选取次数" value={totalPicks.toLocaleString()} accent="green" />
        <MetricCard label="最终牌组样本" value={totalRuns.toLocaleString()} accent="blue" />
      </MetricGrid>

      <section className="card-browser-panel">
        <div className="card-browser-controls">
          <div>
            <label className="field-label" htmlFor="card-search">搜索卡名或 ID</label>
            <input
              id="card-search"
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：涅槃 / STSVWB_CARD_NEHAN"
            />
          </div>
          <SelectControl
            id="card-sort"
            label="排序"
            value={sortKey}
            options={sortOptions}
            onChange={(value) => setSortKey(value)}
          />
          <SelectControl
            id="card-character-filter"
            label="角色"
            value={characterFilter}
            options={characterOptions}
            onChange={(value) => setCharacterFilter(value)}
          />
          <SelectControl
            id="card-cost-filter"
            label="费用"
            value={costFilter}
            options={costOptions}
            onChange={(value) => setCostFilter(value)}
          />
          <SelectControl
            id="card-rarity-filter"
            label="稀有度"
            value={rarityFilter}
            options={rarityOptions}
            onChange={(value) => setRarityFilter(value)}
          />
        </div>
        <div className="card-browser-count">显示 {visibleCards.length.toLocaleString()} / {cards.length.toLocaleString()} 张</div>
      </section>

      <section className="card-browser-grid">
        {visibleCards.map((card) => (
          <Link key={card.card_id} className="card-browser-card" to={`/cards/${encodeURIComponent(card.card_id)}`}>
            <span className="card-browser-name">{card.card_name}</span>
            <span className="card-browser-id">{card.card_id}</span>
            <span className="card-browser-meta">{formatMetadata(card)}</span>
            <span className="card-browser-stats">
              选取 {toPercent(card.pick_rate)}% ({card.picked_count}/{card.offered_count})
            </span>
            <span className="card-browser-stats">
              胜率 {toPercent(card.win_rate)}% ({card.win_count}/{card.run_count})
            </span>
          </Link>
        ))}
      </section>
    </PageShell>
  );
}

function toPercent(rate: number): string {
  return (rate * 100).toFixed(1);
}

function formatMetadata(card: { readonly metadata: CardMetadata | undefined }): string {
  if (!card.metadata) return "未知角色 / 未知费用 / 未知稀有度";
  return `${card.metadata.character} / ${card.metadata.cost} 费 / ${rarityOptions[card.metadata.rarity]}`;
}

function SelectControl<OptionKey extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: OptionKey;
  readonly options: Record<OptionKey, string>;
  readonly onChange: (value: OptionKey) => void;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(event) => onChange(event.target.value as OptionKey)}>
        {typedEntries(options).map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>{text}</option>
        ))}
      </select>
    </div>
  );
}

function typedEntries<OptionKey extends string>(options: Record<OptionKey, string>): Array<[OptionKey, string]> {
  return Object.entries(options) as Array<[OptionKey, string]>;
}
