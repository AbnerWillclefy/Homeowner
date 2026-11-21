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

// investmentCols and scanInvestment read an InvestmentResponse from finance_investments.
const investmentCols = `id, name, value_cents, serves, pluggy_investment_id IS NOT NULL, bank_reported, bank_value_cents, value_set_by`

func scanInvestment(row pgx.Row) (i InvestmentResponse, err error) {
	var bank bool
	var setBy string
	if err = row.Scan(&i.ID, &i.Name, &i.ValueCents, &i.Serves, &bank, &i.ReportedByBank, &i.BankValueCents, &setBy); err != nil {
		return
	}
	if i.Source = "hand"; bank {
		i.Source, i.Edited = "pluggy", setBy == "user"
	} else {
		i.BankValueCents = nil
	}
	return
}

// UpdateInvestment replaces the User's Investment; found is false when it is not theirs.
// On a bank Investment a value other than the stored one marks it edited, so
// the sync stops overwriting it; the same value, with a new name or pick, does not.
func (s *Store) UpdateInvestment(ctx context.Context, userID, id string, i InvestmentRequest, now time.Time) (InvestmentResponse, bool, error) {
	return s.writeInvestment(ctx, userID, id, now, `
		UPDATE finance_investments SET name = $3, serves = $5, updated_at = $6,
			value_set_by = CASE WHEN value_cents <> $4 THEN 'user' ELSE value_set_by END, value_cents = $4
		WHERE id = $1 AND user_id = $2 RETURNING `+investmentCols, id, userID, i.Name, i.ValueCents, i.Serves, now)
}

// UseBankValue gives the User's bank Investment the bank's value back, so the
// sync follows the bank again. found is false when it is not theirs; ErrNotBank
// when it is theirs but hand-typed.
func (s *Store) UseBankValue(ctx context.Context, userID, id string, now time.Time) (InvestmentResponse, bool, error) {
	i, found, err := s.writeInvestment(ctx, userID, id, now, `
		UPDATE finance_investments SET value_cents = bank_value_cents, value_set_by = 'bank', updated_at = $3
		WHERE id = $1 AND user_id = $2 AND pluggy_investment_id IS NOT NULL RETURNING `+investmentCols, id, userID, now)
	if err == nil && !found {
		var hand bool
		switch e := s.db.QueryRow(ctx, `SELECT true FROM finance_investments WHERE id = $1 AND user_id = $2`, id, userID).Scan(&hand); {
		case e == nil:
			err = ErrNotBank
		case !errors.Is(e, pgx.ErrNoRows):
			err = e
		}
	}
	return i, found, err
}

// ErrNotBank is UseBankValue on a hand-typed Investment.
var ErrNotBank = errors.New("not a bank investment")

// writeInvestment runs an UPDATE ... RETURNING of one Investment and writes its value to today's history.
func (s *Store) writeInvestment(ctx context.Context, userID, id string, now time.Time, query string, args ...any) (InvestmentResponse, bool, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return InvestmentResponse{}, false, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // a no-op after Commit
	out, err := scanInvestment(tx.QueryRow(ctx, query, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return out, false, nil
	}
	if err != nil {
		return out, false, err
	}
	if err := RecordInvestmentValue(ctx, tx, userID, id, out.ValueCents, now); err != nil {
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
	rows, err := s.db.Query(ctx, `SELECT `+investmentCols+` FROM finance_investments WHERE user_id = $1 ORDER BY name, id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []InvestmentResponse{}
	for rows.Next() {
		i, err := scanInvestment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}
