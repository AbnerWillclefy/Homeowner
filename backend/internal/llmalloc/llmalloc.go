// Package llmalloc is the LLM allocator (ADR 0004): it asks a language model
// for a Day Plan and turns the answer into an allocation.Result. It does I/O,
// so it lives outside the pure allocation package, and it is never trusted:
// the caller referees every proposal with allocation.Check and falls back to
// the baseline when it fails.
//
// The model sees opaque ids, numbers and fixed vocabulary only, never names,
// emails, Chore titles or any text a User typed. This keeps personal data out
// of a third party and leaves nothing to inject a prompt through.
package llmalloc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// ErrInvalidResponse is an answer that is not a well-formed plan: not JSON,
// an unknown field or reason, a missing list, or too large.
var ErrInvalidResponse = errors.New("llm: invalid response")

// maxAnswerBytes bounds the answer we are willing to decode.
const maxAnswerBytes = 64 << 10

// Request is one call to the model.
type Request struct {
	// System holds the static rules.
	System string
	// User is the day's state as JSON.
	User string
	// Schema is the JSON Schema the answer must follow.
	Schema map[string]any
	// MaxTokens bounds the answer.
	MaxTokens int
}

// Client sends a Request to a model and returns its structured answer, the
// JSON object that follows Request.Schema. It must honour ctx's deadline.
type Client interface {
	Complete(ctx context.Context, req Request) (json.RawMessage, error)
}

// Allocator proposes Day Plans through a Client.
type Allocator struct {
	client Client
}

// New returns an Allocator that asks client.
func New(client Client) *Allocator { return &Allocator{client: client} }

// Name goes in the run record of every plan this Allocator makes.
func (a *Allocator) Name() string { return "llm" }

// Propose asks the model for a Day Plan. Errors from the client are returned
// as they are (a deadline stays context.DeadlineExceeded); an answer that is
// not a well-formed plan is ErrInvalidResponse. A well-formed plan may still
// break every rule: only allocation.Check decides.
func (a *Allocator) Propose(ctx context.Context, st allocation.State) (allocation.Result, error) {
	user, err := json.Marshal(inputOf(st))
	if err != nil {
		return allocation.Result{}, fmt.Errorf("llm: build prompt: %w", err)
	}
	raw, err := a.client.Complete(ctx, Request{
		System:    systemPrompt,
		User:      string(user),
		Schema:    schema,
		MaxTokens: 256 + 128*len(st.Tasks),
	})
	if err != nil {
		return allocation.Result{}, err
	}
	return decode(raw, st)
}

// AssignmentReasons and PoolReasons are the only reasons the model may give.
var (
	AssignmentReasons = []allocation.Reason{
		allocation.ReasonDeadlineToday, allocation.ReasonImportance, allocation.ReasonLateness,
		allocation.ReasonFitsEnergy, allocation.ReasonLiked, allocation.ReasonSparedDislike, allocation.ReasonTurnTaking,
	}
	PoolReasons = []allocation.Reason{
		allocation.ReasonNoEnergyLeft, allocation.ReasonRestrictedForAll,
		allocation.ReasonTwoPersonDeferred, allocation.ReasonWeekdayNotAllowed,
	}
)

const systemPrompt = `You plan today's household chores for one Home.

The user message is JSON: today's date and weekday (0 = Sunday), the Residents and the open Tasks.
Assign Tasks to Residents and leave the rest in the pool. Hard rules, never break them:
- The total effort of a Resident's Tasks must not exceed their energy.
- Never give a Task whose demands include one of the Resident's restricted_demands, or whose chore_id is in their restricted_chores.
- Never give a Task on a weekday not in its allowed_weekdays (empty means any day).
- A Task with people 2 goes to exactly two different Residents, each paying its full effort, and appears once per Resident. Otherwise it stays in the pool.
- Give each Task to at most one Resident (two for people 2). Use only ids from the input.

Priorities, in order: Tasks whose window_end is today or earlier, then importance (essential, normal, nice_to_have), then the oldest window_start.
Among Residents who may take a Task: prefer one who likes its chore, spare one who dislikes it, and when all dislike it, give it to whoever did it longest ago (last_done; absent means never).

Give one reason per assignment and per pooled Task, from the allowed values only.`

var schema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"assignments", "pool"},
	"properties": map[string]any{
		"assignments": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"task_id", "resident_id", "reason"},
				"properties": map[string]any{
					"task_id":     map[string]any{"type": "string"},
					"resident_id": map[string]any{"type": "string"},
					"reason":      map[string]any{"type": "string", "enum": AssignmentReasons},
				},
			},
		},
		"pool": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"task_id", "reason"},
				"properties": map[string]any{
					"task_id": map[string]any{"type": "string"},
					"reason":  map[string]any{"type": "string", "enum": PoolReasons},
				},
			},
		},
	},
}

// input is what the model sees: ids, numbers and fixed vocabulary only.
type input struct {
	Today     string          `json:"today"`
	Weekday   int             `json:"weekday"`
	Residents []residentInput `json:"residents"`
	Tasks     []taskInput     `json:"tasks"`
}

