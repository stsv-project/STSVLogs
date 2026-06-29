package store

import (
	"context"
	"time"
)

func (s *Store) cardPickTrend(ctx context.Context, cardID string, days int) ([]TrendPoint, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DATE(timestamp_utc) AS date, COUNT(*) FILTER (WHERE COALESCE((card_choice->>'was_picked')::boolean, false)) AS picked_count
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
			AND timestamp_utc >= $2
		GROUP BY DATE(timestamp_utc)
		ORDER BY date ASC
	`, cardID, time.Now().UTC().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTrendPoints(rows)
}

func (s *Store) cardFinalDeckTrend(ctx context.Context, cardID string, days int) ([]TrendPoint, error) {
	rows, err := s.pool.Query(ctx, `
		WITH run_cards AS (
			SELECT DISTINCT events.id AS event_id, DATE(timestamp_utc) AS date
			FROM events
			CROSS JOIN LATERAL jsonb_array_elements(
				COALESCE(payload->'applicant_payload'->'run_history'->'players', '[]'::jsonb)
			) AS player
			CROSS JOIN LATERAL jsonb_array_elements(COALESCE(player->'deck', '[]'::jsonb)) AS card
			WHERE category = 'RunHistory'
				AND properties->>'run_character_ids' LIKE '%STSVWB%'
				AND NOT COALESCE((properties->>'is_abandoned')::boolean, false)
				AND regexp_replace(card->>'id', '^CARD\.', '') = $1
				AND timestamp_utc >= $2
		)
		SELECT date, COUNT(*)
		FROM run_cards
		GROUP BY date
		ORDER BY date ASC
	`, cardID, time.Now().UTC().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTrendPoints(rows)
}

type trendRows interface {
	Next() bool
	Scan(dest ...interface{}) error
	Err() error
}

func scanTrendPoints(rows trendRows) ([]TrendPoint, error) {
	points := make([]TrendPoint, 0)
	for rows.Next() {
		var date time.Time
		var count int
		if err := rows.Scan(&date, &count); err != nil {
			return nil, err
		}
		points = append(points, TrendPoint{Date: date.Format("2006-01-02"), Count: count})
	}
	return points, rows.Err()
}
