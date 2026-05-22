package ingest

import (
	"STSVLogs/internal/model"
	"encoding/json"
	"fmt"
	"net/http"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	var req model.IngestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Printf("收到 %d 条事件\n", len(req.Events))
	for _, evt := range req.Events {
		fmt.Printf(" - [%s] %s (category=%s)\n",
			evt.ApplicantID,
			evt.EventName,
			evt.Category,
		)
	}

	json.NewEncoder(w).Encode(map[string]int{"accepted": len(req.Events)})
}
