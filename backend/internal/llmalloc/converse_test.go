package llmalloc_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

var chat = llmalloc.Conversation{
	System: "rules", MaxTokens: 512, Tools: toolRequest.Tools,
	Messages: []llmalloc.Message{{Role: llmalloc.RoleUser, Text: "secret question"}},
}

func idToolUse(id, name, input string) map[string]any {
	return map[string]any{"type": "tool_use", "id": id, "name": name, "input": json.RawMessage(input)}
}

func TestConverseReturnsTheToolUsesInOrderWithTheirIdsAndTheUsage(t *testing.T) {
	body := toolMessage("tool_use",
		idToolUse("toolu_a", "create_chore", `{"title":"a"}`),
		map[string]any{"type": "text", "text": "thinking aloud"},
		idToolUse("toolu_b", "create_chore", `{"title":"b"}`))
	client, _, _, _ := fakeAPI(t, http.StatusOK, body, 0)

	turn, usage, err := client.Converse(context.Background(), chat)
	if err != nil {
		t.Fatal(err)
	}
	want := []llmalloc.ToolUse{
		{ID: "toolu_a", Name: "create_chore", Input: json.RawMessage(`{"title":"a"}`)},
		{ID: "toolu_b", Name: "create_chore", Input: json.RawMessage(`{"title":"b"}`)},
	}
	if !reflect.DeepEqual(turn.ToolUses, want) || turn.Text != "" {
		t.Fatalf("turn = %+v", turn)
	}
	if usage == nil || *usage != (llmalloc.Usage{Model: "claude-haiku-5-5", InputTokens: 7, OutputTokens: 3}) {
		t.Fatalf("usage = %+v", usage)
	}
}

func TestConverseReturnsTheTextOfAnEndTurn(t *testing.T) {
	body := toolMessage("end_turn", map[string]any{"type": "text", "text": "Hello "}, map[string]any{"type": "text", "text": "there"})
	client, _, _, _ := fakeAPI(t, http.StatusOK, body, 0)

	turn, usage, err := client.Converse(context.Background(), chat)
	if err != nil || turn.Text != "Hello there" || len(turn.ToolUses) != 0 || usage == nil || usage.InputTokens != 7 {
		t.Fatalf("turn = %+v, usage = %+v, err = %v", turn, usage, err)
	}
}

func TestTheSecondRoundCarriesTheToolUsesAndTheirResults(t *testing.T) {
	client, _, got, _ := fakeAPI(t, http.StatusOK, toolMessage("end_turn", map[string]any{"type": "text", "text": "done"}), 0)
	conv := chat
	conv.Messages = append(append([]llmalloc.Message{}, chat.Messages...),
		llmalloc.Message{Role: llmalloc.RoleAssistant, Text: "let me look", ToolUses: []llmalloc.ToolUse{
			{ID: "toolu_a", Name: "create_chore", Input: json.RawMessage(`{"title":"a"}`)},
			{ID: "toolu_b", Name: "create_chore", Input: json.RawMessage(`{"title":"b"}`)}}},
		llmalloc.Message{Role: llmalloc.RoleUser, ToolResults: []llmalloc.ToolResult{
			{ToolUseID: "toolu_a", Content: `{"ok":true}`},
			{ToolUseID: "toolu_b", Content: `{"error":"no"}`, IsError: true}}})

	if _, _, err := client.Converse(context.Background(), conv); err != nil {
		t.Fatal(err)
	}
	body := *got
	msgs, _ := body["messages"].([]any)
	if len(msgs) != 3 {
		t.Fatalf("messages = %v", body["messages"])
	}
	block := func(msg any, i int) map[string]any {
		return msg.(map[string]any)["content"].([]any)[i].(map[string]any)
	}
	if m := msgs[0].(map[string]any); m["role"] != "user" || block(m, 0)["text"] != "secret question" {
		t.Errorf("first message = %v", m)
	}
	asst := msgs[1].(map[string]any)
	if asst["role"] != "assistant" || len(asst["content"].([]any)) != 3 ||
		block(asst, 0)["type"] != "text" || block(asst, 0)["text"] != "let me look" {
		t.Fatalf("assistant message = %v", asst)
	}
	for i, id := range []string{"toolu_a", "toolu_b"} {
		if b := block(asst, i+1); b["type"] != "tool_use" || b["id"] != id || b["name"] != "create_chore" || b["input"] == nil {
			t.Errorf("tool_use %d = %v", i, b)
		}
	}
	results := msgs[2].(map[string]any)
	if results["role"] != "user" || len(results["content"].([]any)) != 2 {
		t.Fatalf("results message = %v", results)
	}
	if b := block(results, 0); b["type"] != "tool_result" || b["tool_use_id"] != "toolu_a" || b["is_error"] == true {
		t.Errorf("first result = %v", b)
	}
	if b := block(results, 1); b["type"] != "tool_result" || b["tool_use_id"] != "toolu_b" || b["is_error"] != true {
		t.Errorf("second result = %v", b)
	}
	tools, _ := body["tools"].([]any)
	if len(tools) != 1 || tools[0].(map[string]any)["strict"] != true {
		t.Errorf("tools = %v", body["tools"])
	}
	if choice, _ := body["tool_choice"].(map[string]any); choice["type"] != "auto" {
		t.Errorf("tool_choice = %v, want auto: the model must be free to answer", body["tool_choice"])
	}
	if thinking, _ := body["thinking"].(map[string]any); thinking["type"] != "disabled" {
		t.Errorf("thinking = %v", body["thinking"])
	}
	if effort := body["output_config"].(map[string]any)["effort"]; effort != "low" || body["max_tokens"] != float64(512) {
		t.Errorf("effort = %v, max_tokens = %v", effort, body["max_tokens"])
	}
}

