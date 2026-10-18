package dayplan

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/explain"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
)

// Explainer is the LLM explanation writer as the Planner sees it, so this
// package knows nothing of how the model is asked. One call covers every
// Resident given; a Resident missing from the answer gets no text.
type Explainer interface {
	Explain(ctx context.Context, residents []explain.ResidentFacts) (map[string]explain.Summary, error)
}

// Explanation sources.
const (
	sourceLLM      = "llm"
	sourceTemplate = "template"
)

// Explanation is the plain-language account of a Resident's Day Plan, in both
// languages because the backend does not know their locale yet (ADR 0006).
// Source says where it came from: "llm" or "template".
//
// Text is always the Headline followed by the Detail. It stays for a copy of
// the app cached on a phone that only reads text; a later change removes it.
type Explanation struct {
	Source   string        `json:"source"`
	Headline explain.Texts `json:"headline"`
	Detail   explain.Texts `json:"detail"`
	Text     explain.Texts `json:"text"`
}

// explanationOf is the Explanation of the summary, from the source.
func explanationOf(source string, s explain.Summary) *Explanation {
	return &Explanation{Source: source, Headline: s.Headline, Detail: s.Detail, Text: s.Joined()}
}

// factsFor are the facts an explanation of the Resident's plan is built from,
// and the fingerprint of the Energy and assignments they come from. Tasks are
// the Resident's assignments as stored (completed ones too); the pool is every
// open Task nobody holds, with its recorded reason.
func (r dayRun) factsFor(residentID, level string, open []tasks.Open) (explain.Facts, string) {
	f := explain.Facts{Energy: r.reasons.Energy[residentID], Tasks: []explain.Task{}, Pool: []string{}, Checkin: level}
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
	return f, explain.Fingerprint(f.Energy, level, pairs)
}

// explanationFor is the Resident's explanation of a planned run: the stored
// LLM summary when it still matches their plan, otherwise the template. The
// template is computed here, from the live reasons, so a plan always has one.
//
// The stored summary is used only when the row exists, its fingerprint (which
// holds the Check-in level) matches, it has a headline (a row from before the
// headline columns has none and reads as absent), and the day is not a day of
// rest: a Drained Resident always reads the rest summary.
func (s *Store) explanationFor(ctx context.Context, run dayRun, residentID string, date allocation.Date, open []tasks.Open) (*Explanation, error) {
	cis, err := checkin.LoadMany(ctx, s.db, []string{residentID}, date)
	if err != nil {
		return nil, err
	}
	// A Resident without a Check-in is absent from the map; its zero Level is "",
	// which the facts read as no Check-in.
	facts, fingerprint := run.factsFor(residentID, string(cis[residentID].Level), open)
	template := explanationOf(sourceTemplate, explain.Template(facts))
	if explain.SituationOf(facts) == explain.SituationRest {
		return template, nil
	}
	var (
		sum          explain.Summary
		headEn, head *string
		stored       string
	)
	err = s.db.QueryRow(ctx, `
		SELECT headline_en, headline_pt, text_en, text_pt, fingerprint
		FROM day_plan_explanations WHERE run_id = $1 AND resident_id = $2`,
		run.id, residentID).Scan(&headEn, &head, &sum.Detail.EnUS, &sum.Detail.PtBR, &stored)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return template, nil
	case err != nil:
		return nil, fmt.Errorf("day plan: load explanation: %w", err)
	case stored != fingerprint || headEn == nil || head == nil:
		return template, nil
	}
	sum.Headline = explain.Texts{EnUS: *headEn, PtBR: *head}
	return explanationOf(sourceLLM, sum), nil
}

// explainHomes asks the LLM to explain the Day Plan of each Home this tick
// planned, after all of them are planned and before any push, within its own
// budget so a slow model cannot eat the nudge deadline. It is best effort like
// push: nothing here may fail the tick, and a panic is logged and swallowed.
// Whatever is not explained reads back as the template. Every reason a Home
// went unexplained is logged here, once.
func (p *Planner) explainHomes(ctx context.Context, homes []HomeDay, now time.Time) {
	if p.llm.Explainer == nil || len(homes) == 0 {
		return
	}
	defer func() {
		if r := recover(); r != nil {
			p.log.Error("explanations panicked", "panic", fmt.Sprint(r))
		}
	}()
	ctx, cancel := context.WithTimeout(ctx, p.llm.ExplainBudget)
	defer cancel()
	for _, h := range homes {
		if skip := p.explainHome(ctx, h, now); skip != nil {
			attrs := []any{"home", h.ID, "fallback_reason", skip.reason, "residents", skip.residents}
			if skip.err != nil {
				attrs = append(attrs, "error", skip.err.Error())
			}
			p.log.Warn("explanation not used", attrs...)
		}
	}
}

