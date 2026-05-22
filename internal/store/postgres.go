package store

import (
	"STSVLogs/internal/model"
	"context"
	"fmt"

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

func (s *Store) Close() {
	s.pool.Close()
}
