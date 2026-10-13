package dayplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
)

// ReasonAddedAfterPlan is the pool reason of an open Task the day's run did not
// see, for example a Chore created after the Allocation time.
const ReasonAddedAfterPlan = "added_after_plan"

// TaskView is an open Task with the reason it was assigned or left in the pool.
// The reason is empty before the day is planned.
type TaskView struct {
	tasks.Open
	Reason string `json:"reason,omitempty"`
	// Committed: the Resident it is assigned to accepted it today. Always
	// false in the pool.
	Committed bool `json:"committed"`
	// With are the ids of the other Residents the Task is also given to: the
	// partner of a two-person Task. Absent for a one-person Task and in the
	// pool. A two-person Task is listed under each of its Residents.
	With []string `json:"with,omitempty"`
}

// ResidentTasks are the Tasks one Resident was given.
type ResidentTasks struct {
	ResidentID string     `json:"residentId"`
	Tasks      []TaskView `json:"tasks"`
}

// View is a Home's Day Plan for a local date, seen by one Resident.
type View struct {
	Date string `json:"date"`
	// Planned: today's run exists and produced a plan. Rejected: it exists but
	// the checker refused the proposal, so nothing is assigned today.
	Planned  bool `json:"planned"`
	Rejected bool `json:"rejected"`
	// Allocator names who made the plan; empty before the day is planned.
	Allocator string `json:"allocator"`
	// Energy is the caller's Energy the plan was made with; null before the
	// plan, and 0 when they have no Baseline for the weekday.
	Energy *int `json:"energy"`
	// Mine are the caller's Tasks; Others only lists Residents with Tasks.
	Mine   []TaskView      `json:"mine"`
	Others []ResidentTasks `json:"others"`
	// Pool is every open Task that is not assigned today.
	Pool []TaskView `json:"pool"`
	// DoneToday are the Tasks the caller completed on the Home's date, oldest
	// first. Never null.
	DoneToday []DoneView `json:"doneToday"`
	// Swaps are the live Swap offers the caller is part of. Never null.
	Swaps Swaps `json:"swaps"`
}

// Swaps are the caller's live Swap offers: those made to them and by them.
type Swaps struct {
	Incoming []SwapView `json:"incoming"`
	Outgoing []SwapView `json:"outgoing"`
}

// SwapView is one live offer. Offered is the Task the offerer gives and
// Requested the one they want; ResidentID is the other Resident, the offerer
// of an incoming offer and the recipient of an outgoing one.
type SwapView struct {
	ID         string     `json:"id"`
	ResidentID string     `json:"residentId"`
	Offered    tasks.Open `json:"offered"`
	Requested  tasks.Open `json:"requested"`
}

// DoneView is a Task the caller completed today.
type DoneView struct {
	ID          string    `json:"id"`
	ChoreID     string    `json:"choreId"`
	ChoreName   string    `json:"choreName"`
	Category    string    `json:"category"`
	Effort      int       `json:"currentEffort"`
	CompletedAt time.Time `json:"completedAt"`
}

// Store reads the stored Day Plan.
type Store struct {
	db    *pgxpool.Pool
	tasks *tasks.Store
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db, tasks: tasks.NewStore(db)} }

// given is one assignment of a Task: the Resident it went to and why.
type given struct{ resident, reason string }

// partnersOf are the other Residents holding the Task, sorted, so a two-person
// Task shows under each holder and names its partner.
func partnersOf(holders []given, self string) []string {
	var with []string
	for _, h := range holders {
		if h.resident != self {
			with = append(with, h.resident)
		}
	}
	slices.Sort(with)
	return with
}

