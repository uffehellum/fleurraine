// Package auth handles OAuth authentication, session management, and admin role checks.
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ─── Types ────────────────────────────────────────────────────────────────────

// User represents an authenticated user.
type User struct {
	ID          string
	Email       string
	DisplayName string
}

// Session represents an active user session.
type Session struct {
	ID        string
	UserID    string
	IsAdmin   bool
	ExpiresAt time.Time
}

// contextKey is a private key type to avoid collisions in request contexts.
type contextKey int

const (
	contextKeyUser    contextKey = iota
	contextKeyIsAdmin contextKey = iota
	contextKeySession contextKey = iota
)

// sessionDuration is how long a new session is valid.
const sessionDuration = 30 * 24 * time.Hour

// cookieName is the HTTP cookie name for the session identifier.
const cookieName = "session_id"

// ─── Service ──────────────────────────────────────────────────────────────────

// Service holds the admin email set and a DB pool, exposing auth helpers.
type Service struct {
	adminEmails map[string]bool
	db          *pgxpool.Pool
}

// New loads admin emails from the ADMIN_EMAILS environment variable.
// Emails are trimmed of whitespace and compared case-insensitively.
// db may be nil during unit tests that only call IsAdmin.
func New() *Service {
	raw := os.Getenv("ADMIN_EMAILS")
	emails := make(map[string]bool)
	for _, e := range strings.Split(raw, ",") {
		trimmed := strings.TrimSpace(strings.ToLower(e))
		if trimmed != "" {
			emails[trimmed] = true
		}
	}
	return &Service{adminEmails: emails}
}

// NewWithDB creates a Service with a live database pool.
func NewWithDB(db *pgxpool.Pool) *Service {
	svc := New()
	svc.db = db
	return svc
}

// IsAdmin reports whether the given email belongs to an admin.
// The comparison is case-insensitive.
func (s *Service) IsAdmin(email string) bool {
	return s.adminEmails[strings.ToLower(strings.TrimSpace(email))]
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

// upsertUser inserts or updates a user identified by (provider, providerID).
// If a matching row exists, display_name is updated; the row is returned in all cases.
func (s *Service) upsertUser(ctx context.Context, email, displayName, provider, providerID string) (User, error) {
	const q = `
INSERT INTO users (email, display_name, provider, provider_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (email)
DO UPDATE SET display_name = EXCLUDED.display_name,
              provider     = EXCLUDED.provider,
              provider_id  = EXCLUDED.provider_id
RETURNING id, email, display_name`

	var u User
	err := s.db.QueryRow(ctx, q, email, displayName, provider, providerID).
		Scan(&u.ID, &u.Email, &u.DisplayName)
	if err != nil {
		return User{}, fmt.Errorf("auth: upsert user: %w", err)
	}
	return u, nil
}

// createSession inserts a new session row and returns it.
func (s *Service) createSession(ctx context.Context, userID string, isAdmin bool) (Session, error) {
	const q = `
INSERT INTO sessions (user_id, is_admin, expires_at)
VALUES ($1, $2, $3)
RETURNING id, user_id, is_admin, expires_at`

	expiresAt := time.Now().Add(sessionDuration)
	var sess Session
	err := s.db.QueryRow(ctx, q, userID, isAdmin, expiresAt).
		Scan(&sess.ID, &sess.UserID, &sess.IsAdmin, &sess.ExpiresAt)
	if err != nil {
		return Session{}, fmt.Errorf("auth: create session: %w", err)
	}
	return sess, nil
}

// loadSession returns the session and associated user for a given session ID.
// Returns (zero, zero, pgx.ErrNoRows) if not found or expired.
func (s *Service) loadSession(ctx context.Context, sessionID string) (Session, User, error) {
	const q = `
SELECT s.id, s.user_id, s.is_admin, s.expires_at,
       u.id, u.email, u.display_name
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id = $1 AND s.expires_at > now()`

	var sess Session
	var u User
	err := s.db.QueryRow(ctx, q, sessionID).
		Scan(&sess.ID, &sess.UserID, &sess.IsAdmin, &sess.ExpiresAt,
			&u.ID, &u.Email, &u.DisplayName)
	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, User{}, pgx.ErrNoRows
	}
	if err != nil {
		return Session{}, User{}, fmt.Errorf("auth: load session: %w", err)
	}
	return sess, u, nil
}

