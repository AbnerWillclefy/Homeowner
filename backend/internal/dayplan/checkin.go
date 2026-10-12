package dayplan

import (
	"context"
	"fmt"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkinstore"
)

// CheckIn stores a Resident's Check-in for the Home's local date at now and,
// when today's plan already exists, plans that one Resident again.
//
// The Home row is locked like PlanHome does, so a Check-in and a job tick
// serialise. With no run for the date the Check-in is only saved: the job reads
// it when it plans.
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
	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("check in: commit: %w", err)
	}
	return date, nil
}
