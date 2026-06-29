package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// SendEmailRequest contains the payload for sending an email via Resend
type SendEmailRequest struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html"`
}

// Send sends an email using the Resend API
func Send(ctx context.Context, subject, html string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("email: RESEND_API_KEY environment variable not set")
	}

	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "lorraine.hellum@gmail.com" // fallback
	}

	// Resend onboarding domain default sender
	fromEmail := "Fleurraine <onboarding@resend.dev>"

	payload := SendEmailRequest{
		From:    fromEmail,
		To:      adminEmail,
		Subject: subject,
		HTML:    html,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("email: failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.resend.com/emails", bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("email: failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("email: failed to perform HTTP request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errResp map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		return fmt.Errorf("email: resend API returned status %d: %v", resp.StatusCode, errResp)
	}

	return nil
}
