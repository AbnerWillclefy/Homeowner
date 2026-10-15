package dayplan

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/explain"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
)

// Explainer is the LLM explanation writer as the Planner sees it, so this
// package knows nothing of how the model is asked. One call covers every
// Resident given; a Resident missing from the answer gets no text.
type Explainer interface {
	Explain(ctx context.Context, residents []explain.ResidentFacts) (map[string]explain.Texts, error)
}

// Explanation sources.
const (
	sourceLLM      = "llm"
	sourceTemplate = "template"
)

// Explanation is the plain-language account of a Resident's Day Plan, in both
// languages because the backend does not know their locale yet (ADR 0006).
// Source says where it came from: "llm" or "template".
type Explanation struct {
	Source string        `json:"source"`
	Text   explain.Texts `json:"text"`
}

// factsFor are the facts an explanation of the Resident's plan is built from,
// and the fingerprint of the Energy and assignments they come from. Tasks are
// the Resident's assignments as stored (completed ones too); the pool is every
// open Task nobody holds, with its recorded reason.
func (r dayRun) factsFor(residentID string, open []tasks.Open) (explain.Facts, string) {
	f := explain.Facts{Energy: r.reasons.Energy[residentID], Tasks: []explain.Task{}, Pool: []string{}}
	var pairs []explain.Pair
	held := map[string]bool{}
	for _, a := range r.assigned {
		held[a.task] = true
		if a.resident == residentID {
			pairs = append(pairs, explain.Pair{TaskID: a.task, Reason: a.reason})
			f.Tasks = append(f.Tasks, explain.Task{Reason: a.reason, Category: a.category, Effort: a.effort, Importance: a.importance, People: a.people})
		}
	}
	poolReason := map[string]string{}
	for _, p := range r.reasons.Pool {
		poolReason[p.TaskID] = p.Reason
	}
	for _, o := range open {
		if held[o.ID] {
			continue
		}
		reason, known := poolReason[o.ID]
		if !known {
			reason = ReasonAddedAfterPlan
		}
		f.Pool = append(f.Pool, reason)
	}
	return f, explain.Fingerprint(f.Energy, pairs)
}

// explanationFor is the Resident's explanation of a planned run: the stored
// LLM text when it still matches their plan, otherwise the template. The
// template is computed here, from the live reasons, so a plan always has one.
func (s *Store) explanationFor(ctx context.Context, run dayRun, residentID string, open []tasks.Open) (*Explanation, error) {
	facts, fingerprint := run.factsFor(residentID, open)
	var (
		texts  explain.Texts
		stored string
	)
	err := s.db.QueryRow(ctx, `
		SELECT text_en, text_pt, fingerprint FROM day_plan_explanations WHERE run_id = $1 AND resident_id = $2`,
		run.id, residentID).Scan(&texts.EnUS, &texts.PtBR, &stored)
	switch {
	case err == nil && stored == fingerprint:
		return &Explanation{Source: sourceLLM, Text: texts}, nil
	case err != nil && !errors.Is(err, pgx.ErrNoRows):
		return nil, fmt.Errorf("day plan: load explanation: %w", err)
	}
	return &Explanation{Source: sourceTemplate, Text: explain.Template(facts)}, nil
}

// explainHomes asks the LLM to explain the Day Plan of each Home this tick
// planned, after all of them are planned and before any push, within its own
// budget so a slow model cannot eat the nudge deadline. It is best effort like
// push: nothing here may fail the tick, and a panic is logged and swallowed.
// Whatever is not explained reads back as the template.
func (p *Planner) explainHomes(ctx context.Context, homeIDs []string, now time.Time) {
	if p.llm.Explainer == nil || len(homeIDs) == 0 {
		return
	}
	defer func() {
		if r := recover(); r != nil {
			p.log.Error("explanations panicked", "panic", fmt.Sprint(r))
		}
	}()
	ctx, cancel := context.WithTimeout(ctx, p.llm.ExplainBudget)
	defer cancel()
	for _, id := range homeIDs {
		p.explainHome(ctx, id, now)
	}
}

