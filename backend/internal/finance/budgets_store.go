package finance

import (
	"context"
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
