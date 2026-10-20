package llmalloc_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

const testKey = "sk-ant-secret-test-key"

var request = llmalloc.Request{
	System:    "rules",
	User:      `{"today":"2026-10-15"}`,
	Schema:    map[string]any{"type": "object", "additionalProperties": false},
	MaxTokens: 640,
}

// fakeAPI answers every Messages API call with status and body, and records
// the requests it saw.
func fakeAPI(t *testing.T, status int, body string, delay time.Duration) (*llmalloc.Anthropic, *atomic.Int32, *map[string]any, *http.Header) {
	t.Helper()
	var calls atomic.Int32
	var got map[string]any
	var header http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		header = r.Header.Clone()
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &got)
		select {
		case <-time.After(delay):
		case <-r.Context().Done():
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(srv.Close)
	return llmalloc.NewAnthropic(testKey, "claude-haiku-5-5", option.WithBaseURL(srv.URL)), &calls, &got, &header
}

func message(stopReason, text string) string {
	b, _ := json.Marshal(map[string]any{
		"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-haiku-5-5",
		"content":     []map[string]any{{"type": "text", "text": text}},
		"stop_reason": stopReason,
		"usage":       map[string]any{"input_tokens": 10, "output_tokens": 5},
	})
	return string(b)
}

func TestTheAnthropicClientReturnsTheStructuredAnswer(t *testing.T) {
	client, calls, got, header := fakeAPI(t, http.StatusOK, message("end_turn", `{"assignments": [], "pool": []}`), 0)

	raw, err := client.Complete(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != `{"assignments": [], "pool": []}` {
		t.Fatalf("answer = %s", raw)
	}
	if calls.Load() != 1 || header.Get("X-Api-Key") != testKey {
		t.Fatalf("calls = %d, key header set = %v", calls.Load(), header.Get("X-Api-Key") == testKey)
	}
	body := *got
	format, _ := body["output_config"].(map[string]any)["format"].(map[string]any)
	if body["model"] != "claude-haiku-5-5" || body["max_tokens"] != float64(640) ||
		format["type"] != "json_schema" || format["schema"] == nil {
		t.Fatalf("request body = %v", body)
	}
	if _, ok := body["temperature"]; ok {
		t.Errorf("temperature must not be sent: Haiku 5.5 rejects non-default sampling")
	}
}

func TestTheAnthropicClientFailsWithoutRetrying(t *testing.T) {
	for name, status := range map[string]int{"rate limited": http.StatusTooManyRequests, "server error": http.StatusInternalServerError} {
		client, calls, _, _ := fakeAPI(t, status, `{"type":"error","error":{"type":"x","message":"no"}}`, 0)
		_, err := client.Complete(context.Background(), request)
		if err == nil || errors.Is(err, llmalloc.ErrInvalidResponse) {
			t.Errorf("%s: want a client error, got %v", name, err)
		}
		if calls.Load() != 1 {
			t.Errorf("%s: %d calls, want 1: the timeout is ours, no retries", name, calls.Load())
		}
		if err != nil && strings.Contains(err.Error(), testKey) {
			t.Errorf("%s: the error leaks the key: %v", name, err)
		}
	}
}

func TestTheAnthropicClientStopsAtTheDeadline(t *testing.T) {
	client, _, _, _ := fakeAPI(t, http.StatusOK, message("end_turn", `{}`), 5*time.Second)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := client.Complete(ctx, request)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("want context.DeadlineExceeded, got %v", err)
	}
	if time.Since(start) > time.Second {
		t.Fatalf("took %s, want to stop at the deadline", time.Since(start))
	}
}

func messageWith(content []map[string]any, usage map[string]any) string {
	b, _ := json.Marshal(map[string]any{
		"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-haiku-5-5",
		"content": content, "stop_reason": "end_turn", "usage": usage,
	})
	return string(b)
}

