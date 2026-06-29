CREATE TABLE IF NOT EXISTS card_analysis_breakdowns (
    card_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    ascension TEXT NOT NULL,
    game_mode TEXT NOT NULL,
    run_count BIGINT NOT NULL DEFAULT 0,
    win_count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (card_id, character_id, ascension, game_mode)
);

CREATE TABLE IF NOT EXISTS card_pick_trends (
    card_id TEXT NOT NULL,
    date DATE NOT NULL,
    picked_count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (card_id, date)
);

CREATE TABLE IF NOT EXISTS card_final_deck_trends (
    card_id TEXT NOT NULL,
    date DATE NOT NULL,
    run_count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (card_id, date)
);

CREATE TABLE IF NOT EXISTS card_co_occurrences (
    card_id TEXT NOT NULL,
    related_card_id TEXT NOT NULL,
    count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (card_id, related_card_id)
);

CREATE TABLE IF NOT EXISTS card_offer_mates (
    card_id TEXT NOT NULL,
    related_card_id TEXT NOT NULL,
    count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (card_id, related_card_id)
);

TRUNCATE card_analysis_breakdowns, card_pick_trends, card_final_deck_trends, card_co_occurrences, card_offer_mates;

INSERT INTO card_analysis_breakdowns (card_id, character_id, ascension, game_mode, run_count, win_count)
WITH card_runs AS (
    SELECT DISTINCT
        regexp_replace(card->>'id', '^CARD\.', '') AS card_id,
        regexp_replace(char_id, '^CHARACTER\.', '') AS character_id,
        COALESCE(properties->>'run_ascension', '(unknown)') AS ascension,
        COALESCE(properties->>'run_game_mode', '(unknown)') AS game_mode,
        COALESCE((properties->>'is_victory')::boolean, false) AS is_victory,
        events.id AS event_id
    FROM events
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
    ) AS player
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
    CROSS JOIN LATERAL unnest(
        string_to_array(regexp_replace(properties->>'run_character_ids', '["\[\],]', '', 'g'), ' ')
    ) AS char_id
    WHERE category = 'RunHistory'
        AND properties->>'run_character_ids' LIKE '%STSVWB%'
        AND NOT COALESCE((properties->>'is_abandoned')::boolean, false)
        AND regexp_replace(card->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
        AND regexp_replace(char_id, '^CHARACTER\.', '') LIKE '%STSVWB_CHARACTER_%'
)
SELECT
    card_id,
    character_id,
    ascension,
    game_mode,
    COUNT(*) AS run_count,
    COUNT(*) FILTER (WHERE is_victory) AS win_count
FROM card_runs
GROUP BY card_id, character_id, ascension, game_mode;

INSERT INTO card_pick_trends (card_id, date, picked_count)
WITH choices AS (
    SELECT
        regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') AS card_id,
        DATE(timestamp_utc) AS date,
        COALESCE((card_choice->>'was_picked')::boolean, false) AS was_picked
    FROM events
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(payload->'applicant_payload'->'run_history'->'map_point_history', '[]'::jsonb)
    ) AS act_history
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(act_history, '[]'::jsonb)) AS map_point
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(map_point->'player_stats', '[]'::jsonb)) AS player_stat
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player_stat->'card_choices', '[]'::jsonb)) AS card_choice
    WHERE category = 'RunHistory'
        AND properties->>'run_character_ids' LIKE '%STSVWB%'
        AND regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
)
SELECT card_id, date, COUNT(*) FILTER (WHERE was_picked) AS picked_count
FROM choices
GROUP BY card_id, date;

INSERT INTO card_final_deck_trends (card_id, date, run_count)
WITH run_cards AS (
    SELECT DISTINCT
        events.id AS event_id,
        regexp_replace(card->>'id', '^CARD\.', '') AS card_id,
        DATE(timestamp_utc) AS date
    FROM events
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
    ) AS player
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
    WHERE category = 'RunHistory'
        AND properties->>'run_character_ids' LIKE '%STSVWB%'
        AND NOT COALESCE((properties->>'is_abandoned')::boolean, false)
        AND regexp_replace(card->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
)
SELECT card_id, date, COUNT(*) AS run_count
FROM run_cards
GROUP BY card_id, date;

