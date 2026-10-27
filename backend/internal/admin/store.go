package admin

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// statementTimeout bounds every query of a report. With DB_MAX_CONNS=2 a slow
// report must not hold a connection for long.
const statementTimeout = "5s"

// Vocabulary stored by other domains, repeated here because this package runs
// SQL only and imports no domain package. Each comment names the source of
// truth; a change there must change it here.
const (
	// reasonRefused is the pool reason of a refused Task (dayplan.ReasonRefused).
	reasonRefused = "refused"
	// reasonTaken is the assignment reason of a Task taken from the pool
	// (dayplan.ReasonTaken).
	reasonTaken = "taken"
	// outcomeRejected is the allocation_runs.outcome of a run the checker
	// refused (dayplan.Rejected).
	outcomeRejected = "rejected"
	// swapAccepted is the swap_offers.status of an accepted offer
	// (dayplan's swapAccepted).
	swapAccepted = "accepted"
	// The nudges.outcome values (nudge.OutcomeDelivered, OutcomeFailed,
	// OutcomeGone); a NULL outcome is counted as unknown.
	pushDelivered = "delivered"
	pushFailed    = "failed"
	pushGone      = "gone"
)

// Store reads the reports. It never writes: every method runs in a read-only
// transaction.
type Store struct{ db *pgxpool.Pool }

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// readOnly runs fn in one READ ONLY transaction with a 5 s statement timeout,
// so Postgres itself refuses any write and bounds any slow query. All queries
// of a report share the transaction, hence one connection and one snapshot.
// The transaction is always rolled back: it has nothing to commit. Every
// report (this ticket's and later ones) goes through it.
func readOnly(ctx context.Context, db *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	tx, err := db.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return fmt.Errorf("begin read-only transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, "SET LOCAL statement_timeout = '"+statementTimeout+"'"); err != nil {
		return fmt.Errorf("set statement timeout: %w", err)
	}
	return fn(tx)
}
