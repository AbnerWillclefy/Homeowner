package llmalloc_test

import (
	"context"
	"encoding/json"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

// sent decodes the tasks the model was shown in the last request.
func sent(t *testing.T, fake *llmalloc.FakeClient) map[string]map[string]any {
	t.Helper()
	var in struct {
		Tasks []map[string]any `json:"tasks"`
	}
	if err := json.Unmarshal([]byte(fake.LastRequest().User), &in); err != nil {
		t.Fatalf("user prompt is not JSON: %v", err)
	}
	out := map[string]map[string]any{}
	for _, tk := range in.Tasks {
		out[tk["id"].(string)] = tk
	}
	return out
}

func idsOf(v any) []string {
	var out []string
	for _, x := range v.([]any) {
		out = append(out, x.(string))
	}
	return out
}

func emptyAnswer() *llmalloc.FakeClient {
	fake := llmalloc.NewFakeClient()
	fake.Answer(`{"assignments": [], "pool": []}`)
	return fake
}

// A Task not allowed on today's weekday is decided in Go: it never reaches
// the model and lands in the pool as weekday_not_allowed.
func TestAWeekdayBlockedTaskIsPooledAndNotSent(t *testing.T) {
	st := state()
	st.Tasks[0].AllowedWeekdays = []int{(st.Today.Weekday() + 1) % 7}
	fake := emptyAnswer()

	res, _, _, err := llmalloc.New(fake).Propose(context.Background(), st)
	if err != nil {
		t.Fatal(err)
	}
	if _, in := sent(t, fake)["t1"]; in {
		t.Fatal("t1 is weekday-blocked and must not be sent to the model")
	}
	if !slices.Contains(res.Pool, allocation.PoolEntry{TaskID: "t1", Reason: allocation.ReasonWeekdayNotAllowed}) {
		t.Fatalf("pool = %+v, want t1 as weekday_not_allowed", res.Pool)
	}
}

// Each Task carries the Residents who may take it, computed in Go; the
// Restriction and weekday fields are gone from the prompt.
func TestEachTaskCarriesItsEligibleResidents(t *testing.T) {
	st := state() // r1 cannot do "heights" or chore c3
	st.Residents = append(st.Residents, allocation.Resident{ID: "a0", Energy: 2})
	st.Tasks[0].Demands = []allocation.Demand{"heights"} // t1: not r1
	fake := emptyAnswer()
	if _, _, _, err := llmalloc.New(fake).Propose(context.Background(), st); err != nil {
		t.Fatal(err)
	}
	got := sent(t, fake)
	want := map[string][]string{"t1": {"a0", "r2"}, "t2": {"a0", "r1", "r2"}}
	for id, ids := range want {
		if g := idsOf(got[id]["eligible"]); !slices.Equal(g, ids) {
			t.Errorf("%s eligible = %v, want %v", id, g, ids)
		}
	}
	if _, in := got["t3"]; !in {
		t.Error("t3 has eligible Residents and must be sent")
	}
	if g := idsOf(got["t3"]["eligible"]); !slices.Equal(g, []string{"a0", "r2"}) {
		t.Errorf("t3 eligible = %v", g)
	}
	for _, banned := range []string{"restricted_demands", "restricted_chores", "allowed_weekdays", `"demands"`} {
		if strings.Contains(fake.LastRequest().User, banned) {
			t.Errorf("prompt still holds %s", banned)
		}
	}
	for _, banned := range []string{"restricted", "allowed_weekdays"} {
		if strings.Contains(fake.LastRequest().System, banned) {
			t.Errorf("system prompt still mentions %s", banned)
		}
	}
	if !strings.Contains(fake.LastRequest().System, "eligible") {
		t.Error("system prompt must tell the model about eligible")
	}
}

func TestATaskNoOneCanTakeIsPooledInGo(t *testing.T) {
	st := state()
	st.Residents[1].ChoreRestrictions = []string{"c3"} // t3: nobody
	st.Residents[1].DemandRestrictions = []allocation.Demand{"heavy_lifting"}
	// t2 needs two people and only r1 is left eligible.
	fake := emptyAnswer()

	res, _, _, err := llmalloc.New(fake).Propose(context.Background(), st)
	if err != nil {
		t.Fatal(err)
	}
	got := sent(t, fake)
	if len(got) != 1 || got["t1"] == nil {
		t.Fatalf("sent tasks = %v, want only t1", got)
	}
	for _, id := range []string{"t2", "t3"} {
		if !slices.Contains(res.Pool, allocation.PoolEntry{TaskID: id, Reason: allocation.ReasonRestrictedForAll}) {
			t.Errorf("pool = %+v, want %s as restricted_for_all", res.Pool, id)
		}
	}
}

func TestWhenEveryTaskIsPooledInGoTheModelIsNotCalled(t *testing.T) {
	st := state()
	st.Residents = st.Residents[:1] // r1 only: t2 needs two, t3 restricted
	st.Tasks[0].AllowedWeekdays = []int{(st.Today.Weekday() + 1) % 7}
	fake := emptyAnswer()

	res, _, _, err := llmalloc.New(fake).Propose(context.Background(), st)
	if err != nil {
		t.Fatal(err)
	}
	if fake.Calls() != 0 {
		t.Fatalf("calls = %d, want 0", fake.Calls())
	}
	want := []allocation.PoolEntry{
		{TaskID: "t1", Reason: allocation.ReasonWeekdayNotAllowed},
		{TaskID: "t2", Reason: allocation.ReasonRestrictedForAll},
		{TaskID: "t3", Reason: allocation.ReasonRestrictedForAll},
	}
	if len(res.DayPlan.Assignments) != 0 || !reflect.DeepEqual(res.Pool, want) {
		t.Fatalf("result = %+v, want pool %+v", res, want)
	}
	if v := allocation.Check(res.DayPlan, st); len(v) != 0 {
		t.Fatalf("Check = %+v", v)
	}
}

// No call is told apart from a call that came back without usage.
func TestWhenNoCallIsMadeThereIsNoUsageAndCalledIsFalse(t *testing.T) {
	st := state()
	st.Residents = st.Residents[:1]
	st.Tasks[0].AllowedWeekdays = []int{(st.Today.Weekday() + 1) % 7}
	_, usage, called, err := llmalloc.New(emptyAnswer()).Propose(context.Background(), st)
	if err != nil || called || usage != nil {
		t.Fatalf("usage = %+v, called = %v, err = %v", usage, called, err)
	}
}

// The referee still decides: an answer that gives a Task to an ineligible
// Resident is kept as given and Check refuses it.
func TestAnAnswerForAnIneligibleResidentIsStillRefused(t *testing.T) {
	st := state()
	st.Tasks[0].AllowedWeekdays = []int{(st.Today.Weekday() + 1) % 7} // t1 blocked today
	res, err := proposeWithAnswer(t, st, `{"assignments": [
		{"task_id": "t1", "resident_id": "r1", "reason": "importance"},
		{"task_id": "t3", "resident_id": "r1", "reason": "importance"}
	], "pool": [{"task_id": "t1", "reason": "weekday_not_allowed"}]}`)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.DayPlan.Assignments) != 2 {
		t.Fatalf("assignments = %+v, want both kept as given", res.DayPlan.Assignments)
	}
	for _, p := range res.Pool {
		if p.TaskID == "t1" || p.TaskID == "t3" {
			t.Errorf("%s is assigned and must not also be pooled", p.TaskID)
		}
	}
	kinds := map[allocation.ViolationKind]bool{}
	for _, v := range allocation.Check(res.DayPlan, st) {
		kinds[v.Kind] = true
	}
	if !kinds[allocation.WeekdayNotAllowed] || !kinds[allocation.BrokenRestriction] {
		t.Fatalf("violations = %v, want weekday_not_allowed and broken_restriction", kinds)
	}
}

