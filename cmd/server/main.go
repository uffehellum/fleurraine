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
	"github.com/uffehellum/fleurraine/internal/payments"
	"github.com/uffehellum/fleurraine/internal/photos"
	"github.com/uffehellum/fleurraine/internal/storage"
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

	// Initialize storage client
	storageClient, err := storage.New()
	if err != nil {
		pool.Close()
		log.Fatalf("storage initialization failed: %v", err)
	}

	// Initialize photo service
	photoSvc := photos.NewService(pool, storageClient)
	photoHandlers := photos.NewHandlers(photoSvc)
	storageHandler := photos.NewStorageHandler(storageClient)

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

	// ── Photo routes ─────────────────────────────────────────────────────────
	r.Route("/api/photos", func(r chi.Router) {
		// Public routes
		r.Get("/latest-stand", photoHandlers.HandleGetLatestStand)
		r.Get("/share/{token}", photoHandlers.HandleGetByShareToken)
		r.Get("/", photoHandlers.HandleList)
		r.Get("/{id}", photoHandlers.HandleGetByID)

		// Protected routes (require authentication)
		r.Group(func(r chi.Router) {
			r.Use(auth.RequireAuth)
			r.Post("/upload", photoHandlers.HandleUpload)
		})

		// Admin-only routes
		r.Group(func(r chi.Router) {
			r.Use(auth.RequireAdmin)
			r.Post("/{id}/publish", photoHandlers.HandlePublish)
			r.Post("/{id}/approve-review", photoHandlers.HandleApproveReview)
			r.Post("/{id}/reanalyze", photoHandlers.HandleReanalyze)
			r.Delete("/{id}", photoHandlers.HandleDelete)
			r.Put("/{id}/edits", photoHandlers.HandleUpdateEdits)
			r.Put("/{id}/category", photoHandlers.HandleUpdateCategory)
			r.Put("/{id}/metadata", photoHandlers.HandleUpdateMetadata)
		})
	})

	// ── Storage proxy route (for serving images) ─────────────────────────────
	r.Get("/api/storage/*", storageHandler.HandleGetImage)

	// ── User management routes ───────────────────────────────────────────────
	r.Route("/api/user", func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Get("/profile", authSvc.HandleGetProfile)
		r.Put("/email-opt-out", authSvc.HandleUpdateEmailOptOut)
		r.Delete("/account", authSvc.HandleDeleteAccount)
	})

	// ── Admin user management routes ─────────────────────────────────────────
	r.Route("/api/admin/users", func(r chi.Router) {
		r.Use(auth.RequireAdmin)
		r.Get("/", authSvc.HandleListUsers)
		r.Post("/{id}/block", authSvc.HandleBlockUser)
		r.Post("/{id}/unblock", authSvc.HandleUnblockUser)
		r.Get("/{id}/audit-log", authSvc.HandleGetAuditLog)
	})

	r.Route("/api/admin/settings", func(r chi.Router) {
		r.Use(auth.RequireAdmin)
		r.Put("/registration-limit", authSvc.HandleUpdateRegistrationLimit)
	})

	// ── Placeholder for future API routes ────────────────────────────────────
	r.Route("/api", func(r chi.Router) {
		r.HandleFunc("/*", func(w http.ResponseWriter, req *http.Request) {
			http.NotFound(w, req)
		})
	})

	// ── Payment routes (Stripe Checkout — public, no login required) ──────────
	r.Route("/api/payments", func(r chi.Router) {
		r.Post("/checkout", payments.HandleCheckout)
		r.Post("/webhook", payments.HandleWebhook)
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