INSERT INTO card_co_occurrences (card_id, related_card_id, count)
WITH run_cards AS (
    SELECT DISTINCT
        events.id AS event_id,
        regexp_replace(card->>'id', '^CARD\.', '') AS card_id
    FROM events
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
    ) AS player
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
    WHERE category = 'RunHistory'
        AND properties->>'run_character_ids' LIKE '%STSVWB%'
        AND NOT COALESCE((properties->>'is_abandoned')::boolean, false)
        AND regexp_replace(card->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
)
SELECT target.card_id, related.card_id, COUNT(*) AS count
FROM run_cards AS target
JOIN run_cards AS related ON related.event_id = target.event_id AND related.card_id <> target.card_id
GROUP BY target.card_id, related.card_id;

INSERT INTO card_offer_mates (card_id, related_card_id, count)
WITH map_points AS (
    SELECT
        events.id AS event_id,
        act_history.ordinality AS act_index,
        map_point.ordinality AS map_index,
        map_point.value AS map_point
    FROM events
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(payload->'applicant_payload'->'run_history'->'map_point_history', '[]'::jsonb)
    ) WITH ORDINALITY AS act_history(value, ordinality)
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(act_history.value, '[]'::jsonb)) WITH ORDINALITY AS map_point(value, ordinality)
    WHERE category = 'RunHistory'
        AND properties->>'run_character_ids' LIKE '%STSVWB%'
), choices AS (
    SELECT
        event_id,
        act_index,
        map_index,
        regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') AS card_id
    FROM map_points
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(map_point->'player_stats', '[]'::jsonb)) AS player_stat
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player_stat->'card_choices', '[]'::jsonb)) AS card_choice
    WHERE regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
)
SELECT target.card_id, related.card_id, COUNT(*) AS count
FROM choices AS target
JOIN choices AS related
    ON related.event_id = target.event_id
    AND related.act_index = target.act_index
    AND related.map_index = target.map_index
    AND related.card_id <> target.card_id