// Whatever mix of Go-pooled, model-assigned, model-pooled and omitted Tasks,
// the Result names every Task of the State once.
func TestEveryTaskAppearsOnce(t *testing.T) {
	st := state()
	st.Tasks[0].AllowedWeekdays = []int{(st.Today.Weekday() + 1) % 7} // t1: Go-pooled
	st.Tasks = append(st.Tasks,
		allocation.Task{ID: "t4", ChoreID: "c4", Effort: 1, Importance: allocation.Normal, People: 1},
		allocation.Task{ID: "t5", ChoreID: "c5", Effort: 1, Importance: allocation.Normal, People: 1},
	)
	for name, answer := range map[string]string{
		"model assigns, pools, omits": `{"assignments": [{"task_id": "t2", "resident_id": "r1", "reason": "importance"}, {"task_id": "t2", "resident_id": "r2", "reason": "importance"}],
			"pool": [{"task_id": "t4", "reason": "no_energy_left"}]}`,
		"model pools a Go-pooled task": `{"assignments": [], "pool": [{"task_id": "t1", "reason": "no_energy_left"}, {"task_id": "t2", "reason": "two_person_deferred"}]}`,
		"model assigns a Go-pooled task": `{"assignments": [{"task_id": "t1", "resident_id": "r2", "reason": "importance"}],
			"pool": [{"task_id": "t1", "reason": "no_energy_left"}]}`,
		"model says nothing": `{"assignments": [], "pool": []}`,
	} {
		res, err := proposeWithAnswer(t, st, answer)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		// A two-person Task has two assignments but counts once.
		assigned := map[string]bool{}
		seen := map[string]int{}
		for _, a := range res.DayPlan.Assignments {
			if !assigned[a.TaskID] {
				assigned[a.TaskID] = true
				seen[a.TaskID]++
			}
		}
		for _, p := range res.Pool {
			seen[p.TaskID]++
		}
		for _, tk := range st.Tasks {
			if seen[tk.ID] != 1 {
				t.Errorf("%s: %s appears %d times (result %+v)", name, tk.ID, seen[tk.ID], res)
			}
		}
		for _, p := range res.Pool {
			if p.TaskID == "t1" && !assigned["t1"] && p.Reason != allocation.ReasonWeekdayNotAllowed {
				t.Errorf("%s: t1 reason = %s, want the Go reason", name, p.Reason)
			}
		}
	}
}

