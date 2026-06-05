package store

import (
	_ "embed"
	"encoding/json"
	"strings"
)

//go:embed card_titles_zhs.json
var cardTitlesZHSBytes []byte

var cardTitlesZHS = loadCardTitlesZHS()

func loadCardTitlesZHS() map[string]string {
	var titles map[string]string
	if err := json.Unmarshal(cardTitlesZHSBytes, &titles); err != nil {
		return map[string]string{}
	}
	return titles
}

func cardDisplayName(cardID string) string {
	if title, ok := cardTitlesZHS[cardID]; ok && title != "" {
		return title
	}
	return cleanCardID(cardID)
}

func cleanCardID(cardID string) string {
	cardID = strings.TrimPrefix(cardID, "CARD.")
	return strings.TrimPrefix(cardID, "STSVWB_CARD_")
}
