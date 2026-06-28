package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// UserProfile represents a user's profile information
type UserProfile struct {
	ID                string     `json:"id"`
	Email             string     `json:"email"`
	DisplayName       string     `json:"display_name"`
	Provider          string     `json:"provider"`
	CreatedAt         time.Time  `json:"created_at"`
	LastLoginAt       *time.Time `json:"last_login_at,omitempty"`
	EmailOptOut       bool       `json:"email_opt_out"`
	Blocked           bool       `json:"blocked"`
	PhotoCount        int        `json:"photo_count"`
	OrderCount        int        `json:"order_count"`
	SubscriptionCount int        `json:"subscription_count"`
}

// GetUserProfile retrieves a user's profile with statistics
func (s *Service) GetUserProfile(ctx context.Context, userID string) (*UserProfile, error) {
	const query = `
		SELECT 
			u.id, u.email, u.display_name, u.provider, u.created_at, 
			u.last_login_at, u.email_opt_out, u.blocked,
			COALESCE((SELECT COUNT(*) FROM photos WHERE uploaded_by = u.id), 0) as photo_count,
			COALESCE((SELECT COUNT(*) FROM orders WHERE user_id = u.id), 0) as order_count,
			COALESCE((SELECT COUNT(*) FROM subscriptions WHERE user_id = u.id), 0) as subscription_count
		FROM users u
		WHERE u.id = $1
	`

	var profile UserProfile
	err := s.db.QueryRow(ctx, query, userID).Scan(
		&profile.ID, &profile.Email, &profile.DisplayName, &profile.Provider,
		&profile.CreatedAt, &profile.LastLoginAt, &profile.EmailOptOut, &profile.Blocked,
		&profile.PhotoCount, &profile.OrderCount, &profile.SubscriptionCount,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get user profile: %w", err)
	}

	return &profile, nil
}

// UpdateEmailOptOut updates a user's email opt-out preference
func (s *Service) UpdateEmailOptOut(ctx context.Context, userID string, optOut bool) error {
	const query = `
		UPDATE users
		SET email_opt_out = $1, email_opt_out_at = CASE WHEN $1 THEN now() ELSE NULL END
		WHERE id = $2
	`
	_, err := s.db.Exec(ctx, query, optOut, userID)
	if err != nil {
		return fmt.Errorf("update email opt-out: %w", err)
	}

	// Log the action
	s.logUserAction(ctx, userID, "email_opt_out_changed", map[string]interface{}{
		"opt_out": optOut,
	})

	return nil
}

// DeleteUserAccount deletes a user account and all associated data (GDPR compliance)
func (s *Service) DeleteUserAccount(ctx context.Context, userID string) error {
	// Start a transaction
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Log the deletion before deleting
	s.logUserAction(ctx, userID, "account_deleted", nil)

	// Delete user's photos (CASCADE will handle storage cleanup in application layer)
	_, err = tx.Exec(ctx, "DELETE FROM photos WHERE uploaded_by = $1", userID)
	if err != nil {
		return fmt.Errorf("delete photos: %w", err)
	}

	// Delete user's orders
	_, err = tx.Exec(ctx, "DELETE FROM orders WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("delete orders: %w", err)
	}

	// Delete user's subscriptions
	_, err = tx.Exec(ctx, "DELETE FROM subscriptions WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("delete subscriptions: %w", err)
	}

	// Delete user's season selections
	_, err = tx.Exec(ctx, "DELETE FROM season_selections WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("delete season selections: %w", err)
	}

	// Delete user's sessions
	_, err = tx.Exec(ctx, "DELETE FROM sessions WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("delete sessions: %w", err)
	}

	// Delete user's analytics events
	_, err = tx.Exec(ctx, "DELETE FROM analytics_events WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("delete analytics: %w", err)
	}

	// Finally, delete the user
	_, err = tx.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}

	// Commit the transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// BlockUser blocks a user account (admin only)
func (s *Service) BlockUser(ctx context.Context, userID, adminID, reason string) error {
	const query = `
		UPDATE users
		SET blocked = true, blocked_at = now(), blocked_by = $1, blocked_reason = $2
		WHERE id = $3
	`
	_, err := s.db.Exec(ctx, query, adminID, reason, userID)
	if err != nil {
		return fmt.Errorf("block user: %w", err)
	}

	// Delete all active sessions for the blocked user
	_, err = s.db.Exec(ctx, "DELETE FROM sessions WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("delete sessions: %w", err)
	}

	// Log the action
	s.logUserAction(ctx, userID, "user_blocked", map[string]interface{}{
		"blocked_by": adminID,
		"reason":     reason,
	})

	return nil
}