func TestAThinkingRequestAsksForAdaptiveThinkingAtLowEffort(t *testing.T) {
	client, _, got, _ := fakeAPI(t, http.StatusOK, message("end_turn", `{}`), 0)
	req := request
	req.Thinking = true
	req.MaxTokens = 4224

	if _, err := client.Complete(context.Background(), req); err != nil {
		t.Fatal(err)
	}
	body := *got
	thinking, _ := body["thinking"].(map[string]any)
	effort := body["output_config"].(map[string]any)["effort"]
	if thinking["type"] != "adaptive" || thinking["display"] != "omitted" || effort != "low" || body["max_tokens"] != float64(4224) {
		t.Fatalf("thinking = %v, effort = %v, max_tokens = %v", thinking, effort, body["max_tokens"])
	}
	if _, ok := thinking["budget_tokens"]; ok {
		t.Error("adaptive thinking takes no budget_tokens")
	}
}

func TestARequestWithoutThinkingKeepsItOff(t *testing.T) {
	client, _, got, _ := fakeAPI(t, http.StatusOK, message("end_turn", `{}`), 0)
	if _, err := client.Complete(context.Background(), request); err != nil {
		t.Fatal(err)
	}
	if thinking, _ := (*got)["thinking"].(map[string]any); thinking["type"] != "disabled" {
		t.Fatalf("thinking = %v, want disabled", thinking)
	}
}

func TestAThinkingBlockBeforeTheTextIsSkipped(t *testing.T) {
	body := messageWith([]map[string]any{
		{"type": "thinking", "thinking": "", "signature": "sig"},
		{"type": "text", "text": `{"assignments": [], "pool": []}`},
	}, map[string]any{"input_tokens": 10, "output_tokens": 5})
	client, _, _, _ := fakeAPI(t, http.StatusOK, body, 0)

	raw, err := client.Complete(context.Background(), request)
	if err != nil || string(raw) != `{"assignments": [], "pool": []}` {
		t.Fatalf("answer = %s, err = %v", raw, err)
	}
}

func TestAThinkingBlockWithoutTextIsInvalid(t *testing.T) {
	body := messageWith([]map[string]any{{"type": "thinking", "thinking": "", "signature": "sig"}},
		map[string]any{"input_tokens": 10, "output_tokens": 5})
	client, _, _, _ := fakeAPI(t, http.StatusOK, body, 0)
	if _, err := client.Complete(context.Background(), request); !errors.Is(err, llmalloc.ErrInvalidResponse) {
		t.Fatalf("want ErrInvalidResponse, got %v", err)
	}
}

func TestEveryCallLogsItsTokenUsageAndNothingElse(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })
	body := messageWith([]map[string]any{{"type": "text", "text": `{}`}},
		map[string]any{"input_tokens": 321, "output_tokens": 1234})
	client, _, _, _ := fakeAPI(t, http.StatusOK, body, 0)

	if _, err := client.Complete(context.Background(), request); err != nil {
		t.Fatal(err)
	}
	var line map[string]any
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil {
		t.Fatalf("log = %q: %v", buf.String(), err)
	}
	if line["msg"] != "llm_usage" || line["input_tokens"] != float64(321) || line["output_tokens"] != float64(1234) ||
		line["model"] != "claude-haiku-5-5" {
		t.Fatalf("log line = %v", line)
	}
	if strings.Contains(buf.String(), request.User) || strings.Contains(buf.String(), request.System) {
		t.Fatalf("the log line holds prompt text: %s", buf.String())
	}
}

func TestAnUnfinishedAnswerIsInvalid(t *testing.T) {
	for _, stop := range []string{"max_tokens", "refusal"} {
		client, _, _, _ := fakeAPI(t, http.StatusOK, message(stop, `{"assignments": [`), 0)
		if _, err := client.Complete(context.Background(), request); !errors.Is(err, llmalloc.ErrInvalidResponse) {
			t.Errorf("%s: want ErrInvalidResponse, got %v", stop, err)
		}
	}
}
