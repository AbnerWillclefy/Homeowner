package admin

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// Worth is what the store reads for GET /admin/worth.
type Worth struct {
	Current  WorthCounts
	Previous WorthCounts
	// Days holds only the dates of the current window that have data.
	Days map[string]WorthCounts
	// MonthEstCostMicros and MonthUncostedCalls cover the UTC calendar month,
	// read by the same code as GET /admin/ai.
	MonthEstCostMicros int64
	MonthUncostedCalls int
}

// Worth reads the counts for the current window and the one before it, both
// lists of YYYY-MM-DD dates oldest first, and the UTC month of now, in one
// read-only transaction.
//
// Each measure is one query over prev.first..cur.last grouped by day. Every
// count is per day, so the days are then split in Go: those of the current
// window are kept and summed into Current, the rest are summed into Previous.
// The days therefore add up to Current by construction.
func (s *Store) Worth(ctx context.Context, cur, prev []string, now time.Time) (Worth, error) {
	out := Worth{Days: map[string]WorthCounts{}}
	from, to := prev[0], cur[len(cur)-1]
	inCurrent := make(map[string]bool, len(cur))
	for _, d := range cur {
		inCurrent[d] = true
	}
	perDay := map[string]*WorthCounts{}
	day := func(date string) *WorthCounts {
		c := perDay[date]
		if c == nil {
			c = &WorthCounts{}
			perDay[date] = c
		}
		return c
	}

	err := readOnly(ctx, s.db, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, worthOutcomeSQL, from, to, allocatorLLM, outcomePlanned, reasonTaken, reasonRefused)
		if err != nil {
			return fmt.Errorf("worth outcome: %w", err)
		}
		for rows.Next() {
			var date, arm string
			var a ArmOutcome
			if err := rows.Scan(&date, &arm, &a.Proposed, &a.Completed, &a.Refused); err != nil {
				rows.Close()
				return fmt.Errorf("worth outcome: %w", err)
			}
			if arm == "llm" {
				day(date).Outcome.LLM = a
			} else {
				day(date).Outcome.Baseline = a
			}
		}
		if err := rows.Err(); err != nil {
			return fmt.Errorf("worth outcome: %w", err)
		}

		rows, err = tx.Query(ctx, worthRunsSQL, from, to, allocatorLLM)
		if err != nil {
			return fmt.Errorf("worth runs: %w", err)
		}
		for rows.Next() {
			var date string
			var r WorthReliability
			if err := rows.Scan(&date, &r.RunsLLM, &r.RunsFallback, &r.RunsLLMNotAsked); err != nil {
				rows.Close()
				return fmt.Errorf("worth runs: %w", err)
			}
			c := day(date)
			c.Reliability.RunsLLM, c.Reliability.RunsFallback, c.Reliability.RunsLLMNotAsked =
				r.RunsLLM, r.RunsFallback, r.RunsLLMNotAsked
		}
		if err := rows.Err(); err != nil {
			return fmt.Errorf("worth runs: %w", err)
		}

		rows, err = tx.Query(ctx, worthCallsSQL, from, to, serviceAllocator)
		if err != nil {
			return fmt.Errorf("worth calls: %w", err)
		}
		for rows.Next() {
			var date string
			var calls, rejected int
			var cost WorthCost
			if err := rows.Scan(&date, &calls, &rejected, &cost.AllocatorCostMicros, &cost.UncostedCalls); err != nil {
				rows.Close()
				return fmt.Errorf("worth calls: %w", err)
			}
			c := day(date)
			c.Reliability.AllocatorCalls, c.Reliability.RefereeRejected, c.Cost = calls, rejected, cost
		}
		if err := rows.Err(); err != nil {
			return fmt.Errorf("worth calls: %w", err)
		}

		rows, err = tx.Query(ctx, worthExplanationsSQL, from, to, outcomePlanned)
		if err != nil {
			return fmt.Errorf("worth explanations: %w", err)
		}
		for rows.Next() {
			var date string
			var llm, pairs int
			if err := rows.Scan(&date, &llm, &pairs); err != nil {
				rows.Close()
				return fmt.Errorf("worth explanations: %w", err)
			}
			// The same rule as readExplanationShare, applied per day.
			day(date).Explanations = WorthExplanations{LLM: llm, Template: max(pairs-llm, 0)}
		}
		if err := rows.Err(); err != nil {
			return fmt.Errorf("worth explanations: %w", err)
		}

		out.MonthEstCostMicros, out.MonthUncostedCalls, err = readMonth(ctx, tx, now)
		return err
	})
	if err != nil {
		return Worth{}, err
	}
	for date, c := range perDay {
		if inCurrent[date] {
			out.Days[date] = *c
			out.Current = out.Current.add(*c)
		} else {
			out.Previous = out.Previous.add(*c)
		}
	}
	return out, nil
}