// deleteSession removes a session row by ID.
func (s *Service) deleteSession(ctx context.Context, sessionID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE id = $1`, sessionID)
	if err != nil {
		return fmt.Errorf("auth: delete session: %w", err)
	}
	return nil
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

func setSessionCookie(w http.ResponseWriter, sessionID string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Expires:  expires,
		MaxAge:   int(time.Until(expires).Seconds()),
	})
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

// ─── JSON response helpers ────────────────────────────────────────────────────

type sessionResponse struct {
	User    userResponse `json:"user"`
	IsAdmin bool         `json:"isAdmin"`
}

type userResponse struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
}

func writeSessionResponse(w http.ResponseWriter, u User, isAdmin bool) {
	resp := sessionResponse{
		User: userResponse{
			ID:          u.ID,
			DisplayName: u.DisplayName,
			Email:       u.Email,
		},
		IsAdmin: isAdmin,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp) //nolint:errcheck
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg}) //nolint:errcheck
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

// googleTokenResponse is the JSON body from Google's token endpoint.
type googleTokenResponse struct {
	IDToken     string `json:"id_token"`
	AccessToken string `json:"access_token"`
}

// googleIDTokenPayload holds the claims we care about from the ID token.
type googleIDTokenPayload struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

// exchangeGoogleCode exchanges an authorization code for tokens and returns
// the verified user info from Google's tokeninfo endpoint.
func exchangeGoogleCode(ctx context.Context, code, redirectURI string) (googleIDTokenPayload, error) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")

	resp, err := ctxPost(ctx, "https://oauth2.googleapis.com/token", url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		return googleIDTokenPayload{}, fmt.Errorf("google: token exchange: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return googleIDTokenPayload{}, fmt.Errorf("google: token endpoint returned %d: %s", resp.StatusCode, body)
	}

	var tokens googleTokenResponse
	if err := json.Unmarshal(body, &tokens); err != nil {
		return googleIDTokenPayload{}, fmt.Errorf("google: decode token response: %w", err)
	}

	// Verify the ID token via Google's tokeninfo endpoint (simple, no JWT library needed).
	info, err := verifyGoogleIDToken(ctx, tokens.IDToken)
	if err != nil {
		return googleIDTokenPayload{}, err
	}
	return info, nil
}

func verifyGoogleIDToken(ctx context.Context, idToken string) (googleIDTokenPayload, error) {
	verifyURL := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(idToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, verifyURL, nil)
	if err != nil {
		return googleIDTokenPayload{}, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return googleIDTokenPayload{}, fmt.Errorf("google: verify ID token: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return googleIDTokenPayload{}, fmt.Errorf("google: tokeninfo returned %d: %s", resp.StatusCode, body)
	}

	var payload googleIDTokenPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return googleIDTokenPayload{}, fmt.Errorf("google: decode tokeninfo: %w", err)
	}
	if payload.Sub == "" || payload.Email == "" {
		return googleIDTokenPayload{}, fmt.Errorf("google: missing sub or email in tokeninfo")
	}
	return payload, nil
}

// HandleGoogleAuth handles POST /api/auth/google.
func (s *Service) HandleGoogleAuth(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code        string `json:"code"`
		RedirectURI string `json:"redirectUri"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	info, err := exchangeGoogleCode(r.Context(), req.Code, req.RedirectURI)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "google authentication failed")
		return
	}

	email := strings.ToLower(strings.TrimSpace(info.Email))
	u, err := s.upsertUser(r.Context(), email, info.Name, "google", info.Sub)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save user")
		return
	}

	isAdmin := s.IsAdmin(email)
	sess, err := s.createSession(r.Context(), u.ID, isAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}

	setSessionCookie(w, sess.ID, sess.ExpiresAt)
	writeSessionResponse(w, u, isAdmin)
}

// ─── Facebook OAuth ───────────────────────────────────────────────────────────

type facebookTokenResponse struct {
	AccessToken string `json:"access_token"`
}

type facebookUserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func exchangeFacebookCode(ctx context.Context, code, redirectURI string) (facebookUserResponse, error) {
	appID := os.Getenv("FACEBOOK_APP_ID")
	appSecret := os.Getenv("FACEBOOK_APP_SECRET")

	// Exchange code for access token.
	resp, err := ctxPost(ctx, "https://graph.facebook.com/v19.0/oauth/access_token", url.Values{
		"client_id":     {appID},
		"client_secret": {appSecret},
		"redirect_uri":  {redirectURI},
		"code":          {code},
	})
	if err != nil {
		return facebookUserResponse{}, fmt.Errorf("facebook: token exchange: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return facebookUserResponse{}, fmt.Errorf("facebook: token endpoint returned %d: %s", resp.StatusCode, body)
	}

	var tokens facebookTokenResponse
	if err := json.Unmarshal(body, &tokens); err != nil {
		return facebookUserResponse{}, fmt.Errorf("facebook: decode token response: %w", err)
	}

	// Fetch user info.
	userURL := fmt.Sprintf(
		"https://graph.facebook.com/me?fields=id,name,email&access_token=%s",
		url.QueryEscape(tokens.AccessToken),
	)
	userReq, err := http.NewRequestWithContext(ctx, http.MethodGet, userURL, nil)
	if err != nil {
		return facebookUserResponse{}, err
	}
	userResp, err := http.DefaultClient.Do(userReq)
	if err != nil {
		return facebookUserResponse{}, fmt.Errorf("facebook: fetch user: %w", err)
	}
	defer userResp.Body.Close()

	userBody, _ := io.ReadAll(userResp.Body)
	if userResp.StatusCode != http.StatusOK {
		return facebookUserResponse{}, fmt.Errorf("facebook: me endpoint returned %d: %s", userResp.StatusCode, userBody)
	}

	var fbUser facebookUserResponse
	if err := json.Unmarshal(userBody, &fbUser); err != nil {
		return facebookUserResponse{}, fmt.Errorf("facebook: decode user response: %w", err)
	}
	if fbUser.ID == "" {
		return facebookUserResponse{}, fmt.Errorf("facebook: missing user ID")
	}
	return fbUser, nil
}

// HandleFacebookAuth handles POST /api/auth/facebook.
func (s *Service) HandleFacebookAuth(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code        string `json:"code"`
		RedirectURI string `json:"redirectUri"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	fbUser, err := exchangeFacebookCode(r.Context(), req.Code, req.RedirectURI)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "facebook authentication failed")
		return
	}

	// Facebook may not return email if the user hasn't granted permission.
	email := strings.ToLower(strings.TrimSpace(fbUser.Email))
	if email == "" {
		// Use a deterministic synthetic email so the user row can be created.
		// Real apps would prompt for email; for Fleurraine this edge case is
		// acceptable — non-email Facebook users can't be admins.
		email = fmt.Sprintf("fb:%s@facebook.invalid", fbUser.ID)
	}

	u, err := s.upsertUser(r.Context(), email, fbUser.Name, "facebook", fbUser.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save user")
		return
	}

	isAdmin := s.IsAdmin(email)
	sess, err := s.createSession(r.Context(), u.ID, isAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}

	setSessionCookie(w, sess.ID, sess.ExpiresAt)
	writeSessionResponse(w, u, isAdmin)
}

// ─── Session endpoint ─────────────────────────────────────────────────────────

// HandleSession handles GET /api/auth/session.
// Returns the current session or 401.
func (s *Service) HandleSession(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "no session")
		return
	}

	_, u, err := s.loadSession(r.Context(), cookie.Value)
	if err != nil {
		clearSessionCookie(w)
		writeError(w, http.StatusUnauthorized, "session not found or expired")
		return
	}

	isAdmin := s.IsAdmin(u.Email)
	writeSessionResponse(w, u, isAdmin)
}

// ─── Sign-out endpoint ────────────────────────────────────────────────────────

// HandleSignOut handles POST /api/auth/signout.
func (s *Service) HandleSignOut(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err == nil {
		// Best-effort delete; ignore error if session row is already gone.
		_ = s.deleteSession(r.Context(), cookie.Value)
	}
	clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// ─── Middleware ───────────────────────────────────────────────────────────────

// SessionLoad is middleware that reads the session cookie, loads the user from
// the database, and attaches the user and isAdmin flag to the request context.
// Requests without a valid session proceed with no user in context.
func (s *Service) SessionLoad(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(cookieName)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}

		sess, u, err := s.loadSession(r.Context(), cookie.Value)
		if err != nil {
			// Invalid/expired session — clear the cookie and continue as anonymous.
			clearSessionCookie(w)
			next.ServeHTTP(w, r)
			return
		}

		isAdmin := s.IsAdmin(u.Email)
		ctx := r.Context()
		ctx = context.WithValue(ctx, contextKeyUser, u)
		ctx = context.WithValue(ctx, contextKeyIsAdmin, isAdmin)
		ctx = context.WithValue(ctx, contextKeySession, sess)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireAuth is middleware that returns 401 if no valid session is attached to
// the request context (i.e. SessionLoad found no session).
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.Context().Value(contextKeyUser).(User); !ok {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireAdmin is middleware that returns 403 if the session exists but the
// user is not an admin.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.Context().Value(contextKeyUser).(User); !ok {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		isAdmin, _ := r.Context().Value(contextKeyIsAdmin).(bool)
		if !isAdmin {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ─── Context accessors ────────────────────────────────────────────────────────

// UserFromContext returns the User attached to ctx by SessionLoad, and whether
// one was found.
func UserFromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(contextKeyUser).(User)
	return u, ok
}

// IsAdminFromContext returns the isAdmin flag attached to ctx by SessionLoad.
func IsAdminFromContext(ctx context.Context) bool {
	v, _ := ctx.Value(contextKeyIsAdmin).(bool)
	return v
}

// SessionFromContext returns the Session attached to ctx by SessionLoad.
func SessionFromContext(ctx context.Context) (Session, bool) {
	sess, ok := ctx.Value(contextKeySession).(Session)
	return sess, ok
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

// ctxPost issues an application/x-www-form-urlencoded POST with the given context.
func ctxPost(ctx context.Context, endpoint string, form url.Values) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint,
		strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return http.DefaultClient.Do(req)
}
