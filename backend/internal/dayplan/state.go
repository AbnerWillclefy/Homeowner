package dayplan

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
)

// loaded is the State plus what the run record keeps about it.
type loaded struct {
	state allocation.State
	// energy is each Resident's Energy for the day, by Resident id.
	energy map[string]int
}

// energyOn is a Resident's Energy on the day: the points of their Baseline for
// that weekday. A weekday they have not set is 0, not an error: that Resident
// is given nothing. This is the one place the Check-in will scale or replace
// the Baseline.
func energyOn(p profile.Profile, day allocation.Date) int {
	return p.Baseline[time.Weekday(day.Weekday())]
}

// loadState reads the Home's open Tasks (overdue ones too: nothing is tied to a
// day until it is assigned), its Residents with their Energy for the day, and
// both levels of Restriction.
func loadState(ctx context.Context, q pgx.Tx, homeID string, today allocation.Date) (loaded, error) {
	out := loaded{state: allocation.State{Today: today}, energy: map[string]int{}}

	rows, err := q.Query(ctx, `
		SELECT t.id, c.id, t.current_effort, c.importance, c.people, c.demands, c.allowed_weekdays,
		       t.window_start, t.window_end
		FROM tasks t JOIN chores c ON c.id = t.chore_id
		WHERE c.home_id = $1 AND t.status = 'open'
		ORDER BY t.window_start, c.created_at, t.id`, homeID)
	if err != nil {
		return loaded{}, fmt.Errorf("load open tasks: %w", err)
	}
	out.state.Tasks, err = pgx.CollectRows(rows, func(r pgx.CollectableRow) (t allocation.Task, err error) {
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
		return loaded{}, fmt.Errorf("load open tasks: %w", err)
	}

	type resident struct{ id, userID string }
	rows, err = q.Query(ctx, `SELECT id, user_id FROM residents WHERE home_id = $1 ORDER BY created_at, id`, homeID)
	if err != nil {
		return loaded{}, fmt.Errorf("load residents: %w", err)
	}
	residents, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (x resident, err error) {
		return x, r.Scan(&x.id, &x.userID)
	})
	if err != nil {
		return loaded{}, fmt.Errorf("load residents: %w", err)
	}
	userIDs := make([]string, len(residents))
	for i, r := range residents {
		userIDs[i] = r.userID
	}
	profiles, err := profile.LoadMany(ctx, q, userIDs)
	if err != nil {
		return loaded{}, err
	}

	rows, err = q.Query(ctx, `
		SELECT q.resident_id, q.chore_id
		FROM resident_chore_restrictions q JOIN residents r ON r.id = q.resident_id
		WHERE r.home_id = $1`, homeID)
	if err != nil {
		return loaded{}, fmt.Errorf("load chore restrictions: %w", err)
	}
	type restriction struct{ resident, chore string }
	rs, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (x restriction, err error) {
		return x, r.Scan(&x.resident, &x.chore)
	})
	if err != nil {
		return loaded{}, fmt.Errorf("load chore restrictions: %w", err)
	}
	choreRestrictions := map[string][]string{}
	for _, x := range rs {
		choreRestrictions[x.resident] = append(choreRestrictions[x.resident], x.chore)
	}

	for _, r := range residents {
		p := profiles[r.userID]
		res := allocation.Resident{ID: r.id, Energy: energyOn(p, today), ChoreRestrictions: choreRestrictions[r.id]}
		for _, d := range p.Restrictions {
			res.DemandRestrictions = append(res.DemandRestrictions, allocation.Demand(d))
		}
		out.state.Residents = append(out.state.Residents, res)
		out.energy[r.id] = res.Energy
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
	// Never nil, so the stored arrays are [] and not null.
	if rec.reasons.Assigned == nil {
		rec.reasons.Assigned = []assigned{}
	}
	if rec.reasons.Pool == nil {
		rec.reasons.Pool = []pooled{}
	}
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
