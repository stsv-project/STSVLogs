package store

import "context"

func (s *Store) cardCoOccurrences(ctx context.Context, cardID string) ([]CardCount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT related_card_id, count
		FROM card_co_occurrences
		WHERE card_id = $1
		ORDER BY count DESC, related_card_id ASC
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
		SELECT related_card_id, count
		FROM card_offer_mates
		WHERE card_id = $1
		ORDER BY count DESC, related_card_id ASC
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
