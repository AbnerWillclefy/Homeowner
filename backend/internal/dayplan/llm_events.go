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
	explainerEventService = "explainer"
)

// attempt is the facts of asking the allocator model, before the referee ran.
type attempt struct {
	// skipped is set when the model was not called: the daily cap, the spent
	// tick budget, or a failed reservation. Empty means a call was made.
	skipped eventOutcome
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

// final is the event outcome once the planning transaction is over. fallback is
// why the ask failed, empty when it returned a proposal. A proposal that was
// never refereed (no run used it) has no exact outcome in the vocabulary: it is
// an error, since a call and its tokens were spent and nothing came of them.
func (a attempt) final(fallback fallbackReason, rec *runRecord) eventOutcome {
	switch {
	case a.skipped != "":
		return a.skipped
	case fallback != "":
		return eventOutcomeOf(fallback)
	case rec == nil || !rec.refereed:
		return eventError
	case rec.fallback == fallbackRejected:
		return eventRejectedReferee
	}
	return eventAccepted
}

// event is one llm_call_events row, resolved.
type event struct {
	service string // allocatorEventService or explainerEventService
	home    string
	date    allocation.Date
	now     time.Time
	run     *string // nil when no run came of the attempt
	outcome eventOutcome
	kinds   []string // sorted, distinct Check violation kinds of a rejected proposal
	latency *time.Duration
	usage   *llmalloc.Usage
	// itemsSent and itemsAccepted are the Residents an explainer call asked
	// about and the summaries kept. Nil on allocator rows; itemsAccepted is also
	// nil when no call was made.
	itemsSent, itemsAccepted *int
}

// eventOf resolves the event of an attempt. runID and rec are the run this
// invocation stored: empty and nil when none came of the attempt.
func eventOf(homeID string, date allocation.Date, now time.Time, a attempt, fallback fallbackReason, runID string, rec *runRecord) event {
	e := event{service: allocatorEventService, home: homeID, date: date, now: now, outcome: a.final(fallback, rec), kinds: []string{}, latency: a.latency, usage: a.usage}
	if runID != "" {
		e.run = &runID
	}
	if e.outcome == eventRejectedReferee {
		for _, v := range rec.reasons.LLMViolations {
			e.kinds = append(e.kinds, v.Kind)
		}
		slices.Sort(e.kinds)
		e.kinds = slices.Compact(e.kinds)
	}
	return e
}

// recordLLMEvent writes the event: one best-effort INSERT on the pool, after the
// planning transaction. A failure is logged and changes nothing.
func (p *Planner) recordLLMEvent(ctx context.Context, e event) {
	model := p.llm.Model
	var in, out, cost, latency *int64
	if u := e.usage; u != nil {
		model = u.Model
		in, out = &u.InputTokens, &u.OutputTokens
		if c, ok := llmalloc.Prices.Estimate(u); ok {
			cost = &c
		}
	}
	if e.latency != nil {
		ms := e.latency.Milliseconds()
		latency = &ms
	}

	// The tick budget may be spent already; the event is still worth a try.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), eventInsertTimeout)
	defer cancel()
	_, err := p.db.Exec(ctx, `
		INSERT INTO llm_call_events (created_at, local_date, home_id, run_id, service, model, outcome, violation_kinds,
		                             latency_ms, input_tokens, output_tokens, est_cost_micros, items_sent, items_accepted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		e.now, e.date.Time(), e.home, e.run, e.service, model, string(e.outcome), e.kinds, latency, in, out, cost,
		e.itemsSent, e.itemsAccepted)
	if err != nil {
		p.log.Warn("llm call event not recorded", "home", e.home, "service", e.service, "outcome", string(e.outcome), "error", err.Error())
	}
}