// explainSkip says why a Home's explanations were not all used: a stable id
// for the log, how many Residents it concerns, and the error behind it, if any.
type explainSkip struct {
	reason    string
	residents int
	err       error
}

// explainReason is the id logged for a failed LLM call, derived from the
// allocator's fallback reason so both read the same: "explain_llm_timeout".
func explainReason(r fallbackReason) string { return "explain_" + string(r) }

// explainDBError is the id logged when the database fails around the call.
const explainDBError = "explain_db_error"

// explainInput is what the call for one Home is made of: the run the texts
// belong to, the Residents to ask about, and the fingerprint of each one's plan.
type explainInput struct {
	run          dayRun
	ask          []explain.ResidentFacts
	fingerprints map[string]string
}

// explainHome explains one Home's plan: it reads the plan, then makes the call
// (callExplainer). It returns nil when all went well or there was nothing to
// do, and otherwise why not; it does not log.
func (p *Planner) explainHome(ctx context.Context, h HomeDay, now time.Time) *explainSkip {
	if ctx.Err() != nil {
		return &explainSkip{reason: "explain_budget_spent"}
	}
	in, err := p.loadExplainInput(ctx, h)
	if err != nil {
		return &explainSkip{reason: explainDBError, err: err}
	}
	if len(in.ask) == 0 {
		return nil
	}
	return p.callExplainer(ctx, h, in, now)
}

// loadExplainInput reads the Home's planned run and open Tasks and picks the
// Residents who have Tasks and are not resting (the template already says it
// all for the others, and always wins on a day of rest).
// Without a planned run, or with nobody to ask about, the input has no ask.
func (p *Planner) loadExplainInput(ctx context.Context, h HomeDay) (explainInput, error) {
	run, found, err := readRun(ctx, p.db, h.ID, h.Date.Time())
	if err != nil || !found || run.outcome != string(Planned) {
		return explainInput{}, err
	}
	open, err := p.tasks.ListOpen(ctx, h.ID)
	if err != nil {
		return explainInput{}, err
	}
	ids := slices.Sorted(maps.Keys(run.reasons.Energy))
	levels, err := checkin.LoadMany(ctx, p.db, ids, allocation.DateOf(h.Date.Time()))
	if err != nil {
		return explainInput{}, err
	}
	in := explainInput{run: run, fingerprints: map[string]string{}}
	for _, id := range ids {
		facts, fp := run.factsFor(id, string(levels[id].Level), open)
		if len(facts.Tasks) == 0 || explain.SituationOf(facts) == explain.SituationRest {
			continue
		}
		in.fingerprints[id] = fp
		in.ask = append(in.ask, explain.ResidentFacts{ResidentID: id, Facts: facts})
	}
	return in, nil
}

// callExplainer takes one of the Home's daily LLM calls on the pool (before the
// call, so a failed call still counts), asks once for every Resident in the
// input and stores the valid texts with the fingerprint of the plan they were
// written for.
func (p *Planner) callExplainer(ctx context.Context, h HomeDay, in explainInput, now time.Time) *explainSkip {
	n := len(in.ask)
	ok, err := reserveLLMCall(ctx, p.db, h.ID, h.Date, p.llm.DailyCap)
	switch {
	case err != nil:
		return &explainSkip{reason: explainDBError, residents: n, err: err}
	case !ok:
		return &explainSkip{reason: "explain_llm_daily_cap_reached", residents: n}
	}
	callCtx, cancel := context.WithTimeout(ctx, p.llm.CallTimeout)
	defer cancel()
	texts, err := p.llm.Explainer.Explain(callCtx, in.ask)
	if err != nil {
		return &explainSkip{reason: explainReason(llmFailure(ctx, err)), residents: n, err: err}
	}
	if err := p.storeExplanations(ctx, in.run.id, texts, in.fingerprints, now); err != nil {
		return &explainSkip{reason: explainDBError, residents: n, err: err}
	}
	if missing := n - len(texts); missing > 0 {
		return &explainSkip{reason: explainReason(fallbackInvalid), residents: missing}
	}
	return nil
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
func (p *Planner) storeExplanations(ctx context.Context, runID string, texts map[string]explain.Summary, fingerprints map[string]string, now time.Time) error {
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
			INSERT INTO day_plan_explanations (run_id, resident_id, headline_en, headline_pt, text_en, text_pt, fingerprint, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
			runID, id, t.Headline.EnUS, t.Headline.PtBR, t.Detail.EnUS, t.Detail.PtBR, fingerprints[id], now); err != nil {
			return fmt.Errorf("store explanation: %w", err)
		}
	}
	return tx.Commit(ctx)
}
