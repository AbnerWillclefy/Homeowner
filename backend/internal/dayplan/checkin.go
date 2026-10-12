package dayplan

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
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
	var (
		runID, outcome string
		raw            []byte
	)
	err := tx.QueryRow(ctx, `SELECT id, outcome, reasons FROM allocation_runs WHERE home_id = $1 AND plan_date = $2`,
		homeID, date.Time()).Scan(&runID, &outcome, &raw)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && outcome != string(Planned)) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("check in: load run: %w", err)
	}
	var rs reasons
	if err := json.Unmarshal(raw, &rs); err != nil {
		return nil, fmt.Errorf("check in: read reasons: %w", err)
	}

	st, err := loadState(ctx, tx, homeID, date)
	if err != nil {
		return nil, err
	}
	given, err := givenToOthers(ctx, tx, runID, residentID)
	if err != nil {
		return nil, err
	}
	sub := allocation.State{Today: date}
	for _, r := range st.state.Residents {
		if r.ID == residentID {
			sub.Residents = []allocation.Resident{r}
		}
	}
	if len(sub.Residents) == 0 {
		return nil, fmt.Errorf("check in: resident %s is not in the home", residentID)
	}
	for _, t := range st.state.Tasks {
		if !given[t.ID] {
			sub.Tasks = append(sub.Tasks, t)
		}
	}

	res, err := p.alloc.Plan(sub)
	if err != nil {
		return nil, fmt.Errorf("check in: allocator %s failed: %w", p.alloc.Name(), err)
	}
	if vs := allocation.Check(res.DayPlan, sub); len(vs) > 0 {
		return nil, fmt.Errorf("check in: allocator %s proposal refused by the checker: %d violations, first: %s",
			p.alloc.Name(), len(vs), vs[0].Detail)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM day_plan_assignments WHERE run_id = $1 AND resident_id = $2`, runID, residentID); err != nil {
		return nil, fmt.Errorf("check in: clear assignments: %w", err)
	}
	for _, a := range res.DayPlan.Assignments {
		if _, err := tx.Exec(ctx, `
			INSERT INTO day_plan_assignments (run_id, task_id, resident_id, reason) VALUES ($1, $2, $3, $4)`,
			runID, a.TaskID, a.ResidentID, string(a.Reason)); err != nil {
			return nil, fmt.Errorf("check in: store assignment: %w", err)
		}
	}
	rs = rewriteReasons(rs, st, sub, res, residentID)
	body, err := json.Marshal(rs)
	if err != nil {
		return nil, fmt.Errorf("check in: write reasons: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE allocation_runs SET reasons = $2 WHERE id = $1`, runID, body); err != nil {
		return nil, fmt.Errorf("check in: write reasons: %w", err)
	}
	return &replanned{assigned: len(res.DayPlan.Assignments), pooled: len(res.Pool)}, nil
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

// rewriteReasons brings the run's reasons up to date with the new plan of one
// Resident: their Energy and level, their assigned entries and the pool. A Task
// that was already in the pool and still is keeps its reason, since it is about
// everyone; a Task newly released into the pool gets the reason the new plan
// gave it. Entries for Tasks the re-plan did not consider are kept.
func rewriteReasons(rs reasons, st loaded, sub allocation.State, res allocation.Result, residentID string) reasons {
	if rs.Energy == nil {
		rs.Energy = map[string]int{}
	}
	rs.Energy[residentID] = st.energy[residentID]
	if level, ok := st.levels[residentID]; ok {
		if rs.Levels == nil {
			rs.Levels = map[string]string{}
		}
		rs.Levels[residentID] = level
	}

	candidate := map[string]bool{}
	for _, t := range sub.Tasks {
		candidate[t.ID] = true
	}
	oldPool := map[string]string{}
	for _, e := range rs.Pool {
		oldPool[e.TaskID] = e.Reason
	}

	assignedNow := make([]assigned, 0, len(rs.Assigned))
	for _, a := range rs.Assigned {
		if a.ResidentID != residentID {
			assignedNow = append(assignedNow, a)
		}
	}
	for _, a := range res.DayPlan.Assignments {
		assignedNow = append(assignedNow, assigned{TaskID: a.TaskID, ResidentID: a.ResidentID, Reason: string(a.Reason)})
	}
	rs.Assigned = assignedNow

	pool := make([]pooled, 0, len(rs.Pool))
	for _, e := range rs.Pool {
		if !candidate[e.TaskID] {
			pool = append(pool, e)
		}
	}
	for _, e := range res.Pool {
		reason := string(e.Reason)
		if old, was := oldPool[e.TaskID]; was {
			reason = old
		}
		pool = append(pool, pooled{TaskID: e.TaskID, Reason: reason})
	}
	slices.SortFunc(pool, func(a, b pooled) int { return cmp.Compare(a.TaskID, b.TaskID) })
	rs.Pool = pool
	return rs
}
