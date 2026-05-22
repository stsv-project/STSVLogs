export interface StatsOverview {
  total_events: number;
  categories: Record<string, number>;
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