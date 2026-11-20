package llmalloc_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestTheScriptedClientPlaysAToolRoundThenAnAnswer(t *testing.T) {
	fake := llmalloc.NewScriptedClient()
	fake.ToolRound(llmalloc.ToolUse{Name: "create_chore", Input: json.RawMessage(`{"title":"a"}`)},
		llmalloc.ToolUse{Name: "create_chore", Input: json.RawMessage(`{"title":"b"}`)})
	fake.ToolRound(llmalloc.ToolUse{Name: "create_chore", Input: json.RawMessage(`{"title":"c"}`)})
	fake.Answer("all done")

	turn, usage, err := fake.Converse(context.Background(), chat)
	if err != nil || len(turn.ToolUses) != 2 || turn.ToolUses[0].ID != "toolu_1" || turn.ToolUses[1].ID != "toolu_2" ||
		turn.Text != "" || usage == nil || usage.Model != config.DefaultLLMModel {
		t.Fatalf("turn = %+v, usage = %+v, err = %v", turn, usage, err)
	}
	second := chat
	second.Messages = append(append([]llmalloc.Message{}, chat.Messages...),
		llmalloc.Message{Role: llmalloc.RoleAssistant, ToolUses: turn.ToolUses},
		llmalloc.Message{Role: llmalloc.RoleUser, ToolResults: []llmalloc.ToolResult{{ToolUseID: "toolu_1", Content: `{"ok":true}`}}})
	turn, _, err = fake.Converse(context.Background(), second)
	if err != nil || len(turn.ToolUses) != 1 || turn.ToolUses[0].ID != "toolu_3" {
		t.Fatalf("second round = %+v, err = %v", turn, err)
	}
	turn, _, err = fake.Converse(context.Background(), second)
	if err != nil || turn.Text != "all done" || len(turn.ToolUses) != 0 {
		t.Fatalf("answer = %+v, err = %v", turn, err)
	}

	reqs := fake.Requests()
	if fake.Calls() != 3 || len(reqs) != 3 {
		t.Fatalf("calls = %d, requests = %d", fake.Calls(), len(reqs))
	}
	got := reqs[1].Messages[2].ToolResults
	if len(got) != 1 || got[0].ToolUseID != "toolu_1" || got[0].Content != `{"ok":true}` {
		t.Fatalf("the second request lacks the tool result: %+v", reqs[1].Messages)
	}
	if !reflect.DeepEqual(reqs[0], chat) {
		t.Fatalf("first request = %+v", reqs[0])
	}
}

func TestTheScriptedClientRecordsCopiesOfWhatItReceived(t *testing.T) {
	fake := llmalloc.NewScriptedClient()
	fake.Answer("x")
	conv := chat
	conv.Messages = []llmalloc.Message{{Role: llmalloc.RoleUser, Text: "before"}}
	if _, _, err := fake.Converse(context.Background(), conv); err != nil {
		t.Fatal(err)
	}
	conv.Messages[0].Text = "after"
	if got := fake.Requests()[0].Messages[0].Text; got != "before" {
		t.Fatalf("recorded %q: the caller's later edit leaked in", got)
	}
}

func TestACallPastTheScriptFailsLoudly(t *testing.T) {
	fake := llmalloc.NewScriptedClient()
	fake.Answer("only")
	if _, _, err := fake.Converse(context.Background(), chat); err != nil {
		t.Fatal(err)
	}
	_, usage, err := fake.Converse(context.Background(), chat)
	if err == nil || usage != nil {
		t.Fatalf("err = %v, usage = %+v: the last step must not repeat", err, usage)
	}
	if fake.Calls() != 2 {
		t.Fatalf("calls = %d, want the failed call counted", fake.Calls())
	}
}

func TestTheScriptedClientFailsAndBlocksAsScripted(t *testing.T) {
	boom := errors.New("boom")
	fake := llmalloc.NewScriptedClient()
	fake.Fail(boom)
	fake.FailWithUsage(llmalloc.ErrInvalidResponse)
	fake.Block()

	if _, usage, err := fake.Converse(context.Background(), chat); !errors.Is(err, boom) || usage != nil {
		t.Fatalf("Fail: err = %v, usage = %+v", err, usage)
	}
	if _, usage, err := fake.Converse(context.Background(), chat); !errors.Is(err, llmalloc.ErrInvalidResponse) || usage == nil {
		t.Fatalf("FailWithUsage: err = %v, usage = %+v", err, usage)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if _, usage, err := fake.Converse(ctx, chat); !errors.Is(err, context.DeadlineExceeded) || usage != nil {
		t.Fatalf("Block: err = %v, usage = %+v", err, usage)
	}
}
