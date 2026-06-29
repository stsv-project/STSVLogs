CREATE TABLE IF NOT EXISTS card_pick_stats (
    card_id TEXT PRIMARY KEY,
    offered_count BIGINT NOT NULL DEFAULT 0,
    picked_count BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS card_win_stats (
    card_id TEXT PRIMARY KEY,
    run_count BIGINT NOT NULL DEFAULT 0,
    win_count BIGINT NOT NULL DEFAULT 0
);

INSERT INTO card_pick_stats (card_id, offered_count, picked_count)
WITH choices AS (
    SELECT
        regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') AS card_id,
        COALESCE((card_choice->>'was_picked')::boolean, false) AS was_picked
    FROM events
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(payload->'applicant_payload'->'run_history'->'map_point_history', '[]'::jsonb)
    ) AS act_history
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(act_history, '[]'::jsonb)
    ) AS map_point
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(map_point->'player_stats', '[]'::jsonb)
    ) AS player_stat
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(player_stat->'card_choices', '[]'::jsonb)
    ) AS card_choice
    WHERE category = 'RunHistory'
        AND properties->>'run_character_ids' LIKE '%STSVWB%'
        AND regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
)
SELECT
    card_id,
    COUNT(*) AS offered_count,
    COUNT(*) FILTER (WHERE was_picked) AS picked_count
FROM choices
GROUP BY card_id
ON CONFLICT (card_id) DO UPDATE SET
    offered_count = EXCLUDED.offered_count,
    picked_count = EXCLUDED.picked_count;

INSERT INTO card_win_stats (card_id, run_count, win_count)
WITH run_cards AS (
    SELECT DISTINCT
        events.id AS event_id,
        regexp_replace(card->>'id', '^CARD\.', '') AS card_id,
        COALESCE((properties->>'is_victory')::boolean, false) AS is_victory
    FROM events
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
    ) AS player
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(player->'deck', '[]'::jsonb)
    ) AS card
    WHERE category = 'RunHistory'
        AND properties->>'run_character_ids' LIKE '%STSVWB%'
        AND NOT COALESCE((properties->>'is_abandoned')::boolean, false)
        AND regexp_replace(card->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
)
SELECT
    card_id,
    COUNT(*) AS run_count,
    COUNT(*) FILTER (WHERE is_victory) AS win_count
FROM run_cards
GROUP BY card_id
ON CONFLICT (card_id) DO UPDATE SET
    run_count = EXCLUDED.run_count,
    win_count = EXCLUDED.win_count;

CREATE OR REPLACE FUNCTION update_card_stats_from_event()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.category <> 'RunHistory' OR COALESCE(NEW.properties->>'run_character_ids', '') NOT LIKE '%STSVWB%' THEN
        RETURN NEW;
    END IF;

    INSERT INTO card_pick_stats (card_id, offered_count, picked_count)
    WITH choices AS (
        SELECT
            regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') AS card_id,
            COALESCE((card_choice->>'was_picked')::boolean, false) AS was_picked
        FROM jsonb_array_elements(
            COALESCE(NEW.payload->'applicant_payload'->'run_history'->'map_point_history', '[]'::jsonb)
        ) AS act_history
        CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(act_history, '[]'::jsonb)
        ) AS map_point
        CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(map_point->'player_stats', '[]'::jsonb)
        ) AS player_stat
        CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(player_stat->'card_choices', '[]'::jsonb)
        ) AS card_choice
        WHERE regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
    )
    SELECT
        card_id,
        COUNT(*) AS offered_count,
        COUNT(*) FILTER (WHERE was_picked) AS picked_count
    FROM choices
    GROUP BY card_id
    ON CONFLICT (card_id) DO UPDATE SET
        offered_count = card_pick_stats.offered_count + EXCLUDED.offered_count,
        picked_count = card_pick_stats.picked_count + EXCLUDED.picked_count;

    IF NOT COALESCE((NEW.properties->>'is_abandoned')::boolean, false) THEN
        INSERT INTO card_win_stats (card_id, run_count, win_count)
        WITH run_cards AS (
            SELECT DISTINCT
                regexp_replace(card->>'id', '^CARD\.', '') AS card_id,
                COALESCE((NEW.properties->>'is_victory')::boolean, false) AS is_victory
            FROM jsonb_array_elements(
                COALESCE(NEW.payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
            ) AS player
            CROSS JOIN LATERAL jsonb_array_elements(
                COALESCE(player->'deck', '[]'::jsonb)
            ) AS card
            WHERE regexp_replace(card->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
        )
        SELECT
            card_id,
            1 AS run_count,
            CASE WHEN is_victory THEN 1 ELSE 0 END AS win_count
        FROM run_cards
        ON CONFLICT (card_id) DO UPDATE SET
            run_count = card_win_stats.run_count + EXCLUDED.run_count,
            win_count = card_win_stats.win_count + EXCLUDED.win_count;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_card_stats_from_event ON events;
CREATE TRIGGER trg_update_card_stats_from_event
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION update_card_stats_from_event();
