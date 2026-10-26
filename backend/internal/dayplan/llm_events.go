package dayplan

import (
	"context"
	"slices"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

// eventOutcome is the fixed vocabulary of llm_call_events.outcome.
type eventOutcome string

const (
	eventAccepted        eventOutcome = "accepted"
	eventRejectedReferee eventOutcome = "rejected_by_referee"
	eventInvalidResponse eventOutcome = "invalid_response"
	eventTimeout         eventOutcome = "timeout"
	eventError           eventOutcome = "error"
	eventSkippedCap      eventOutcome = "skipped_cap"
	eventSkippedBudget   eventOutcome = "skipped_budget"
)

const (
	eventInsertTimeout    = 5 * time.Second
	allocatorEventService = "allocator"
)

// attempt is what asking the allocator model did, before the referee ran. A
// nil attempt means the model was not worth asking: no event.
type attempt struct {
	// outcome is set when the attempt is already decided; empty means the call
	// succeeded and the referee decides.
	outcome eventOutcome
	usage   *llmalloc.Usage
	// latency is nil when no call was made.
	latency *time.Duration
}

// eventOutcomeOf maps a failed call to its event outcome, the way llmFailure
// maps it to a fallback reason.
func eventOutcomeOf(reason fallbackReason) eventOutcome {
	switch reason {
	case fallbackTimeout:
		return eventTimeout
	case fallbackInvalid:
		return eventInvalidResponse
	}
	return eventError
}

// final is the event outcome once the planning transaction is over. A call that
// succeeded but whose plan was never refereed (no run used it) has no exact
// outcome in the vocabulary: it is an error, since a call and its tokens were
// spent and nothing came of them.
func (a attempt) final(rec *runRecord) eventOutcome {
	switch {
	case a.outcome != "":
		return a.outcome
	case rec == nil || !rec.refereed:
		return eventError
	case rec.fallback == fallbackRejected:
		return eventRejectedReferee
	}
	return eventAccepted
}

// recordLLMEvent writes the allocator event of an attempt: one best-effort
// INSERT on the pool, after the planning transaction. runID is empty when no
// run came of the attempt; rec is the run record when the proposal was
// refereed. A failure is logged and changes nothing.
func (p *Planner) recordLLMEvent(ctx context.Context, homeID string, date allocation.Date, now time.Time, a attempt, runID string, rec *runRecord) {
	outcome := a.final(rec)
	var kinds []string
	if outcome == eventRejectedReferee {
		for _, v := range rec.reasons.LLMViolations {
			kinds = append(kinds, v.Kind)
		}
		slices.Sort(kinds)
		kinds = slices.Compact(kinds)
	}
	if kinds == nil {
		kinds = []string{}
	}
	model := p.llm.Model
	var in, out, cost, latency *int64
	if u := a.usage; u != nil {
		model = u.Model
		in, out = &u.InputTokens, &u.OutputTokens
		if c, ok := llmalloc.Prices.Estimate(u); ok {
			cost = &c
		}
	}
	if a.latency != nil {
		ms := a.latency.Milliseconds()
		latency = &ms
	}
	var run *string
	if runID != "" {
		run = &runID
	}

	// The tick budget may be spent already; the event is still worth a try.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), eventInsertTimeout)
	defer cancel()
	_, err := p.db.Exec(ctx, `
		INSERT INTO llm_call_events (created_at, local_date, home_id, run_id, service, model, outcome, violation_kinds,
		                             latency_ms, input_tokens, output_tokens, est_cost_micros)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		now, date.Time(), homeID, run, allocatorEventService, model, string(outcome), kinds, latency, in, out, cost)
	if err != nil {
		p.log.Warn("llm call event not recorded", "home", homeID, "outcome", string(outcome), "error", err.Error())
	}
}
