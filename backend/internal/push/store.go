package push

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound means no subscription is stored for the endpoint.
var ErrNotFound = errors.New("push subscription not found")

// Store keeps push subscriptions, one row per device endpoint.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// The apps a subscription can belong to. A browser issues one endpoint per
// origin, so an endpoint belongs to exactly one app.
const (
	AppHomeowner = "homeowner"
	AppRevenue   = "revenue"
)

// Upsert stores sub for the User userID in app, replacing the keys and owner of an
// existing row for the same endpoint (a device re-registered by another
// signed-in User moves to them, as on a shared phone). now is the time to
// record (taken from the injected clock).
func (s *Store) Upsert(ctx context.Context, userID string, sub Subscription, app, userAgent string, now time.Time) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, app, user_agent, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $7)
		ON CONFLICT (endpoint) DO UPDATE
		SET user_id = EXCLUDED.user_id,
		    p256dh = EXCLUDED.p256dh,
		    auth = EXCLUDED.auth,
		    app = EXCLUDED.app,
		    user_agent = EXCLUDED.user_agent,
		    updated_at = EXCLUDED.updated_at`,
		userID, sub.Endpoint, sub.P256dh, sub.Auth, app, userAgent, now)
	if err != nil {
		return fmt.Errorf("upsert push subscription: %w", err)
	}
	return nil
}

// Get returns the subscription for endpoint if it belongs to userID, or
// ErrNotFound. A row owned by another User, or by nobody, is not found.
func (s *Store) Get(ctx context.Context, userID, endpoint string) (Subscription, error) {
	sub := Subscription{Endpoint: endpoint}
	err := s.db.QueryRow(ctx,
		`SELECT p256dh, auth FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`, endpoint, userID).
		Scan(&sub.P256dh, &sub.Auth)
	if errors.Is(err, pgx.ErrNoRows) {
		return Subscription{}, ErrNotFound
	}
	if err != nil {
		return Subscription{}, fmt.Errorf("get push subscription: %w", err)
	}
	return sub, nil
}

// ListByUsers returns every stored subscription in app of each of userIDs, by User id,
// in one query. A User with no device is absent from the map. Selecting by
// user_id (never by endpoint) keeps a shared phone's subscription with the
// User who registered it last.
func (s *Store) ListByUsers(ctx context.Context, userIDs []string, app string) (map[string][]Subscription, error) {
	out := map[string][]Subscription{}
	if len(userIDs) == 0 {
		return out, nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions
		WHERE user_id = ANY($1::uuid[]) AND app = $2 ORDER BY user_id, created_at, endpoint`, userIDs, app)
	if err != nil {
		return nil, fmt.Errorf("list push subscriptions: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var user string
		var sub Subscription
		if err := rows.Scan(&user, &sub.Endpoint, &sub.P256dh, &sub.Auth); err != nil {
			return nil, fmt.Errorf("list push subscriptions: %w", err)
		}
		out[user] = append(out[user], sub)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list push subscriptions: %w", err)
	}
	return out, nil
}

// DeleteOwn removes the subscription for endpoint if it belongs to userID; no
// match is not an error.
func (s *Store) DeleteOwn(ctx context.Context, userID, endpoint string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`, endpoint, userID); err != nil {
		return fmt.Errorf("delete own push subscription: %w", err)
	}
	return nil
}

// Delete removes the subscription for endpoint; a missing row is not an error.
func (s *Store) Delete(ctx context.Context, endpoint string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1`, endpoint); err != nil {
		return fmt.Errorf("delete push subscription: %w", err)
	}
	return nil
}

// Deliver sends payload to sub and drops the stored subscription when the push
// service reports it gone (the error still wraps ErrGone). Batch senders reuse
// it so every caller prunes rejected subscriptions the same way.
func (s *Store) Deliver(ctx context.Context, sender Sender, sub Subscription, payload Payload) error {
	err := sender.Send(ctx, sub, payload)
	if errors.Is(err, ErrGone) {
		if derr := s.Delete(ctx, sub.Endpoint); derr != nil {
			return errors.Join(err, derr)
		}
	}
	return err
}
