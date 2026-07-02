// Package payments handles Stripe Checkout integration for bouquet purchases.
package payments

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"

	stripe "github.com/stripe/stripe-go/v76"
	stripecheckout "github.com/stripe/stripe-go/v76/checkout/session"
	stripewebhook "github.com/stripe/stripe-go/v76/webhook"
)

// defaultTaxRate returns the sales tax rate from the SALES_TAX_RATE env var,
// defaulting to 0.09 (9%) for Camano Island.
func defaultTaxRate() float64 {
	if raw := os.Getenv("SALES_TAX_RATE"); raw != "" {
		if rate, err := strconv.ParseFloat(raw, 64); err == nil {
			return rate
		}
	}
	return 0.09
}

// taxLabel returns the human-readable tax label from SALES_TAX_LABEL,
// defaulting to "Camano Island Sales Tax (9%)".
func taxLabel() string {
	if label := os.Getenv("SALES_TAX_LABEL"); label != "" {
		return label
	}
	return "Camano Island Sales Tax (9%)"
}

// initStripe sets the Stripe API key from the STRIPE_SECRET_KEY env var.
// If the key is not set, Stripe operations will fail gracefully.
func initStripe() error {
	key := os.Getenv("STRIPE_SECRET_KEY")
	if key == "" {
		return fmt.Errorf("STRIPE_SECRET_KEY not set")
	}
	stripe.Key = key
	return nil
}

// HandleCheckout creates a Stripe Checkout Session for purchasing a bouquet.
//
// POST /api/payments/checkout
// Request body: {"amount": 1000, "label": "Bouquet from Fleurraine"}
//   - amount is in cents (e.g., 1000 = $10.00)
//   - label is the product name shown on the Stripe Checkout page
//
// The response returns {"url": "https://checkout.stripe.com/..."} that the
// frontend redirects to. Tax is calculated server-side as a fixed line item
// (SALES_TAX_RATE, default 9% for Camano Island).
func HandleCheckout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	if err := initStripe(); err != nil {
		writeStripeError(w, http.StatusServiceUnavailable, "Stripe is not configured")
		return
	}

	var req struct {
		Amount int64  `json:"amount"` // amount in cents
		Label  string `json:"label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeStripeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Amount <= 0 {
		writeStripeError(w, http.StatusBadRequest, "amount must be positive")
		return
	}

	if req.Label == "" {
		req.Label = "Bouquet from Fleurraine"
	}

	// Calculate tax: amount * rate, rounded to nearest cent.
	taxRate := defaultTaxRate()
	taxCents := int64(float64(req.Amount) * taxRate)
	totalCents := req.Amount + taxCents

	// Determine the base URL for success/cancel redirects.
	// In production this should be the app's public URL.
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		// Fall back to the request origin
		appURL = "https://" + r.Host
	}

	params := &stripe.CheckoutSessionParams{
		Mode: stripe.String(string(stripe.CheckoutSessionModePayment)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Quantity: stripe.Int64(1),
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String("usd"),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String(req.Label),
					},
					UnitAmount: stripe.Int64(req.Amount),
				},
			},
			{
				Quantity: stripe.Int64(1),
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String("usd"),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String(taxLabel()),
					},
					UnitAmount: stripe.Int64(taxCents),
				},
			},
		},
		SuccessURL: stripe.String(appURL + "/?payment=success"),
		CancelURL:  stripe.String(appURL + "/?payment=cancelled"),
	}

	session, err := stripecheckout.New(params)
	if err != nil {
		log.Printf("Stripe checkout error: %v", err)
		writeStripeError(w, http.StatusInternalServerError, "failed to create checkout session")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"url":         session.URL,
		"session_id":  session.ID,
		"total_cents": fmt.Sprintf("%d", totalCents),
	})
}

// HandleWebhook processes Stripe webhook events (e.g., successful payments).
//
// POST /api/payments/webhook
// The request body is the raw Stripe webhook payload.
// The Stripe-Signature header is verified using STRIPE_WEBHOOK_SECRET.
//
// On a successful checkout.session.completed event, the payment is logged.
// In a full implementation, this would mark the bouquet as sold in the database.
func HandleWebhook(w http.ResponseWriter, r *http.Request) {
	if err := initStripe(); err != nil {
		writeStripeError(w, http.StatusServiceUnavailable, "Stripe is not configured")
		return
	}

	webhookSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
	if webhookSecret == "" {
		writeStripeError(w, http.StatusServiceUnavailable, "STRIPE_WEBHOOK_SECRET not set")
		return
	}

	const maxBodyBytes = int64(65536) // 64KB
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeStripeError(w, http.StatusBadRequest, "could not read request body")
		return
	}

	event, err := stripewebhook.ConstructEvent(body, r.Header.Get("Stripe-Signature"), webhookSecret)
	if err != nil {
		log.Printf("Stripe webhook signature verification failed: %v", err)
		writeStripeError(w, http.StatusBadRequest, "webhook signature verification failed")
		return
	}

	switch event.Type {
	case "checkout.session.completed":
		var session stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
			log.Printf("Stripe webhook: failed to parse session: %v", err)
			writeStripeError(w, http.StatusBadRequest, "failed to parse session")
			return
		}
		log.Printf("Stripe payment completed: session_id=%s amount_total=%d", session.ID, session.AmountTotal)
		// TODO: Mark the bouquet as sold in the database and send email notification.
		// This requires access to the photos service — for now we log the event.

	case "checkout.session.async_payment_succeeded":
		log.Printf("Stripe async payment succeeded")

	case "checkout.session.async_payment_failed":
		log.Printf("Stripe async payment failed")

	default:
		log.Printf("Stripe webhook: unhandled event type: %s", event.Type)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "received"})
}

// writeStripeError writes a JSON error response.
func writeStripeError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
