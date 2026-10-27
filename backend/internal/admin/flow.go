package admin

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
)

// The nudges.kind of a push telling a Resident their Day Plan is ready
// (nudge.KindDayPlanReady); the flow counts these only.
const kindDayPlanReady = "day_plan_ready"

// The ids of the funnel steps, in pipeline order.
const (
	stepHomesDue             = "homesDue"
	stepRuns                 = "runs"
	stepLLMAsked             = "llmAsked"
	stepLLMSkipped           = "llmSkipped"
	stepLLMAccepted          = "llmAccepted"
	stepLLMFallback          = "llmFallback"
	stepRejectedRuns         = "rejectedRuns"
	stepExplanationsLLM      = "explanationsLlm"
	stepExplanationsTemplate = "explanationsTemplate"
	stepPushesDelivered      = "pushesDelivered"
	stepPushesFailed         = "pushesFailed"
	stepPushesGone           = "pushesGone"
	stepPushesUnknown        = "pushesUnknown"
)

// Flow reads the funnel for the dates from..to (YYYY-MM-DD, inclusive) in one
// read-only transaction. The explanation counts come from the same function as
// AI, so the two reports agree by construction.
func (s *Store) Flow(ctx context.Context, from, to string, log *slog.Logger) ([]FlowStep, error) {
	var steps []FlowStep
	err := readOnly(ctx, s.db, func(tx pgx.Tx) error {
		var homesDue, runs, rejected int
		if err := tx.QueryRow(ctx, homesDueSQL, from, to).Scan(&homesDue); err != nil {
			return fmt.Errorf("homes due: %w", err)
		}
		if err := tx.QueryRow(ctx, runTotalsSQL, from, to, outcomeRejected).Scan(&runs, &rejected); err != nil {
			return fmt.Errorf("runs: %w", err)
		}
		// The allocator outcomes come from the reader AI uses.
		days := map[string]AIServices{}
		if err := readServiceDays(ctx, tx, from, to, days); err != nil {
			return err
		}
		var o Outcomes
		for _, d := range days {
			c := d.Allocator.Outcomes
			o.Accepted += c.Accepted
			o.RejectedByReferee += c.RejectedByReferee
			o.InvalidResponse += c.InvalidResponse
			o.Timeout += c.Timeout
			o.Error += c.Error
			o.SkippedCap += c.SkippedCap
			o.SkippedBudget += c.SkippedBudget
		}
		// A call that was made and not accepted fell back to the baseline.
		fallback := o.RejectedByReferee + o.InvalidResponse + o.Timeout + o.Error
		expl, err := readExplanationShare(ctx, tx, from, to, log)
		if err != nil {
			return err
		}
		var p Pushes
		if err := tx.QueryRow(ctx, flowPushesSQL, from, to, kindDayPlanReady, pushDelivered, pushFailed, pushGone).Scan(
			&p.Delivered, &p.Failed, &p.Gone, &p.Unknown); err != nil {
			return fmt.Errorf("pushes: %w", err)
		}
		// One table holds the order and the denominators of the funnel.
		for _, r := range []struct {
			id, of string
			count  int
		}{
			{stepHomesDue, "", homesDue},
			{stepRuns, stepHomesDue, runs},
			{stepLLMAsked, stepRuns, o.Accepted + fallback},
			{stepLLMSkipped, stepRuns, o.SkippedCap + o.SkippedBudget},
			{stepLLMAccepted, stepLLMAsked, o.Accepted},
			{stepLLMFallback, stepLLMAsked, fallback},
			{stepRejectedRuns, stepRuns, rejected},
			{stepExplanationsLLM, "", expl.LLM},
			{stepExplanationsTemplate, "", expl.Template},
			{stepPushesDelivered, "", p.Delivered},
			{stepPushesFailed, "", p.Failed},
			{stepPushesGone, "", p.Gone},
			{stepPushesUnknown, "", p.Unknown},
		} {
			steps = append(steps, FlowStep{ID: r.id, Count: r.count, Of: r.of})
		}
		return nil
	})
	return steps, err
}

// homesDueSQL: for each date in $1..$2, the Homes created before the next UTC
// midnight; summed. See FlowResponse.
const homesDueSQL = `
SELECT count(*)::int
  FROM generate_series($1::text::date, $2::text::date, interval '1 day') AS d(day)
  JOIN homes h ON h.created_at < ((d.day::date + 1)::timestamp AT TIME ZONE 'UTC')`

// runTotalsSQL: the runs by plan_date, and those the checker rejected ($3).
const runTotalsSQL = `
SELECT count(*)::int, count(*) FILTER (WHERE outcome = $3)::int
  FROM allocation_runs
 WHERE plan_date BETWEEN $1::text::date AND $2::text::date`

// flowPushesSQL: the nudges of kind $3 by local date, split by outcome $4..$6;
// a NULL outcome is unknown.
const flowPushesSQL = `
SELECT count(*) FILTER (WHERE outcome = $4)::int, count(*) FILTER (WHERE outcome = $5)::int,
       count(*) FILTER (WHERE outcome = $6)::int, count(*) FILTER (WHERE outcome IS NULL)::int
  FROM nudges
 WHERE kind = $3 AND local_date BETWEEN $1::text::date AND $2::text::date`