func proposeWithAnswer(t *testing.T, st allocation.State, answer string) (allocation.Result, error) {
	t.Helper()
	fake := llmalloc.NewFakeClient()
	fake.Answer(answer)
	res, _, _, err := llmalloc.New(fake).Propose(context.Background(), st)
	return res, err
}

// No name, email, title or free text can reach the model: the State carries
// ids only, and the request is built from those fields.
func TestNoFreeTextReachesTheModel(t *testing.T) {
	st := state()
	st.Residents[0].ID = "res-1"
	fake := emptyAnswer()
	if _, _, _, err := llmalloc.New(fake).Propose(context.Background(), st); err != nil {
		t.Fatal(err)
	}
	for _, leak := range []string{"Alice", "alice@example.com", "Wash the dishes"} {
		if strings.Contains(fake.LastRequest().System+fake.LastRequest().User, leak) {
			t.Errorf("request contains %q", leak)
		}
	}
}

func TestTheAllocatorAsksForThinking(t *testing.T) {
	fake := emptyAnswer()
	if _, _, _, err := llmalloc.New(fake).Propose(context.Background(), state()); err != nil {
		t.Fatal(err)
	}
	if !fake.LastRequest().Thinking {
		t.Fatal("the allocator's request must turn adaptive thinking on")
	}
}

func TestMaxTokensLeavesRoomToThinkAndIsCapped(t *testing.T) {
	tasks := func(n int) allocation.State {
		st := state()
		st.Tasks = nil
		for i := range n {
			st.Tasks = append(st.Tasks, allocation.Task{ID: "x" + string(rune('a'+i%26)) + string(rune('a'+i/26)), ChoreID: "c", Effort: 1,
				Importance: allocation.Normal, People: 1})
		}
		return st
	}
	var prev int
	for _, n := range []int{1, 2, 10, 20, 32, 33, 100} {
		fake := emptyAnswer()
		if _, _, _, err := llmalloc.New(fake).Propose(context.Background(), tasks(n)); err != nil {
			t.Fatal(err)
		}
		got := fake.LastRequest().MaxTokens
		if got < 4096 || got > 8192 || got < prev {
			t.Errorf("n=%d: MaxTokens = %d, want within [4096, 8192] and not shrinking (prev %d)", n, got, prev)
		}
		prev = got
	}
	fake := emptyAnswer()
	_, _, _, _ = llmalloc.New(fake).Propose(context.Background(), tasks(1))
	one := fake.LastRequest().MaxTokens
	fake = emptyAnswer()
	_, _, _, _ = llmalloc.New(fake).Propose(context.Background(), tasks(2))
	if fake.LastRequest().MaxTokens != one+128 {
		t.Errorf("each Task adds 128 tokens: %d then %d", one, fake.LastRequest().MaxTokens)
	}
	if one != 4096+128 {
		t.Errorf("one Task = %d, want 4224", one)
	}
}
