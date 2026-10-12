package homes

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// Leave removes a Resident from their Home in one transaction (see LeaveTx).
func (s *Store) Leave(ctx context.Context, residentID, homeID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("leave home: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if err := LeaveTx(ctx, tx, residentID, homeID); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("leave home: %w", err)
	}
	return nil
}

// LeaveTx removes a Resident from their Home inside tx, and deletes the Home
// if nobody lives there any more. Deleting the residents row clears the
// Resident's specific Preferences and Restrictions (cascade); deleting the Home
// clears its Chores, Tasks and Invites. It is a helper over a caller's
// transaction so joining another Home can leave and join atomically; the leave
// endpoint reuses it.
//
// It locks the Home row first, so two last Residents leaving at once are
// serialised and cannot leave an empty Home behind.
func LeaveTx(ctx context.Context, tx pgx.Tx, residentID, homeID string) error {
	if _, err := tx.Exec(ctx, `SELECT 1 FROM homes WHERE id = $1 FOR UPDATE`, homeID); err != nil {
		return fmt.Errorf("lock home: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM residents WHERE id = $1`, residentID); err != nil {
		return fmt.Errorf("delete resident: %w", err)
	}
	var left int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM residents WHERE home_id = $1`, homeID).Scan(&left); err != nil {
		return fmt.Errorf("count residents: %w", err)
	}
	if left == 0 {
		if _, err := tx.Exec(ctx, `DELETE FROM homes WHERE id = $1`, homeID); err != nil {
			return fmt.Errorf("delete empty home: %w", err)
		}
	}
	return nil
}
