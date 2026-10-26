package admin

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
)

// The llm_call_events vocabulary this report reads (CHECK constraints of
// migration 0022; the source of truth is package dayplan's event outcomes).
const (
	eventAccepted = "accepted"
	// The llm_call_events.service values.
	serviceAllocator = "allocator"
	serviceExplainer = "explainer"
	// outcomePlanned is the allocation_runs.outcome of a run that made a Day
	// Plan (dayplan.Planned).
	outcomePlanned = "planned"
	// allocatorLLM is the allocation_runs.allocator the LLM allocator records
	// (llmalloc.Allocator.Name).
	allocatorLLM = "llm"
	// topN bounds the violation-kind and fallback-reason lists.
	topN = 10
)

// AI is what the store reads for GET /admin/ai.
type AI struct {
	// Days holds only the (date, service) pairs with events, keyed by date.
	Days map[string]AIServices
	// MonthEstCostMicros and MonthUncostedCalls cover the UTC calendar month.
	MonthEstCostMicros int64
	MonthUncostedCalls int
	Allocator          AllocatorShare
	Explanation        ExplanationShare
	Kinds              []KindCount
	Reasons            []ReasonCount
	// The previous window's range totals.
	PreviousServices    AIServices
	PreviousAllocator   AllocatorShare
	PreviousExplanation ExplanationShare
}

// AI reads the LLM report for the current window and the UTC calendar month of
// now, and the totals of the previous window, in one read-only transaction.
// The previous window has no top lists and no month to date: lists are not
// totals, and the month is a calendar month, not a range.
func (s *Store) AI(ctx context.Context, cur, prev window, now time.Time, log *slog.Logger) (AI, error) {
	out := AI{Days: map[string]AIServices{}}
	from, to := cur.From, cur.To
	err := readOnly(ctx, s.db, func(tx pgx.Tx) error {
		if err := readServiceDays(ctx, tx, from, to, out.Days); err != nil {
			return err
		}
		start := time.Date(now.UTC().Year(), now.UTC().Month(), 1, 0, 0, 0, 0, time.UTC)
		if err := tx.QueryRow(ctx, monthSQL, start, start.AddDate(0, 1, 0)).Scan(
			&out.MonthEstCostMicros, &out.MonthUncostedCalls); err != nil {
			return fmt.Errorf("month to date: %w", err)
		}
		if err := tx.QueryRow(ctx, allocatorShareSQL, from, to, outcomePlanned, allocatorLLM).Scan(
			&out.Allocator.LLM, &out.Allocator.Baseline); err != nil {
			return fmt.Errorf("allocator share: %w", err)
		}
		var err error
		if out.Explanation, err = readExplanationShare(ctx, tx, from, to, log.With("window", "current")); err != nil {
			return err
		}
		if out.PreviousServices, err = readServiceRange(ctx, tx, prev); err != nil {
			return fmt.Errorf("previous %w", err)
		}
		if err := tx.QueryRow(ctx, allocatorShareSQL, prev.From, prev.To, outcomePlanned, allocatorLLM).Scan(
			&out.PreviousAllocator.LLM, &out.PreviousAllocator.Baseline); err != nil {
			return fmt.Errorf("previous allocator share: %w", err)
		}
		if out.PreviousExplanation, err = readExplanationShare(ctx, tx, prev.From, prev.To, log.With("window", "previous")); err != nil {
			return err
		}
		kinds, err := readCounts(ctx, tx, "violation kinds", violationKindsSQL, from, to, topN)
		if err != nil {
			return err
		}
		out.Kinds = make([]KindCount, len(kinds))
		for i, k := range kinds {
			out.Kinds[i] = KindCount{Kind: k.Key, Count: k.Count}
		}
		reasons, err := readCounts(ctx, tx, "fallback reasons", fallbackReasonsSQL, from, to, topN)
		if err != nil {
			return err
		}
		out.Reasons = make([]ReasonCount, len(reasons))
		for i, r := range reasons {
			out.Reasons[i] = ReasonCount{Reason: r.Key, Count: r.Count}
		}
		return nil
	})
	return out, err
}

