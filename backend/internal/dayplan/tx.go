package dayplan

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
)

// errStop is returned by the function given to inHomeTx to end the run early
// without an error: the transaction is rolled back (Refresh included) and
// inHomeTx returns nil. Use it when there is nothing to commit, or when a
// failed statement has already aborted the transaction.
var errStop = errors.New("stop the home transaction")

// inHomeTx is the one place a Day Plan run begins and ends. In one transaction
// it locks the Home, brings the Home's Tasks up to date for the local date the
// lock returned, runs fn with that date and commits. Any error from fn rolls
// everything back, the Refresh included. Errors of its own steps are wrapped
// with name; fn's errors are returned as they are.
//
// The order matters. The Home lock (FOR NO KEY UPDATE) comes first and the
// Chore row locks of Refresh (FOR UPDATE) second. GET /home/tasks takes Chore
// locks without the Home lock and never waits on the Home afterwards, so the
// two cannot wait on each other. The Chore locks are held until the commit, so
// a concurrent GET /home/tasks waits for the run, which is short.
func (p *Planner) inHomeTx(ctx context.Context, homeID string, now time.Time, name string, fn func(tx pgx.Tx, date allocation.Date) error) error {
	return p.runInHomeTx(ctx, homeID, now, name, true, fn)
}

// runInHomeTx is inHomeTx with the Refresh optional: Accept, Refuse, Take and
// the swaps use the same lock and commit but leave the Tasks alone.
func (p *Planner) runInHomeTx(ctx context.Context, homeID string, now time.Time, name string, refresh bool, fn func(tx pgx.Tx, date allocation.Date) error) error {
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	date, loc, err := lockHome(ctx, tx, homeID, now)
	if err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	if refresh {
		if err := tasks.RefreshIn(ctx, tx, homeID, date, loc, now); err != nil {
			return fmt.Errorf("%s: %w", name, err)
		}
	}
	if err := fn(tx, date); err != nil {
		if errors.Is(err, errStop) {
			return nil
		}
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("%s: commit: %w", name, err)
	}
	return nil
}
