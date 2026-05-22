CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    applicant_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    request_id TEXT NOT NULL,
    category TEXT NOT NULL,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    payload JSONB,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_category_ts ON events (category, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_events_game_version ON events ((properties->>'game_version'));
CREATE INDEX IF NOT EXISTS idx_events_install_id ON events ((properties->>'anonymous_install_id'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup ON events (
    (properties->>'anonymous_install_id'),
    (properties->>'session_id'),
    timestamp_utc,
    event_name
);