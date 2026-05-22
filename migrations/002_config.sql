CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO config (key, value)
VALUES ('latest_version', '0.1.33') ON CONFLICT (key) DO NOTHING;
INSERT INTO config (key, value)
VALUES (
        'release_page',
        'https://github.com/stsv-project/STSVWB/releases'
    ) ON CONFLICT (key) DO NOTHING;