package store

import (
	"STSVLogs/internal/model"
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, connStr string) (*Store, error) {
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("connect to postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) InsertEvent(ctx context.Context, evt model.TelemetryEvent) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO events
			(applicant_id, event_name, request_id, category, timestamp_utc, properties, payload)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (
			(properties->>'anonymous_install_id'),
			(properties->>'session_id'),
			timestamp_utc,
			event_name
		) DO NOTHING
	`, evt.ApplicantID, evt.EventName, evt.RequestID, evt.Category, evt.TimestampUtc, evt.Properties, evt.Payload)
	return err
}

// StatsOverview returns aggregate stats: total events, categories, unique installs, version/platform/language/OS distribution
func (s *Store) StatsOverview(ctx context.Context) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	var total int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM events`).Scan(&total); err != nil {
		return nil, err
	}
	result["total_events"] = total

	categories, err := s.groupCount(ctx,
		`SELECT category, COUNT(*) FROM events GROUP BY category ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["categories"] = categories

	var installs int
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT properties->>'anonymous_install_id') FROM events`,
	).Scan(&installs); err != nil {
		return nil, err
	}
	result["unique_installs"] = installs

	versions, err := s.groupCount(ctx,
		`SELECT properties->>'game_version', COUNT(*) FROM events GROUP BY properties->>'game_version' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["game_versions"] = versions

	platforms, err := s.groupCount(ctx,
		`SELECT properties->>'platform', COUNT(*) FROM events GROUP BY properties->>'platform' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["platforms"] = platforms

	languages, err := s.groupCount(ctx,
		`SELECT properties->>'game_language', COUNT(*) FROM events GROUP BY properties->>'game_language' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["languages"] = languages

	oses, err := s.groupCount(ctx,
		`SELECT properties->>'os_name', COUNT(*) FROM events GROUP BY properties->>'os_name' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["os_names"] = oses

	return result, nil
}

func (s *Store) groupCount(ctx context.Context, query string) (map[string]int, error) {
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]int)
	for rows.Next() {
		var key string
		var cnt int
		if err := rows.Scan(&key, &cnt); err != nil {
			return nil, err
		}
		m[key] = cnt
	}
	return m, nil
}

// DailyTrend returns daily event counts for the last N days
func (s *Store) DailyTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DATE(timestamp_utc) AS date, COUNT(*) AS cnt
		FROM events
		WHERE timestamp_utc >= $1
		GROUP BY DATE(timestamp_utc)
		ORDER BY date ASC
	`, time.Now().UTC().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trend []map[string]interface{}
	for rows.Next() {
		var date time.Time
		var cnt int
		if err := rows.Scan(&date, &cnt); err != nil {
			return nil, err
		}
		trend = append(trend, map[string]interface{}{
			"date":  date.Format("2006-01-02"),
			"count": cnt,
		})
	}
	return trend, nil
}

// ListEvents returns paginated events with optional category filter
func (s *Store) ListEvents(ctx context.Context, category string, page, limit int) ([]model.TelemetryEvent, int, error) {
	var total int
	args := []interface{}{ }
	where := ""

	if category != "" {
		where = "WHERE category = $1"
		args = append(args, category)
	}

	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM events `+where, args...,
	).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	queryArgs := append(args, limit, offset)
	queryIdx := len(args)

	rows, err := s.pool.Query(ctx,
		`SELECT applicant_id, event_name, request_id, category, timestamp_utc, properties, payload
         FROM events `+where+
			` ORDER BY timestamp_utc DESC
         LIMIT $`+fmt.Sprintf("%d", queryIdx+1)+
			` OFFSET $`+fmt.Sprintf("%d", queryIdx+2),
		queryArgs...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var events []model.TelemetryEvent
	for rows.Next() {
		var evt model.TelemetryEvent
		if err := rows.Scan(
			&evt.ApplicantID, &evt.EventName, &evt.RequestID,
			&evt.Category, &evt.TimestampUtc, &evt.Properties, &evt.Payload,
		); err != nil {
			return nil, 0, err
		}
		events = append(events, evt)
	}

	return events, total, nil
}

func (s *Store) GetConfig(ctx context.Context, key string) (string, error) {
	var value string
	err := s.pool.QueryRow(ctx, `SELECT value FROM config WHERE key = $1`, key).Scan(&value)
	return value, err
}

func (s *Store) SetConfig(ctx context.Context, key, value string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		key, value)
	return err
}

func (s *Store) Close() {
	s.pool.Close()
}
