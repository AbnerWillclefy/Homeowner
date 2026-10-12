package dayplan

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// PlanResident is "get my tasks right away": it plans one Resident for the
// Home's local date at now from what is still in today's pool, without
// touching anyone else's assignments. It is a Check-in re-plan without the
// Check-in (see CheckIn), and the Resident's Energy comes from the same
// energyOn.
//
// Steps, in the order PlanHome uses: refresh the Tasks before the transaction
// (a Home made minutes ago has Chores but no Tasks yet), then lock the Home and
// look for the day's run.
//   - Planned: the Resident's own assignments are replaced from the pool.
//   - Rejected: nothing changes and Rejected is returned; the day is taken.
//   - No run yet: today's run is created in the same transaction, with only
//     this Resident's Energy and assignments. The job then sees a run for the
//     date and skips the Home, so Residents who did not ask are not planned
//     until tomorrow's Allocation (they can still Check in, which plans them
//     from the pool).
//
// A proposal that errors or breaks a rule rolls everything back, the new run
// included, and returns an error: an unchecked plan is never stored (ADR 0004).
func (p *Planner) PlanResident(ctx context.Context, homeID, residentID string, now time.Time) (Outcome, error) {
	if err := p.tasks.Refresh(ctx, homeID, now); err != nil {
		return "", err
	}
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("plan resident: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var zone string
	if err := tx.QueryRow(ctx, `SELECT timezone FROM homes WHERE id = $1 FOR NO KEY UPDATE`, homeID).Scan(&zone); err != nil {
		return "", fmt.Errorf("plan resident: lock home: %w", err)
	}
	date, err := LocalDate(zone, now)
	if err != nil {
		return "", fmt.Errorf("plan resident: %w", err)
	}

	run, found, err := loadRun(ctx, tx, homeID, date)
	if err != nil {
		return "", err
	}
	if found && run.outcome != Planned {
		return Rejected, nil
	}
	if !found {
		// The Home lock is held, so nobody else can create the run meanwhile.
		run = storedRun{outcome: Planned, reasons: reasons{Energy: map[string]int{}, Assigned: []assigned{}, Pool: []pooled{}}}
		body, err := json.Marshal(run.reasons)
		if err != nil {
			return "", fmt.Errorf("plan resident: %w", err)
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO allocation_runs (home_id, plan_date, allocator, outcome, reasons, created_at)
			VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
			homeID, date.Time(), p.alloc.Name(), string(Planned), body, now).Scan(&run.id)
		if err != nil {
			return "", fmt.Errorf("plan resident: create run: %w", err)
		}
	}

	done, err := p.replanRun(ctx, tx, homeID, residentID, date, run)
	if err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("plan resident: commit: %w", err)
	}
	p.log.Info("resident planned right away", "home", homeID, "date", date.Time().Format(time.DateOnly),
		"new_run", !found, "assigned", done.assigned, "pooled", done.pooled)
	return Planned, nil
}
