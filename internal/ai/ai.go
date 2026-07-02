package ai

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const model = anthropic.ModelClaudeHaiku4_5

// AnalyzeImageRequest contains the parameters for image analysis
type AnalyzeImageRequest struct {
	ImageData []byte
	MimeType  string
	Prompt    string
}

// AnalyzeImageResponse contains the AI's analysis result
type AnalyzeImageResponse struct {
	Category        string   `json:"category"`
	Confidence      float64  `json:"confidence"`
	Description     string   `json:"description"`
	RawResponse     string   `json:"raw_response"`
	DetectedFlowers []string `json:"detected_flowers"`
}

// AnalyzeImage sends an image to Claude for analysis
func AnalyzeImage(ctx context.Context, req AnalyzeImageRequest) (*AnalyzeImageResponse, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY not set")
	}

	client := anthropic.NewClient(option.WithAPIKey(apiKey))

	// Encode image to base64
	base64Image := base64.StdEncoding.EncodeToString(req.ImageData)

	// Determine media type
	mediaType := req.MimeType
	if mediaType == "" {
		mediaType = "image/jpeg"
	}

	// Build the prompt - if not provided, use enhanced classification prompt
	prompt := req.Prompt
	if prompt == "" {
		prompt = `Analyze this flower image and provide detailed classification:

1. Category: Classify as ONE of these:
   - "stand" - A flower stand/display with cut flowers in buckets/vases for sale
   - "flower_type" - A close-up of a single flower or flower type
   - "garden_row" - Flowers growing in garden rows/beds
   - "other" - Anything else

2. Flower Identification:
   - List the types of flowers you can identify in the image
   - Be specific (e.g., "roses", "lilies", "daisies", "baby's breath")

Respond with ONLY a JSON object in this exact format:
{
  "category": "stand",
  "confidence": 0.95,
  "description": "A flower stand with buckets of fresh cut flowers",
  "detected_flowers": ["roses", "lilies", "baby's breath"]
}

If you cannot identify specific flowers, set "detected_flowers" to an empty array.
The confidence should be 0.0 to 1.0.`
	}

	// Create the message with image
	message, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     model,
		MaxTokens: 1024,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewImageBlockBase64(mediaType, base64Image),
				anthropic.NewTextBlock(prompt),
			),
		},
	})

	if err != nil {
		return nil, fmt.Errorf("API call failed: %w", err)
	}

	if len(message.Content) == 0 {
		return nil, fmt.Errorf("no content in response")
	}

	// Extract text from response
	var responseText string
	for _, block := range message.Content {
		if textBlock, ok := block.AsAny().(anthropic.TextBlock); ok {
			responseText += textBlock.Text
		}
	}

	// Try to parse JSON response
	var result AnalyzeImageResponse
	result.RawResponse = responseText

	// Claude sometimes wraps JSON in markdown code blocks, so extract it
	jsonText := responseText
	if strings.Contains(responseText, "```json") {
		// Extract JSON from markdown code block
		start := strings.Index(responseText, "```json") + 7
		end := strings.LastIndex(responseText, "```")
		if start >= 7 && end > start {
			jsonText = strings.TrimSpace(responseText[start:end])
		}
	} else if strings.Contains(responseText, "```") {
		// Try plain code block
		start := strings.Index(responseText, "```") + 3
		end := strings.LastIndex(responseText, "```")
		if start >= 3 && end > start {
			jsonText = strings.TrimSpace(responseText[start:end])
		}
	}

	// Attempt to extract JSON from the response
	if err := json.Unmarshal([]byte(jsonText), &result); err != nil {
		// If JSON parsing fails, return raw response with defaults
		result.Category = "other"
		result.Confidence = 0.0
		result.Description = responseText
	}

	// Preserve raw response for debugging
	result.RawResponse = responseText

	return &result, nil
}

// Placeholder functions for backward compatibility

