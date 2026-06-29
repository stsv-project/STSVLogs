package store

import (
	"context"
	"time"
)

const cardStatsCacheTTL = 5 * time.Minute

func (s *Store) CardStatsOverview(ctx context.Context) (CardStatsOverview, error) {
	s.cardStatsMu.Lock()
	defer s.cardStatsMu.Unlock()

	if time.Since(s.cardStatsCachedAt) < cardStatsCacheTTL {
		return s.cardStatsCache, nil
	}

	cardPickRates, err := s.CardPickRates(ctx)
	if err != nil {
		return CardStatsOverview{}, err
	}
	cardWinRates, err := s.CardWinRates(ctx)
	if err != nil {
		return CardStatsOverview{}, err
	}

	result := CardStatsOverview{
		CardPickRates: cardPickRates,
		CardWinRates:  cardWinRates,
	}
	s.cardStatsCache = result
	s.cardStatsCachedAt = time.Now()
	return result, nil
}
