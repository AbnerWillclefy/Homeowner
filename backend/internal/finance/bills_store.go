package finance

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// CreateBill stores a Bill for the User.
func (s *Store) CreateBill(ctx context.Context, userID string, b BillRequest, now time.Time) (BillResponse, error) {
	out := BillResponse{Name: b.Name, ExpectedCents: b.ExpectedCents, DueDay: b.DueDay}
	err := s.db.QueryRow(ctx, `
		INSERT INTO finance_bills (user_id, name, expected_cents, due_day, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`, userID, b.Name, b.ExpectedCents, b.DueDay, now).Scan(&out.ID)
	return out, err
}

// UpdateBill replaces the User's Bill; found is false when it is not theirs.
func (s *Store) UpdateBill(ctx context.Context, userID, id string, b BillRequest, now time.Time) (BillResponse, bool, error) {
	tag, err := s.db.Exec(ctx, `
		UPDATE finance_bills SET name = $3, expected_cents = $4, due_day = $5, updated_at = $6
		WHERE id = $1 AND user_id = $2`, id, userID, b.Name, b.ExpectedCents, b.DueDay, now)
	return BillResponse{ID: id, Name: b.Name, ExpectedCents: b.ExpectedCents, DueDay: b.DueDay}, tag.RowsAffected() == 1, err
}

// DeleteBill removes the User's Bill and, by cascade, its payments.
func (s *Store) DeleteBill(ctx context.Context, userID, id string) (bool, error) {
	tag, err := s.db.Exec(ctx, `DELETE FROM finance_bills WHERE id = $1 AND user_id = $2`, id, userID)
	return tag.RowsAffected() == 1, err
}

