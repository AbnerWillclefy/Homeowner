package finance

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// SetReserveTarget stores the Emergency reserve target; nil clears it. Only
// its own column changes, so the Monthly income and contribution stay.
func (s *Store) SetReserveTarget(ctx context.Context, userID string, cents *int64, now time.Time) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO finance_settings (user_id, reserve_target_cents, updated_at) VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET reserve_target_cents = $2, updated_at = $3`,
		userID, cents, now)
	return err
}

// SetContribution stores the Monthly contribution base and the reserve's share
// of it; both nil clear both.
func (s *Store) SetContribution(ctx context.Context, userID string, base *int64, sharePercent *int16, now time.Time) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO finance_settings (user_id, contribution_base_cents, reserve_share_percent, updated_at) VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id) DO UPDATE SET contribution_base_cents = $2, reserve_share_percent = $3, updated_at = $4`,
		userID, base, sharePercent, now)
	return err
}

// SavingsSettings returns the three savings settings, nil where not set.
func (s *Store) SavingsSettings(ctx context.Context, userID string) (reserve, base *int64, share *int16, err error) {
	err = s.db.QueryRow(ctx, `
		SELECT reserve_target_cents, contribution_base_cents, reserve_share_percent
		FROM finance_settings WHERE user_id = $1`, userID).Scan(&reserve, &base, &share)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, nil, nil
	}
	return reserve, base, share, err
}