// add returns the sum of two sets of counts.
func (a WorthCounts) add(b WorthCounts) WorthCounts {
	a.Outcome.LLM = a.Outcome.LLM.add(b.Outcome.LLM)
	a.Outcome.Baseline = a.Outcome.Baseline.add(b.Outcome.Baseline)
	a.Reliability.RunsLLM += b.Reliability.RunsLLM
	a.Reliability.RunsFallback += b.Reliability.RunsFallback
	a.Reliability.RunsLLMNotAsked += b.Reliability.RunsLLMNotAsked
	a.Reliability.AllocatorCalls += b.Reliability.AllocatorCalls
	a.Reliability.RefereeRejected += b.Reliability.RefereeRejected
	a.Cost.AllocatorCostMicros += b.Cost.AllocatorCostMicros
	a.Cost.UncostedCalls += b.Cost.UncostedCalls
	a.Explanations.LLM += b.Explanations.LLM
	a.Explanations.Template += b.Explanations.Template
	return a
}

func (a ArmOutcome) add(b ArmOutcome) ArmOutcome {
	return ArmOutcome{a.Proposed + b.Proposed, a.Completed + b.Completed, a.Refused + b.Refused}
}

// worthOutcomeSQL: per (plan date, arm) of the planned runs, the Tasks the
// plan proposed and how they ended. $3 is the LLM allocator's name, $4 the
// planned outcome, $5 the taken assignment reason and $6 the refused pool
// reason.
//
// A proposed Task is a distinct (run, Task) assignment not taken from the pool
// (a two-person Task has two rows), or a refused entry of the run's pool. A
// refusal deletes the Task's assignment rows, so the two never overlap. The
// pool is read only when reasons->'pool' is an array. A Task is completed when
// it has a Completion on the plan date; completions.task_id is unique, so the
// join matches at most one row.
const worthOutcomeSQL = `
WITH runs AS (
    SELECT id, plan_date, CASE WHEN allocator = $3 THEN 'llm' ELSE 'baseline' END AS arm, reasons
      FROM allocation_runs
     WHERE plan_date BETWEEN $1::text::date AND $2::text::date AND outcome = $4
), proposed AS (
    SELECT r.plan_date, r.arm, a.task_id, false AS refused
      FROM runs r
      JOIN (SELECT DISTINCT run_id, task_id FROM day_plan_assignments WHERE reason <> $5) a ON a.run_id = r.id
    UNION ALL
    SELECT r.plan_date, r.arm, (e->>'taskId')::uuid, true
      FROM runs r
      CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(r.reasons->'pool') = 'array' THEN r.reasons->'pool' ELSE '[]'::jsonb END) e
     WHERE e->>'reason' = $6
)
SELECT p.plan_date::text, p.arm, count(*)::int, count(c.id)::int, count(*) FILTER (WHERE p.refused)::int
  FROM proposed p
  LEFT JOIN completions c ON c.task_id = p.task_id AND c.completed_on = p.plan_date
 GROUP BY 1, 2`

// worthRunsSQL: per plan date, every run (planned or rejected) split into
// three counts that partition them: planned by the LLM ($3), fell back to the
// baseline (has a fallback reason, a spent tick budget and a reached daily cap
// included), and everything else, where the LLM was not asked.
const worthRunsSQL = `
SELECT plan_date::text,
       count(*) FILTER (WHERE allocator = $3)::int,
       count(*) FILTER (WHERE allocator <> $3 AND fallback_reason IS NOT NULL)::int,
       count(*) FILTER (WHERE allocator <> $3 AND fallback_reason IS NULL)::int
  FROM allocation_runs
 WHERE plan_date BETWEEN $1::text::date AND $2::text::date
 GROUP BY 1`

// worthCallsSQL: per local date, the calls of service $3: those made (not
// skipped by the cap or the budget), those the referee refused, and the cost
// of every row, fallbacks and rows with no run included. Uncosted is a call
// with no estimate, as in serviceDaysSQL.
const worthCallsSQL = `
SELECT local_date::text,
       count(*) FILTER (WHERE outcome NOT IN ('skipped_cap', 'skipped_budget'))::int,
       count(*) FILTER (WHERE outcome = 'rejected_by_referee')::int,
       coalesce(sum(est_cost_micros), 0)::bigint,
       count(*) FILTER (WHERE latency_ms IS NOT NULL AND est_cost_micros IS NULL)::int
  FROM llm_call_events
 WHERE service = $3 AND local_date BETWEEN $1::text::date AND $2::text::date
 GROUP BY 1`

// worthExplanationsSQL: per plan date of the planned runs ($3), the stored LLM
// texts and the distinct (run, Resident) pairs holding an assignment.
const worthExplanationsSQL = `
WITH planned AS (
    SELECT id, plan_date FROM allocation_runs
     WHERE plan_date BETWEEN $1::text::date AND $2::text::date AND outcome = $3
)
SELECT plan_date::text, sum(llm)::int, sum(pairs)::int
  FROM (
    SELECT p.plan_date, count(*) AS llm, 0 AS pairs
      FROM planned p JOIN day_plan_explanations e ON e.run_id = p.id GROUP BY 1
    UNION ALL
    SELECT p.plan_date, 0, count(*)
      FROM planned p
      JOIN (SELECT DISTINCT run_id, resident_id FROM day_plan_assignments) a ON a.run_id = p.id GROUP BY 1
  ) m
 GROUP BY 1`
