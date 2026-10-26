package admin

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// Overview is what the store reads for GET /admin/overview.
type Overview struct {
	Totals Totals
	Active Active
	// Days holds only the dates with data, keyed by YYYY-MM-DD; ZeroFill adds
	// the rest.
	Days map[string]Day
}

// Overview reads the overview for the dates from..to (YYYY-MM-DD, inclusive)
// in one read-only transaction and three queries: totals, active counts and
// one UNION ALL of every per-day metric. It never loops per day.
func (s *Store) Overview(ctx context.Context, from, to string) (Overview, error) {
	var out Overview
	err := readOnly(ctx, s.db, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, totalsSQL).Scan(
			&out.Totals.Users, &out.Totals.Homes, &out.Totals.Residents, &out.Totals.Chores); err != nil {
			return fmt.Errorf("totals: %w", err)
		}
		if err := tx.QueryRow(ctx, activeSQL, from, to).Scan(&out.Active.Residents, &out.Active.Homes); err != nil {
			return fmt.Errorf("active: %w", err)
		}
		rows, err := tx.Query(ctx, dailySQL, from, to,
			outcomeRejected, reasonRefused, reasonTaken, swapAccepted)
		if err != nil {
			return fmt.Errorf("daily: %w", err)
		}
		defer rows.Close()
		out.Days = map[string]Day{}
		for rows.Next() {
			var date, metric string
			var n int
			if err := rows.Scan(&date, &metric, &n); err != nil {
				return fmt.Errorf("daily: %w", err)
			}
			day := out.Days[date]
			day.Date = date
			switch metric {
			case metricRuns:
				day.Runs = n
			case metricRejected:
				day.Rejected = n
			case metricFallbacks:
				day.Fallbacks = n
			case metricCheckins:
				day.Checkins = n
			case metricCompletions:
				day.Completions = n
			case metricRefuses:
				day.Refuses = n
			case metricTakes:
				day.Takes = n
			case metricSwaps:
				day.SwapsAccepted = n
			case metricPush + pushDelivered:
				day.Pushes.Delivered = n
			case metricPush + pushFailed:
				day.Pushes.Failed = n
			case metricPush + pushGone:
				day.Pushes.Gone = n
			case metricPush + pushUnknown:
				day.Pushes.Unknown = n
			}
			out.Days[date] = day
		}
		return rows.Err()
	})
	return out, err
}

// Metric names of the daily query's second column.
const (
	metricRuns        = "runs"
	metricRejected    = "rejected"
	metricFallbacks   = "fallbacks"
	metricCheckins    = "checkins"
	metricCompletions = "completions"
	metricRefuses     = "refuses"
	metricTakes       = "takes"
	metricSwaps       = "swaps"
	// metricPush starts the push metrics: "push_" + outcome (see dailySQL).
	metricPush  = "push_"
	pushUnknown = "unknown"
)

const totalsSQL = `
SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM homes),
       (SELECT count(*) FROM residents), (SELECT count(*) FROM chores)`

// activeSQL: a Resident is active with a Check-in, a Commitment or a
// Completion on a stored date in $1..$2. UNION de-duplicates the Residents.
const activeSQL = `
WITH active AS (
    SELECT resident_id FROM checkins
     WHERE checkin_date BETWEEN $1::text::date AND $2::text::date
    UNION
    SELECT resident_id FROM task_residents
     WHERE committed_on BETWEEN $1::text::date AND $2::text::date
    UNION
    SELECT cr.resident_id FROM completion_residents cr
      JOIN completions c ON c.id = cr.completion_id
     WHERE c.completed_on BETWEEN $1::text::date AND $2::text::date
)
SELECT count(*), count(DISTINCT r.home_id)
  FROM active a JOIN residents r ON r.id = a.resident_id`

// dailySQL returns (date, metric, count) rows for $1..$2, only where the count
// is above zero. $3 is the rejected outcome, $4 the refused pool reason, $5 the
// taken assignment reason and $6 the accepted swap status. The pool is read
// only when reasons->'pool' is an array.
const dailySQL = `
SELECT day::text, metric, n FROM (
    SELECT plan_date AS day, 'runs' AS metric, count(*) AS n
      FROM allocation_runs WHERE plan_date BETWEEN $1::text::date AND $2::text::date GROUP BY 1
    UNION ALL
    SELECT plan_date, 'rejected', count(*)
      FROM allocation_runs
     WHERE plan_date BETWEEN $1::text::date AND $2::text::date AND outcome = $3 GROUP BY 1
    UNION ALL
    SELECT plan_date, 'fallbacks', count(*)
      FROM allocation_runs
     WHERE plan_date BETWEEN $1::text::date AND $2::text::date AND fallback_reason IS NOT NULL GROUP BY 1
    UNION ALL
    SELECT checkin_date, 'checkins', count(*)
      FROM checkins WHERE checkin_date BETWEEN $1::text::date AND $2::text::date GROUP BY 1
    UNION ALL
    SELECT completed_on, 'completions', count(*)
      FROM completions WHERE completed_on BETWEEN $1::text::date AND $2::text::date GROUP BY 1
    UNION ALL
    SELECT ar.plan_date, 'refuses', count(*)
      FROM allocation_runs ar
      CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(ar.reasons->'pool') = 'array' THEN ar.reasons->'pool' ELSE '[]'::jsonb END) e
     WHERE ar.plan_date BETWEEN $1::text::date AND $2::text::date AND e->>'reason' = $4 GROUP BY 1
    UNION ALL
    SELECT ar.plan_date, 'takes', count(*)
      FROM day_plan_assignments dpa JOIN allocation_runs ar ON ar.id = dpa.run_id
     WHERE ar.plan_date BETWEEN $1::text::date AND $2::text::date AND dpa.reason = $5 GROUP BY 1
    UNION ALL
    SELECT plan_date, 'swaps', count(*)
      FROM swap_offers
     WHERE plan_date BETWEEN $1::text::date AND $2::text::date AND status = $6 GROUP BY 1
    UNION ALL
    SELECT local_date, 'push_' || coalesce(outcome, 'unknown'), count(*)
      FROM nudges WHERE local_date BETWEEN $1::text::date AND $2::text::date GROUP BY 1, 2
) m`
