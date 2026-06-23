package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/uffehellum/fleurraine/internal/auth"
	"github.com/uffehellum/fleurraine/internal/db"
)

// static holds the compiled React frontend.
// At build time (via Dockerfile), web/dist is copied to cmd/server/static.
// For local development without a built frontend, the embed will be empty
// but the server still starts (API-only mode).
//
//go:embed static
var static embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")

	// Startup context with a 30-second timeout for DB connection + migrations.
	startCtx, startCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer startCancel()

	pool, err := db.Connect(startCtx, databaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}

	if err := db.Migrate(startCtx, pool); err != nil {
		pool.Close()
		log.Fatalf("database migration failed: %v", err)
	}
	log.Println("Database migrations up to date")

	// Close the pool on shutdown via signal or process exit.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		log.Println("Shutting down — closing database pool")
		pool.Close()
		os.Exit(0)
	}()

	authSvc := auth.NewWithDB(pool)

	r := chi.NewRouter()

	// ── Global middleware ────────────────────────────────────────────────────
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		// Allow the Vite dev server origin in development; tighten in production
		// via the ALLOWED_ORIGINS env var.
		AllowedOrigins:   allowedOrigins(),
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(authSvc.SessionLoad)

	// ── Auth routes ──────────────────────────────────────────────────────────
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/google", authSvc.HandleGoogleAuth)
		r.Post("/facebook", authSvc.HandleFacebookAuth)
		r.Get("/session", authSvc.HandleSession)
		r.Post("/signout", authSvc.HandleSignOut)
	})

	// ── Placeholder for future API routes ────────────────────────────────────
	r.Route("/api", func(r chi.Router) {
		r.HandleFunc("/*", func(w http.ResponseWriter, req *http.Request) {
			http.NotFound(w, req)
		})
	})

	// ── Serve React static assets from the embedded filesystem ───────────────
	staticFS, err := fs.Sub(static, "static")
	if err != nil {
		log.Fatalf("embed sub-filesystem: %v", err)
	}
	fileServer := http.FileServer(http.FS(staticFS))

	// SPA fallback: serve index.html for any non-API, non-asset path.
	r.HandleFunc("/*", func(w http.ResponseWriter, req *http.Request) {
		path := strings.TrimPrefix(req.URL.Path, "/")
		if path != "" && !strings.HasPrefix(req.URL.Path, "/api/") {
			_, openErr := staticFS.Open(path)
			if openErr == nil {
				fileServer.ServeHTTP(w, req)
				return
			}
		}
		// SPA routing: always serve index.html for unknown paths.
		req.URL.Path = "/"
		fileServer.ServeHTTP(w, req)
	})

	addr := ":" + port
	log.Printf("Starting Fleurraine server on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// allowedOrigins returns CORS origins from the ALLOWED_ORIGINS env var,
// defaulting to localhost dev servers.
func allowedOrigins() []string {
	if raw := os.Getenv("ALLOWED_ORIGINS"); raw != "" {
		var origins []string
		for _, o := range strings.Split(raw, ",") {
			if t := strings.TrimSpace(o); t != "" {
				origins = append(origins, t)
			}
		}
		return origins
	}
	return []string{"http://localhost:5173", "http://localhost:3000"}
}
