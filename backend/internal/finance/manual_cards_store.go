package finance

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ManualCardInput is a manual card's body once validated. Bills maps a typed
// month to its total; a nil total deletes that month, a month absent is kept.
type ManualCardInput struct {
	Name         string
	DueDay       int
	PixRecipient *string
	Bills        map[time.Time]*int64
}

// ManualCards lists the User's manual cards by name, each with every typed month.
func (s *Store) ManualCards(ctx context.Context, userID string) ([]ManualCard, error) {
	rows, err := s.db.Query(ctx, `SELECT id, name, due_day, pix_recipient FROM finance_manual_cards WHERE user_id = $1 ORDER BY name, id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ManualCard{}
	at := map[string]int{}
	for rows.Next() {
		c := ManualCard{Bills: []ManualBill{}}
		if err := rows.Scan(&c.ID, &c.Name, &c.DueDay, &c.PixRecipient); err != nil {
			return nil, err
		}
		at[c.ID] = len(out)
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	bills, err := s.db.Query(ctx, `SELECT card_id, month, total_cents FROM finance_manual_card_bills WHERE user_id = $1 ORDER BY month`, userID)
	if err != nil {
		return nil, err
	}
	defer bills.Close()
	for bills.Next() {
		var id string
		var b ManualBill
		if err := bills.Scan(&id, &b.Month, &b.TotalCents); err != nil {
			return nil, err
		}
		out[at[id]].Bills = append(out[at[id]].Bills, b)
	}
	return out, bills.Err()
}

// ManualRecipients lists the Pix recipient names marked on the User's manual cards.
func (s *Store) ManualRecipients(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.db.Query(ctx, `SELECT pix_recipient FROM finance_manual_cards WHERE user_id = $1 AND pix_recipient IS NOT NULL`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

// SaveManualCard creates the User's manual card (id empty) or replaces the one
// with id, with its typed months, in one transaction; found is false when id is
// not theirs. When the Pix recipient changes, the import restarts in the same
// transaction (restartImport).
func (s *Store) SaveManualCard(ctx context.Context, userID, id string, in ManualCardInput, now time.Time) (ManualCard, bool, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return ManualCard{}, false, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // a no-op after Commit
	var changed bool
	if id == "" {
		err = tx.QueryRow(ctx, `
			INSERT INTO finance_manual_cards (user_id, name, due_day, pix_recipient, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`, userID, in.Name, in.DueDay, in.PixRecipient, now).Scan(&id)
		changed = in.PixRecipient != nil
	} else {
		err = tx.QueryRow(ctx, `
			UPDATE finance_manual_cards n SET name = $3, due_day = $4, pix_recipient = $5, updated_at = $6
			FROM finance_manual_cards o WHERE n.id = $1 AND n.user_id = $2 AND o.id = n.id
			RETURNING o.pix_recipient IS DISTINCT FROM n.pix_recipient`, id, userID, in.Name, in.DueDay, in.PixRecipient, now).Scan(&changed)
		if errors.Is(err, pgx.ErrNoRows) {
			return ManualCard{}, false, nil
		}
	}
	if err != nil {
		return ManualCard{}, false, err
	}
	for month, cents := range in.Bills {
		if cents == nil {
			_, err = tx.Exec(ctx, `DELETE FROM finance_manual_card_bills WHERE card_id = $1 AND month = $2`, id, month)
		} else {
			_, err = tx.Exec(ctx, `
				INSERT INTO finance_manual_card_bills (card_id, user_id, month, total_cents) VALUES ($1, $2, $3, $4)
				ON CONFLICT (card_id, month) DO UPDATE SET total_cents = EXCLUDED.total_cents`, id, userID, month, *cents)
		}
		if err != nil {
			return ManualCard{}, false, err
		}
	}
	if changed {
		if err := restartImport(ctx, tx, userID); err != nil {
			return ManualCard{}, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return ManualCard{}, false, err
	}
	cards, err := s.ManualCards(ctx, userID)
	for _, c := range cards {
		if c.ID == id {
			return c, true, err
		}
	}
	return ManualCard{}, false, err
}

// DeleteManualCard removes the User's manual card and, by cascade, its bills;
// found is false when it is not theirs. A card that had a Pix recipient restarts the import.
func (s *Store) DeleteManualCard(ctx context.Context, userID, id string) (bool, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // a no-op after Commit
	var had bool
	err = tx.QueryRow(ctx, `DELETE FROM finance_manual_cards WHERE id = $1 AND user_id = $2 RETURNING pix_recipient IS NOT NULL`, id, userID).Scan(&had)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if had {
		if err := restartImport(ctx, tx, userID); err != nil {
			return false, err
		}
	}
	return true, tx.Commit(ctx)
}

// restartImport makes the next sync re-read the 12 months of every Source: the
// counterpart of a Pix is never stored, so only a re-read can reclassify the old
// ones (the reset 0042 did).
func restartImport(ctx context.Context, tx pgx.Tx, userID string) error {
	if _, err := tx.Exec(ctx, `UPDATE finance_sources SET import_cursor = NULL WHERE user_id = $1`, userID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `UPDATE finance_items SET import_complete = false WHERE user_id = $1`, userID)
	return err
}
