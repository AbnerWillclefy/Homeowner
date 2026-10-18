package llmalloc

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

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

// Complete sends req at effort low. Thinking is adaptive when req asks for it
// (its text is omitted: nobody reads it) and off otherwise; with adaptive
// thinking MaxTokens is the only ceiling on how much the model thinks. The
// referee, not the model, decides if the answer is good. No temperature is
// sent; current models reject non-default sampling. One llm_usage line with
// the token counts is logged per call, never prompt text, so the cost per call
// can be read from the logs.
func (a *Anthropic) Complete(ctx context.Context, req Request) (json.RawMessage, error) {
	thinking := anthropic.ThinkingConfigParamUnion{OfDisabled: &anthropic.ThinkingConfigDisabledParam{}}
	if req.Thinking {
		thinking = anthropic.ThinkingConfigParamUnion{OfAdaptive: &anthropic.ThinkingConfigAdaptiveParam{
			Display: anthropic.ThinkingConfigAdaptiveDisplayOmitted}}
	}
	msg, err := a.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.Model(a.model),
		MaxTokens: int64(req.MaxTokens),
		System:    []anthropic.TextBlockParam{{Text: req.System}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(req.User))},
		Thinking:  thinking,
		OutputConfig: anthropic.OutputConfigParam{
			Effort: anthropic.OutputConfigEffortLow,
			Format: anthropic.JSONOutputFormatParam{Schema: req.Schema},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("anthropic: %w", err)
	}
	slog.InfoContext(ctx, "llm_usage", "model", a.model, "thinking", req.Thinking,
		"input_tokens", msg.Usage.InputTokens, "output_tokens", msg.Usage.OutputTokens,
		"stop_reason", string(msg.StopReason))
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
