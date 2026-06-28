package ai

import (
	"context"
	"os"
	"testing"
)

func TestFlowerStandDetection(t *testing.T) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		t.Skip("ANTHROPIC_API_KEY not set")
	}

	// Read the flower stand test image
	imageData, err := os.ReadFile("testdata/flowerstand.jpeg")
	if err != nil {
		t.Fatalf("Failed to read test image: %v", err)
	}

	// Analyze the image
	ctx := context.Background()
	result, err := AnalyzeImage(ctx, AnalyzeImageRequest{
		ImageData: imageData,
		MimeType:  "image/jpeg",
	})

	if err != nil {
		t.Fatalf("AnalyzeImage failed: %v", err)
	}

	// Log the results
	t.Logf("Category: %s", result.Category)
	t.Logf("Confidence: %.2f", result.Confidence)
	t.Logf("Description: %s", result.Description)
	t.Logf("Raw Response: %s", result.RawResponse)

	// Verify it was classified as "stand"
	if result.Category != "stand" {
		t.Errorf("Expected category 'stand', got '%s'", result.Category)
	}

	// Verify confidence is reasonable (at least 0.5)
	if result.Confidence < 0.5 {
		t.Errorf("Expected confidence >= 0.5, got %.2f", result.Confidence)
	}

	// Verify description is not empty
	if result.Description == "" {
		t.Error("Expected non-empty description")
	}
}
