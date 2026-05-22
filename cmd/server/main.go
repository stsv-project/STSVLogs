package main

import (
	"STSVLogs/internal/ingest"
	"STSVLogs/internal/query"
	"STSVLogs/internal/store"
	"context"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	//连接数据库
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Fatal("环境变量 DATABASE_URL 未设置")
	}
	db, err := store.New(context.Background(), connStr)
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	defer db.Close()
	q := &query.Handler{Store: db}
	r := chi.NewRouter()
	r.Post("/ingest", ingest.Handler(db))
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})
	r.Get("api/stats/overview", q.StatsOverview)
	r.Get("api/events", q.ListEvents)

	log.Println("listening on :2666")
	log.Fatal(http.ListenAndServe(":2666", r))
}
