package dayplan

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/choresettings"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/profile"
)

// nest runs the query, which must select a Resident id, a Chore id and one
// more column, and returns the third column by Resident id then Chore id. conv
// turns the scanned value into the stored one.
func nest[S, V any](ctx context.Context, q pgx.Tx, what, sql string, args []any, conv func(S) V) (map[string]map[string]V, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("load %s: %w", what, err)
	}
	type row struct {
		resident, chore string
		value           S
	}
	rs, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (x row, err error) {
		return x, r.Scan(&x.resident, &x.chore, &x.value)
	})
	if err != nil {
		return nil, fmt.Errorf("load %s: %w", what, err)
	}
	out := map[string]map[string]V{}
	for _, x := range rs {
		if out[x.resident] == nil {
			out[x.resident] = map[string]V{}
		}
		out[x.resident][x.chore] = conv(x.value)
	}
	return out, nil
}

// loadSpecificPreferences returns the Preference each Resident set on a Chore,
// by Resident id then Chore id.
func loadSpecificPreferences(ctx context.Context, q pgx.Tx, homeID string) (map[string]map[string]string, error) {
	return nest(ctx, q, "preferences", `
		SELECT p.resident_id, p.chore_id, p.preference
		FROM resident_chore_preferences p JOIN residents r ON r.id = p.resident_id
		WHERE r.home_id = $1`, []any{homeID}, func(s string) string { return s })
}

// preferencesOf resolves the Resident's effective Preference for each Chore of
// the Home (a specific one beats the general one for the Category) and keeps
// the non-neutral ones. choresettings.Resolve holds the rule.
func preferencesOf(p profile.Profile, homeChores []chores.Chore, specific map[string]string) map[string]allocation.Preference {
	general := choresettings.General{Preferences: p.Preferences, Restrictions: p.Restrictions}
	out := map[string]allocation.Preference{}
	for _, c := range homeChores {
		e := choresettings.Resolve(choresettings.Chore{Category: c.Category, Demands: c.Demands}, general,
			choresettings.Specific{Preference: specific[c.ID]})
		switch e.Preference {
		case choresettings.Like:
			out[c.ID] = allocation.Like
		case choresettings.Dislike:
			out[c.ID] = allocation.Dislike
		}
	}
	return out
}

// loadLastDone returns, by Resident id then Chore id, the Date of the
// Resident's latest Completion of the Chore on or before today. It is the
// Chore's last Completion, not the Task's, because the Task changes every
// round. A two-person Completion counts for both partners.
func loadLastDone(ctx context.Context, q pgx.Tx, homeID string, today allocation.Date) (map[string]map[string]allocation.Date, error) {
	return nest(ctx, q, "last done", `
		SELECT cr.resident_id, t.chore_id, max(c.completed_on)
		FROM completion_residents cr
		JOIN completions c ON c.id = cr.completion_id
		JOIN tasks t ON t.id = c.task_id
		JOIN chores ch ON ch.id = t.chore_id
		WHERE ch.home_id = $1 AND c.completed_on <= $2
		GROUP BY cr.resident_id, t.chore_id`, []any{homeID, today.Time()},
		func(on time.Time) allocation.Date { return allocation.DateOf(on) })
}