// explainHome reads the Home's plan, takes one of its daily LLM calls on the
// pool (before the call, so a failed call still counts) and asks once for
// every Resident who has Tasks. Valid texts are stored with the fingerprint of
// the plan they were written for.
func (p *Planner) explainHome(ctx context.Context, homeID string, now time.Time) {
	skip := func(reason string, residents int, err error) {
		attrs := []any{"home", homeID, "fallback_reason", reason, "residents", residents}
		if err != nil {
			attrs = append(attrs, "error", err.Error())
		}
		p.log.Warn("explanation not used", attrs...)
	}
	if ctx.Err() != nil {
		skip("explain_budget_spent", 0, nil)
		return
	}
	date, _, err := p.planned(ctx, homeID, now)
	if err != nil {
		skip("explain_llm_error", 0, err)
		return
	}
	run, found, err := readRun(ctx, p.db, homeID, date.Time())
	if err != nil || !found || run.outcome != string(Planned) {
		if err != nil {
			skip("explain_llm_error", 0, err)
		}
		return
	}
	open, err := p.tasks.ListOpen(ctx, homeID)
	if err != nil {
		skip("explain_llm_error", 0, err)
		return
	}

	fingerprints := map[string]string{}
	var ask []explain.ResidentFacts
	for _, id := range slices.Sorted(maps.Keys(run.reasons.Energy)) {
		facts, fp := run.factsFor(id, open)
		if len(facts.Tasks) == 0 {
			continue // the template already says it all
		}
		fingerprints[id] = fp
		ask = append(ask, explain.ResidentFacts{ResidentID: id, Facts: facts})
	}
	if len(ask) == 0 {
		return
	}

	ok, err := reserveLLMCall(ctx, p.db, homeID, date, p.llm.DailyCap)
	switch {
	case err != nil:
		skip(string(explainFailure(ctx, err)), len(ask), err)
		return
	case !ok:
		skip("explain_llm_daily_cap_reached", len(ask), nil)
		return
	}
	callCtx, cancel := context.WithTimeout(ctx, p.llm.CallTimeout)
	defer cancel()
	texts, err := p.llm.Explainer.Explain(callCtx, ask)
	if err != nil {
		skip(string(explainFailure(ctx, err)), len(ask), err)
		return
	}
	if err := p.storeExplanations(ctx, run.id, texts, fingerprints, now); err != nil {
		skip("explain_llm_error", len(ask), err)
		return
	}
	if missing := len(ask) - len(texts); missing > 0 {
		skip("explain_llm_invalid_response", missing, nil)
	}
}

// explainFailure maps a failed call to the id logged for it, exactly as the
// allocator's failures are mapped: a deadline or a spent budget is a timeout,
// an unreadable answer is an invalid response, anything else an error.
func explainFailure(ctx context.Context, err error) string {
	switch llmFailure(ctx, err) {
	case fallbackTimeout:
		return "explain_llm_timeout"
	case fallbackInvalid:
		return "explain_llm_invalid_response"
	}
	return "explain_llm_error"
}

// llmFailure maps a failed LLM call to the fallback reason it is recorded as.
// ctx is the budget the call ran under.
func llmFailure(ctx context.Context, err error) fallbackReason {
	switch {
	case ctx.Err() != nil, errors.Is(err, context.DeadlineExceeded):
		return fallbackTimeout
	case errors.Is(err, llmalloc.ErrInvalidResponse):
		return fallbackInvalid
	}
	return fallbackError
}

// storeExplanations inserts the texts in one transaction. A row already there
// (the key is the run and the Resident) is left alone.
func (p *Planner) storeExplanations(ctx context.Context, runID string, texts map[string]explain.Texts, fingerprints map[string]string, now time.Time) error {
	if len(texts) == 0 {
		return nil
	}
	// The budget may have ended during the call; the texts were paid for, so
	// store them under a context of their own.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	for _, id := range slices.Sorted(maps.Keys(texts)) {
		t := texts[id]
		if _, err := tx.Exec(ctx, `
			INSERT INTO day_plan_explanations (run_id, resident_id, text_en, text_pt, fingerprint, created_at)
			VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
			runID, id, t.EnUS, t.PtBR, fingerprints[id], now); err != nil {
			return fmt.Errorf("store explanation: %w", err)
		}
	}
	return tx.Commit(ctx)
}
