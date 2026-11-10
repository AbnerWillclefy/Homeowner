package finance

import (
	"context"
	"time"
)

// monthText formats a stored first-of-month date as YYYY-MM; nil stays nil.
func monthText(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format("2006-01")
	return &s
}

// CreateGoal stores a Goal last in the User's order. The position is computed in
// the INSERT; two creates at once collide on the unique constraint (23505)
// instead of sharing a position, and the handler answers 409.
func (s *Store) CreateGoal(ctx context.Context, userID string, g GoalInput, now time.Time) (GoalResponse, error) {
	out := GoalResponse{Name: g.Name, TargetCents: g.TargetCents, TargetMonth: monthText(g.TargetMonth)}
	err := s.db.QueryRow(ctx, `
		INSERT INTO finance_goals (id, user_id, name, target_cents, position, target_month, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, (SELECT COALESCE(max(position), 0) + 1 FROM finance_goals WHERE user_id = $1), $4, $5, $5)
		RETURNING id`, userID, g.Name, g.TargetCents, g.TargetMonth, now).Scan(&out.ID)
	return out, err
}

// UpdateGoal changes the User's Goal; found is false when it is not theirs.
func (s *Store) UpdateGoal(ctx context.Context, userID, id string, g GoalInput, now time.Time) (GoalResponse, bool, error) {
	tag, err := s.db.Exec(ctx, `
		UPDATE finance_goals SET name = $3, target_cents = $4, target_month = $5, updated_at = $6
		WHERE id = $1 AND user_id = $2`, id, userID, g.Name, g.TargetCents, g.TargetMonth, now)
	return GoalResponse{ID: id, Name: g.Name, TargetCents: g.TargetCents, TargetMonth: monthText(g.TargetMonth)}, tag.RowsAffected() == 1, err
}

// DeleteGoal removes the User's Goal, leaving a gap in the positions.
func (s *Store) DeleteGoal(ctx context.Context, userID, id string) (bool, error) {
	tag, err := s.db.Exec(ctx, `DELETE FROM finance_goals WHERE id = $1 AND user_id = $2`, id, userID)
	return tag.RowsAffected() == 1, err
}

// ReorderGoals makes ids the User's order. It locks the User's Goals and, only
// when ids is exactly their set (same length, no repeats, same members), writes
// positions 1..n; otherwise same is false and nothing is written. The unique
// constraint is deferred, so positions may collide until commit.
func (s *Store) ReorderGoals(ctx context.Context, userID string, ids []string, now time.Time) (same bool, err error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `SELECT id FROM finance_goals WHERE user_id = $1 FOR UPDATE`, userID)
	if err != nil {
		return false, err
	}
	have := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return false, err
		}
		have[id] = true
	}
	if err := rows.Err(); err != nil {
		return false, err
	}
	if len(ids) != len(have) {
		return false, nil
	}
	for _, id := range ids {
		if !have[id] {
			return false, nil
		}
		delete(have, id) // a repeat finds it gone
	}
	for i, id := range ids {
		if _, err := tx.Exec(ctx, `UPDATE finance_goals SET position = $3, updated_at = $4 WHERE id = $1 AND user_id = $2`, id, userID, i+1, now); err != nil {
			return false, err
		}
	}
	return true, tx.Commit(ctx)
}

// Goals lists the User's Goals in order.
func (s *Store) Goals(ctx context.Context, userID string) ([]GoalResponse, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, name, target_cents, target_month FROM finance_goals WHERE user_id = $1 ORDER BY position`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []GoalResponse{}
	for rows.Next() {
		var g GoalResponse
		var m *time.Time
		if err := rows.Scan(&g.ID, &g.Name, &g.TargetCents, &m); err != nil {
			return nil, err
		}
		g.TargetMonth = monthText(m)
		out = append(out, g)
	}
	return out, rows.Err()
}
