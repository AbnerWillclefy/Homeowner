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
// month; DueDate is left for the caller.
func (s *Store) MonthBills(ctx context.Context, userID string, month time.Time) ([]MonthBill, error) {
	rows, err := s.db.Query(ctx, `
		SELECT b.id, b.name, b.expected_cents, b.due_day, p.paid_by
		FROM finance_bills b
		LEFT JOIN finance_bill_payments p ON p.bill_id = b.id AND p.month = $2
		WHERE b.user_id = $1 ORDER BY b.due_day, b.name, b.id`, userID, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MonthBill{}
	for rows.Next() {
		var m MonthBill
		if err := rows.Scan(&m.ID, &m.Name, &m.ExpectedCents, &m.DueDay, &m.PaidBy); err != nil {
			return nil, err
		}
		m.Paid = m.PaidBy != nil
		out = append(out, m)
	}
	return out, rows.Err()
}

// PayBillByHand marks the month paid; an existing payment, bank or hand, is
// kept. found is false when the Bill is not the User's.
func (s *Store) PayBillByHand(ctx context.Context, userID, id string, month, now time.Time) (bool, error) {
	var got string
	err := s.db.QueryRow(ctx, `
		INSERT INTO finance_bill_payments (bill_id, user_id, month, paid_by, paid_at)
		SELECT id, user_id, $3, 'hand', $4 FROM finance_bills WHERE id = $1 AND user_id = $2
		ON CONFLICT (bill_id, month) DO UPDATE SET paid_at = finance_bill_payments.paid_at
		RETURNING bill_id`, id, userID, month, now).Scan(&got)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// UnpayBill deletes the month payment; found is false when the Bill is not the
// User's. The time is unused, so it fits the same handler as PayBillByHand.
func (s *Store) UnpayBill(ctx context.Context, userID, id string, month, _ time.Time) (bool, error) {
	var got string
	err := s.db.QueryRow(ctx, `
		WITH b AS (SELECT id FROM finance_bills WHERE id = $1 AND user_id = $2),
		     d AS (DELETE FROM finance_bill_payments WHERE bill_id IN (SELECT id FROM b) AND month = $3)
		SELECT id FROM b`, id, userID, month).Scan(&got)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}
