package ai

import (
	"strings"
	"testing"
)

func TestJSONExtraction(t *testing.T) {
	responseText := "```json\n{\"category\": \"stand\", \"confidence\": 0.92, \"description\": \"A flower stand\"}\n```"

	jsonText := responseText
	if strings.Contains(responseText, "```json") {
		// Extract JSON from markdown code block
		start := strings.Index(responseText, "```json") + 7
		end := strings.LastIndex(responseText, "```")
		t.Logf("start=%d, end=%d", start, end)
		if start > 7 && end > start {
			jsonText = strings.TrimSpace(responseText[start:end])
		}
	}

	t.Logf("Original: %q", responseText)
	t.Logf("Extracted: %q", jsonText)

	// Check if it's valid JSON
	if !strings.HasPrefix(jsonText, "{") {
		t.Errorf("Extracted text doesn't start with {: %q", jsonText)
	}
}