type residentInput struct {
	ID                string              `json:"id"`
	Energy            int                 `json:"energy"`
	RestrictedDemands []allocation.Demand `json:"restricted_demands,omitempty"`
	RestrictedChores  []string            `json:"restricted_chores,omitempty"`
	Preferences       map[string]string   `json:"preferences,omitempty"`
	LastDone          map[string]string   `json:"last_done,omitempty"`
}

type taskInput struct {
	ID              string                `json:"id"`
	ChoreID         string                `json:"chore_id"`
	Effort          int                   `json:"effort"`
	Importance      allocation.Importance `json:"importance"`
	Demands         []allocation.Demand   `json:"demands,omitempty"`
	People          int                   `json:"people"`
	WindowStart     string                `json:"window_start"`
	WindowEnd       string                `json:"window_end"`
	AllowedWeekdays []int                 `json:"allowed_weekdays,omitempty"`
}

func inputOf(st allocation.State) input {
	in := input{Today: day(st.Today), Weekday: st.Today.Weekday(),
		Residents: []residentInput{}, Tasks: []taskInput{}}
	for _, r := range st.Residents {
		ri := residentInput{ID: r.ID, Energy: r.Energy, RestrictedDemands: r.DemandRestrictions, RestrictedChores: r.ChoreRestrictions}
		for chore, p := range r.Preferences {
			if p == allocation.Neutral {
				continue
			}
			if ri.Preferences == nil {
				ri.Preferences = map[string]string{}
			}
			ri.Preferences[chore] = map[allocation.Preference]string{allocation.Like: "like", allocation.Dislike: "dislike"}[p]
		}
		for chore, d := range r.LastDone {
			if ri.LastDone == nil {
				ri.LastDone = map[string]string{}
			}
			ri.LastDone[chore] = day(d)
		}
		in.Residents = append(in.Residents, ri)
	}
	for _, t := range st.Tasks {
		in.Tasks = append(in.Tasks, taskInput{ID: t.ID, ChoreID: t.ChoreID, Effort: t.Effort, Importance: t.Importance,
			Demands: t.Demands, People: t.People, WindowStart: day(t.WindowStart), WindowEnd: day(t.WindowEnd),
			AllowedWeekdays: t.AllowedWeekdays})
	}
	return in
}

func day(d allocation.Date) string { return d.Time().Format(time.DateOnly) }

// answer is the shape the schema asks for. The lists are pointers so a
// missing one is told apart from an empty one.
type answer struct {
	Assignments *[]struct {
		TaskID     string            `json:"task_id"`
		ResidentID string            `json:"resident_id"`
		Reason     allocation.Reason `json:"reason"`
	} `json:"assignments"`
	Pool *[]struct {
		TaskID string            `json:"task_id"`
		Reason allocation.Reason `json:"reason"`
	} `json:"pool"`
}

// decode reads the model's answer strictly and builds a complete Result: the
// assignments as given (Check judges them, duplicates included), and every
// other Task of st in the pool, with the model's reason when it gave one and
// no_energy_left when it left the Task out.
func decode(raw json.RawMessage, st allocation.State) (allocation.Result, error) {
	if len(raw) > maxAnswerBytes {
		return allocation.Result{}, fmt.Errorf("%w: %d bytes", ErrInvalidResponse, len(raw))
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var a answer
	if err := dec.Decode(&a); err != nil {
		return allocation.Result{}, fmt.Errorf("%w: %v", ErrInvalidResponse, err)
	}
	if err := dec.Decode(&json.RawMessage{}); err != io.EOF {
		return allocation.Result{}, fmt.Errorf("%w: data after the answer", ErrInvalidResponse)
	}
	if a.Assignments == nil || a.Pool == nil {
		return allocation.Result{}, fmt.Errorf("%w: assignments and pool are required", ErrInvalidResponse)
	}

	res := allocation.Result{DayPlan: allocation.DayPlan{Assignments: []allocation.Assignment{}}}
	assigned := map[string]bool{}
	for _, as := range *a.Assignments {
		if as.TaskID == "" || as.ResidentID == "" || !slices.Contains(AssignmentReasons, as.Reason) {
			return allocation.Result{}, fmt.Errorf("%w: bad assignment %+v", ErrInvalidResponse, as)
		}
		res.DayPlan.Assignments = append(res.DayPlan.Assignments,
			allocation.Assignment{TaskID: as.TaskID, ResidentID: as.ResidentID, Reason: as.Reason})
		assigned[as.TaskID] = true
	}
	pooled := map[string]allocation.Reason{}
	for _, p := range *a.Pool {
		if p.TaskID == "" || !slices.Contains(PoolReasons, p.Reason) {
			return allocation.Result{}, fmt.Errorf("%w: bad pool entry %+v", ErrInvalidResponse, p)
		}
		pooled[p.TaskID] = p.Reason
	}
	for _, t := range st.Tasks {
		if assigned[t.ID] {
			continue
		}
		reason, ok := pooled[t.ID]
		if !ok {
			reason = allocation.ReasonNoEnergyLeft
		}
		res.Pool = append(res.Pool, allocation.PoolEntry{TaskID: t.ID, Reason: reason})
	}
	return res, nil
}
