package finance

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// RecordInvestmentValue keeps the Investment's value for the São Paulo day of
// now; a second write the same day replaces the first. The caller owns the
// Investment's user_id check.
func RecordInvestmentValue(ctx context.Context, tx pgx.Tx, userID, investmentID string, cents int64, now time.Time) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO finance_investment_values (investment_id, user_id, day, value_cents) VALUES ($1, $2, $3, $4)
		ON CONFLICT (investment_id, day) DO UPDATE SET value_cents = EXCLUDED.value_cents`, investmentID, userID, postedOn(now), cents)
	return err
}

// InvestmentValues returns the User's stored values per Investment, oldest
// first: every write in from..to plus the last one before from, which
// CarryForward needs to fill the days up to the first write in the range.
func (s *Store) InvestmentValues(ctx context.Context, userID string, from, to time.Time) (map[string][]Point[int64], error) {
	rows, err := s.db.Query(ctx, `
		SELECT investment_id, day, value_cents FROM finance_investment_values v
		WHERE user_id = $1 AND day <= $3 AND day >= coalesce(
			(SELECT max(day) FROM finance_investment_values WHERE investment_id = v.investment_id AND day < $2), $2)
		ORDER BY investment_id, day`, userID, from, to)
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

// CreateInvestment stores an Investment for the User.
func (s *Store) CreateInvestment(ctx context.Context, userID string, i InvestmentRequest, now time.Time) (InvestmentResponse, error) {
	out := InvestmentResponse{Name: i.Name, ValueCents: i.ValueCents, Serves: i.Serves}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // a no-op after Commit
	if err := tx.QueryRow(ctx, `
		INSERT INTO finance_investments (id, user_id, name, value_cents, serves, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $5) RETURNING id`, userID, i.Name, i.ValueCents, i.Serves, now).Scan(&out.ID); err != nil {
		return out, err
	}
	if err := RecordInvestmentValue(ctx, tx, userID, out.ID, i.ValueCents, now); err != nil {
		return out, err
	}
	return out, tx.Commit(ctx)
}

// UpdateInvestment replaces the User's Investment; found is false when it is not theirs.
func (s *Store) UpdateInvestment(ctx context.Context, userID, id string, i InvestmentRequest, now time.Time) (InvestmentResponse, bool, error) {
	out := InvestmentResponse{ID: id, Name: i.Name, ValueCents: i.ValueCents, Serves: i.Serves}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return out, false, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // a no-op after Commit
	tag, err := tx.Exec(ctx, `
		UPDATE finance_investments SET name = $3, value_cents = $4, serves = $5, updated_at = $6
		WHERE id = $1 AND user_id = $2`, id, userID, i.Name, i.ValueCents, i.Serves, now)
	if err != nil || tag.RowsAffected() != 1 {
		return out, false, err
	}
	if err := RecordInvestmentValue(ctx, tx, userID, id, i.ValueCents, now); err != nil {
		return out, false, err
	}
	return out, true, tx.Commit(ctx)
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
