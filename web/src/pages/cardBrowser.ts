import type { CardPickRate, CardStatsOverview, CardWinRate } from "../types";
import { cardMetadataById, type CardMetadata, type CharacterFilter, type CostFilter, type RarityFilter } from "./cardMetadata";

export const sortOptions = {
  picked: "选取次数",
  pickRate: "选取率",
  winRate: "胜率",
  character: "角色",
  cost: "费用",
  rarity: "稀有度",
  name: "卡名",
} as const;

export type SortKey = keyof typeof sortOptions;

export type CardEntry = {
  readonly card_id: string;
  readonly card_name: string;
  readonly metadata: CardMetadata | undefined;
  readonly offered_count: number;
  readonly picked_count: number;
  readonly pick_rate: number;
  readonly run_count: number;
  readonly win_count: number;
  readonly win_rate: number;
};

export type CardBrowserState = {
  readonly query: string;
  readonly sortKey: SortKey;
  readonly characterFilter: CharacterFilter;
  readonly costFilter: CostFilter;
  readonly rarityFilter: RarityFilter;
};

export function mergeCardStats(data: CardStatsOverview | undefined): CardEntry[] {
  if (!data) return [];

  const entries = new Map<string, CardEntry>();
  for (const card of data.card_pick_rates) {
    entries.set(card.card_id, entryFromPick(card));
  }
  for (const card of data.card_win_rates) {
    const existing = entries.get(card.card_id);
    entries.set(card.card_id, existing ? mergeWin(existing, card) : entryFromWin(card));
  }
  return [...entries.values()];
}

export function selectVisibleCards(cards: readonly CardEntry[], state: CardBrowserState): CardEntry[] {
  const normalizedQuery = state.query.trim().toLowerCase();
  return cards
    .filter((card) => matchesSearch(card, normalizedQuery))
    .filter((card) => matchesCharacterFilter(card, state.characterFilter))
    .filter((card) => matchesCostFilter(card, state.costFilter))
    .filter((card) => matchesRarityFilter(card, state.rarityFilter))
    .sort((a, b) => compareCards(a, b, state.sortKey));
}

function entryFromPick(card: CardPickRate): CardEntry {
  return {
    card_id: card.card_id,
    card_name: card.card_name,
    metadata: cardMetadataById.get(card.card_id),
    offered_count: card.offered_count,
    picked_count: card.picked_count,
    pick_rate: card.pick_rate,
    run_count: 0,
    win_count: 0,
    win_rate: 0,
  };
}

function entryFromWin(card: CardWinRate): CardEntry {
  return {
    card_id: card.card_id,
    card_name: card.card_name,
    metadata: cardMetadataById.get(card.card_id),
    offered_count: 0,
    picked_count: 0,
    pick_rate: 0,
    run_count: card.run_count,
    win_count: card.win_count,
    win_rate: card.win_rate,
  };
}

function mergeWin(entry: CardEntry, card: CardWinRate): CardEntry {
  return {
    ...entry,
    run_count: card.run_count,
    win_count: card.win_count,
    win_rate: card.win_rate,
  };
}

function matchesSearch(card: CardEntry, normalizedQuery: string): boolean {
  return normalizedQuery.length === 0
    || card.card_name.toLowerCase().includes(normalizedQuery)
    || card.card_id.toLowerCase().includes(normalizedQuery);
}

function matchesCharacterFilter(card: CardEntry, filter: CharacterFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    default:
      return card.metadata?.character === filter;
  }
}

function matchesCostFilter(card: CardEntry, filter: CostFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "0":
    case "1":
    case "2":
    case "3":
      return card.metadata?.cost === Number(filter);
    case "4plus":
      return card.metadata !== undefined && card.metadata.cost >= 4;
  }
}

function matchesRarityFilter(card: CardEntry, filter: RarityFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    default:
      return card.metadata?.rarity === filter;
  }
}

function compareCards(left: CardEntry, right: CardEntry, sortKey: SortKey): number {
  switch (sortKey) {
    case "picked":
      return byNumber(right.picked_count, left.picked_count) || fallbackCompare(left, right);
    case "pickRate":
      return byNumber(right.pick_rate, left.pick_rate) || byNumber(right.offered_count, left.offered_count) || fallbackCompare(left, right);
    case "winRate":
      return byNumber(right.win_rate, left.win_rate) || byNumber(right.run_count, left.run_count) || fallbackCompare(left, right);
    case "character":
      return compareMetadataText(left.metadata?.character, right.metadata?.character) || fallbackCompare(left, right);
    case "cost":
      return compareMetadataNumber(left.metadata?.cost, right.metadata?.cost) || fallbackCompare(left, right);
    case "rarity":
      return compareMetadataText(left.metadata?.rarity, right.metadata?.rarity) || fallbackCompare(left, right);
    case "name":
      return left.card_name.localeCompare(right.card_name) || left.card_id.localeCompare(right.card_id);
  }
}

function byNumber(left: number, right: number): number {
  return left - right;
}

function fallbackCompare(left: CardEntry, right: CardEntry): number {
  return left.card_name.localeCompare(right.card_name) || left.card_id.localeCompare(right.card_id);
}

function compareMetadataText(left: string | undefined, right: string | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left.localeCompare(right);
}

function compareMetadataNumber(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}
