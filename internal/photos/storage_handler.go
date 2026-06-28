// Package photos provides a storage proxy handler for serving images.
package photos

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/uffehellum/fleurraine/internal/storage"
)

// StorageHandler provides HTTP handlers for serving images from storage.
type StorageHandler struct {
	storage *storage.Client
}

// NewStorageHandler creates a new StorageHandler instance.
func NewStorageHandler(storage *storage.Client) *StorageHandler {
	return &StorageHandler{storage: storage}
}

// HandleGetImage handles GET /api/storage/{key...}
// Proxies requests to Tigris storage and serves the image.
func (h *StorageHandler) HandleGetImage(w http.ResponseWriter, r *http.Request) {
	// Get the full key from the URL path
	key := chi.URLParam(r, "*")
	if key == "" {
		http.Error(w, "storage key required", http.StatusBadRequest)
		return
	}

	// Ensure the key starts with "photos/" for security
	if !strings.HasPrefix(key, "photos/") {
		http.Error(w, "invalid storage key", http.StatusForbidden)
		return
	}

	// Fetch from storage (now returns []byte)
	data, err := h.storage.Get(r.Context(), key)
	if err != nil {
		// Check if it's a 404
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "NotFound") {
			http.Error(w, "image not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to fetch image", http.StatusInternalServerError)
		return
	}

	// Determine content type from key extension
	contentType := "application/octet-stream"
	if strings.HasSuffix(key, ".jpg") || strings.HasSuffix(key, ".jpeg") {
		contentType = "image/jpeg"
	} else if strings.HasSuffix(key, ".png") {
		contentType = "image/png"
	} else if strings.HasSuffix(key, ".webp") {
		contentType = "image/webp"
	} else if strings.HasSuffix(key, ".gif") {
		contentType = "image/gif"
	}

	// Set cache headers for images (cache for 1 hour)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600")

	// Stream the image to the response
	if _, err := io.Copy(w, bytes.NewReader(data)); err != nil {
		// Can't send error response here as headers are already sent
		return
	}
}
