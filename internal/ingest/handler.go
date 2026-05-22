package ingest

import (
	"STSVLogs/internal/model"
	"STSVLogs/internal/store"
	"encoding/json"
	"log"
	"net/http"
)

func Handler(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req model.IngestRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		accepted := 0
		for _, evt := range req.Events {
			if err := s.InsertEvent(r.Context(), evt); err != nil {
				log.Printf("插入事件失败: %v", err)
				continue
			}
			accepted++
		}

		log.Printf("收到 %d 条事件, 成功写入 %d 条", len(req.Events), accepted)
		json.NewEncoder(w).Encode(map[string]int{"accepted": accepted})
	}
}
