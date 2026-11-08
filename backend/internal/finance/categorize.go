package finance

import (
	"context"
	"errors"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

const (
	// categorizerDailyCap is how many Categorizer calls one User may cause a
	// day (São Paulo). Worst case about $0.25 a month per User: infra/README.md,
	// "Spend limits". Change the constant to change the cap.
	categorizerDailyCap = 10
	// categorizerTimeout bounds one call.
	categorizerTimeout = 30 * time.Second
	eventInsertTimeout = 5 * time.Second
)

// WithCategorizer turns on step 3 of the order of decision: the model. model is
// the name recorded when a call reports no usage. Without it, Expenses that the
// User's corrections and Pluggy's category do not decide stay Other until a
// Categorizer exists.
func (s *Syncer) WithCategorizer(c *llmalloc.Categorizer, model string) *Syncer {
	s.cat, s.model = c, model
	return s
}

// categorize settles the Expenses still on 'fallback', for every allowed User,
// while the run has time. The order: the User's saved correction, then the
// Categorizer within the daily cap. Pluggy's category was applied as the rows
// were written. What stays 'fallback' is tried again on the next run, and a day
// later has a fresh cap. A failure is logged and the run goes on.
func (s *Syncer) categorize(ctx context.Context, now, deadline time.Time) {
	users, err := s.store.FallbackUsers(ctx)
	if err != nil {
		s.log.Error("finance categorize failed", "step", "users", "error", safeErr(err))
		return
	}
	for _, u := range users {
		if !s.allow.Allows(u.Email) {
			continue
		}
		if err := s.categorizeUser(ctx, u.ID, now, deadline); err != nil {
			s.log.Error("finance categorize failed", "user", u.ID, "error", safeErr(err))
		}
	}
}

func (s *Syncer) categorizeUser(ctx context.Context, userID string, now, deadline time.Time) error {
	if err := s.store.ApplyCorrections(ctx, userID, now); err != nil {
		return err
	}
	if s.cat == nil {
		return nil
	}
	all, err := s.store.FallbackMerchants(ctx, userID)
	if err != nil {
		return err
	}
	// Held back in Go, and so left on Other for good: no call is spent on them.
	var merchants []string
	for _, m := range all {
		if llmalloc.Sendable(m) {
			merchants = append(merchants, m)
		}
	}
	day := postedOn(now)
	for len(merchants) > 0 && time.Until(deadline) >= reserve {
		batch := merchants[:min(len(merchants), llmalloc.MaxCategorizerBatch)]
		merchants = merchants[len(batch):]
		ok, err := s.store.ReserveCategorizerCall(ctx, userID, day, categorizerDailyCap)
		if err != nil {
			return err
		}
		if !ok {
			s.recordEvent(ctx, event{now: now, day: day, outcome: "skipped_cap", sent: len(batch)})
			return nil
		}
		callCtx, cancel := context.WithTimeout(ctx, categorizerTimeout)
		start := time.Now()
		got, usage, err := s.cat.Categorize(callCtx, batch)
		cancel()
		ev := event{now: now, day: day, usage: usage, latency: time.Since(start), called: true, sent: len(batch), outcome: outcomeOf(err)}
		if err != nil {
			s.recordEvent(ctx, ev)
			return nil // the next run tries again; hammering a failing model helps nobody
		}
		ev.accepted = len(got)
		s.recordEvent(ctx, ev)
		keys, cats := make([]string, 0, len(got)), make([]string, 0, len(got))
		for i, c := range got {
			keys, cats = append(keys, batch[i]), append(cats, c)
		}
		if err := s.store.SetCategories(ctx, userID, keys, cats, now); err != nil {
			return err
		}
	}
	return nil
}

// event is one llm_call_events row of the Categorizer: counts and cost only.
type event struct {
	now, day       time.Time
	outcome        string
	usage          *llmalloc.Usage
	latency        time.Duration
	called         bool
	sent, accepted int
}

func outcomeOf(err error) string {
	switch {
	case err == nil:
		return "accepted"
	case errors.Is(err, llmalloc.ErrInvalidResponse):
		return "invalid_response"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	}
	return "error"
}

// recordEvent writes the row, best effort, as dayplan.recordLLMEvent does. It
// holds no User and no Home: the table has no column for either. items_accepted
// is NULL unless a valid answer came back.
func (s *Syncer) recordEvent(ctx context.Context, e event) {
	model := s.model
	var in, out, cost, latency, accepted *int64
	if u := e.usage; u != nil {
		model = u.Model
		in, out = &u.InputTokens, &u.OutputTokens
		if c, ok := llmalloc.Prices.Estimate(u); ok {
			cost = &c
		}
	}
	if e.called {
		ms := e.latency.Milliseconds()
		latency = &ms
	}
	if e.outcome == "accepted" {
		n := int64(e.accepted)
		accepted = &n
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), eventInsertTimeout)
	defer cancel()
	_, err := s.store.db.Exec(ctx, `
		INSERT INTO llm_call_events (created_at, local_date, service, model, outcome, latency_ms,
		                             input_tokens, output_tokens, est_cost_micros, items_sent, items_accepted)
		VALUES ($1, $2, 'categorizer', $3, $4, $5, $6, $7, $8, $9, $10)`,
		e.now, e.day, model, e.outcome, latency, in, out, cost, e.sent, accepted)
	if err != nil {
		s.log.Warn("llm call event not recorded", "service", "categorizer", "outcome", e.outcome, "error", safeErr(err))
	}
}