func TestConverseWithoutToolsSendsNoToolChoice(t *testing.T) {
	client, _, got, _ := fakeAPI(t, http.StatusOK, toolMessage("end_turn", map[string]any{"type": "text", "text": "hi"}), 0)
	conv := chat
	conv.Tools = nil
	if _, _, err := client.Converse(context.Background(), conv); err != nil {
		t.Fatal(err)
	}
	if _, ok := (*got)["tool_choice"]; ok {
		t.Errorf("tool_choice sent without tools: %v", (*got)["tool_choice"])
	}
}

func TestAnUnusableTurnIsInvalidButStillReportsItsUsage(t *testing.T) {
	for name, body := range map[string]string{
		"max_tokens":       toolMessage("max_tokens", map[string]any{"type": "text", "text": "cut o"}),
		"refusal":          toolMessage("refusal"),
		"pause_turn":       toolMessage("pause_turn"),
		"end_turn no text": toolMessage("end_turn", map[string]any{"type": "thinking", "thinking": "", "signature": "s"}),
		"end_turn empty":   toolMessage("end_turn", map[string]any{"type": "text", "text": ""}),
		"tool_use no uses": toolMessage("tool_use", map[string]any{"type": "text", "text": "let me look"}),
	} {
		client, _, _, _ := fakeAPI(t, http.StatusOK, body, 0)
		_, usage, err := client.Converse(context.Background(), chat)
		if !errors.Is(err, llmalloc.ErrInvalidResponse) || usage == nil || usage.InputTokens != 7 || usage.OutputTokens != 3 {
			t.Errorf("%s: err = %v, usage = %+v", name, err, usage)
		}
	}
}

func TestConverseFailsOnAServerErrorWithoutUsageOrRetry(t *testing.T) {
	client, calls, _, _ := fakeAPI(t, http.StatusInternalServerError, `{"type":"error","error":{"type":"x","message":"no"}}`, 0)
	_, usage, err := client.Converse(context.Background(), chat)
	if err == nil || errors.Is(err, llmalloc.ErrInvalidResponse) || usage != nil || calls.Load() != 1 {
		t.Fatalf("err = %v, usage = %+v, calls = %d", err, usage, calls.Load())
	}
}

func TestConverseStopsAtTheDeadline(t *testing.T) {
	client, _, _, _ := fakeAPI(t, http.StatusOK, toolMessage("end_turn", map[string]any{"type": "text", "text": "x"}), 5*time.Second)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	_, usage, err := client.Converse(ctx, chat)
	if !errors.Is(err, context.DeadlineExceeded) || usage != nil {
		t.Fatalf("err = %v, usage = %+v", err, usage)
	}
}

func TestConverseLogsTokenCountsButNeitherTextNorToolInput(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })
	client, _, _, _ := fakeAPI(t, http.StatusOK, toolMessage("tool_use", idToolUse("toolu_a", "create_chore", `{"title":"hidden title"}`)), 0)

	if _, _, err := client.Converse(context.Background(), chat); err != nil {
		t.Fatal(err)
	}
	var line map[string]any
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil {
		t.Fatalf("log = %q: %v", buf.String(), err)
	}
	if line["msg"] != "llm_usage" || line["input_tokens"] != float64(7) || line["output_tokens"] != float64(3) ||
		line["stop_reason"] != "tool_use" {
		t.Fatalf("log line = %v", line)
	}
	for _, secret := range []string{"hidden title", "secret question", "create_chore"} {
		if strings.Contains(buf.String(), secret) {
			t.Fatalf("the log line holds %q: %s", secret, buf.String())
		}
	}
}