// MonthBills lists the User's Bills with the payment of the month starting at
// month; DueDate is left for the caller. A paid month shows the amount expected
// when it was paid (the Bill's current one for payments made before that was
// recorded), and a Bill is listed only from the month it was created.
func (s *Store) MonthBills(ctx context.Context, userID string, month time.Time) ([]MonthBill, error) {
	rows, err := s.db.Query(ctx, `
		SELECT b.id, b.name, COALESCE(p.expected_cents, b.expected_cents), b.due_day, p.paid_by,
		       CASE p.paid_by WHEN 'bank' THEN COALESCE(-t.amount_cents, p.expected_cents, b.expected_cents)
		                      WHEN 'hand' THEN COALESCE(p.expected_cents, b.expected_cents) END
		FROM finance_bills b
		LEFT JOIN finance_bill_payments p ON p.bill_id = b.id AND p.month = $2 AND p.undone_at IS NULL
		LEFT JOIN finance_transactions t ON t.id = p.transaction_id
		WHERE b.user_id = $1 AND date_trunc('month', b.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $2::date ORDER BY b.due_day, b.name, b.id`, userID, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MonthBill{}
	for rows.Next() {
		var m MonthBill
		if err := rows.Scan(&m.ID, &m.Name, &m.ExpectedCents, &m.DueDay, &m.PaidBy, &m.PaidCents); err != nil {
			return nil, err
		}
		m.Paid = m.PaidBy != nil
		out = append(out, m)
	}
	return out, rows.Err()
}

// PayBillByHand marks the month paid; an existing payment, bank or hand, is
// kept, except an undone one, which becomes a hand payment. found is false when
// the Bill is not the User's.
func (s *Store) PayBillByHand(ctx context.Context, userID, id string, month, now time.Time) (bool, error) {
	var got string
	err := s.db.QueryRow(ctx, `
		INSERT INTO finance_bill_payments (bill_id, user_id, month, paid_by, paid_at, expected_cents)
		SELECT id, user_id, $3, 'hand', $4, expected_cents FROM finance_bills WHERE id = $1 AND user_id = $2
		ON CONFLICT (bill_id, month) DO UPDATE SET
			paid_by = CASE WHEN finance_bill_payments.undone_at IS NULL THEN finance_bill_payments.paid_by ELSE 'hand' END,
			transaction_id = CASE WHEN finance_bill_payments.undone_at IS NULL THEN finance_bill_payments.transaction_id END,
			paid_at = CASE WHEN finance_bill_payments.undone_at IS NULL THEN finance_bill_payments.paid_at ELSE EXCLUDED.paid_at END,
			expected_cents = CASE WHEN finance_bill_payments.undone_at IS NULL THEN finance_bill_payments.expected_cents ELSE EXCLUDED.expected_cents END,
			undone_at = NULL
		RETURNING bill_id`, id, userID, month, now).Scan(&got)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// PayBillsFromBank pays the User's Bills from the Expenses posted in [from, to)
// that no payment links yet. The payment rows already there, undone ones
// included, are never paid again, and the two unique keys make a repeated run
// insert nothing.
func (s *Store) PayBillsFromBank(ctx context.Context, userID string, from, to, now time.Time) error {
	var bills []Bill
	rows, err := s.db.Query(ctx, `SELECT id, name, expected_cents FROM finance_bills WHERE user_id = $1`, userID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var b Bill
		if err := rows.Scan(&b.ID, &b.Name, &b.ExpectedCents); err != nil {
			rows.Close()
			return err
		}
		bills = append(bills, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(bills) == 0 {
		return err
	}
	taken := map[billMonth]bool{}
	rows, err = s.db.Query(ctx, `SELECT bill_id, month FROM finance_bill_payments WHERE user_id = $1`, userID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var k billMonth
		if err := rows.Scan(&k.BillID, &k.Month); err != nil {
			rows.Close()
			return err
		}
		taken[k] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	var txns []Txn
	rows, err = s.db.Query(ctx, `
		SELECT t.id, t.description, t.posted_on, t.amount_cents, t.type FROM finance_transactions t
		WHERE t.user_id = $1 AND t.type = 'expense' AND t.posted_on >= $2 AND t.posted_on < $3
		  AND NOT EXISTS (SELECT 1 FROM finance_bill_payments p WHERE p.transaction_id = t.id)`, userID, from, to)
	if err != nil {
		return err
	}
	for rows.Next() {
		var t Txn
		if err := rows.Scan(&t.ID, &t.Description, &t.PostedOn, &t.AmountCents, &t.Type); err != nil {
			rows.Close()
			return err
		}
		txns = append(txns, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	matches := MatchBills(bills, txns, taken)
	if len(matches) == 0 {
		return nil
	}
	billIDs, months, txnIDs := make([]string, len(matches)), make([]time.Time, len(matches)), make([]string, len(matches))
	for i, m := range matches {
		billIDs[i], months[i], txnIDs[i] = m.BillID, m.Month, m.TxnID
	}
	_, err = s.db.Exec(ctx, `
		INSERT INTO finance_bill_payments (bill_id, user_id, month, paid_by, transaction_id, paid_at, expected_cents)
		SELECT m.bill_id, $1, m.month, 'bank', m.transaction_id, $5, b.expected_cents
		FROM unnest($2::uuid[], $3::date[], $4::uuid[]) AS m (bill_id, month, transaction_id)
		JOIN finance_bills b ON b.id = m.bill_id
		WHERE m.month >= date_trunc('month', b.created_at AT TIME ZONE 'America/Sao_Paulo')::date -- not listed before the created month
		ON CONFLICT DO NOTHING`, userID, billIDs, months, txnIDs, now)
	return err
}

// UnpayBill undoes the month payment: a hand one is deleted, a bank one stays
// as a tombstone (undone_at) so the matcher never pays that month again. found
// is false when the Bill is not the User's.
func (s *Store) UnpayBill(ctx context.Context, userID, id string, month, now time.Time) (bool, error) {
	var got string
	err := s.db.QueryRow(ctx, `
		WITH b AS (SELECT id FROM finance_bills WHERE id = $1 AND user_id = $2),
		     d AS (DELETE FROM finance_bill_payments WHERE bill_id IN (SELECT id FROM b) AND month = $3 AND paid_by = 'hand'),
		     u AS (UPDATE finance_bill_payments SET undone_at = COALESCE(undone_at, $4)
		           WHERE bill_id IN (SELECT id FROM b) AND month = $3 AND paid_by = 'bank')
		SELECT id FROM b`, id, userID, month, now).Scan(&got)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}