GROUP BY target.card_id, related.card_id;

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
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(act_history, '[]'::jsonb)) AS map_point
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(map_point->'player_stats', '[]'::jsonb)) AS player_stat
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player_stat->'card_choices', '[]'::jsonb)) AS card_choice
        WHERE regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
    )
    SELECT card_id, COUNT(*) AS offered_count, COUNT(*) FILTER (WHERE was_picked) AS picked_count
    FROM choices
    GROUP BY card_id
    ON CONFLICT (card_id) DO UPDATE SET
        offered_count = card_pick_stats.offered_count + EXCLUDED.offered_count,
        picked_count = card_pick_stats.picked_count + EXCLUDED.picked_count;

    INSERT INTO card_pick_trends (card_id, date, picked_count)
    WITH choices AS (
        SELECT
            regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') AS card_id,
            COALESCE((card_choice->>'was_picked')::boolean, false) AS was_picked
        FROM jsonb_array_elements(
            COALESCE(NEW.payload->'applicant_payload'->'run_history'->'map_point_history', '[]'::jsonb)
        ) AS act_history
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(act_history, '[]'::jsonb)) AS map_point
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(map_point->'player_stats', '[]'::jsonb)) AS player_stat
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player_stat->'card_choices', '[]'::jsonb)) AS card_choice
        WHERE regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
    )
    SELECT card_id, DATE(NEW.timestamp_utc), COUNT(*) FILTER (WHERE was_picked)
    FROM choices
    GROUP BY card_id
    ON CONFLICT (card_id, date) DO UPDATE SET
        picked_count = card_pick_trends.picked_count + EXCLUDED.picked_count;

    IF NOT COALESCE((NEW.properties->>'is_abandoned')::boolean, false) THEN
        INSERT INTO card_win_stats (card_id, run_count, win_count)
        WITH run_cards AS (
            SELECT DISTINCT
                regexp_replace(card->>'id', '^CARD\.', '') AS card_id,
                COALESCE((NEW.properties->>'is_victory')::boolean, false) AS is_victory
            FROM jsonb_array_elements(
                COALESCE(NEW.payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
            ) AS player
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
            WHERE regexp_replace(card->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
        )
        SELECT card_id, 1 AS run_count, CASE WHEN is_victory THEN 1 ELSE 0 END AS win_count
        FROM run_cards
        ON CONFLICT (card_id) DO UPDATE SET
            run_count = card_win_stats.run_count + EXCLUDED.run_count,
            win_count = card_win_stats.win_count + EXCLUDED.win_count;

        INSERT INTO card_analysis_breakdowns (card_id, character_id, ascension, game_mode, run_count, win_count)
        WITH run_cards AS (
            SELECT DISTINCT regexp_replace(card->>'id', '^CARD\.', '') AS card_id
            FROM jsonb_array_elements(
                COALESCE(NEW.payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
            ) AS player
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
            WHERE regexp_replace(card->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
        ), characters AS (
            SELECT regexp_replace(char_id, '^CHARACTER\.', '') AS character_id
            FROM unnest(string_to_array(regexp_replace(NEW.properties->>'run_character_ids', '["\[\],]', '', 'g'), ' ')) AS char_id
            WHERE regexp_replace(char_id, '^CHARACTER\.', '') LIKE '%STSVWB_CHARACTER_%'
        )
        SELECT
            run_cards.card_id,
            characters.character_id,
            COALESCE(NEW.properties->>'run_ascension', '(unknown)'),
            COALESCE(NEW.properties->>'run_game_mode', '(unknown)'),
            1 AS run_count,
            CASE WHEN COALESCE((NEW.properties->>'is_victory')::boolean, false) THEN 1 ELSE 0 END AS win_count
        FROM run_cards
        CROSS JOIN characters
        ON CONFLICT (card_id, character_id, ascension, game_mode) DO UPDATE SET
            run_count = card_analysis_breakdowns.run_count + EXCLUDED.run_count,
            win_count = card_analysis_breakdowns.win_count + EXCLUDED.win_count;

        INSERT INTO card_final_deck_trends (card_id, date, run_count)
        WITH run_cards AS (
            SELECT DISTINCT regexp_replace(card->>'id', '^CARD\.', '') AS card_id
            FROM jsonb_array_elements(
                COALESCE(NEW.payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
            ) AS player
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
            WHERE regexp_replace(card->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
        )
        SELECT card_id, DATE(NEW.timestamp_utc), 1 AS run_count
        FROM run_cards
        ON CONFLICT (card_id, date) DO UPDATE SET
            run_count = card_final_deck_trends.run_count + EXCLUDED.run_count;

        INSERT INTO card_co_occurrences (card_id, related_card_id, count)
        WITH run_cards AS (
            SELECT DISTINCT regexp_replace(card->>'id', '^CARD\.', '') AS card_id
            FROM jsonb_array_elements(
                COALESCE(NEW.payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
            ) AS player
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
            WHERE regexp_replace(card->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
        )
        SELECT target.card_id, related.card_id, 1 AS count
        FROM run_cards AS target
        JOIN run_cards AS related ON related.card_id <> target.card_id
        ON CONFLICT (card_id, related_card_id) DO UPDATE SET
            count = card_co_occurrences.count + EXCLUDED.count;
    END IF;

    INSERT INTO card_offer_mates (card_id, related_card_id, count)
    WITH map_points AS (
        SELECT act_history.ordinality AS act_index, map_point.ordinality AS map_index, map_point.value AS map_point
        FROM jsonb_array_elements(
            COALESCE(NEW.payload->'applicant_payload'->'run_history'->'map_point_history', '[]'::jsonb)
        ) WITH ORDINALITY AS act_history(value, ordinality)
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(act_history.value, '[]'::jsonb)) WITH ORDINALITY AS map_point(value, ordinality)
    ), choices AS (
        SELECT
            act_index,
            map_index,
            regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') AS card_id
        FROM map_points
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(map_point->'player_stats', '[]'::jsonb)) AS player_stat
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player_stat->'card_choices', '[]'::jsonb)) AS card_choice
        WHERE regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') LIKE 'STSVWB_CARD_%'
    )
    SELECT target.card_id, related.card_id, COUNT(*) AS count
    FROM choices AS target
    JOIN choices AS related
        ON related.act_index = target.act_index
        AND related.map_index = target.map_index
        AND related.card_id <> target.card_id
    GROUP BY target.card_id, related.card_id
    ON CONFLICT (card_id, related_card_id) DO UPDATE SET
        count = card_offer_mates.count + EXCLUDED.count;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
