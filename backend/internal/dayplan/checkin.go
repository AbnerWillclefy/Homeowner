package dayplan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
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
//     open Task not given to someone else today (their own Proposed Tasks, the
//     pool, Tasks added after the plan), except the ones they Committed to
//     (those stay, and their Effort comes off the Energy) and the ones
//     refused (those wait for tomorrow). A two-person Task they hold stays for
//     both partners when either Committed or they can still afford it, and
//     otherwise both partners lose it (see replanRun). Only their Proposed assignments and the run's
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

	date, err := lockHome(ctx, tx, homeID, now)
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
	// A refused Task waits for the next Allocation, whoever plans.
	for _, e := range rs.refusedTasks() {
		given[e.TaskID] = true
	}
	// A Committed Task is a promise: it stays as it is, is not planned again,
	// and what it costs is already spent.
	committed, err := committedTasks(ctx, tx, residentID, date)
	if err != nil {
		return nil, err
	}
	for id := range committed {
		given[id] = true
	}
	two, err := settleTwoPerson(ctx, tx, st, runID, residentID, date, committed)
	if err != nil {
		return nil, err
	}
	for _, id := range two.held {
		given[id] = true
	}
	sub, ok := subState(st.state, residentID, given)
	if !ok {
		return nil, fmt.Errorf("check in: resident %s is not in the home", residentID)
	}
	sub.Residents[0].Energy = two.left

	res, err := p.alloc.Plan(sub)
	if err != nil {
		return nil, fmt.Errorf("check in: allocator %s failed: %w", p.alloc.Name(), err)
	}
	if vs := allocation.Check(res.DayPlan, sub); len(vs) > 0 {
		return nil, fmt.Errorf("check in: allocator %s proposal refused by the checker: %d violations, first: %s",
			p.alloc.Name(), len(vs), vs[0].Detail)
	}

	rs.replan(residentID, st.energy[residentID], res, two.keep)
	if err := releaseTwoPerson(ctx, tx, runID, &rs, two.released); err != nil {
		return nil, err
	}
	if err := persist(ctx, tx, runID, residentID, res, rs, two.keep); err != nil {
		return nil, err
	}
	return &replanned{assigned: len(res.DayPlan.Assignments), pooled: len(res.Pool)}, nil
}

// twoPerson is how a re-plan treats the two-person Tasks the Resident holds.
type twoPerson struct {
	held     []string        // every open two-person Task the run gave the Resident
	keep     map[string]bool // Tasks a re-plan must not drop: Commitments and the held Tasks that stand
	released []string        // held Tasks that fall, for both partners
	left     int             // Energy the re-plan may still hand out
}

// settleTwoPerson decides the two-person Tasks the Resident holds. A two-person
// Task is only ever placed by the daily Allocation, never by a one-Resident
// re-plan, and its rows stand or fall together. Those held stay (keep) when
// either partner promised them, or when the Resident can still afford them and
// may do them; otherwise both partners lose them (released).
func settleTwoPerson(ctx context.Context, tx pgx.Tx, st loaded, runID, residentID string, date allocation.Date, committed map[string]bool) (twoPerson, error) {
	var energy int
	found := false
	for _, r := range st.state.Residents {
		if r.ID == residentID {
			energy, found = r.Energy, true
		}
	}
	if !found {
		return twoPerson{}, fmt.Errorf("check in: resident %s is not in the home", residentID)
	}
	held, err := heldTwoPerson(ctx, tx, runID, residentID)
	if err != nil {
		return twoPerson{}, err
	}
	two := twoPerson{held: held, keep: maps.Clone(committed)}
	promised := map[string]bool{}
	for _, id := range held {
		yes, err := committedBy(ctx, tx, id, residentID, date, true)
		if err != nil {
			return twoPerson{}, err
		}
		if yes {
			two.keep[id], promised[id] = true, true
		}
	}
	left := energyLeft(energy, st.state.Tasks, two.keep)
	for _, id := range held {
		if promised[id] {
			continue
		}
		effort, ok := effortOf(st.state.Tasks, id)
		if !ok {
			return twoPerson{}, fmt.Errorf("check in: two-person task %s is not an open task", id)
		}
		err := mayDoIn(st, residentID, id, "replan")
		if err != nil && !errors.Is(err, ErrRestricted) {
			return twoPerson{}, err
		}
		if err == nil && left >= effort {
			left -= effort
			two.keep[id] = true
		} else {
			two.released = append(two.released, id)
		}
	}
	two.left = left
	return two, nil
}

