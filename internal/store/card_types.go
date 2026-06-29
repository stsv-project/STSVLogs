package store

type CardStatsOverview struct {
	CardPickRates []CardPickRate `json:"card_pick_rates"`
	CardWinRates  []CardWinRate  `json:"card_win_rates"`
}

type CardAnalysis struct {
	CardID             string         `json:"card_id"`
	CardName           string         `json:"card_name"`
	OfferedCount       int            `json:"offered_count"`
	PickedCount        int            `json:"picked_count"`
	SkippedCount       int            `json:"skipped_count"`
	PickRate           float64        `json:"pick_rate"`
	RunCount           int            `json:"run_count"`
	WinCount           int            `json:"win_count"`
	LossCount          int            `json:"loss_count"`
	WinRate            float64        `json:"win_rate"`
	CharacterRuns      map[string]int `json:"character_runs"`
	CharacterWins      map[string]int `json:"character_wins"`
	Ascensions         map[string]int `json:"ascensions"`
	GameModes          map[string]int `json:"game_modes"`
	PickTrend          []TrendPoint   `json:"pick_trend"`
	FinalDeckTrend     []TrendPoint   `json:"final_deck_trend"`
	CoOccurringCards   []CardCount    `json:"co_occurring_cards"`
	FrequentOfferMates []CardCount    `json:"frequent_offer_mates"`
}

type TrendPoint struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type CardCount struct {
	CardID   string `json:"card_id"`
	CardName string `json:"card_name"`
	Count    int    `json:"count"`
}
