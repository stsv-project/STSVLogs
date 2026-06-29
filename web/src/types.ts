export interface StatsOverview {
  total_events: number;
  unique_installs: number;
  categories: Record<string, number>;
  game_versions: Record<string, number>;
  platforms: Record<string, number>;
  languages: Record<string, number>;
  os_names: Record<string, number>;
  ritsulib_versions: Record<string, number>;
  process_architectures: Record<string, number>;
  dotnet_runtimes: Record<string, number>;
  stsvwb_versions: Record<string, number>;
}

export interface ModInventoryOverview {
  total_snapshots: number;
  avg_loaded: number;
  avg_gameplay: number;
  avg_disabled: number;
  avg_failed: number;
  popular_mods: { id: string; name: string; installs: number }[];
  load_states: Record<string, number>;
}

export interface RunHistoryOverview {
  total_runs: number;
  total_victories: number;
  total_abandoned: number;
  avg_run_time_seconds: number;
  characters: Record<string, number>;
  character_wins: Record<string, number>;
  character_abandoned: Record<string, number>;
  run_times: Record<string, number>;
  ascensions: Record<string, number>;
  game_modes: Record<string, number>;
  card_pick_rates: CardPickRate[];
  card_win_rates: CardWinRate[];
}

export interface CardPickRate {
  card_id: string;
  card_name: string;
  offered_count: number;
  picked_count: number;
  skipped_count: number;
  pick_rate: number;
}

export interface CardWinRate {
  card_id: string;
  card_name: string;
  run_count: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
}

export interface CardAnalysis {
  card_id: string;
  card_name: string;
  offered_count: number;
  picked_count: number;
  skipped_count: number;
  pick_rate: number;
  run_count: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  character_runs: Record<string, number>;
  character_wins: Record<string, number>;
  ascensions: Record<string, number>;
  game_modes: Record<string, number>;
  pick_trend: TrendPoint[];
  final_deck_trend: TrendPoint[];
  co_occurring_cards: CardCount[];
  frequent_offer_mates: CardCount[];
}

export interface CardCount {
  card_id: string;
  card_name: string;
  count: number;
}

export interface DiagnosticsOverview {
  total_diagnostics: number;
  exception_types: Record<string, number>;
  capture_sources: Record<string, number>;
  by_game_version: Record<string, number>;
}

export interface TelemetryEvent {
  applicantId: string;
  eventName: string;
  category: string;
  requestId: string;
  timestampUtc: string;
  properties: Record<string, unknown>;
  payload: unknown;
}

export interface EventsResponse {
  events: TelemetryEvent[];
  total: number;
  page: number;
  limit: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface TrendsResponse {
  trend: TrendPoint[];
  days: number;
}