// UnblockUser unblocks a user account (admin only)
func (s *Service) UnblockUser(ctx context.Context, userID, adminID string) error {
	const query = `
		UPDATE users
		SET blocked = false, blocked_at = NULL, blocked_by = NULL, blocked_reason = NULL
		WHERE id = $1
	`
	_, err := s.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("unblock user: %w", err)
	}

	// Log the action
	s.logUserAction(ctx, userID, "user_unblocked", map[string]interface{}{
		"unblocked_by": adminID,
	})

	return nil
}

// ListUsers lists all users with optional filters (admin only)
func (s *Service) ListUsers(ctx context.Context, blockedOnly bool, limit, offset int) ([]UserProfile, error) {
	query := `
		SELECT 
			u.id, u.email, u.display_name, u.provider, u.created_at, 
			u.last_login_at, u.email_opt_out, u.blocked,
			COALESCE((SELECT COUNT(*) FROM photos WHERE uploaded_by = u.id), 0) as photo_count,
			COALESCE((SELECT COUNT(*) FROM orders WHERE user_id = u.id), 0) as order_count,
			COALESCE((SELECT COUNT(*) FROM subscriptions WHERE user_id = u.id), 0) as subscription_count
		FROM users u
	`

	if blockedOnly {
		query += " WHERE u.blocked = true"
	}

	query += " ORDER BY u.created_at DESC LIMIT $1 OFFSET $2"

	rows, err := s.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []UserProfile
	for rows.Next() {
		var user UserProfile
		err := rows.Scan(
			&user.ID, &user.Email, &user.DisplayName, &user.Provider,
			&user.CreatedAt, &user.LastLoginAt, &user.EmailOptOut, &user.Blocked,
			&user.PhotoCount, &user.OrderCount, &user.SubscriptionCount,
		)
		if err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, user)
	}

	return users, rows.Err()
}

// CheckRegistrationLimit checks if new registrations are allowed today
func (s *Service) CheckRegistrationLimit(ctx context.Context) (bool, error) {
	today := time.Now().Format("2006-01-02")

	const query = `
		INSERT INTO registration_limits (date, count, max_registrations)
		VALUES ($1, 1, 100)
		ON CONFLICT (date) DO UPDATE
		SET count = registration_limits.count + 1
		RETURNING count, max_registrations
	`

	var count, maxRegistrations int
	err := s.db.QueryRow(ctx, query, today).Scan(&count, &maxRegistrations)
	if err != nil {
		return false, fmt.Errorf("check registration limit: %w", err)
	}

	return count <= maxRegistrations, nil
}

// UpdateRegistrationLimit updates the daily registration limit (admin only)
func (s *Service) UpdateRegistrationLimit(ctx context.Context, limit int) error {
	today := time.Now().Format("2006-01-02")

	const query = `
		INSERT INTO registration_limits (date, count, max_registrations)
		VALUES ($1, 0, $2)
		ON CONFLICT (date) DO UPDATE
		SET max_registrations = $2
	`

	_, err := s.db.Exec(ctx, query, today, limit)
	if err != nil {
		return fmt.Errorf("update registration limit: %w", err)
	}

	return nil
}

// UpdateLastLogin updates the user's last login timestamp
func (s *Service) UpdateLastLogin(ctx context.Context, userID string) error {
	const query = `UPDATE users SET last_login_at = now() WHERE id = $1`
	_, err := s.db.Exec(ctx, query, userID)
	return err
}

// logUserAction logs a user action to the audit log
func (s *Service) logUserAction(ctx context.Context, userID, action string, details map[string]interface{}) {
	const query = `
		INSERT INTO user_audit_log (user_id, action, details)
		VALUES ($1, $2, $3)
	`
	// Fire and forget - don't fail the main operation if logging fails
	s.db.Exec(ctx, query, userID, action, details)
}

// GetUserAuditLog retrieves audit log entries for a user (admin only)
func (s *Service) GetUserAuditLog(ctx context.Context, userID string, limit int) ([]map[string]interface{}, error) {
	const query = `
		SELECT id, action, details, created_at
		FROM user_audit_log
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := s.db.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("get audit log: %w", err)
	}
	defer rows.Close()

	var logs []map[string]interface{}
	for rows.Next() {
		var id, action string
		var details map[string]interface{}
		var createdAt time.Time

		err := rows.Scan(&id, &action, &details, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("scan audit log: %w", err)
		}

		logs = append(logs, map[string]interface{}{
			"id":         id,
			"action":     action,
			"details":    details,
			"created_at": createdAt,
		})
	}

	return logs, rows.Err()
}
