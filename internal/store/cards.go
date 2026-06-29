package store

import (
	"context"
	"strings"
)

func (s *Store) CardAnalysis(ctx context.Context, rawCardID string) (CardAnalysis, error) {
	cardID := normalizeCardID(rawCardID)
	analysis := CardAnalysis{
		CardID:             cardID,
		CardName:           cardDisplayName(cardID),
		CharacterRuns:      map[string]int{},
		CharacterWins:      map[string]int{},
		Ascensions:         map[string]int{},
		GameModes:          map[string]int{},
		PickTrend:          []TrendPoint{},
		FinalDeckTrend:     []TrendPoint{},
		CoOccurringCards:   []CardCount{},
		FrequentOfferMates: []CardCount{},
	}

	picks, err := s.cardPickSummary(ctx, cardID)
	if err != nil {
		return analysis, err
	}
	analysis.OfferedCount = picks.OfferedCount
	analysis.PickedCount = picks.PickedCount
	analysis.SkippedCount = picks.SkippedCount
	analysis.PickRate = picks.PickRate

	wins, err := s.cardWinSummary(ctx, cardID)
	if err != nil {
		return analysis, err
	}
	analysis.RunCount = wins.RunCount
	analysis.WinCount = wins.WinCount
	analysis.LossCount = wins.LossCount
	analysis.WinRate = wins.WinRate

	if err := s.fillCardBreakdowns(ctx, cardID, &analysis); err != nil {
		return analysis, err
	}
	analysis.PickTrend, err = s.cardPickTrend(ctx, cardID, 30)
	if err != nil {
		return analysis, err
	}
	analysis.FinalDeckTrend, err = s.cardFinalDeckTrend(ctx, cardID, 30)
	if err != nil {
		return analysis, err
	}
	analysis.CoOccurringCards, err = s.cardCoOccurrences(ctx, cardID)
	if err != nil {
		return analysis, err
	}
	analysis.FrequentOfferMates, err = s.cardOfferMates(ctx, cardID)
	if err != nil {
		return analysis, err
	}

	return analysis, nil
}

func normalizeCardID(cardID string) string {
	cardID = strings.TrimPrefix(cardID, "CARD.")
	if strings.HasPrefix(cardID, "STSVWB_CARD_") {
		return cardID
	}
	return "STSVWB_CARD_" + cardID
}

func (s *Store) cardPickSummary(ctx context.Context, cardID string) (CardPickRate, error) {
	var offered, picked int
	if err := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE((SELECT offered_count FROM card_pick_stats WHERE card_id = $1), 0),
			COALESCE((SELECT picked_count FROM card_pick_stats WHERE card_id = $1), 0)
	`, cardID).Scan(&offered, &picked); err != nil {
		return CardPickRate{}, err
	}

	pickRate := 0.0
	if offered > 0 {
		pickRate = float64(picked) / float64(offered)
	}
	return CardPickRate{
		CardID:       cardID,
		CardName:     cardDisplayName(cardID),
		OfferedCount: offered,
		PickedCount:  picked,
		SkippedCount: offered - picked,
		PickRate:     pickRate,
	}, nil
}

func (s *Store) cardWinSummary(ctx context.Context, cardID string) (CardWinRate, error) {
	var runs, wins int
	if err := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE((SELECT run_count FROM card_win_stats WHERE card_id = $1), 0),
			COALESCE((SELECT win_count FROM card_win_stats WHERE card_id = $1), 0)
	`, cardID).Scan(&runs, &wins); err != nil {
		return CardWinRate{}, err
	}

	winRate := 0.0
	if runs > 0 {
		winRate = float64(wins) / float64(runs)
	}
	return CardWinRate{
		CardID:    cardID,
		CardName:  cardDisplayName(cardID),
		RunCount:  runs,
		WinCount:  wins,
		LossCount: runs - wins,
		WinRate:   winRate,
	}, nil
}

func (s *Store) fillCardBreakdowns(ctx context.Context, cardID string, analysis *CardAnalysis) error {
	rows, err := s.pool.Query(ctx, `
		SELECT character_id, ascension, game_mode, run_count, win_count
		FROM card_analysis_breakdowns
		WHERE card_id = $1
	`, cardID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var characterID, ascension, gameMode string
		var runs, wins int
		if err := rows.Scan(&characterID, &ascension, &gameMode, &runs, &wins); err != nil {
			return err
		}
		characterName := strings.TrimSuffix(strings.Replace(characterID, "STSVWB_CHARACTER_", "", 1), "_CHARACTER")
		analysis.CharacterRuns[characterName] += runs
		analysis.CharacterWins[characterName] += wins
		analysis.Ascensions[ascension] += runs
		analysis.GameModes[gameMode] += runs
	}
	return rows.Err()
}