// VerifyFlowerImage validates that a customer's review photo primarily depicts florist-style cut flowers or bouquets.
func VerifyFlowerImage(ctx context.Context, imageData []byte) (bool, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return false, fmt.Errorf("VerifyFlowerImage: ANTHROPIC_API_KEY not set")
	}

	client := anthropic.NewClient(option.WithAPIKey(apiKey))

	// Encode image to base64
	base64Image := base64.StdEncoding.EncodeToString(imageData)

	// Detect MIME type
	mimeType := http.DetectContentType(imageData)
	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	prompt := `You are an AI assistant verifying customer-uploaded photos for flower shop reviews.
Analyze this image and determine if it primarily depicts a florist-style bouquet, cut flowers, or arranged fresh flowers (such as those purchased from a flower stand or florist).

CRITERIA:
1. YES: It shows cut flowers in a vase, pre-arranged bouquets, hand-tied bouquets, or fresh flower stems purchased for home display.
2. NO: It shows indoor houseplants in pots, wild flower fields, landscapes, gardens, artificial/fake flowers, people, pets, or completely unrelated objects/text.

Respond with ONLY a JSON object in this exact format:
{
  "is_valid_flower_purchase": true,
  "confidence": 0.98,
  "reason": "An elegant hand-tied bouquet of fresh roses and eucalyptus on a kitchen table."
}

Ensure "is_valid_flower_purchase" is true if it meets the criteria, and false otherwise. The confidence should be between 0.0 and 1.0.`

	message, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     model,
		MaxTokens: 512,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewImageBlockBase64(mimeType, base64Image),
				anthropic.NewTextBlock(prompt),
			),
		},
	})
	if err != nil {
		return false, fmt.Errorf("VerifyFlowerImage API call failed: %w", err)
	}

	if len(message.Content) == 0 {
		return false, fmt.Errorf("VerifyFlowerImage: no content in response")
	}

	// Extract text from response
	var responseText string
	for _, block := range message.Content {
		if textBlock, ok := block.AsAny().(anthropic.TextBlock); ok {
			responseText += textBlock.Text
		}
	}

	// Clean code blocks if present
	jsonText := responseText
	if strings.Contains(responseText, "```json") {
		start := strings.Index(responseText, "```json") + 7
		end := strings.LastIndex(responseText, "```")
		if start >= 7 && end > start {
			jsonText = strings.TrimSpace(responseText[start:end])
		}
	} else if strings.Contains(responseText, "```") {
		start := strings.Index(responseText, "```") + 3
		end := strings.LastIndex(responseText, "```")
		if start >= 3 && end > start {
			jsonText = strings.TrimSpace(responseText[start:end])
		}
	}

	type VerificationResult struct {
		IsValidFlowerPurchase bool    `json:"is_valid_flower_purchase"`
		Confidence            float64 `json:"confidence"`
		Reason                string  `json:"reason"`
	}

	var result VerificationResult
	if err := json.Unmarshal([]byte(jsonText), &result); err != nil {
		return false, fmt.Errorf("VerifyFlowerImage: failed to parse JSON response: %w", err)
	}

	// Require a confidence threshold
	if result.IsValidFlowerPurchase && result.Confidence >= 0.7 {
		return true, nil
	}

	return false, nil
}

// SpeciesIdentificationRequest is a placeholder type
type SpeciesIdentificationRequest struct {
	ImageData []byte
	MimeType  string
}

// SpeciesIdentificationResponse is a placeholder type
type SpeciesIdentificationResponse struct {
	SpeciesName       string
	CommonName        string
	Confidence        float64
	WikipediaURL      string
	SeasonDescription string
	IsSingleFlower    bool
}

// IdentifyFlowerSpecies is a placeholder - returns empty response
func IdentifyFlowerSpecies(ctx context.Context, req SpeciesIdentificationRequest) (*SpeciesIdentificationResponse, error) {
	// TODO: Implement species identification
	return &SpeciesIdentificationResponse{
		SpeciesName:       "Unknown",
		CommonName:        "Unknown",
		Confidence:        0.0,
		WikipediaURL:      "",
		SeasonDescription: "",
		IsSingleFlower:    false,
	}, nil
}
