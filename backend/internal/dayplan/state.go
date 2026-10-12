package dayplan

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkinstore"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
)

// loaded is the State plus what the run record keeps about it.
type loaded struct {
	state allocation.State
	// energy is each Resident's Energy for the day, by Resident id.
	energy map[string]int
}

// energyOn is a Resident's Energy on the day: the points of their Baseline for
// that weekday, scaled by their Check-in when they made one. A weekday they
// have not set is 0, not an error, and no Check-in can raise it: that Resident
// is given nothing. This is the one place the Check-in scales the Baseline.
func energyOn(p profile.Profile, day allocation.Date, ci *checkinstore.CheckIn) int {
	base := p.Baseline[time.Weekday(day.Weekday())]
	if ci == nil {
		return base
	}
	return checkin.Scale(base, ci.Level)
}

// demandRestrictions are the Demands the Resident cannot do on the day: their
// lasting Restrictions, then the day-only ones from the Check-in that do not
// repeat one.
func demandRestrictions(p profile.Profile, ci *checkinstore.CheckIn) []allocation.Demand {
	var out []allocation.Demand
	for _, d := range p.Restrictions {
		out = append(out, allocation.Demand(d))
	}
	if ci != nil {
		for _, d := range ci.Demands {
			if !slices.Contains(out, allocation.Demand(d)) {
				out = append(out, allocation.Demand(d))
			}
		}
	}
	return out
}

// loadState reads the Home's open Tasks (overdue ones too: nothing is tied to a
// day until it is assigned), its Residents with their Energy for the day, and
// both levels of Restriction.
func loadState(ctx context.Context, q pgx.Tx, homeID string, today allocation.Date) (loaded, error) {
	out := loaded{state: allocation.State{Today: today}, energy: map[string]int{}}

	var err error
	if out.state.Tasks, err = loadTasks(ctx, q, homeID); err != nil {
		return loaded{}, err
	}
	residents, err := loadResidents(ctx, q, homeID)
	if err != nil {
		return loaded{}, err
	}
	userIDs := make([]string, len(residents))
	for i, r := range residents {
		userIDs[i] = r.userID
	}
	profiles, err := profile.LoadMany(ctx, q, userIDs)
	if err != nil {
		return loaded{}, err
	}
	choreRestrictions, err := loadChoreRestrictions(ctx, q, homeID)
	if err != nil {
		return loaded{}, err
	}
	residentIDs := make([]string, len(residents))
	for i, r := range residents {
		residentIDs[i] = r.id
	}
	checkIns, err := checkinstore.LoadMany(ctx, q, residentIDs, today)
	if err != nil {
		return loaded{}, err
	}

	for _, r := range residents {
		p := profiles[r.userID]
		var ci *checkinstore.CheckIn
		if c, ok := checkIns[r.id]; ok {
			ci = &c
		}
		res := allocation.Resident{ID: r.id, Energy: energyOn(p, today, ci), ChoreRestrictions: choreRestrictions[r.id],
			DemandRestrictions: demandRestrictions(p, ci)}
		out.state.Residents = append(out.state.Residents, res)
		out.energy[r.id] = res.Energy
	}
	return out, nil
}

func loadTasks(ctx context.Context, q pgx.Tx, homeID string) ([]allocation.Task, error) {
	rows, err := q.Query(ctx, `
		SELECT t.id, c.id, t.current_effort, c.importance, c.people, c.demands, c.allowed_weekdays,
		       t.window_start, t.window_end
		FROM tasks t JOIN chores c ON c.id = t.chore_id
		WHERE c.home_id = $1 AND t.status = 'open'
		ORDER BY t.window_start, c.created_at, t.id`, homeID)
	if err != nil {
		return nil, fmt.Errorf("load open tasks: %w", err)
	}
	out, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (t allocation.Task, err error) {
		var (
			effort, people int16
			importance     string
			demands        []string
			weekdays       []int16
			ws, we         time.Time
		)
		if err := r.Scan(&t.ID, &t.ChoreID, &effort, &importance, &people, &demands, &weekdays, &ws, &we); err != nil {
			return t, err
		}
		t.Effort, t.People, t.Importance = int(effort), int(people), allocation.Importance(importance)
		t.WindowStart, t.WindowEnd = allocation.DateOf(ws), allocation.DateOf(we)
		for _, d := range demands {
			t.Demands = append(t.Demands, allocation.Demand(d))
		}
		for _, w := range weekdays {
			t.AllowedWeekdays = append(t.AllowedWeekdays, int(w))
		}
		return t, nil
	})
	if err != nil {
		return nil, fmt.Errorf("load open tasks: %w", err)
	}
	return out, nil
}

type residentRow struct{ id, userID string }

