package finance

import (
	"context"
	"time"
)

// CreateInvestment stores an Investment for the User.
func (s *Store) CreateInvestment(ctx context.Context, userID string, i InvestmentRequest, now time.Time) (InvestmentResponse, error) {
	out := InvestmentResponse{Name: i.Name, ValueCents: i.ValueCents, Serves: i.Serves}
	err := s.db.QueryRow(ctx, `
		INSERT INTO finance_investments (id, user_id, name, value_cents, serves, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $5) RETURNING id`, userID, i.Name, i.ValueCents, i.Serves, now).Scan(&out.ID)
	return out, err
}

// UpdateInvestment replaces the User's Investment; found is false when it is not theirs.
func (s *Store) UpdateInvestment(ctx context.Context, userID, id string, i InvestmentRequest, now time.Time) (InvestmentResponse, bool, error) {
	tag, err := s.db.Exec(ctx, `
		UPDATE finance_investments SET name = $3, value_cents = $4, serves = $5, updated_at = $6
		WHERE id = $1 AND user_id = $2`, id, userID, i.Name, i.ValueCents, i.Serves, now)
	return InvestmentResponse{ID: id, Name: i.Name, ValueCents: i.ValueCents, Serves: i.Serves}, tag.RowsAffected() == 1, err
}

// DeleteInvestment removes the User's Investment; found is false when it is not theirs.
func (s *Store) DeleteInvestment(ctx context.Context, userID, id string) (bool, error) {
	tag, err := s.db.Exec(ctx, `DELETE FROM finance_investments WHERE id = $1 AND user_id = $2`, id, userID)
	return tag.RowsAffected() == 1, err
}

// Investments lists the User's Investments by name, then id.
func (s *Store) Investments(ctx context.Context, userID string) ([]InvestmentResponse, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, name, value_cents, serves FROM finance_investments
		WHERE user_id = $1 ORDER BY name, id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []InvestmentResponse{}
	for rows.Next() {
		var i InvestmentResponse
		if err := rows.Scan(&i.ID, &i.Name, &i.ValueCents, &i.Serves); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}
