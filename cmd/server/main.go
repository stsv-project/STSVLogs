package main

import (
	"STSVLogs/internal/ingest"
	"log"
	"net/http"

	"github.com/go-chi/chi"
)

func main() {
	r := chi.NewRouter()
	r.Post("/ingest", ingest.Handler)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	log.Println("listening on :2666")
	log.Fatal(http.ListenAndServe(":2666", r))
}
