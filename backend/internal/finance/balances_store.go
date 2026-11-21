package finance

import (
	"context"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
)

// UpsertBalances keeps one balance per bank account Source for day; a second
// write the same day replaces the first. Cards, non-BRL Sources and accounts
// with no readable balance are skipped, so a nil balance never erases the last.
func (s *Store) UpsertBalances(ctx context.Context, itemID string, accounts []pluggy.Account, day time.Time) error {
	var ids []string
	var cents []int64
	for _, a := range accounts {
		if a.BalanceCents != nil {
			ids, cents = append(ids, a.ID), append(cents, *a.BalanceCents)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	_, err := s.db.Exec(ctx, `
		INSERT INTO finance_source_balances (user_id, source_id, day, balance_cents)
		SELECT fs.user_id, fs.id, $2, a.cents
		FROM unnest($3::text[], $4::bigint[]) AS a(account_id, cents)
		JOIN finance_sources fs ON fs.item_id = $1 AND fs.pluggy_account_id = a.account_id
		WHERE fs.kind <> 'credit_card' AND fs.currency = 'BRL'
		ON CONFLICT (source_id, day) DO UPDATE SET balance_cents = EXCLUDED.balance_cents`, itemID, day, ids, cents)
	return err
}

// BalanceHistory returns the User's balance rows per Source, oldest first:
// every row in from..to plus the last one before from, which CarryForward
// needs to fill the days up to the first row in the range.
func (s *Store) BalanceHistory(ctx context.Context, userID string, from, to time.Time) (map[string][]Point[int64], error) {
	rows, err := s.db.Query(ctx, `
		SELECT source_id, day, balance_cents FROM finance_source_balances b
		WHERE user_id = $1 AND day <= $3 AND day >= coalesce(
			(SELECT max(day) FROM finance_source_balances WHERE source_id = b.source_id AND day < $2), $2)
		ORDER BY source_id, day`, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string][]Point[int64]{}
	for rows.Next() {
		var id string
		var p Point[int64]
		if err := rows.Scan(&id, &p.Day, &p.Value); err != nil {
			return nil, err
		}
		out[id] = append(out[id], p)
	}
	return out, rows.Err()
}
