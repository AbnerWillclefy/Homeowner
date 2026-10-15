package llmalloc

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// Anthropic is the production Client: one call to the Anthropic Messages API
// with structured output (output_config.format), so the answer is JSON that
// follows Request.Schema.
type Anthropic struct {
	client anthropic.Client
	model  string
}

// NewAnthropic returns a Client for model. Retries are off: the caller's
// context deadline is the only time limit, and a retry would spend the cap.
// opts are for tests (option.WithBaseURL).
func NewAnthropic(apiKey, model string, opts ...option.RequestOption) *Anthropic {
	opts = append([]option.RequestOption{option.WithAPIKey(apiKey), option.WithMaxRetries(0)}, opts...)
	return &Anthropic{client: anthropic.NewClient(opts...), model: model}
}

// Complete sends req. Thinking is off and effort low: the answer is bounded by
// MaxTokens and the referee, not the model, decides if it is good. No
// temperature is sent; current models reject non-default sampling.
func (a *Anthropic) Complete(ctx context.Context, req Request) (json.RawMessage, error) {
	msg, err := a.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.Model(a.model),
		MaxTokens: int64(req.MaxTokens),
		System:    []anthropic.TextBlockParam{{Text: req.System}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(req.User))},
		Thinking:  anthropic.ThinkingConfigParamUnion{OfDisabled: &anthropic.ThinkingConfigDisabledParam{}},
		OutputConfig: anthropic.OutputConfigParam{
			Effort: anthropic.OutputConfigEffortLow,
			Format: anthropic.JSONOutputFormatParam{Schema: req.Schema},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("anthropic: %w", err)
	}
	if msg.StopReason != anthropic.StopReasonEndTurn {
		return nil, fmt.Errorf("%w: stop reason %s", ErrInvalidResponse, msg.StopReason)
	}
	for _, block := range msg.Content {
		if text, ok := block.AsAny().(anthropic.TextBlock); ok {
			return json.RawMessage(text.Text), nil
		}
	}
	return nil, fmt.Errorf("%w: no text in the answer", ErrInvalidResponse)
}
