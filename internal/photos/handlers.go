// Package photos provides HTTP handlers for photo upload and retrieval.
package photos

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/uffehellum/fleurraine/internal/auth"
)

// Handlers provides HTTP handlers for photo operations.
type Handlers struct {
	service *Service
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

// HandleUpload handles POST /api/photos/upload
// Requires authentication. Admins can upload any category, users can only upload reviews.
func (h *Handlers) HandleUpload(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	isAdmin := auth.IsAdminFromContext(r.Context())

	// Parse multipart form (max 32MB)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse form")
		return
	}

	// Get the uploaded file
	file, header, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "image file required")
		return
	}
	defer file.Close()

	// Get optional parameters
	category := r.FormValue("category")
	flowerName := r.FormValue("flower_name")
	wikipediaURL := r.FormValue("wikipedia_url")
	harvestSeason := r.FormValue("harvest_season")
	description := r.FormValue("description")
	isReview := r.FormValue("is_review") == "true"

	var rowNumber *int16
	if rowStr := r.FormValue("row_number"); rowStr != "" {
		if num, err := strconv.ParseInt(rowStr, 10, 16); err == nil {
			row := int16(num)
			rowNumber = &row
		}
	}

	// Non-admins can only upload reviews
	if !isAdmin && !isReview {
		writeError(w, http.StatusForbidden, "only admins can upload non-review photos")
		return
	}

	// Upload the photo
	photo, err := h.service.UploadPhoto(r.Context(), UploadRequest{
		File:          file,
		Filename:      header.Filename,
		UserID:        user.ID,
		Category:      category,
		FlowerName:    flowerName,
		WikipediaURL:  wikipediaURL,
		HarvestSeason: harvestSeason,
		RowNumber:     rowNumber,
		Description:   description,
		IsReview:      isReview,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(photo)
}

// HandleGetLatestStand handles GET /api/photos/latest-stand
// Returns the most recent published flower stand photo.
func (h *Handlers) HandleGetLatestStand(w http.ResponseWriter, r *http.Request) {
	photo, err := h.service.GetLatestStandPhoto(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if photo == nil {
		writeError(w, http.StatusNotFound, "no stand photo found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(photo)
}

// HandleGetByID handles GET /api/photos/{id}
// Returns a photo by its ID. Published photos are public, pending photos require admin.
func (h *Handlers) HandleGetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "photo ID required")
		return
	}

	photo, err := h.service.GetPhotoByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if photo == nil {
		writeError(w, http.StatusNotFound, "photo not found")
		return
	}

	// Check permissions: published photos are public, pending require admin
	if photo.Status != "published" {
		isAdmin := auth.IsAdminFromContext(r.Context())
		if !isAdmin {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(photo)
}

// HandleGetByShareToken handles GET /api/photos/share/{token}
// Returns a photo by its share token (public access for published photos).
func (h *Handlers) HandleGetByShareToken(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		writeError(w, http.StatusBadRequest, "share token required")
		return
	}

	photo, err := h.service.GetPhotoByShareToken(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if photo == nil {
		writeError(w, http.StatusNotFound, "photo not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(photo)
}

// HandleList handles GET /api/photos
// Lists photos with optional filtering by category and status.
// Pending photos require admin access.
func (h *Handlers) HandleList(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	status := r.URL.Query().Get("status")
	limitStr := r.URL.Query().Get("limit")

	limit := 50 // default
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	// Check permissions for pending photos
	if status == "pending" || status == "" {
		isAdmin := auth.IsAdminFromContext(r.Context())
		if !isAdmin {
			// Non-admins can only see published photos
			status = "published"
		}
	}

	photos, err := h.service.ListPhotos(r.Context(), category, status, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(photos)
}

// HandlePublish handles POST /api/photos/{id}/publish
// Publishes a pending photo (admin only).
func (h *Handlers) HandlePublish(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "photo ID required")
		return
	}

	if err := h.service.PublishPhoto(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleApproveReview handles POST /api/photos/{id}/approve-review
// Approves or rejects a consumer review photo (admin only).
func (h *Handlers) HandleApproveReview(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "photo ID required")
		return
	}

	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		Approved bool `json:"approved"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.ApproveReview(r.Context(), id, user.ID, req.Approved); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleDelete handles DELETE /api/photos/{id}
// Soft deletes a photo (marks as deleted in DB, hard deletes from storage) - admin only.
func (h *Handlers) HandleDelete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "photo ID required")
		return
	}

	// Get admin user email for audit trail
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	if err := h.service.DeletePhoto(r.Context(), id, user.Email); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleUpdateEdits handles PUT /api/photos/{id}/edits
// Updates photo editing metadata (rotation, crop) - admin only.
func (h *Handlers) HandleUpdateEdits(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "photo ID required")
		return
	}

	var edits map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&edits); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.UpdatePhotoEdits(r.Context(), id, edits); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleUpdateCategory handles PUT /api/photos/{id}/category
// Updates photo category (admin override of AI suggestion) - admin only.
func (h *Handlers) HandleUpdateCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "photo ID required")
		return
	}

	var req struct {
		Category string `json:"category"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Category == "" {
		writeError(w, http.StatusBadRequest, "category required")
		return
	}

	if err := h.service.UpdatePhotoCategory(r.Context(), id, req.Category); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleReanalyze handles POST /api/photos/{id}/reanalyze
// Re-runs AI classification on a photo (admin only).
func (h *Handlers) HandleReanalyze(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "photo ID required")
		return
	}

	if err := h.service.ReanalyzePhoto(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleGetAvailableBouquets handles GET /api/bouquets/available
// Returns all numbered bouquets available for purchase (public access).
func (h *Handlers) HandleGetAvailableBouquets(w http.ResponseWriter, r *http.Request) {
	bouquets, err := h.service.GetAvailableBouquets(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bouquets)
}

// HandleGetAllBouquets handles GET /api/bouquets/all
// Returns all numbered bouquets (available, sold, active).
func (h *Handlers) HandleGetAllBouquets(w http.ResponseWriter, r *http.Request) {
	bouquets, err := h.service.GetAllBouquets(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bouquets)
}

// HandlePurchaseBouquet handles POST /api/bouquets/{id}/purchase
// Authenticated user purchases a bouquet.
func (h *Handlers) HandlePurchaseBouquet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "photo ID required")
		return
	}

	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	if err := h.service.PurchaseBouquet(r.Context(), id, user.ID, user.Email, user.DisplayName); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "bouquet purchased successfully"})
}

// HandleHoldBouquet handles POST /api/bouquets/{id}/hold
// Authenticated user places a bouquet on Venmo pending hold.
func (h *Handlers) HandleHoldBouquet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "bouquet ID required")
		return
	}

	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	if err := h.service.HoldBouquet(r.Context(), id, user.ID, user.Email, user.DisplayName); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "bouquet placed on Venmo hold successfully"})
}

// HandleUpdateMetadata handles PUT /api/photos/{id}/metadata
// Updates all metadata fields for a photo (admin only).
func (h *Handlers) HandleUpdateMetadata(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "photo ID required")
		return
	}

	var req struct {
		Category      string   `json:"category"`
		BouquetNumber *int     `json:"bouquet_number"`
		PriceCents    *int     `json:"price_cents"`
		FlowerNames   []string `json:"flower_names"`
		RowNumbers    []int32  `json:"row_numbers"`
		Description   string   `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.UpdatePhotoMetadata(r.Context(), id, req.Category, req.BouquetNumber, req.PriceCents, req.FlowerNames, req.RowNumbers, req.Description); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
