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
			outcomeRejected, reasonRefused, reasonTaken, swapAccepted,
			pushDelivered, pushFailed, pushGone)
		if err != nil {
			return fmt.Errorf("daily: %w", err)
		}
		defer rows.Close()
		out.Days = map[string]Day{}
		for rows.Next() {
			var d Day
			if err := rows.Scan(&d.Date, &d.Runs, &d.Rejected, &d.Fallbacks, &d.Checkins,
				&d.Completions, &d.Refuses, &d.Takes, &d.SwapsAccepted,
				&d.Pushes.Delivered, &d.Pushes.Failed, &d.Pushes.Gone, &d.Pushes.Unknown); err != nil {
				return fmt.Errorf("daily: %w", err)
			}
			out.Days[d.Date] = d
		}
		return rows.Err()
	})
	return out, err
}

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

// dailySQL returns one row per date in $1..$2 that has data, with one count
// per Day field in Scan order. $3 is the rejected outcome, $4 the refused pool
// reason, $5 the taken assignment reason, $6 the accepted swap status and
// $7..$9 the delivered, failed and gone push outcomes (a NULL outcome is
// unknown). Each source selects its own counts and zeros for the rest; the
// outer query sums them per date. The pool is read only when reasons->'pool'
// is an array.
const dailySQL = `
WITH w AS (SELECT $1::text::date AS lo, $2::text::date AS hi)
SELECT day::text, sum(runs)::int, sum(rejected)::int, sum(fallbacks)::int, sum(checkins)::int,
       sum(completions)::int, sum(refuses)::int, sum(takes)::int, sum(swaps)::int,
       sum(delivered)::int, sum(failed)::int, sum(gone)::int, sum(unknown)::int
FROM (
    SELECT plan_date AS day, count(*) AS runs,
           count(*) FILTER (WHERE outcome = $3) AS rejected,
           count(*) FILTER (WHERE fallback_reason IS NOT NULL) AS fallbacks,
           0 AS checkins, 0 AS completions, 0 AS refuses, 0 AS takes, 0 AS swaps,
           0 AS delivered, 0 AS failed, 0 AS gone, 0 AS unknown
      FROM allocation_runs, w WHERE plan_date BETWEEN w.lo AND w.hi GROUP BY 1
    UNION ALL
    SELECT checkin_date, 0, 0, 0, count(*), 0, 0, 0, 0, 0, 0, 0, 0
      FROM checkins, w WHERE checkin_date BETWEEN w.lo AND w.hi GROUP BY 1
    UNION ALL
    SELECT completed_on, 0, 0, 0, 0, count(*), 0, 0, 0, 0, 0, 0, 0
      FROM completions, w WHERE completed_on BETWEEN w.lo AND w.hi GROUP BY 1
    UNION ALL
    SELECT ar.plan_date, 0, 0, 0, 0, 0, count(*), 0, 0, 0, 0, 0, 0
      FROM allocation_runs ar, w
      CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(ar.reasons->'pool') = 'array' THEN ar.reasons->'pool' ELSE '[]'::jsonb END) e
     WHERE ar.plan_date BETWEEN w.lo AND w.hi AND e->>'reason' = $4 GROUP BY 1
    UNION ALL
    SELECT ar.plan_date, 0, 0, 0, 0, 0, 0, count(*), 0, 0, 0, 0, 0
      FROM day_plan_assignments dpa JOIN allocation_runs ar ON ar.id = dpa.run_id, w
     WHERE ar.plan_date BETWEEN w.lo AND w.hi AND dpa.reason = $5 GROUP BY 1
    UNION ALL
    SELECT plan_date, 0, 0, 0, 0, 0, 0, 0, count(*), 0, 0, 0, 0
      FROM swap_offers, w WHERE plan_date BETWEEN w.lo AND w.hi AND status = $6 GROUP BY 1
    UNION ALL
    SELECT local_date, 0, 0, 0, 0, 0, 0, 0, 0,
           count(*) FILTER (WHERE outcome = $7), count(*) FILTER (WHERE outcome = $8),
           count(*) FILTER (WHERE outcome = $9), count(*) FILTER (WHERE outcome IS NULL)
      FROM nudges, w WHERE local_date BETWEEN w.lo AND w.hi GROUP BY 1
) m
GROUP BY day`
