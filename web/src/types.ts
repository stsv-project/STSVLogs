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
