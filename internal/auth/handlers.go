package auth

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// HandleGetProfile returns the current user's profile
func (s *Service) HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	profile, err := s.GetUserProfile(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "Failed to get profile", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

// HandleUpdateEmailOptOut updates the user's email opt-out preference
func (s *Service) HandleUpdateEmailOptOut(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		OptOut bool `json:"opt_out"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if err := s.UpdateEmailOptOut(r.Context(), user.ID, req.OptOut); err != nil {
		http.Error(w, "Failed to update preference", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"opt_out": req.OptOut,
	})
}

// HandleDeleteAccount deletes the current user's account and all data (GDPR)
func (s *Service) HandleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Require confirmation
	var req struct {
		Confirm string `json:"confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Confirm != "DELETE" {
		http.Error(w, "Confirmation required", http.StatusBadRequest)
		return
	}

	if err := s.DeleteUserAccount(r.Context(), user.ID); err != nil {
		http.Error(w, "Failed to delete account", http.StatusInternalServerError)
		return
	}

	// Clear the session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Account deleted successfully",
	})
}

// HandleListUsers lists all users (admin only)
func (s *Service) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	blockedOnly := r.URL.Query().Get("blocked") == "true"
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	offset := 0
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	users, err := s.ListUsers(r.Context(), blockedOnly, limit, offset)
	if err != nil {
		http.Error(w, "Failed to list users", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// HandleBlockUser blocks a user account (admin only)
func (s *Service) HandleBlockUser(w http.ResponseWriter, r *http.Request) {
	admin, ok := r.Context().Value(contextKeyUser).(User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID := chi.URLParam(r, "id")
	if userID == "" {
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Reason == "" {
		req.Reason = "Blocked by admin"
	}

	if err := s.BlockUser(r.Context(), userID, admin.ID, req.Reason); err != nil {
		http.Error(w, "Failed to block user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User blocked successfully",
	})
}

// HandleUnblockUser unblocks a user account (admin only)
func (s *Service) HandleUnblockUser(w http.ResponseWriter, r *http.Request) {
	admin, ok := r.Context().Value(contextKeyUser).(User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID := chi.URLParam(r, "id")
	if userID == "" {
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	if err := s.UnblockUser(r.Context(), userID, admin.ID); err != nil {
		http.Error(w, "Failed to unblock user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User unblocked successfully",
	})
}

// HandleGetAuditLog retrieves audit log for a user (admin only)
func (s *Service) HandleGetAuditLog(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	if userID == "" {
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	logs, err := s.GetUserAuditLog(r.Context(), userID, limit)
	if err != nil {
		http.Error(w, "Failed to get audit log", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

// HandleUpdateRegistrationLimit updates the daily registration limit (admin only)
func (s *Service) HandleUpdateRegistrationLimit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Limit int `json:"limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Limit < 0 {
		http.Error(w, "Limit must be non-negative", http.StatusBadRequest)
		return
	}

	if err := s.UpdateRegistrationLimit(r.Context(), req.Limit); err != nil {
		http.Error(w, "Failed to update limit", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"limit":   req.Limit,
	})
}
