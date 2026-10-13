package dayplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
}

// Store reads the stored Day Plan.
type Store struct {
	db    *pgxpool.Pool
	tasks *tasks.Store
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db, tasks: tasks.NewStore(db)} }

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
	v := View{Date: date.Format(time.DateOnly), Mine: []TaskView{}, Others: []ResidentTasks{}, Pool: []TaskView{}}

	open, err := s.tasks.ListOpen(ctx, homeID)
	if err != nil {
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

	type given struct{ resident, reason string }
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
	by := map[string]given{}
	for _, a := range assigned {
		by[a.task] = a.given
	}
	committed, err := s.committedToday(ctx, homeID, date)
	if err != nil {
		return View{}, err
	}

	at := map[string]int{} // index in v.Others by Resident id, in first-seen order
	for _, o := range open {
		g, ok := by[o.ID]
		switch {
		case !ok:
			// A rejected run stored no pool, so its Tasks have no reason.
			reason, known := poolReason[o.ID]
			if !known && v.Planned {
				reason = ReasonAddedAfterPlan
			}
			v.Pool = append(v.Pool, TaskView{Open: o, Reason: reason})
		case g.resident == residentID:
			v.Mine = append(v.Mine, TaskView{Open: o, Reason: g.reason, Committed: committed[commitment{o.ID, g.resident}]})
		default:
			i, seen := at[g.resident]
			if !seen {
				i = len(v.Others)
				at[g.resident] = i
				v.Others = append(v.Others, ResidentTasks{ResidentID: g.resident, Tasks: []TaskView{}})
			}
			v.Others[i].Tasks = append(v.Others[i].Tasks, TaskView{Open: o, Reason: g.reason, Committed: committed[commitment{o.ID, g.resident}]})
		}
	}
	return v, nil
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
