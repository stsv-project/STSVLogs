package store

import "context"

func (s *Store) cardCoOccurrences(ctx context.Context, cardID string) ([]CardCount, error) {
	rows, err := s.pool.Query(ctx, `
		WITH target_runs AS (
			SELECT DISTINCT events.id AS event_id
			FROM events
			CROSS JOIN LATERAL jsonb_array_elements(
				COALESCE(payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
			) AS player
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
			WHERE category = 'RunHistory'
				AND properties->>'run_character_ids' LIKE '%STSVWB%'
				AND NOT COALESCE((properties->>'is_abandoned')::boolean, false)
				AND regexp_replace(card->>'id', '^CARD\.', '') = $1
		), run_cards AS (
			SELECT DISTINCT target_runs.event_id, regexp_replace(card->>'id', '^CARD\.', '') AS card_id
			FROM target_runs
			JOIN events ON events.id = target_runs.event_id
			CROSS JOIN LATERAL jsonb_array_elements(
				COALESCE(payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
			) AS player
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
		)
		SELECT card_id, COUNT(*)
		FROM run_cards
		WHERE card_id LIKE 'STSVWB_CARD_%' AND card_id <> $1
		GROUP BY card_id
		ORDER BY COUNT(*) DESC, card_id ASC
		LIMIT 20
	`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCardCounts(rows)
}

func (s *Store) cardOfferMates(ctx context.Context, cardID string) ([]CardCount, error) {
	rows, err := s.pool.Query(ctx, `
		WITH target_offers AS (
			SELECT map_point
			FROM events
			CROSS JOIN LATERAL jsonb_array_elements(
				COALESCE(payload->'applicant_payload'->'run_history'->'map_point_history', '[]'::jsonb)
			) AS act_history
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(act_history, '[]'::jsonb)) AS map_point
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(map_point->'player_stats', '[]'::jsonb)) AS player_stat
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player_stat->'card_choices', '[]'::jsonb)) AS card_choice
			WHERE category = 'RunHistory'
				AND properties->>'run_character_ids' LIKE '%STSVWB%'
				AND regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') = $1
		), offer_cards AS (
			SELECT regexp_replace(card_choice->'card'->>'id', '^CARD\.', '') AS card_id
			FROM target_offers
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(map_point->'player_stats', '[]'::jsonb)) AS player_stat
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player_stat->'card_choices', '[]'::jsonb)) AS card_choice
		)
		SELECT card_id, COUNT(*)
		FROM offer_cards
		WHERE card_id LIKE 'STSVWB_CARD_%' AND card_id <> $1
		GROUP BY card_id
		ORDER BY COUNT(*) DESC, card_id ASC
		LIMIT 20
	`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCardCounts(rows)
}

type cardCountRows interface {
	Next() bool
	Scan(dest ...interface{}) error
	Err() error
}

func scanCardCounts(rows cardCountRows) ([]CardCount, error) {
	cards := make([]CardCount, 0)
	for rows.Next() {
		var cardID string
		var count int
		if err := rows.Scan(&cardID, &count); err != nil {
			return nil, err
		}
		cards = append(cards, CardCount{CardID: cardID, CardName: cardDisplayName(cardID), Count: count})
	}
	return cards, rows.Err()
}
