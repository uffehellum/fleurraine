package ai

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
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
	Category          string   `json:"category"`
	Confidence        float64  `json:"confidence"`
	Description       string   `json:"description"`
	RawResponse       string   `json:"raw_response"`
	IsNumberedBouquet bool     `json:"is_numbered_bouquet"`
	BouquetNumber     *int     `json:"bouquet_number"`
	DetectedFlowers   []string `json:"detected_flowers"`
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
   - "bouquet" - A pre-arranged bouquet or bundle of cut flowers
   - "flower_type" - A close-up of a single flower or flower type
   - "garden_row" - Flowers growing in garden rows/beds
   - "other" - Anything else

2. Numbered Bouquet Detection:
   - Look for a visible 4-digit number (1000-9999) on a sticker, tag, or label
   - This is typically on wrapped bouquets ready for sale

3. Flower Identification:
   - List the types of flowers you can identify in the image
   - Be specific (e.g., "roses", "lilies", "daisies", "baby's breath")

Respond with ONLY a JSON object in this exact format:
{
  "category": "bouquet",
  "confidence": 0.95,
  "description": "A mixed bouquet with roses and lilies",
  "is_numbered_bouquet": true,
  "bouquet_number": 1234,
  "detected_flowers": ["roses", "lilies", "baby's breath"]
}

If no number is visible, set "is_numbered_bouquet" to false and "bouquet_number" to null.
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

// VerifyFlowerImage is a placeholder - returns true for now
func VerifyFlowerImage(ctx context.Context, imageData []byte) (bool, error) {
	// TODO: Implement actual verification logic
	return true, nil
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