// releaseTwoPerson takes the Tasks back from both partners and sends them to
// the pool with no energy left.
func releaseTwoPerson(ctx context.Context, tx pgx.Tx, runID string, rs *reasons, released []string) error {
	for _, id := range released {
		if _, err := tx.Exec(ctx, `DELETE FROM day_plan_assignments WHERE run_id = $1 AND task_id = $2`, runID, id); err != nil {
			return fmt.Errorf("check in: release two-person task: %w", err)
		}
		rs.release(id)
		rs.Pool = append(rs.Pool, pooled{TaskID: id, Reason: string(allocation.ReasonNoEnergyLeft)})
	}
	return nil
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

// energyLeft is the Energy less the Effort of the open Tasks the Resident is
// Committed to, never below 0. It is what a re-plan may still hand out.
func energyLeft(energy int, tasks []allocation.Task, committed map[string]bool) int {
	for _, t := range tasks {
		if committed[t.ID] {
			energy -= t.Effort
		}
	}
	return max(energy, 0)
}

// committedTasks is the set of Task ids the Resident is Committed to on the
// date.
func committedTasks(ctx context.Context, tx pgx.Tx, residentID string, date allocation.Date) (map[string]bool, error) {
	rows, err := tx.Query(ctx, `SELECT task_id FROM task_residents WHERE resident_id = $1 AND committed_on = $2`,
		residentID, date.Time())
	if err != nil {
		return nil, fmt.Errorf("check in: load commitments: %w", err)
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("check in: load commitments: %w", err)
	}
	out := make(map[string]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out, nil
}

// committedBy says whether the Task is Committed on the date: by the Resident,
// or by anyone when anyPartner is set (a two-person Task is promised once either
// partner accepts it).
func committedBy(ctx context.Context, tx pgx.Tx, taskID, residentID string, date allocation.Date, anyPartner bool) (bool, error) {
	var yes bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM task_residents
		               WHERE task_id = $1 AND committed_on = $2 AND ($3 OR resident_id = $4))`,
		taskID, date.Time(), anyPartner, residentID).Scan(&yes)
	if err != nil {
		return false, fmt.Errorf("check commitment: %w", err)
	}
	return yes, nil
}

// heldTwoPerson lists the ids of the open two-person Tasks the run gave the
// Resident, ordered by id.
func heldTwoPerson(ctx context.Context, tx pgx.Tx, runID, residentID string) ([]string, error) {
	rows, err := tx.Query(ctx, `
		SELECT d.task_id
		FROM day_plan_assignments d
		JOIN tasks t ON t.id = d.task_id AND t.status = 'open'
		JOIN chores ch ON ch.id = t.chore_id AND ch.people > 1
		WHERE d.run_id = $1 AND d.resident_id = $2
		ORDER BY d.task_id`, runID, residentID)
	if err != nil {
		return nil, fmt.Errorf("check in: load two-person tasks: %w", err)
	}
	out, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("check in: load two-person tasks: %w", err)
	}
	return out, nil
}

// effortOf is the Effort of the Task in tasks; ok is false when it is not there.
func effortOf(tasks []allocation.Task, id string) (effort int, ok bool) {
	for _, t := range tasks {
		if t.ID == id {
			return t.Effort, true
		}
	}
	return 0, false
}

// persist replaces the Resident's Proposed assignments in the run and writes
// its reasons. The Tasks in keep stay: a re-plan never drops a promise, nor
// half of a two-person Task.
func persist(ctx context.Context, tx pgx.Tx, runID, residentID string, res allocation.Result, rs reasons, keep map[string]bool) error {
	// Never nil: pgx sends a nil slice as NULL, and NOT (x = ANY(NULL)) is NULL,
	// so nothing would be cleared when keep is empty.
	kept := append([]string{}, slices.Sorted(maps.Keys(keep))...)
	if _, err := tx.Exec(ctx, `
		DELETE FROM day_plan_assignments
		WHERE run_id = $1 AND resident_id = $2 AND NOT (task_id = ANY($3::uuid[]))`,
		runID, residentID, kept); err != nil {
		return fmt.Errorf("check in: clear assignments: %w", err)
	}
	for _, a := range res.DayPlan.Assignments {
		if _, err := tx.Exec(ctx, `
			INSERT INTO day_plan_assignments (run_id, task_id, resident_id, reason) VALUES ($1, $2, $3, $4)`,
			runID, a.TaskID, a.ResidentID, string(a.Reason)); err != nil {
			return fmt.Errorf("check in: store assignment: %w", err)
		}
	}
	return writeReasons(ctx, tx, runID, rs)
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
