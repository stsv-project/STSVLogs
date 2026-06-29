import { get } from "../api";
import type { CardStatsOverview } from "../types";

export const cardsOverviewQueryKey = ["cards-overview"] as const;

export function fetchCardsOverview(): Promise<CardStatsOverview> {
  return get<CardStatsOverview>("/api/stats/cards");
}
