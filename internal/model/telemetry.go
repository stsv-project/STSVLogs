package model

import (
	"encoding/json"
	"time"
)

type IngestRequest struct {
	Schema      string           `json:"schema"`
	ApplicantID string           `json:"applicant_id"`
	Events      []TelemetryEvent `json:"events"`
}

type TelemetryEvent struct {
	Schema       string                 `json:"schema"`
	ApplicantID  string                 `json:"applicantId"`
	EventName    string                 `json:"eventName"`
	RequestID    string                 `json:"requestId"`
	Category     string                 `json:"category"`
	TimestampUtc time.Time              `json:"timestampUtc"`
	Properties   map[string]interface{} `json:"properties"`
	Payload      json.RawMessage        `json:"payload"`
}
