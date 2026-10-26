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

// The allocator llm_call_events.outcome values that mean no call was made.
const (
	eventSkippedCap    = "skipped_cap"
	eventSkippedBudget = "skipped_budget"
)

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
		var asked, skipped, accepted int
		if err := tx.QueryRow(ctx, allocatorCallsSQL, from, to, eventSkippedCap, eventSkippedBudget, eventAccepted).Scan(
			&asked, &skipped, &accepted); err != nil {
			return fmt.Errorf("allocator calls: %w", err)
		}
		expl, err := readExplanationShare(ctx, tx, from, to, log)
		if err != nil {
			return err
		}
		var p Pushes
		if err := tx.QueryRow(ctx, flowPushesSQL, from, to, kindDayPlanReady, pushDelivered, pushFailed, pushGone).Scan(
			&p.Delivered, &p.Failed, &p.Gone, &p.Unknown); err != nil {
			return fmt.Errorf("pushes: %w", err)
		}
		steps = []FlowStep{
			{ID: stepHomesDue, Count: homesDue},
			{ID: stepRuns, Count: runs, Of: stepHomesDue},
			{ID: stepLLMAsked, Count: asked, Of: stepRuns},
			{ID: stepLLMSkipped, Count: skipped, Of: stepRuns},
			{ID: stepLLMAccepted, Count: accepted, Of: stepLLMAsked},
			{ID: stepLLMFallback, Count: asked - accepted, Of: stepLLMAsked},
			{ID: stepRejectedRuns, Count: rejected, Of: stepRuns},
			{ID: stepExplanationsLLM, Count: expl.LLM},
			{ID: stepExplanationsTemplate, Count: expl.Template},
			{ID: stepPushesDelivered, Count: p.Delivered},
			{ID: stepPushesFailed, Count: p.Failed},
			{ID: stepPushesGone, Count: p.Gone},
			{ID: stepPushesUnknown, Count: p.Unknown},
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

// allocatorCallsSQL: the allocator events by local date. $3 and $4 are the skip
// outcomes (no call made), so asked is every other row; $5 is accepted.
const allocatorCallsSQL = `
SELECT count(*) FILTER (WHERE outcome NOT IN ($3, $4))::int,
       count(*) FILTER (WHERE outcome IN ($3, $4))::int,
       count(*) FILTER (WHERE outcome = $5)::int
  FROM llm_call_events
 WHERE service = 'allocator' AND local_date BETWEEN $1::text::date AND $2::text::date`

// flowPushesSQL: the nudges of kind $3 by local date, split by outcome $4..$6;
// a NULL outcome is unknown.
const flowPushesSQL = `
SELECT count(*) FILTER (WHERE outcome = $4)::int, count(*) FILTER (WHERE outcome = $5)::int,
       count(*) FILTER (WHERE outcome = $6)::int, count(*) FILTER (WHERE outcome IS NULL)::int
  FROM nudges
 WHERE kind = $3 AND local_date BETWEEN $1::text::date AND $2::text::date`