func loadResidents(ctx context.Context, q pgx.Tx, homeID string) ([]residentRow, error) {
	rows, err := q.Query(ctx, `SELECT id, user_id FROM residents WHERE home_id = $1 ORDER BY created_at, id`, homeID)
	if err != nil {
		return nil, fmt.Errorf("load residents: %w", err)
	}
	out, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (x residentRow, err error) {
		return x, r.Scan(&x.id, &x.userID)
	})
	if err != nil {
		return nil, fmt.Errorf("load residents: %w", err)
	}
	return out, nil
}

// loadChoreRestrictions returns the Chore ids each Resident is restricted
// from, by Resident id.
func loadChoreRestrictions(ctx context.Context, q pgx.Tx, homeID string) (map[string][]string, error) {
	rows, err := q.Query(ctx, `
		SELECT q.resident_id, q.chore_id
		FROM resident_chore_restrictions q JOIN residents r ON r.id = q.resident_id
		WHERE r.home_id = $1`, homeID)
	if err != nil {
		return nil, fmt.Errorf("load chore restrictions: %w", err)
	}
	type restriction struct{ resident, chore string }
	rs, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (x restriction, err error) {
		return x, r.Scan(&x.resident, &x.chore)
	})
	if err != nil {
		return nil, fmt.Errorf("load chore restrictions: %w", err)
	}
	out := map[string][]string{}
	for _, x := range rs {
		out[x.resident] = append(out[x.resident], x.chore)
	}
	return out, nil
}

// reasons is the jsonb stored on the run: what cannot be recomputed later
// because Energy and Restrictions change. All values are stable ids.
type reasons struct {
	Assigned   []assigned     `json:"assigned"`
	Pool       []pooled       `json:"pool"`
	Energy     map[string]int `json:"energy"`
	Violations []violation    `json:"violations,omitempty"`
	Error      string         `json:"error,omitempty"`
}

// add appends the assignments and the pool of a proposal. It is the one place
// that turns an allocation.Result into the stored shape.
func (rs *reasons) add(res allocation.Result) {
	for _, a := range res.DayPlan.Assignments {
		rs.Assigned = append(rs.Assigned, assigned{TaskID: a.TaskID, ResidentID: a.ResidentID, Reason: string(a.Reason)})
	}
	for _, e := range res.Pool {
		rs.Pool = append(rs.Pool, pooled{TaskID: e.TaskID, Reason: string(e.Reason)})
	}
}

// replan swaps one Resident's part of a planned run for the result of planning
// them again: their Energy and assignments, and the pool. A Task that was
// already in the pool and still is keeps its reason, since it is about
// everyone; a Task newly released into the pool gets the new plan's reason.
func (rs *reasons) replan(residentID string, energy int, res allocation.Result) {
	oldPool := make(map[string]string, len(rs.Pool))
	for _, e := range rs.Pool {
		oldPool[e.TaskID] = e.Reason
	}
	if rs.Energy == nil {
		rs.Energy = map[string]int{}
	}
	rs.Energy[residentID] = energy
	others := make([]assigned, 0, len(rs.Assigned))
	for _, a := range rs.Assigned {
		if a.ResidentID != residentID {
			others = append(others, a)
		}
	}
	rs.Assigned, rs.Pool = others, []pooled{}
	rs.add(res)
	for i, e := range rs.Pool {
		if old, was := oldPool[e.TaskID]; was {
			rs.Pool[i].Reason = old
		}
	}
}

type assigned struct {
	TaskID     string `json:"taskId"`
	ResidentID string `json:"residentId"`
	Reason     string `json:"reason"`
}

type pooled struct {
	TaskID string `json:"taskId"`
	Reason string `json:"reason"`
}

type violation struct {
	Kind       string `json:"kind"`
	TaskID     string `json:"taskId,omitempty"`
	ResidentID string `json:"residentId,omitempty"`
	Level      string `json:"level,omitempty"`
	Detail     string `json:"detail"`
}

// store writes the run and its assignments.
func store(ctx context.Context, tx pgx.Tx, homeID string, date allocation.Date, now time.Time, rec runRecord) error {
	body, err := json.Marshal(rec.reasons)
	if err != nil {
		return fmt.Errorf("store run: %w", err)
	}
	var runID string
	err = tx.QueryRow(ctx, `
		INSERT INTO allocation_runs (home_id, plan_date, allocator, outcome, reasons, created_at)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		homeID, date.Time(), rec.allocator, string(rec.outcome), body, now).Scan(&runID)
	if err != nil {
		return fmt.Errorf("store run: %w", err)
	}
	for _, a := range rec.result.DayPlan.Assignments {
		if _, err := tx.Exec(ctx, `
			INSERT INTO day_plan_assignments (run_id, task_id, resident_id, reason) VALUES ($1, $2, $3, $4)`,
			runID, a.TaskID, a.ResidentID, string(a.Reason)); err != nil {
			return fmt.Errorf("store assignment: %w", err)
		}
	}
	return nil
}
