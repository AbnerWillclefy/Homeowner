package choresettings

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
)

// ResidentView is one Resident's effective settings on every Chore of the
// Home, keyed by Chore id. Never nil.
type ResidentView struct {
	ResidentID string
	Chores     map[string]Effective
}

type settingKey struct{ resident, chore string }

// Effective returns the effective settings of every Resident of the Home on
// every Chore of the Home, Residents in joining order. Everything is read for
// homeID only, in one read-only snapshot, so a write landing mid-request
// cannot make the Residents, Chores, settings and profiles disagree. It is a
// fixed number of queries however many Residents there are.
func (s *Store) Effective(ctx context.Context, homeID string) ([]ResidentView, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, fmt.Errorf("begin effective read: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cs, err := chores.ListIn(ctx, tx, homeID)
	if err != nil {
		return nil, err
	}

	type resident struct{ id, userID string }
	rows, err := tx.Query(ctx,
		`SELECT id, user_id FROM residents WHERE home_id = $1 ORDER BY created_at, id`, homeID)
	if err != nil {
		return nil, fmt.Errorf("list residents: %w", err)
	}
	residents, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (x resident, err error) {
		return x, r.Scan(&x.id, &x.userID)
	})
	if err != nil {
		return nil, fmt.Errorf("list residents: %w", err)
	}

	prefs, err := collectKeyed(ctx, tx, "load specific preferences", `
		SELECT p.resident_id, p.chore_id, p.preference
		FROM resident_chore_preferences p JOIN residents r ON r.id = p.resident_id
		WHERE r.home_id = $1`, homeID,
		func(r pgx.CollectableRow) (k settingKey, p string, err error) {
			return k, p, r.Scan(&k.resident, &k.chore, &p)
		})
	if err != nil {
		return nil, err
	}
	restricted, err := collectKeyed(ctx, tx, "load specific restrictions", `
		SELECT q.resident_id, q.chore_id
		FROM resident_chore_restrictions q JOIN residents r ON r.id = q.resident_id
		WHERE r.home_id = $1`, homeID,
		func(r pgx.CollectableRow) (k settingKey, set bool, err error) {
			return k, true, r.Scan(&k.resident, &k.chore)
		})
	if err != nil {
		return nil, err
	}

	userIDs := make([]string, len(residents))
	for i, r := range residents {
		userIDs[i] = r.userID
	}
	profiles, err := profile.LoadMany(ctx, tx, userIDs)
	if err != nil {
		return nil, err
	}

	out := make([]ResidentView, 0, len(residents))
	for _, r := range residents {
		p := profiles[r.userID]
		g := General{Preferences: p.Preferences, Restrictions: p.Restrictions}
		v := ResidentView{ResidentID: r.id, Chores: make(map[string]Effective, len(cs))}
		for _, c := range cs {
			k := settingKey{r.id, c.ID}
			v.Chores[c.ID] = Resolve(Chore{Category: c.Category, Demands: c.Demands}, g,
				Specific{Preference: prefs[k], Restricted: restricted[k]})
		}
		out = append(out, v)
	}
	return out, nil
}

// collectKeyed runs one query with a single argument and gathers its rows
// into a map. what names the query in errors.
func collectKeyed[V any](ctx context.Context, q chores.Querier, what, sql string, arg any,
	scan func(pgx.CollectableRow) (settingKey, V, error)) (map[settingKey]V, error) {
	rows, err := q.Query(ctx, sql, arg)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", what, err)
	}
	type entry struct {
		k settingKey
		v V
	}
	entries, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (entry, error) {
		k, v, err := scan(r)
		return entry{k, v}, err
	})
	if err != nil {
		return nil, fmt.Errorf("%s: %w", what, err)
	}
	out := make(map[settingKey]V, len(entries))
	for _, e := range entries {
		out[e.k] = e.v
	}
	return out, nil
}
