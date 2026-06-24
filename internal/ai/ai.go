// Package ai wraps the Anthropic Claude Vision API for photo category suggestions.
package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const anthropicAPIURL = "https://api.anthropic.com/v1/messages"
const anthropicVersion = "2023-06-01"

// AnalyzeImageRequest holds the parameters for image analysis.
type AnalyzeImageRequest struct {
	// ImageData is the raw image bytes (JPEG, PNG, WebP, or GIF).
	ImageData []byte
	// MimeType is the MIME type of the image (e.g., "image/jpeg").
	MimeType string
	// Prompt is an optional custom prompt. If empty, a default prompt is used.
	Prompt string
}

// AnalyzeImageResponse holds the AI's analysis of the image.
type AnalyzeImageResponse struct {
	// Category is the suggested category (e.g., "stand", "bouquet", "flower_type", "garden_row").
	Category string `json:"category"`
	// Description is a brief description of what's in the image.
	Description string `json:"description"`
	// Confidence is a rough confidence score (0.0 to 1.0).
	Confidence float64 `json:"confidence"`
	// Subjects lists detected subjects (e.g., ["sunflower", "rose", "person"]).
	Subjects []string `json:"subjects"`
	// Location is the detected location type (e.g., "flower_stand", "garden", "indoor").
	Location string `json:"location"`
}

// AnalyzeImage sends an image to Claude Vision API for content analysis.
// It returns structured information about the image content, including category,
// description, detected subjects, and location.
func AnalyzeImage(ctx context.Context, req AnalyzeImageRequest) (*AnalyzeImageResponse, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("ai: ANTHROPIC_API_KEY is required")
	}

	// Default prompt if none provided
	prompt := req.Prompt
	if prompt == "" {
		prompt = `Analyze this image and provide a JSON response with the following fields:
- category: one of "stand" (flower stand/display), "bouquet" (arranged flowers), "flower_type" (individual flower species), "garden_row" (flowers growing in rows), "review" (customer photo of flowers at home), or "other"
- description: a brief description of what's in the image (1-2 sentences)
- confidence: your confidence in the category (0.0 to 1.0)
- subjects: array of detected subjects (flower types, objects, people, etc.)
- location: detected location type ("flower_stand", "garden", "indoor", "outdoor", "unknown")

Focus on identifying flowers, their arrangement, and the setting. For flower stands, look for displays with multiple flower types. For bouquets, look for arranged cut flowers. For garden rows, look for flowers growing in organized rows or beds.

Respond ONLY with valid JSON, no additional text.`
	}

	// Encode image to base64
	base64Image := base64.StdEncoding.EncodeToString(req.ImageData)

	// Build the Anthropic API request
	anthropicReq := map[string]interface{}{
		"model":      "claude-3-5-sonnet-20241022",
		"max_tokens": 1024,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "image",
						"source": map[string]string{
							"type":       "base64",
							"media_type": req.MimeType,
							"data":       base64Image,
						},
					},
					{
						"type": "text",
						"text": prompt,
					},
				},
			},
		},
	}

	body, err := json.Marshal(anthropicReq)
	if err != nil {
		return nil, fmt.Errorf("ai: marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicAPIURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ai: create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", anthropicVersion)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ai: http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("ai: read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ai: API returned %d: %s", resp.StatusCode, respBody)
	}

	// Parse Anthropic response
	var anthropicResp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(respBody, &anthropicResp); err != nil {
		return nil, fmt.Errorf("ai: unmarshal response: %w", err)
	}

	if len(anthropicResp.Content) == 0 {
		return nil, fmt.Errorf("ai: empty response from API")
	}

	// Extract the text content (should be JSON)
	textContent := anthropicResp.Content[0].Text

	// Parse the AI's JSON response
	var result AnalyzeImageResponse
	if err := json.Unmarshal([]byte(textContent), &result); err != nil {
		return nil, fmt.Errorf("ai: parse AI response JSON: %w (response: %s)", err, textContent)
	}

	return &result, nil
}

// VerifyFlowerImage checks if an image actually contains flowers.
// This is used for consumer review verification to ensure submitted images
// are relevant to the flower stand.
func VerifyFlowerImage(ctx context.Context, imageData []byte, mimeType string) (bool, string, error) {
	prompt := `Analyze this image and determine if it contains flowers or floral arrangements.
Respond with a JSON object containing:
- contains_flowers: boolean (true if flowers are present, false otherwise)
- reason: string (brief explanation of your determination)

Respond ONLY with valid JSON, no additional text.`

	req := AnalyzeImageRequest{
		ImageData: imageData,
		MimeType:  mimeType,
		Prompt:    prompt,
	}

	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return false, "", fmt.Errorf("ai: ANTHROPIC_API_KEY is required")
	}

	// Encode image to base64
	base64Image := base64.StdEncoding.EncodeToString(req.ImageData)

	// Build the Anthropic API request
	anthropicReq := map[string]interface{}{
		"model":      "claude-3-5-sonnet-20241022",
		"max_tokens": 512,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "image",
						"source": map[string]string{
							"type":       "base64",
							"media_type": req.MimeType,
							"data":       base64Image,
						},
					},
					{
						"type": "text",
						"text": prompt,
					},
				},
			},
		},
	}

	body, err := json.Marshal(anthropicReq)
	if err != nil {
		return false, "", fmt.Errorf("ai: marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicAPIURL, bytes.NewReader(body))
	if err != nil {
		return false, "", fmt.Errorf("ai: create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", anthropicVersion)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return false, "", fmt.Errorf("ai: http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, "", fmt.Errorf("ai: read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return false, "", fmt.Errorf("ai: API returned %d: %s", resp.StatusCode, respBody)
	}

	// Parse Anthropic response
	var anthropicResp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(respBody, &anthropicResp); err != nil {
		return false, "", fmt.Errorf("ai: unmarshal response: %w", err)
	}

	if len(anthropicResp.Content) == 0 {
		return false, "", fmt.Errorf("ai: empty response from API")
	}

	// Extract the text content (should be JSON)
	textContent := anthropicResp.Content[0].Text

	// Parse the AI's JSON response
	var result struct {
		ContainsFlowers bool   `json:"contains_flowers"`
		Reason          string `json:"reason"`
	}
	if err := json.Unmarshal([]byte(textContent), &result); err != nil {
		return false, "", fmt.Errorf("ai: parse AI response JSON: %w (response: %s)", err, textContent)
	}

	return result.ContainsFlowers, result.Reason, nil
}
