package dayplan

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
)

// inHomeTx is the one place a Day Plan run begins and ends. In one transaction
// it locks the Home, runs fn with the Home's local clock the lock returned and
// commits. Any error from fn rolls everything back. Errors of its own steps are
// wrapped with name; fn's errors are returned as they are.
//
// Accept, Refuse, Take and the swaps use it as it is and leave the Tasks alone;
// the planning paths use refreshedHomeTx.
func (p *Planner) inHomeTx(ctx context.Context, homeID string, now time.Time, name string, fn func(tx pgx.Tx, clock homeClock) error) error {
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	clock, err := lockHome(ctx, tx, homeID, now)
	if err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	if err := fn(tx, clock); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("%s: commit: %w", name, err)
	}
	return nil
}

// refreshedHomeTx is inHomeTx with the Home's Tasks brought up to date, for the
// local date the lock returned, before fn runs. A rollback undoes the Refresh
// too.
//
// The order matters. The Home lock (FOR NO KEY UPDATE) comes first and the
// Chore row locks of Refresh (FOR UPDATE) second. GET /home/tasks takes Chore
// locks without the Home lock and never waits on the Home afterwards, so the
// two cannot wait on each other. The Chore locks are held until the commit, so
// a concurrent GET /home/tasks waits for the run, which is short.
func (p *Planner) refreshedHomeTx(ctx context.Context, homeID string, now time.Time, name string, fn func(tx pgx.Tx, date allocation.Date) error) error {
	return p.inHomeTx(ctx, homeID, now, name, func(tx pgx.Tx, clock homeClock) error {
		if err := tasks.RefreshIn(ctx, tx, homeID, clock.date, clock.loc, now); err != nil {
			return fmt.Errorf("%s: %w", name, err)
		}
		return fn(tx, clock.date)
	})
}
