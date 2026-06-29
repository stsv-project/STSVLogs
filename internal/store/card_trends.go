package store

import (
	"context"
	"time"
)

func (s *Store) cardPickTrend(ctx context.Context, cardID string, days int) ([]TrendPoint, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT date, picked_count
		FROM card_pick_trends
		WHERE card_id = $1 AND date >= $2
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
		SELECT date, run_count
		FROM card_final_deck_trends
		WHERE card_id = $1 AND date >= $2
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
