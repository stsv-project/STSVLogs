package config

import (
	"STSVLogs/internal/store"
	"encoding/json"
	"net/http"
)

type Handler struct {
	Store *store.Store
}

// GetManifest 动态生成更新清单
func (h *Handler) GetManifest(w http.ResponseWriter, r *http.Request) {
	version, err := h.Store.GetConfig(r.Context(), "latest_version")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	releasePage, err := h.Store.GetConfig(r.Context(), "release_page")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"schema":           "ritsulib.update.v1",
		"latest_version":   version,
		"release_page_url": releasePage,
	})
}

// GetVersion 读取当前版本
func (h *Handler) GetVersion(w http.ResponseWriter, r *http.Request) {
	version, _ := h.Store.GetConfig(r.Context(), "latest_version")
	releasePage, _ := h.Store.GetConfig(r.Context(), "release_page")
	json.NewEncoder(w).Encode(map[string]string{
		"schema":           "ritsulib.update.v1",
		"latest_version":   version,
		"release_page_url": releasePage,
	})
}

// UpdateVersion 更新版本信息
func (h *Handler) UpdateVersion(w http.ResponseWriter, r *http.Request) {
	var body struct {
		LatestVersion string `json:"latest_version"`
		ReleasePage   string `json:"release_page"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if body.LatestVersion != "" {
		h.Store.SetConfig(r.Context(), "latest_version", body.LatestVersion)
	}
	if body.ReleasePage != "" {
		h.Store.SetConfig(r.Context(), "release_page", body.ReleasePage)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
