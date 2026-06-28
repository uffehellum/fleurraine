package ai

import (
	"context"
	"os"
	"testing"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

func TestSimpleSDKCall(t *testing.T) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		t.Skip("ANTHROPIC_API_KEY not set")
	}

	client := anthropic.NewClient(option.WithAPIKey(apiKey))

	// Make simplest possible call - just send a text message
	ctx := context.Background()
	message, err := client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.ModelClaudeHaiku4_5,
		MaxTokens: 10,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock("Say hello")),
		},
	})

	if err != nil {
		t.Fatalf("API call failed: %v", err)
	}

	if len(message.Content) == 0 {
		t.Fatal("No content in response")
	}

	t.Logf("Success! Model: %s, Response: %+v", message.Model, message.Content[0])
}
