package finance

import (
	"context"
	"time"
)

// SuggestionInputs reads what SuggestBills needs for the three complete months
// before now: the User's charges with their Bill-payment link, the Bills and
// the dismissed merchant keys.
func (s *Store) SuggestionInputs(ctx context.Context, userID string, from, to time.Time) (txns []Txn, bills []Bill, dismissed map[string]bool, err error) {
	rows, err := s.db.Query(ctx, `
		SELECT t.posted_on, t.amount_cents, t.type, t.merchant_key, t.description, t.installment_number IS NOT NULL,
		       EXISTS (SELECT 1 FROM finance_bill_payments p WHERE p.transaction_id = t.id)
		FROM finance_transactions t
		WHERE t.user_id = $1 AND t.posted_on >= $2 AND t.posted_on < $3`, userID, from, to)
	if err != nil {
		return nil, nil, nil, err
	}
	for rows.Next() {
		var t Txn
		if err = rows.Scan(&t.PostedOn, &t.AmountCents, &t.Type, &t.MerchantKey, &t.Description, &t.Installment, &t.Linked); err != nil {
			rows.Close()
			return nil, nil, nil, err
		}
		txns = append(txns, t)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return nil, nil, nil, err
	}
	if rows, err = s.db.Query(ctx, `SELECT id, name, expected_cents FROM finance_bills WHERE user_id = $1`, userID); err != nil {
		return nil, nil, nil, err
	}
	for rows.Next() {
		var b Bill
		if err = rows.Scan(&b.ID, &b.Name, &b.ExpectedCents); err != nil {
			rows.Close()
			return nil, nil, nil, err
		}
		bills = append(bills, b)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return nil, nil, nil, err
	}
	if rows, err = s.db.Query(ctx, `SELECT merchant_key FROM finance_bill_suggestion_dismissals WHERE user_id = $1`, userID); err != nil {
		return nil, nil, nil, err
	}
	defer rows.Close()
	dismissed = map[string]bool{}
	for rows.Next() {
		var k string
		if err = rows.Scan(&k); err != nil {
			return nil, nil, nil, err
		}
		dismissed[k] = true
	}
	return txns, bills, dismissed, rows.Err()
}

// DismissSuggestion records the dismissal; a repeat changes nothing.
func (s *Store) DismissSuggestion(ctx context.Context, userID, merchantKey string, now time.Time) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO finance_bill_suggestion_dismissals (user_id, merchant_key, dismissed_at) VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING`, userID, merchantKey, now)
	return err
}
