package llmalloc

import (
	"context"
	"encoding/json"
	"errors"
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
//
// The Usage is nil when there is no response (HTTP, transport or deadline
// error) and set from the response otherwise, also for ErrInvalidResponse.
func (a *Anthropic) Complete(ctx context.Context, req Request) (json.RawMessage, *Usage, error) {
	if len(req.Tools) > 0 && req.Thinking {
		return nil, nil, errors.New("anthropic: tools cannot be combined with thinking")
	}
	thinking := anthropic.ThinkingConfigParamUnion{OfDisabled: &anthropic.ThinkingConfigDisabledParam{}}
	if req.Thinking {
		thinking = anthropic.ThinkingConfigParamUnion{OfAdaptive: &anthropic.ThinkingConfigAdaptiveParam{
			Display: anthropic.ThinkingConfigAdaptiveDisplayOmitted}}
	}
	params := anthropic.MessageNewParams{
		Model:        anthropic.Model(a.model),
		MaxTokens:    int64(req.MaxTokens),
		System:       []anthropic.TextBlockParam{{Text: req.System}},
		Messages:     []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(req.User))},
		Thinking:     thinking,
		OutputConfig: anthropic.OutputConfigParam{Effort: anthropic.OutputConfigEffortLow},
	}
	if len(req.Tools) > 0 {
		// Forced tool calls and structured output are two answer channels: send one.
		for _, t := range req.Tools {
			params.Tools = append(params.Tools, anthropic.ToolUnionParam{OfTool: toolParam(t)})
		}
		params.ToolChoice = anthropic.ToolChoiceUnionParam{OfAny: &anthropic.ToolChoiceAnyParam{}}
	} else {
		params.OutputConfig.Format = anthropic.JSONOutputFormatParam{Schema: req.Schema}
	}
	msg, err := a.client.Messages.New(ctx, params)
	if err != nil {
		return nil, nil, fmt.Errorf("anthropic: %w", err)
	}
	usage := &Usage{Model: a.model, InputTokens: msg.Usage.InputTokens, OutputTokens: msg.Usage.OutputTokens}
	slog.InfoContext(ctx, "llm_usage", "model", a.model, "thinking", req.Thinking,
		"input_tokens", msg.Usage.InputTokens, "output_tokens", msg.Usage.OutputTokens,
		"stop_reason", string(msg.StopReason))
	if len(req.Tools) > 0 {
		if msg.StopReason != anthropic.StopReasonToolUse && msg.StopReason != anthropic.StopReasonEndTurn {
			return nil, usage, fmt.Errorf("%w: stop reason %s", ErrInvalidResponse, msg.StopReason)
		}
		calls := []ToolCall{}
		for _, block := range msg.Content {
			if use, ok := block.AsAny().(anthropic.ToolUseBlock); ok {
				calls = append(calls, ToolCall{Name: use.Name, Input: use.Input})
			}
		}
		raw, err := json.Marshal(calls)
		return raw, usage, err
	}
	if msg.StopReason != anthropic.StopReasonEndTurn {
		return nil, usage, fmt.Errorf("%w: stop reason %s", ErrInvalidResponse, msg.StopReason)
	}
	for _, block := range msg.Content {
		if text, ok := block.AsAny().(anthropic.TextBlock); ok {
			return json.RawMessage(text.Text), usage, nil
		}
	}
	return nil, usage, fmt.Errorf("%w: no text in the answer", ErrInvalidResponse)
}

// toolParam maps a strict JSON Schema object onto the SDK's input schema; every
// key except type and properties (required, additionalProperties) travels as an extra.
func toolParam(t Tool) *anthropic.ToolParam {
	schema := anthropic.ToolInputSchemaParam{Properties: t.InputSchema["properties"], ExtraFields: map[string]any{}}
	for k, v := range t.InputSchema {
		if k != "type" && k != "properties" {
			schema.ExtraFields[k] = v
		}
	}
	return &anthropic.ToolParam{
		Name:        t.Name,
		Description: anthropic.String(t.Description),
		Strict:      anthropic.Bool(true),
		InputSchema: schema,
	}
}