// Today returns the Home's Day Plan for its local date at now, seen by the
// Resident. It only reads: it never plans and never refreshes the Tasks, so a
// plan cannot appear before the Allocation time. Yesterday's assignments are
// not today's, since runs are keyed by date, so a Task left undone is in
// today's pool until today's run assigns it.
func (s *Store) Today(ctx context.Context, homeID, timezone, residentID string, now time.Time) (View, error) {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return View{}, fmt.Errorf("day plan: timezone %q: %w", timezone, err)
	}
	date := allocation.DateOf(now.In(loc)).Time()
	v := View{Date: date.Format(time.DateOnly), Mine: []TaskView{}, Others: []ResidentTasks{}, Pool: []TaskView{},
		Swaps: Swaps{Incoming: []SwapView{}, Outgoing: []SwapView{}}}

	open, err := s.tasks.ListOpen(ctx, homeID)
	if err != nil {
		return View{}, err
	}
	if v.DoneToday, err = s.doneToday(ctx, residentID, date); err != nil {
		return View{}, err
	}

	var (
		runID, outcome string
		raw            []byte
	)
	err = s.db.QueryRow(ctx, `
		SELECT id, allocator, outcome, reasons FROM allocation_runs WHERE home_id = $1 AND plan_date = $2`,
		homeID, date).Scan(&runID, &v.Allocator, &outcome, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		for _, o := range open {
			v.Pool = append(v.Pool, TaskView{Open: o})
		}
		return v, nil
	}
	if err != nil {
		return View{}, fmt.Errorf("day plan: load run: %w", err)
	}
	v.Planned, v.Rejected = outcome == string(Planned), outcome == string(Rejected)

	var rs reasons
	if err := json.Unmarshal(raw, &rs); err != nil {
		return View{}, fmt.Errorf("day plan: read reasons: %w", err)
	}
	energy := rs.Energy[residentID]
	v.Energy = &energy
	poolReason := map[string]string{}
	for _, p := range rs.Pool {
		poolReason[p.TaskID] = p.Reason
	}

	rows, err := s.db.Query(ctx, `SELECT task_id, resident_id, reason FROM day_plan_assignments WHERE run_id = $1`, runID)
	if err != nil {
		return View{}, fmt.Errorf("day plan: load assignments: %w", err)
	}
	type row struct {
		task string
		given
	}
	assigned, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (x row, err error) {
		return x, r.Scan(&x.task, &x.resident, &x.reason)
	})
	if err != nil {
		return View{}, fmt.Errorf("day plan: load assignments: %w", err)
	}
	// A two-person Task has one assignment per Resident.
	by := map[string][]given{}
	for _, a := range assigned {
		by[a.task] = append(by[a.task], a.given)
	}
	committed, err := s.committedToday(ctx, homeID, date)
	if err != nil {
		return View{}, err
	}

	at := map[string]int{} // index in v.Others by Resident id, in first-seen order
	for _, o := range open {
		holders := by[o.ID]
		if len(holders) == 0 {
			// A rejected run stored no pool, so its Tasks have no reason.
			reason, known := poolReason[o.ID]
			if !known && v.Planned {
				reason = ReasonAddedAfterPlan
			}
			v.Pool = append(v.Pool, TaskView{Open: o, Reason: reason})
			continue
		}
		for _, g := range holders {
			tv := TaskView{Open: o, Reason: g.reason, Committed: committed[commitment{o.ID, g.resident}], With: partnersOf(holders, g.resident)}
			if g.resident == residentID {
				v.Mine = append(v.Mine, tv)
				continue
			}
			i, seen := at[g.resident]
			if !seen {
				i = len(v.Others)
				at[g.resident] = i
				v.Others = append(v.Others, ResidentTasks{ResidentID: g.resident, Tasks: []TaskView{}})
			}
			v.Others[i].Tasks = append(v.Others[i].Tasks, tv)
		}
	}
	if v.Swaps, err = s.liveSwaps(ctx, homeID, residentID, runID, date, open); err != nil {
		return View{}, err
	}
	return v, nil
}

