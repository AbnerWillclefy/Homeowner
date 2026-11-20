package llmalloc

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
)

// Role is who wrote a Message.
type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

// Conversation is one call to Converse: the rules, the tools the model may
// use and the messages so far. Unlike Request it is multi-turn, and the model
// is free to answer in text instead of using a tool.
type Conversation struct {
	System    string
	Tools     []Tool
	MaxTokens int
	Messages  []Message
}

// Message is one turn of a Conversation. A user message holds Text or
// ToolResults; an assistant message holds Text and/or the ToolUses the model
// asked for, echoed back so every ToolResult can name its ToolUse.
type Message struct {
	Role        Role
	Text        string
	ToolUses    []ToolUse
	ToolResults []ToolResult
}

// ToolUse is one tool call the model asked for. ID is the API's tool_use id.
// It is not a ToolCall, which has no id and is what Complete returns.
type ToolUse struct {
	ID    string
	Name  string
	Input json.RawMessage
}

// ToolResult answers the ToolUse named by ToolUseID. Content is a JSON string.
type ToolResult struct {
	ToolUseID string
	Content   string
	IsError   bool
}

// Turn is the model's reply: the ToolUses it asks for, or its final Text,
// never both.
type Turn struct {
	ToolUses []ToolUse
	Text     string
}

// Converse sends conv at effort low with thinking off and tool choice auto,
// and returns the tool uses the model asks for (stop reason tool_use) or its
// final text (end_turn). Any other stop reason, or an end_turn without text,
// is ErrInvalidResponse. The Usage and the logging follow Complete: nil when
// there is no response, set otherwise, one llm_usage line without text or
// tool input. A deadline stays context.DeadlineExceeded.
func (a *Anthropic) Converse(ctx context.Context, conv Conversation) (Turn, *Usage, error) {
	params := anthropic.MessageNewParams{
		Model:        anthropic.Model(a.model),
		MaxTokens:    int64(conv.MaxTokens),
		System:       []anthropic.TextBlockParam{{Text: conv.System}},
		Thinking:     anthropic.ThinkingConfigParamUnion{OfDisabled: &anthropic.ThinkingConfigDisabledParam{}},
		OutputConfig: anthropic.OutputConfigParam{Effort: anthropic.OutputConfigEffortLow},
	}
	for _, t := range conv.Tools {
		params.Tools = append(params.Tools, anthropic.ToolUnionParam{OfTool: toolParam(t)})
	}
	if len(conv.Tools) > 0 {
		params.ToolChoice = anthropic.ToolChoiceUnionParam{OfAuto: &anthropic.ToolChoiceAutoParam{}}
	}
	for _, m := range conv.Messages {
		var blocks []anthropic.ContentBlockParamUnion
		if m.Text != "" {
			blocks = append(blocks, anthropic.NewTextBlock(m.Text))
		}
		for _, u := range m.ToolUses {
			blocks = append(blocks, anthropic.NewToolUseBlock(u.ID, u.Input, u.Name))
		}
		for _, r := range m.ToolResults {
			blocks = append(blocks, anthropic.NewToolResultBlock(r.ToolUseID, r.Content, r.IsError))
		}
		if m.Role == RoleAssistant {
			params.Messages = append(params.Messages, anthropic.NewAssistantMessage(blocks...))
		} else {
			params.Messages = append(params.Messages, anthropic.NewUserMessage(blocks...))
		}
	}
	msg, err := a.client.Messages.New(ctx, params)
	if err != nil {
		return Turn{}, nil, fmt.Errorf("anthropic: %w", err)
	}
	usage := &Usage{Model: a.model, InputTokens: msg.Usage.InputTokens, OutputTokens: msg.Usage.OutputTokens}
	slog.InfoContext(ctx, "llm_usage", "model", a.model, "thinking", false,
		"input_tokens", msg.Usage.InputTokens, "output_tokens", msg.Usage.OutputTokens,
		"stop_reason", string(msg.StopReason))
	var turn Turn
	var text strings.Builder
	for _, block := range msg.Content {
		switch b := block.AsAny().(type) {
		case anthropic.ToolUseBlock:
			turn.ToolUses = append(turn.ToolUses, ToolUse{ID: b.ID, Name: b.Name, Input: b.Input})
		case anthropic.TextBlock:
			text.WriteString(b.Text)
		}
	}
	switch {
	case msg.StopReason == anthropic.StopReasonToolUse && len(turn.ToolUses) > 0:
		return turn, usage, nil
	case msg.StopReason == anthropic.StopReasonEndTurn && text.Len() > 0:
		return Turn{Text: text.String()}, usage, nil
	}
	return Turn{}, usage, fmt.Errorf("%w: stop reason %s with %d tool uses and %d text bytes",
		ErrInvalidResponse, msg.StopReason, len(turn.ToolUses), text.Len())
}