func readServiceDays(ctx context.Context, tx pgx.Tx, from, to string, into map[string]AIServices) error {
	rows, err := tx.Query(ctx, serviceDaysSQL, from, to)
	if err != nil {
		return fmt.Errorf("service days: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var date, service string
		var d ServiceDay
		if err := rows.Scan(append([]any{&date, &service}, d.dest()...)...); err != nil {
			return fmt.Errorf("service days: %w", err)
		}
		day := into[date]
		if err := day.set(service, d); err != nil {
			return fmt.Errorf("service days: %w", err)
		}
		into[date] = day
	}
	return rows.Err()
}

// readServiceRange reads the range totals of each service over the window, in
// one row per service. A service with no event stays at its zero value.
func readServiceRange(ctx context.Context, tx pgx.Tx, w window) (AIServices, error) {
	var out AIServices
	rows, err := tx.Query(ctx, serviceRangeSQL, w.From, w.To)
	if err != nil {
		return out, fmt.Errorf("service range: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var service string
		var d ServiceDay
		if err := rows.Scan(append([]any{&service}, d.dest()...)...); err != nil {
			return out, fmt.Errorf("service range: %w", err)
		}
		if err := out.set(service, d); err != nil {
			return out, fmt.Errorf("service range: %w", err)
		}
	}
	return out, rows.Err()
}

// dest lists the scan targets of a ServiceDay in the column order of
// serviceDaysSQL and serviceRangeSQL, after their key columns.
func (d *ServiceDay) dest() []any {
	o := &d.Outcomes
	return []any{&o.Accepted, &o.RejectedByReferee, &o.InvalidResponse, &o.Timeout,
		&o.Error, &o.SkippedCap, &o.SkippedBudget, &d.LatencyP50Ms, &d.LatencyMaxMs,
		&d.InputTokens, &d.OutputTokens, &d.EstCostMicros, &d.UncostedCalls}
}

func (s *AIServices) set(service string, d ServiceDay) error {
	switch service {
	case serviceAllocator:
		s.Allocator = d
	case serviceExplainer:
		s.Explainer = d
	default:
		return fmt.Errorf("unknown service %q", service)
	}
	return nil
}

// readExplanationShare counts LLM-written explanations and the Residents left
// on the template, and splits the template by why.
//
// Two caveats. Assignments change after planning (Take, Swap), so a Resident
// who only Took a Task later is counted in Template. And a stored LLM text
// whose fingerprint later mismatches is shown as the template but counts as
// LLM here: the metric is "written by the LLM", not "shown".
func readExplanationShare(ctx context.Context, tx pgx.Tx, from, to string, log *slog.Logger) (ExplanationShare, error) {
	var s ExplanationShare
	var pairs int
	if err := tx.QueryRow(ctx, explanationShareSQL, from, to, outcomePlanned).Scan(&s.LLM, &pairs); err != nil {
		return s, fmt.Errorf("explanation share: %w", err)
	}
	s.Template = max(pairs-s.LLM, 0)

	rows, err := tx.Query(ctx, templateReasonsSQL, from, to, eventAccepted)
	if err != nil {
		return s, fmt.Errorf("template reasons: %w", err)
	}
	defer rows.Close()
	explained := 0
	for rows.Next() {
		var outcome string
		var n int
		if err := rows.Scan(&outcome, &n); err != nil {
			return s, fmt.Errorf("template reasons: %w", err)
		}
		r := &s.TemplateReasons
		switch outcome {
		case eventAccepted:
			r.Partial = n
		case "rejected_by_referee":
			r.RejectedByReferee = n
		case "invalid_response":
			r.InvalidResponse = n
		case "timeout":
			r.Timeout = n
		case "error":
			r.Error = n
		case "skipped_cap":
			r.SkippedCap = n
		case "skipped_budget":
			r.SkippedBudget = n
		default:
			log.Warn("admin ai: unknown explainer outcome", "outcome", outcome)
		}
		explained += n
	}
	if err := rows.Err(); err != nil {
		return s, fmt.Errorf("template reasons: %w", err)
	}
	// Whoever the explainer did not account for was never asked: a rest day,
	// the LLM switched off, a Resident who joined after the plan. Negative
	// means the definitions above drifted apart.
	notAsked := s.Template - explained
	if notAsked < 0 {
		log.Warn("admin ai: template reasons exceed the template count", "template", s.Template, "explained", explained)
		notAsked = 0
	}
	s.TemplateReasons.NotAsked = notAsked
	return s, nil
}

// keyCount is one (key, count) row of a top-N list.
type keyCount struct {
	Key   string
	Count int
}

// readCounts reads (key, count) pairs, most frequent first, ties by key.
func readCounts(ctx context.Context, tx pgx.Tx, what, sql, from, to string, limit int) ([]keyCount, error) {
	rows, err := tx.Query(ctx, sql, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", what, err)
	}
	defer rows.Close()
	var out []keyCount
	for rows.Next() {
		var k keyCount
		if err := rows.Scan(&k.Key, &k.Count); err != nil {
			return nil, fmt.Errorf("%s: %w", what, err)
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// serviceDaysSQL: one row per (local date, service) with events in $1..$2.
// percentile_cont and max ignore NULL latencies, so skips do not drag the
// median to 0, and a group with no call has a NULL median. A "call" is a row
// with a latency; uncosted is a call with no estimated cost (an unknown model,
// or no usage reported).
const serviceDaysSQL = `
SELECT local_date::text, service,
       count(*) FILTER (WHERE outcome = 'accepted')::int,
       count(*) FILTER (WHERE outcome = 'rejected_by_referee')::int,
       count(*) FILTER (WHERE outcome = 'invalid_response')::int,
       count(*) FILTER (WHERE outcome = 'timeout')::int,
       count(*) FILTER (WHERE outcome = 'error')::int,
       count(*) FILTER (WHERE outcome = 'skipped_cap')::int,
       count(*) FILTER (WHERE outcome = 'skipped_budget')::int,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms),
       max(latency_ms),
       coalesce(sum(input_tokens), 0)::bigint,
       coalesce(sum(output_tokens), 0)::bigint,
       coalesce(sum(est_cost_micros), 0)::bigint,
       count(*) FILTER (WHERE latency_ms IS NOT NULL AND est_cost_micros IS NULL)::int
  FROM llm_call_events
 WHERE local_date BETWEEN $1::text::date AND $2::text::date
 GROUP BY local_date, service`

// serviceRangeSQL is serviceDaysSQL over the whole range: one row per service,
// with no date. A range median cannot be built from daily medians, so it is
// its own query.
const serviceRangeSQL = `
SELECT service,
       count(*) FILTER (WHERE outcome = 'accepted')::int,
       count(*) FILTER (WHERE outcome = 'rejected_by_referee')::int,
       count(*) FILTER (WHERE outcome = 'invalid_response')::int,
       count(*) FILTER (WHERE outcome = 'timeout')::int,
       count(*) FILTER (WHERE outcome = 'error')::int,
       count(*) FILTER (WHERE outcome = 'skipped_cap')::int,
       count(*) FILTER (WHERE outcome = 'skipped_budget')::int,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms),
       max(latency_ms),
       coalesce(sum(input_tokens), 0)::bigint,
       coalesce(sum(output_tokens), 0)::bigint,
       coalesce(sum(est_cost_micros), 0)::bigint,
       count(*) FILTER (WHERE latency_ms IS NOT NULL AND est_cost_micros IS NULL)::int
  FROM llm_call_events
 WHERE local_date BETWEEN $1::text::date AND $2::text::date
 GROUP BY service`

// monthSQL: $1 and $2 are the UTC month's first instant and the next month's.
const monthSQL = `
SELECT coalesce(sum(est_cost_micros), 0)::bigint,
       count(*) FILTER (WHERE latency_ms IS NOT NULL AND est_cost_micros IS NULL)::int
  FROM llm_call_events
 WHERE created_at >= $1 AND created_at < $2`

// allocatorShareSQL: planned runs by plan_date; $3 is the planned outcome and
// $4 the LLM allocator's name.
const allocatorShareSQL = `
SELECT count(*) FILTER (WHERE allocator = $4)::int,
       count(*) FILTER (WHERE allocator <> $4)::int
  FROM allocation_runs
 WHERE plan_date BETWEEN $1::text::date AND $2::text::date AND outcome = $3`

// explanationShareSQL: the stored LLM texts of planned runs in range, and the
// distinct (run, Resident) pairs holding an assignment in those runs.
const explanationShareSQL = `
WITH planned AS (
    SELECT id FROM allocation_runs
     WHERE plan_date BETWEEN $1::text::date AND $2::text::date AND outcome = $3
)
SELECT (SELECT count(*) FROM day_plan_explanations WHERE run_id IN (SELECT id FROM planned))::int,
       (SELECT count(*) FROM (SELECT DISTINCT run_id, resident_id FROM day_plan_assignments
                               WHERE run_id IN (SELECT id FROM planned)) p)::int`

// templateReasonsSQL: the Residents each explainer outcome left without an LLM
// text. Every outcome but accepted contributes the Residents it asked about;
// an accepted call contributes those it asked about and did not keep ($3).
const templateReasonsSQL = `
SELECT outcome,
       coalesce(sum(CASE WHEN outcome = $3 THEN items_sent - coalesce(items_accepted, 0) ELSE items_sent END), 0)::int
  FROM llm_call_events
 WHERE service = 'explainer' AND local_date BETWEEN $1::text::date AND $2::text::date
 GROUP BY outcome`

// violationKindsSQL: $3 is the list length. Each row of the allocator holds a
// distinct set of kinds, so a count is the number of calls that reported it.
const violationKindsSQL = `
SELECT k, count(*)::int
  FROM llm_call_events, unnest(violation_kinds) AS k
 WHERE service = 'allocator' AND local_date BETWEEN $1::text::date AND $2::text::date
 GROUP BY k ORDER BY 2 DESC, 1 LIMIT $3`

const fallbackReasonsSQL = `
SELECT fallback_reason, count(*)::int
  FROM allocation_runs
 WHERE fallback_reason IS NOT NULL AND plan_date BETWEEN $1::text::date AND $2::text::date
 GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT $3`
