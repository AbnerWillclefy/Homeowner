package dayplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkinstore"
)

// CheckIn stores a Resident's Check-in for the Home's local date at now and,
// when today's plan already exists, plans that one Resident again. It returns
// the local date the Check-in belongs to.
//
// Everything happens in one transaction that locks the Home row as PlanHome
// does, so a Check-in and a job tick serialise:
//   - No run for the date yet: the Check-in is only saved. The job reads it
//     when it plans.
//   - The run was rejected: the Check-in is saved and nothing else changes. The
//     day is taken and nothing is assigned (see Rejected).
//   - The run was planned: the Resident's Tasks are planned again, from every
//     open Task not given to someone else today (their own previous Tasks, the
//     pool, Tasks added after the plan). Only their assignments and the run's
//     reasons change; other Residents' assignments, the run row and its
//     allocator stay. A proposal that errors or breaks a rule rolls back
//     everything, the Check-in included, and returns an error: an unchecked
//     plan is never stored (ADR 0004).
func (p *Planner) CheckIn(ctx context.Context, homeID, residentID string, in checkinstore.CheckIn, now time.Time) (allocation.Date, error) {
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("check in: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var zone string
	if err := tx.QueryRow(ctx, `SELECT timezone FROM homes WHERE id = $1 FOR NO KEY UPDATE`, homeID).Scan(&zone); err != nil {
		return 0, fmt.Errorf("check in: lock home: %w", err)
	}
	date, err := LocalDate(zone, now)
	if err != nil {
		return 0, fmt.Errorf("check in: %w", err)
	}
	if err := checkinstore.Save(ctx, tx, residentID, date, in, now); err != nil {
		return 0, err
	}

	replanned, err := p.replan(ctx, tx, homeID, residentID, date)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("check in: commit: %w", err)
	}
	if replanned != nil {
		p.log.Info("resident planned again after a check-in", "home", homeID, "date", date.Time().Format(time.DateOnly),
			"assigned", replanned.assigned, "pooled", replanned.pooled)
	}
	return date, nil
}

type replanned struct{ assigned, pooled int }

// replan plans one Resident again inside the day's planned run, or does
// nothing (nil) when there is no run or it was rejected.
func (p *Planner) replan(ctx context.Context, tx pgx.Tx, homeID, residentID string, date allocation.Date) (*replanned, error) {
	run, found, err := loadRun(ctx, tx, homeID, date)
	if err != nil || !found || run.outcome != Planned {
		return nil, err
	}
	return p.replanRun(ctx, tx, homeID, residentID, date, run)
}

// storedRun is a run row as the re-plan needs it.
type storedRun struct {
	id      string
	outcome Outcome
	reasons reasons
}

// loadRun reads the Home's run for the date; found is false when there is none.
func loadRun(ctx context.Context, tx pgx.Tx, homeID string, date allocation.Date) (run storedRun, found bool, err error) {
	var (
		outcome string
		raw     []byte
	)
	err = tx.QueryRow(ctx, `SELECT id, outcome, reasons FROM allocation_runs WHERE home_id = $1 AND plan_date = $2`,
		homeID, date.Time()).Scan(&run.id, &outcome, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return storedRun{}, false, nil
	}
	if err != nil {
		return storedRun{}, false, fmt.Errorf("replan: load run: %w", err)
	}
	run.outcome = Outcome(outcome)
	if err := json.Unmarshal(raw, &run.reasons); err != nil {
		return storedRun{}, false, fmt.Errorf("replan: read reasons: %w", err)
	}
	return run, true, nil
}

// replanRun plans one Resident again inside a planned run: it proposes from
// every open Task not given to someone else, has Check referee it, and replaces
// only that Resident's assignments. It loads the whole Home's State, not only
// the Resident, so Energy and Restrictions come from the one code path PlanHome
// uses. A Check-in and "get my tasks right away" share it.
func (p *Planner) replanRun(ctx context.Context, tx pgx.Tx, homeID, residentID string, date allocation.Date, run storedRun) (*replanned, error) {
	rs := run.reasons
	runID := run.id
	st, err := loadState(ctx, tx, homeID, date)
	if err != nil {
		return nil, err
	}
	given, err := givenToOthers(ctx, tx, runID, residentID)
	if err != nil {
		return nil, err
	}
	sub, ok := subState(st.state, residentID, given)
	if !ok {
		return nil, fmt.Errorf("check in: resident %s is not in the home", residentID)
	}

	res, err := p.alloc.Plan(sub)
	if err != nil {
		return nil, fmt.Errorf("check in: allocator %s failed: %w", p.alloc.Name(), err)
	}
	if vs := allocation.Check(res.DayPlan, sub); len(vs) > 0 {
		return nil, fmt.Errorf("check in: allocator %s proposal refused by the checker: %d violations, first: %s",
			p.alloc.Name(), len(vs), vs[0].Detail)
	}

	rs.replan(residentID, st.energy[residentID], res)
	if err := persist(ctx, tx, runID, residentID, res, rs); err != nil {
		return nil, err
	}
	return &replanned{assigned: len(res.DayPlan.Assignments), pooled: len(res.Pool)}, nil
}

// subState narrows st to one Resident and to the Tasks not given to someone
// else today. ok is false when the Resident is not in st.
func subState(st allocation.State, residentID string, given map[string]bool) (sub allocation.State, ok bool) {
	sub = allocation.State{Today: st.Today}
	for _, r := range st.Residents {
		if r.ID == residentID {
			sub.Residents, ok = []allocation.Resident{r}, true
		}
	}
	for _, t := range st.Tasks {
		if !given[t.ID] {
			sub.Tasks = append(sub.Tasks, t)
		}
	}
	return sub, ok
}

// persist replaces the Resident's assignments in the run and writes its reasons.
func persist(ctx context.Context, tx pgx.Tx, runID, residentID string, res allocation.Result, rs reasons) error {
	// Only the Resident's own rows go. When Committed Tasks exist (#15) they must
	// survive here and be added to what givenToOthers excludes: a re-plan never
	// drops a Committed Task.
	if _, err := tx.Exec(ctx, `DELETE FROM day_plan_assignments WHERE run_id = $1 AND resident_id = $2`, runID, residentID); err != nil {
		return fmt.Errorf("check in: clear assignments: %w", err)
	}
	for _, a := range res.DayPlan.Assignments {
		if _, err := tx.Exec(ctx, `
			INSERT INTO day_plan_assignments (run_id, task_id, resident_id, reason) VALUES ($1, $2, $3, $4)`,
			runID, a.TaskID, a.ResidentID, string(a.Reason)); err != nil {
			return fmt.Errorf("check in: store assignment: %w", err)
		}
	}
	body, err := json.Marshal(rs)
	if err != nil {
		return fmt.Errorf("check in: write reasons: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE allocation_runs SET reasons = $2 WHERE id = $1`, runID, body); err != nil {
		return fmt.Errorf("check in: write reasons: %w", err)
	}
	return nil
}

// givenToOthers is the set of Task ids the run gave to Residents other than
// residentID.
func givenToOthers(ctx context.Context, tx pgx.Tx, runID, residentID string) (map[string]bool, error) {
	rows, err := tx.Query(ctx, `SELECT task_id FROM day_plan_assignments WHERE run_id = $1 AND resident_id <> $2`, runID, residentID)
	if err != nil {
		return nil, fmt.Errorf("check in: load assignments: %w", err)
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("check in: load assignments: %w", err)
	}
	out := make(map[string]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out, nil
}
