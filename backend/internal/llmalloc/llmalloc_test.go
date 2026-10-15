package llmalloc_test

import (
	"context"
	"encoding/json"
	"errors"
	"go/ast"
	"go/parser"
	"go/token"
	"maps"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

func state() allocation.State {
	return allocation.State{
		Today: allocation.NewDate(2026, 10, 15),
		Residents: []allocation.Resident{
			{ID: "r1", Energy: 5, DemandRestrictions: []allocation.Demand{"heights"}, ChoreRestrictions: []string{"c3"},
				Preferences: map[string]allocation.Preference{"c1": allocation.Like},
				LastDone:    map[string]allocation.Date{"c2": allocation.NewDate(2026, 10, 1)}},
			{ID: "r2", Energy: 3},
		},
		Tasks: []allocation.Task{
			{ID: "t1", ChoreID: "c1", Effort: 2, Importance: allocation.Essential, People: 1,
				WindowStart: allocation.NewDate(2026, 10, 14), WindowEnd: allocation.NewDate(2026, 10, 15), AllowedWeekdays: []int{4}},
			{ID: "t2", ChoreID: "c2", Effort: 1, Importance: allocation.Normal, People: 2, Demands: []allocation.Demand{"heavy_lifting"}},
			{ID: "t3", ChoreID: "c3", Effort: 3, Importance: allocation.NiceToHave, People: 1},
		},
	}
}

func propose(t *testing.T, answer string) (allocation.Result, error) {
	t.Helper()
	fake := llmalloc.NewFakeClient()
	fake.Answer(answer)
	return llmalloc.New(fake).Propose(context.Background(), state())
}

func TestAGoodAnswerBecomesAResult(t *testing.T) {
	res, err := propose(t, `{
		"assignments": [
			{"task_id": "t1", "resident_id": "r1", "reason": "liked"},
			{"task_id": "t2", "resident_id": "r1", "reason": "importance"},
			{"task_id": "t2", "resident_id": "r2", "reason": "importance"}
		],
		"pool": [{"task_id": "t3", "reason": "restricted_for_all"}]
	}`)
	if err != nil {
		t.Fatal(err)
	}
	want := allocation.Result{
		DayPlan: allocation.DayPlan{Assignments: []allocation.Assignment{
			{TaskID: "t1", ResidentID: "r1", Reason: allocation.ReasonLiked},
			{TaskID: "t2", ResidentID: "r1", Reason: allocation.ReasonImportance},
			{TaskID: "t2", ResidentID: "r2", Reason: allocation.ReasonImportance},
		}},
		Pool: []allocation.PoolEntry{{TaskID: "t3", Reason: allocation.ReasonRestrictedForAll}},
	}
	if !reflect.DeepEqual(res, want) {
		t.Fatalf("result = %+v\nwant     %+v", res, want)
	}
}

func TestATaskLeftOutLandsInThePool(t *testing.T) {
	res, err := propose(t, `{"assignments": [{"task_id": "t1", "resident_id": "r1", "reason": "fits_energy"}], "pool": []}`)
	if err != nil {
		t.Fatal(err)
	}
	want := []allocation.PoolEntry{
		{TaskID: "t2", Reason: allocation.ReasonNoEnergyLeft},
		{TaskID: "t3", Reason: allocation.ReasonNoEnergyLeft},
	}
	if !reflect.DeepEqual(res.Pool, want) {
		t.Fatalf("pool = %+v, want %+v", res.Pool, want)
	}
}

func TestBadAnswersAreAnInvalidResponse(t *testing.T) {
	for name, answer := range map[string]string{
		"empty":                     ``,
		"not json":                  `the plan is: t1 to r1`,
		"missing assignments":       `{"pool": []}`,
		"missing pool":              `{"assignments": []}`,
		"unknown field":             `{"assignments": [], "pool": [], "note": "trust me"}`,
		"unknown field in an entry": `{"assignments": [{"task_id": "t1", "resident_id": "r1", "reason": "liked", "why": "x"}], "pool": []}`,
		"unknown reason":            `{"assignments": [{"task_id": "t1", "resident_id": "r1", "reason": "vibes"}], "pool": []}`,
		"pool reason on assignment": `{"assignments": [{"task_id": "t1", "resident_id": "r1", "reason": "no_energy_left"}], "pool": []}`,
		"assignment reason in pool": `{"assignments": [], "pool": [{"task_id": "t1", "reason": "liked"}]}`,
		"empty task id":             `{"assignments": [{"task_id": "", "resident_id": "r1", "reason": "liked"}], "pool": []}`,
		"trailing data":             `{"assignments": [], "pool": []} {"assignments": [], "pool": []}`,
		"oversized":                 `{"assignments": [], "pool": [], "x": "` + strings.Repeat("a", 70_000) + `"}`,
	} {
		_, err := propose(t, answer)
		if !errors.Is(err, llmalloc.ErrInvalidResponse) {
			t.Errorf("%s: want ErrInvalidResponse, got %v", name, err)
		}
	}
}

func TestClientErrorsPassThrough(t *testing.T) {
	fake := llmalloc.NewFakeClient()
	fake.Fail(context.DeadlineExceeded)
	_, err := llmalloc.New(fake).Propose(context.Background(), state())
	if !errors.Is(err, context.DeadlineExceeded) || errors.Is(err, llmalloc.ErrInvalidResponse) {
		t.Fatalf("want the client's error, got %v", err)
	}
}

func TestABlockedCallEndsWithItsContext(t *testing.T) {
	fake := llmalloc.NewFakeClient()
	fake.Block()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := llmalloc.New(fake).Propose(ctx, state()); !errors.Is(err, context.Canceled) {
		t.Fatalf("want context.Canceled, got %v", err)
	}
	if fake.Calls() != 1 {
		t.Fatalf("calls = %d, want 1", fake.Calls())
	}
}

// The model sees opaque ids, numbers and fixed vocabulary only: no names,
// emails, Chore titles or any text a User typed.
func TestThePromptHoldsOnlyIDsAndNumbers(t *testing.T) {
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"assignments": [], "pool": []}`)
	if _, err := llmalloc.New(fake).Propose(context.Background(), state()); err != nil {
		t.Fatal(err)
	}
	var input any
	if err := json.Unmarshal([]byte(fake.LastRequest().User), &input); err != nil {
		t.Fatalf("user prompt is not JSON: %v", err)
	}
	keys := map[string]bool{}
	collectKeys(input, keys)
	want := []string{
		"today", "weekday", "residents", "tasks",
		"id", "energy", "restricted_demands", "restricted_chores", "preferences", "last_done",
		"chore_id", "effort", "importance", "demands", "people", "window_start", "window_end", "allowed_weekdays",
		"c1", "c2", // map keys: Chore ids
	}
	got := slices.Sorted(maps.Keys(keys))
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Fatalf("prompt keys = %v\nwant          %v", got, want)
	}
}

func collectKeys(v any, into map[string]bool) {
	switch v := v.(type) {
	case map[string]any:
		for k, child := range v {
			into[k] = true
			collectKeys(child, into)
		}
	case []any:
		for _, child := range v {
			collectKeys(child, into)
		}
	}
}

// Every Reason the allocation package declares is offered to the model,
// except invalid_effort, which only the code may give. Parsing the source
// catches a new Reason added there and forgotten here.
func TestTheSchemaOffersEveryAllocationReason(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "../allocation/types.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	var declared []string
	ast.Inspect(file, func(n ast.Node) bool {
		if spec, ok := n.(*ast.ValueSpec); ok {
			if id, ok := spec.Type.(*ast.Ident); ok && id.Name == "Reason" {
				for _, v := range spec.Values {
					declared = append(declared, strings.Trim(v.(*ast.BasicLit).Value, `"`))
				}
			}
		}
		return true
	})
	declared = slices.DeleteFunc(declared, func(r string) bool { return r == string(allocation.ReasonInvalidEffort) })

	var offered []string
	for _, r := range slices.Concat(llmalloc.AssignmentReasons, llmalloc.PoolReasons) {
		offered = append(offered, string(r))
	}
	slices.Sort(declared)
	slices.Sort(offered)
	if !slices.Equal(declared, offered) {
		t.Fatalf("schema reasons = %v\nallocation     = %v", offered, declared)
	}
}
