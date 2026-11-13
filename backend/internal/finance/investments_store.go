package finance

import (
	"context"
	"errors"
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
	out := InvestmentResponse{Name: i.Name, ValueCents: i.ValueCents, Serves: &i.Serves, Source: "hand"}
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
	out := InvestmentResponse{ID: id, Name: i.Name, ValueCents: i.ValueCents, Serves: &i.Serves, Source: "hand"}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return out, false, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // a no-op after Commit
	tag, err := tx.Exec(ctx, `
		UPDATE finance_investments SET name = $3, value_cents = $4, serves = $5, updated_at = $6
		WHERE id = $1 AND user_id = $2 AND pluggy_investment_id IS NULL`, id, userID, i.Name, i.ValueCents, i.Serves, now)
	if err != nil || tag.RowsAffected() != 1 {
		return out, false, err
	}
	if err := RecordInvestmentValue(ctx, tx, userID, id, i.ValueCents, now); err != nil {
		return out, false, err
	}
	return out, true, tx.Commit(ctx)
}

// DeleteInvestment removes the User's hand-typed Investment; found is false
// when it is not theirs. A bank Investment is kept (bank is true): the next
// sync would bring it back.
func (s *Store) DeleteInvestment(ctx context.Context, userID, id string) (found, bank bool, err error) {
	tag, err := s.db.Exec(ctx, `DELETE FROM finance_investments WHERE id = $1 AND user_id = $2 AND pluggy_investment_id IS NULL`, id, userID)
	if err != nil || tag.RowsAffected() == 1 {
		return tag.RowsAffected() == 1, false, err
	}
	err = s.db.QueryRow(ctx, `SELECT true FROM finance_investments WHERE id = $1 AND user_id = $2`, id, userID).Scan(&bank)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, false, nil
	}
	return bank, bank, err
}

// SetInvestmentServes picks what the User's Investment serves; found is false
// when it is not theirs. The value is never touched.
func (s *Store) SetInvestmentServes(ctx context.Context, userID, id, serves string, now time.Time) (bool, error) {
	tag, err := s.db.Exec(ctx, `UPDATE finance_investments SET serves = $3, updated_at = $4 WHERE id = $1 AND user_id = $2`, id, userID, serves, now)
	return tag.RowsAffected() == 1, err
}

// BankInvestment is a holding to store: Pluggy's id and name and its BRL value.
type BankInvestment struct {
	PluggyID, Name string
	ValueCents     int64
}

// UpsertBankInvestments stores what the bank reports for one Item, in one
// transaction. A new row has nothing picked; an existing one gets the bank's
// value (unless the User set it) and keeps its name and pick. Rows of the Item
// the bank no longer returns are marked so, never deleted. Each row's value
// goes to the daily history.
func (s *Store) UpsertBankInvestments(ctx context.Context, userID, itemID string, invs []BankInvestment, now time.Time) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)           //nolint:errcheck // a no-op after Commit
	ids := make([]string, len(invs)) // non-nil: a nil slice is NULL in SQL
	for n, inv := range invs {
		ids[n] = inv.PluggyID
		var id string
		var value int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO finance_investments (id, user_id, name, value_cents, serves, created_at, updated_at, item_id, pluggy_investment_id, bank_value_cents, value_set_by, bank_reported)
			VALUES (gen_random_uuid(), $1, $2, $3, NULL, $4, $4, $5, $6, $3, 'bank', true)
			ON CONFLICT (item_id, pluggy_investment_id) DO UPDATE SET
				bank_value_cents = EXCLUDED.bank_value_cents, bank_reported = true, updated_at = EXCLUDED.updated_at,
				value_cents = CASE WHEN finance_investments.value_set_by = 'bank' THEN EXCLUDED.value_cents ELSE finance_investments.value_cents END
			RETURNING id, value_cents`, userID, inv.Name, inv.ValueCents, now, itemID, inv.PluggyID).Scan(&id, &value); err != nil {
			return err
		}
		if err := RecordInvestmentValue(ctx, tx, userID, id, value, now); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE finance_investments SET bank_reported = false
		WHERE item_id = $1 AND user_id = $2 AND bank_reported AND NOT pluggy_investment_id = ANY($3)`, itemID, userID, ids); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Investments lists the User's Investments by name, then id.
func (s *Store) Investments(ctx context.Context, userID string) ([]InvestmentResponse, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, name, value_cents, serves, pluggy_investment_id IS NOT NULL, bank_reported FROM finance_investments
		WHERE user_id = $1 ORDER BY name, id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []InvestmentResponse{}
	for rows.Next() {
		var i InvestmentResponse
		var bank bool
		if err := rows.Scan(&i.ID, &i.Name, &i.ValueCents, &i.Serves, &bank, &i.ReportedByBank); err != nil {
			return nil, err
		}
		if i.Source = "hand"; bank {
			i.Source = "pluggy"
		}
		out = append(out, i)
	}
	return out, rows.Err()
}
