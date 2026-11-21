package finance

import (
	"context"
	"errors"
	"time"
)

// SetBudget stores the User's monthly limit for a Spending Category; nil removes it.
func (s *Store) SetBudget(ctx context.Context, userID, category string, cents *int64, now time.Time) error {
	if cents == nil {
		_, err := s.db.Exec(ctx, `DELETE FROM finance_category_budgets WHERE user_id = $1 AND spending_category = $2`, userID, category)
		return err
	}
	_, err := s.db.Exec(ctx, `
		INSERT INTO finance_category_budgets (user_id, spending_category, limit_cents, updated_at) VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, spending_category) DO UPDATE SET limit_cents = $3, updated_at = $4`,
		userID, category, *cents, now)
	return err
}

// Budgets returns the User's limits by category; empty, never nil, when none are set.
func (s *Store) Budgets(ctx context.Context, userID string) (map[string]int64, error) {
	rows, err := s.db.Query(ctx, `SELECT spending_category, limit_cents FROM finance_category_budgets WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int64{}
	for rows.Next() {
		var c string
		var n int64
		if err := rows.Scan(&c, &n); err != nil {
			return nil, err
		}
		out[c] = n
	}
	return out, rows.Err()
}

// GroceriesLeft is the month's groceries limit minus what groceries took, the
// figure Spending Categories shows (month is YYYY-MM). Nil when no groceries
// limit is set; negative when the User went over it. Pantry reads it here
// instead of recomputing it.
func (s *Store) GroceriesLeft(ctx context.Context, userID, month string) (*int64, error) {
	from, to, ok := parseMonth(month)
	if !ok {
		return nil, errors.New("finance: invalid month")
	}
	limits, err := s.Budgets(ctx, userID)
	if err != nil {
		return nil, err
	}
	limit, ok := limits["groceries"]
	if !ok {
		return nil, nil
	}
	rows, err := s.MonthTransactions(ctx, userID, from, to)
	if err != nil {
		return nil, err
	}
	return new(limit - MonthTotals(toTxns(rows)).ByCategory["groceries"]), nil
}