// liveSwaps are the pending offers of the date the caller made or received and
// whose Tasks still sit where the offer assumed. Liveness is read from the
// assignments and the Tasks, not stored.
func (s *Store) liveSwaps(ctx context.Context, homeID, residentID, runID string, date time.Time, open []tasks.Open) (Swaps, error) {
	out := Swaps{Incoming: []SwapView{}, Outgoing: []SwapView{}}
	rows, err := s.db.Query(ctx, `
		SELECT o.id, o.from_resident_id, o.to_resident_id, o.offered_task_id, o.requested_task_id
		FROM swap_offers o
		JOIN day_plan_assignments x ON x.run_id = $3 AND x.task_id = o.offered_task_id AND x.resident_id = o.from_resident_id
		JOIN day_plan_assignments y ON y.run_id = $3 AND y.task_id = o.requested_task_id AND y.resident_id = o.to_resident_id
		JOIN tasks tx ON tx.id = o.offered_task_id AND tx.status = 'open'
		JOIN tasks ty ON ty.id = o.requested_task_id AND ty.status = 'open'
		WHERE o.home_id = $1 AND o.plan_date = $2 AND o.status = 'pending'
		  AND (o.from_resident_id = $4 OR o.to_resident_id = $4)
		ORDER BY o.created_at, o.id`, homeID, date, runID, residentID)
	if err != nil {
		return Swaps{}, fmt.Errorf("day plan: load swaps: %w", err)
	}
	type offer struct{ id, from, to, offered, requested string }
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (o offer, err error) {
		return o, r.Scan(&o.id, &o.from, &o.to, &o.offered, &o.requested)
	})
	if err != nil {
		return Swaps{}, fmt.Errorf("day plan: load swaps: %w", err)
	}
	byID := make(map[string]tasks.Open, len(open))
	for _, t := range open {
		byID[t.ID] = t
	}
	for _, o := range list {
		sv := SwapView{ID: o.id, Offered: byID[o.offered], Requested: byID[o.requested]}
		if o.to == residentID {
			sv.ResidentID = o.from
			out.Incoming = append(out.Incoming, sv)
		} else {
			sv.ResidentID = o.to
			out.Outgoing = append(out.Outgoing, sv)
		}
	}
	return out, nil
}

// doneToday is the Tasks the Resident completed on the date, oldest first.
func (s *Store) doneToday(ctx context.Context, residentID string, date time.Time) ([]DoneView, error) {
	rows, err := s.db.Query(ctx, `
		SELECT t.id, c.id, c.name, c.category, t.current_effort, k.completed_at
		FROM completions k
		JOIN completion_residents cr ON cr.completion_id = k.id
		JOIN tasks t ON t.id = k.task_id
		JOIN chores c ON c.id = t.chore_id
		WHERE cr.resident_id = $1 AND k.completed_on = $2
		ORDER BY k.completed_at, t.id`, residentID, date)
	if err != nil {
		return nil, fmt.Errorf("day plan: load completions: %w", err)
	}
	out, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (d DoneView, err error) {
		var effort int16
		if err := r.Scan(&d.ID, &d.ChoreID, &d.ChoreName, &d.Category, &effort, &d.CompletedAt); err != nil {
			return d, err
		}
		d.Effort = int(effort)
		return d, nil
	})
	if err != nil {
		return nil, fmt.Errorf("day plan: load completions: %w", err)
	}
	if out == nil {
		out = []DoneView{}
	}
	return out, nil
}

// commitment is a Resident's promise of a Task.
type commitment struct{ task, resident string }

// committedToday is every Commitment of the Home dated the given day.
func (s *Store) committedToday(ctx context.Context, homeID string, date time.Time) (map[commitment]bool, error) {
	rows, err := s.db.Query(ctx, `
		SELECT tr.task_id, tr.resident_id
		FROM task_residents tr JOIN residents r ON r.id = tr.resident_id
		WHERE r.home_id = $1 AND tr.committed_on = $2`, homeID, date)
	if err != nil {
		return nil, fmt.Errorf("day plan: load commitments: %w", err)
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (c commitment, err error) {
		return c, r.Scan(&c.task, &c.resident)
	})
	if err != nil {
		return nil, fmt.Errorf("day plan: load commitments: %w", err)
	}
	out := make(map[commitment]bool, len(list))
	for _, c := range list {
		out[c] = true
	}
	return out, nil
}
