// Package dayplan runs Allocation for Homes and keeps the Day Plan it makes
// (see CONTEXT.md and docs/adr/0004). The Planner is the one orchestrator the
// scheduled job calls, and that later features (a Check-in, a new Home that
// wants its first Day Plan) can call too: it builds the allocation.State from
// the database, asks an Allocator for a proposal, has allocation.Check referee
// it, and stores the run and the assignments in one transaction. The Store
// reads the stored plan back for the API.
//
// The pure rules live in the allocation package; this one does the I/O.
package dayplan

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/tasks"
)

// Outcome says what PlanHome did.
type Outcome string

const (
	// Planned: a Day Plan was stored for the Home's local date.
	Planned Outcome = "planned"
	// AlreadyPlanned: the Home already has a run for its local date.
	AlreadyPlanned Outcome = "already_planned"
	// Rejected: the checker refused the allocator's proposal. The run is
	// recorded as rejected, nothing is assigned and it is not retried today.
	Rejected Outcome = "rejected"
)

const uniqueViolation = "23505"

// Planner plans Homes.
type Planner struct {
	db    *pgxpool.Pool
	tasks *tasks.Store
	alloc allocation.Allocator
	log   *slog.Logger
	nudge Nudger
	llm   LLMConfig
	// nudgeTimeout is the one deadline for all the nudging of a tick.
	nudgeTimeout time.Duration
}

// defaultNudgeTimeout bounds both nudge calls of a tick together, well inside
// the Allocation Lambda's 60 second timeout. Whatever is not sent when it runs
// out is lost, by design.
const defaultNudgeTimeout = 30 * time.Second

// Nudger sends the pushes that hang off the Allocation tick. It is an
// interface so this package knows nothing of push or subscriptions. Both
// methods log their own failures and never return one: push is best effort and
// must not touch Allocation.
type Nudger interface {
	// DayPlanReady tells the Residents of the Homes their Day Plan is ready.
	DayPlanReady(ctx context.Context, homeIDs []string, now time.Time)
	// CheckinReminders reminds Residents who have not checked in, for Homes an
	// hour from their Allocation time.
	CheckinReminders(ctx context.Context, now time.Time)
}

// Option adjusts a Planner built by New.
type Option func(*Planner)

// WithNudger makes RunDue send push nudges through n after it has planned.
// Without it (nil, or the option left out) push is off and a tick only plans.
func WithNudger(n Nudger) Option {
	return func(p *Planner) { p.nudge = n }
}

// WithNudgeTimeout sets the one deadline for all the nudging of a tick
// (default 30 seconds). It exists for tests.
func WithNudgeTimeout(d time.Duration) Option {
	return func(p *Planner) { p.nudgeTimeout = d }
}

// Proposer is the LLM allocator as the Planner sees it: like an Allocator, but
// it takes a context, because it calls out and must stop at a deadline.
type Proposer interface {
	// Name goes in the run record when its plan is used.
	Name() string
	Propose(ctx context.Context, st allocation.State) (allocation.Result, error)
}

// LLMConfig is the optional LLM allocator of the daily Allocation.
type LLMConfig struct {
	Proposer Proposer
	// DailyCap is how many calls one Home may make per local day.
	DailyCap int
	// CallTimeout bounds one call.
	CallTimeout time.Duration
	// TickBudget bounds all the calls of one RunDue; zero means the default.
	TickBudget time.Duration
}

// WithLLM makes PlanHome ask c.Proposer first. Its plan is used only when it
// passes Check; otherwise the Planner's Allocator plans and the run records why
// (ADR 0004). Check-in and "right away" re-plans never use it.
func WithLLM(c LLMConfig) Option {
	if c.TickBudget == 0 {
		c.TickBudget = defaultLLMBudget
	}
	return func(p *Planner) { p.llm = c }
}

// defaultLLMBudget bounds the LLM calls of a whole tick. With the 30 second
// nudge deadline after planning, it keeps the tick inside the Allocation
// Lambda's 60 second timeout.
const defaultLLMBudget = 20 * time.Second

// New returns a Planner that asks alloc for every proposal.
func New(db *pgxpool.Pool, alloc allocation.Allocator, log *slog.Logger, opts ...Option) *Planner {
	p := &Planner{db: db, tasks: tasks.NewStore(db), alloc: alloc, log: log, nudgeTimeout: defaultNudgeTimeout}
	for _, opt := range opts {
		opt(p)
	}
	return p
}

// Summary is what one run of the job did.
type Summary struct {
	Due, Planned, AlreadyPlanned, Rejected, Failed int
}

// RunDue plans every Home whose Allocation time has arrived and that has no
// run for its local date. A failure for one Home is logged and does not stop
// the others; the next tick tries it again. The error is only for not being
// able to find the Homes at all.
func (p *Planner) RunDue(ctx context.Context, now time.Time) (Summary, error) {
	due, err := p.DueHomes(ctx, now)
	if err != nil {
		return Summary{}, err
	}
	sum := Summary{Due: len(due)}
	var planned []string
	// One LLM budget for the whole tick: once it is spent, the remaining Homes
	// fall back to the baseline without asking.
	llmCtx, cancel := context.WithTimeout(ctx, p.llm.TickBudget)
	defer cancel()
	for _, id := range due {
		outcome, err := p.planHome(ctx, llmCtx, id, now)
		switch {
		case err != nil:
			sum.Failed++
			p.log.Error("allocate home failed", "home", id, "error", err.Error())
		case outcome == Planned:
			sum.Planned++
			planned = append(planned, id)
		case outcome == Rejected:
			sum.Rejected++
		default:
			sum.AlreadyPlanned++
		}
	}
	// Every Home is planned before any push is attempted, so a slow or failing
	// push service can never delay or fail an Allocation.
	p.sendNudges(ctx, planned, now)
	p.log.Info("allocation tick done", "due", sum.Due, "planned", sum.Planned,
		"already_planned", sum.AlreadyPlanned, "rejected", sum.Rejected, "failed", sum.Failed)
	return sum, nil
}

// sendNudges sends "Day Plan ready" for the Homes this tick planned (not for
// ones already planned or rejected), then the Check-in reminders. A panic is
// logged and swallowed: nothing here may change the tick's answer. Both calls
// share one deadline.
func (p *Planner) sendNudges(ctx context.Context, planned []string, now time.Time) {
	if p.nudge == nil {
		return
	}
	defer func() {
		if r := recover(); r != nil {
			p.log.Error("nudges panicked", "panic", fmt.Sprint(r))
		}
	}()
	ctx, cancel := context.WithTimeout(ctx, p.nudgeTimeout)
	defer cancel()
	p.nudge.DayPlanReady(ctx, planned, now)
	p.nudge.CheckinReminders(ctx, now)
}

// DueHomes returns the ids of the Homes whose local time at now is at or past
// their Allocation time and that have no run for their local date. "At or
// past", not "equal", so a late or skipped tick, or a daylight-saving gap that
// skips the exact time, still plans the Home once. A Home with an unknown
// timezone is logged and skipped.
func (p *Planner) DueHomes(ctx context.Context, now time.Time) ([]string, error) {
	homes, err := UnplannedHomes(ctx, p.db, p.log, now, func(local, alloc time.Duration) bool {
		return local >= alloc
	})
	if err != nil {
		return nil, err
	}
	due := make([]string, 0, len(homes))
	for _, h := range homes {
		due = append(due, h.ID)
	}
	return due, nil
}

// HomeDay is a Home with its local date at some instant.
type HomeDay struct {
	ID   string
	Date allocation.Date
}

// UnplannedHomes returns, ordered by id, the Homes that have no run for their
// local date at now and for which inWindow(local, alloc) holds, where local is
// the Home's time of day at now and alloc its Allocation time, both as offsets
// since local midnight. It is the one scan behind DueHomes and the Check-in
// reminder window: the zone conversion, the skip of an unknown zone (logged)
// and the check for a run live here only.
func UnplannedHomes(ctx context.Context, db *pgxpool.Pool, log *slog.Logger, now time.Time, inWindow func(local, alloc time.Duration) bool) ([]HomeDay, error) {
	type home struct {
		id, zone string
		minutes  int
	}
	rows, err := db.Query(ctx, `
		SELECT id, timezone, extract(hour FROM allocation_time)::int * 60 + extract(minute FROM allocation_time)::int
		FROM homes ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("list homes: %w", err)
	}
	homes, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (h home, err error) {
		return h, r.Scan(&h.id, &h.zone, &h.minutes)
	})
	if err != nil {
		return nil, fmt.Errorf("list homes: %w", err)
	}

	// A local date is at most a day away from the UTC one, so two days back
	// covers every zone.
	type key struct {
		home string
		date allocation.Date
	}
	rows, err = db.Query(ctx, `SELECT home_id, plan_date FROM allocation_runs WHERE plan_date >= $1`,
		now.UTC().AddDate(0, 0, -2))
	if err != nil {
		return nil, fmt.Errorf("list runs: %w", err)
	}
	planned, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (k key, err error) {
		var d time.Time
		if err := r.Scan(&k.home, &d); err != nil {
			return k, err
		}
		k.date = allocation.DateOf(d)
		return k, nil
	})
	if err != nil {
		return nil, fmt.Errorf("list runs: %w", err)
	}

	var out []HomeDay
	for _, h := range homes {
		loc, err := time.LoadLocation(h.zone)
		if err != nil {
			log.Warn("home skipped: unknown timezone", "home", h.id, "timezone", h.zone)
			continue
		}
		local := now.In(loc)
		sinceMidnight := time.Duration(local.Hour()*60+local.Minute()) * time.Minute
		if !inWindow(sinceMidnight, time.Duration(h.minutes)*time.Minute) {
			continue
		}
		date := allocation.DateOf(local)
		if slices.Contains(planned, key{h.id, date}) {
			continue
		}
		out = append(out, HomeDay{ID: h.id, Date: date})
	}
	return out, nil
}

// PlanHome makes the Day Plan of the Home for its local date at now, unless the
// Home already has a run for that date. It does not look at the Allocation
// time: choosing when to plan is the caller's business (see DueHomes).
//
// Steps: bring the Tasks up to date, ask the LLM when it is on, then in one
// transaction lock the Home, look for the day's run, build the State, have
// Check referee the LLM's proposal, ask the Allocator when it is not used, and
// store the run with its assignments. The lock makes
// overlapping invocations plan once, and the unique key on the run is the last
// guard. A crash leaves nothing half-written.
//
// The Tasks are refreshed before the lock, not inside it, so a call never holds
// a connection while waiting for a second one from the pool. Refresh is
// idempotent, so overlapping calls only repeat it.
func (p *Planner) PlanHome(ctx context.Context, homeID string, now time.Time) (Outcome, error) {
	return p.planHome(ctx, ctx, homeID, now)
}

// planHome is PlanHome with llmCtx bounding the LLM call, so RunDue can share
// one LLM budget across its Homes.
func (p *Planner) planHome(ctx, llmCtx context.Context, homeID string, now time.Time) (Outcome, error) {
	day, done, err := p.planned(ctx, homeID, now)
	if err != nil || done {
		return AlreadyPlanned, err
	}
	if err := p.tasks.Refresh(ctx, homeID, now); err != nil {
		return "", err
	}
	// The LLM is asked before the transaction: the call is slow, and it must
	// not hold the Home lock (a Check-in would wait) or a connection.
	ans := p.askLLM(llmCtx, homeID, day)

	tx, err := p.db.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("plan home: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	date, err := lockHome(ctx, tx, homeID, now)
	if err != nil {
		return "", fmt.Errorf("plan home: %w", err)
	}
	exists, err := runExists(ctx, tx, homeID, date)
	if err != nil {
		return "", fmt.Errorf("plan home: %w", err)
	}
	if exists {
		return AlreadyPlanned, nil
	}
	if date != day {
		ans = llmAnswer{} // the Home's zone changed during the call: that plan was for another day
	}

	st, err := loadState(ctx, tx, homeID, date)
	if err != nil {
		return "", err
	}
	run := p.propose(st, ans)
	if err := store(ctx, tx, homeID, date, now, run); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return AlreadyPlanned, nil
		}
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("plan home: commit: %w", err)
	}

	if run.fallback != "" {
		p.log.Warn("llm proposal not used", "home", homeID, "fallback_reason", run.fallback, "violations", len(run.reasons.LLMViolations))
	}
	if run.outcome == Rejected {
		p.log.Error("allocator proposal rejected by the checker", "home", homeID, "date", date.Time().Format(time.DateOnly),
			"allocator", run.allocator, "fallback_reason", run.fallback, "violations", len(run.reasons.Violations), "reason", run.reasons.Error)
		return Rejected, nil
	}
	p.log.Info("day planned", "home", homeID, "date", date.Time().Format(time.DateOnly), "allocator", run.allocator, "fallback_reason", run.fallback,
		"assigned", len(run.result.DayPlan.Assignments), "pooled", len(run.result.Pool))
	return Planned, nil
}

// planned returns the Home's local date at now and whether the Home already
// has a run for it, without taking any lock.
func (p *Planner) planned(ctx context.Context, homeID string, now time.Time) (allocation.Date, bool, error) {
	var zone string
	if err := p.db.QueryRow(ctx, `SELECT timezone FROM homes WHERE id = $1`, homeID).Scan(&zone); err != nil {
		return 0, false, fmt.Errorf("plan home: load home: %w", err)
	}
	date, err := LocalDate(zone, now)
	if err != nil {
		return 0, false, fmt.Errorf("plan home: %w", err)
	}
	exists, err := runExists(ctx, p.db, homeID, date)
	if err != nil {
		return 0, false, fmt.Errorf("plan home: %w", err)
	}
	return date, exists, nil
}

// querier is the QueryRow half of *pgxpool.Pool and pgx.Tx.
type querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// LocalDate is the date at now in the IANA zone.
func LocalDate(zone string, now time.Time) (allocation.Date, error) {
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return 0, fmt.Errorf("timezone %q: %w", zone, err)
	}
	return allocation.DateOf(now.In(loc)), nil
}

// runExists reports whether the Home has a run for the date.
func runExists(ctx context.Context, q querier, homeID string, date allocation.Date) (bool, error) {
	var exists bool
	err := q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM allocation_runs WHERE home_id = $1 AND plan_date = $2)`,
		homeID, date.Time()).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("look for run: %w", err)
	}
	return exists, nil
}

// runRecord is a finished proposal, ready to store.
type runRecord struct {
	allocator string
	outcome   Outcome
	result    allocation.Result
	reasons   reasons
	// fallback says why the LLM's plan was not used, when it was asked.
	fallback fallbackReason
}

// fallbackReason is why the LLM's plan was not used, stored in
// allocation_runs.fallback_reason. The zero value means there was no
// fallback: the LLM was not asked or its plan was used.
type fallbackReason string

const (
	fallbackError      fallbackReason = "llm_error"
	fallbackTimeout    fallbackReason = "llm_timeout"
	fallbackInvalid    fallbackReason = "llm_invalid_response"
	fallbackRejected   fallbackReason = "llm_rejected_by_checker"
	fallbackCapReached fallbackReason = "llm_daily_cap_reached"
)

// llmAnswer is what asking the LLM gave: a proposal, not yet refereed, or why
// there is none. Both zero means the LLM was not asked.
type llmAnswer struct {
	proposal *allocation.Result
	fallback fallbackReason
}

// propose referees the LLM's proposal against st, the State under the Home
// lock, and uses it when it passes Check. Otherwise the Allocator proposes and
// the run records why the LLM's plan was not used. Every proposal is refereed:
// a plan is stored only when it passes Check (ADR 0004). A baseline proposal
// that errors or breaks a rule is a rejected run with nothing assigned.
func (p *Planner) propose(st loaded, ans llmAnswer) runRecord {
	rec := runRecord{allocator: p.alloc.Name(), outcome: Planned,
		reasons: reasons{Energy: st.energy, Assigned: []assigned{}, Pool: []pooled{}}}
	if worthAsking(st.state) {
		if ans.proposal != nil {
			vs := allocation.Check(ans.proposal.DayPlan, st.state)
			if len(vs) == 0 {
				rec.allocator, rec.result = p.llm.Proposer.Name(), *ans.proposal
				rec.reasons.add(*ans.proposal)
				return rec
			}
			rec.reasons.LLMViolations = violationsOf(vs)
			ans.fallback = fallbackRejected
		}
		rec.fallback = ans.fallback
	}
	res, err := p.alloc.Plan(st.state)
	if err != nil {
		rec.outcome, rec.reasons.Error = Rejected, "allocator_failed"
		return rec
	}
	if vs := allocation.Check(res.DayPlan, st.state); len(vs) > 0 {
		rec.outcome, rec.reasons.Error, rec.reasons.Violations = Rejected, "referee_rejected", violationsOf(vs)
		return rec
	}
	rec.result = res
	rec.reasons.add(res)
	return rec
}

// askLLM asks the LLM for a proposal for the Home's date, when it is on and
// there is something to plan. ctx is the LLM's budget (the tick's, in RunDue):
// once spent, the call is skipped without reserving. Otherwise it reads the
// State, reserves one of the Home's daily calls (on the pool, so a later
// rollback cannot give back a call that was paid) and asks under the call
// timeout. It takes no lock and holds no connection while the model answers.
func (p *Planner) askLLM(ctx context.Context, homeID string, date allocation.Date) llmAnswer {
	if p.llm.Proposer == nil {
		return llmAnswer{}
	}
	failed := func(err error) llmAnswer {
		switch {
		case ctx.Err() != nil, errors.Is(err, context.DeadlineExceeded):
			return llmAnswer{fallback: fallbackTimeout}
		case errors.Is(err, llmalloc.ErrInvalidResponse):
			return llmAnswer{fallback: fallbackInvalid}
		}
		p.log.Error("llm allocator failed", "home", homeID, "error", err.Error())
		return llmAnswer{fallback: fallbackError}
	}
	if err := ctx.Err(); err != nil {
		return failed(err)
	}
	st, err := p.readState(ctx, homeID, date)
	if err != nil {
		return failed(err)
	}
	if !worthAsking(st) {
		return llmAnswer{}
	}
	ok, err := reserveLLMCall(ctx, p.db, homeID, date, p.llm.DailyCap)
	if err != nil {
		return failed(err)
	}
	if !ok {
		return llmAnswer{fallback: fallbackCapReached}
	}
	callCtx, cancel := context.WithTimeout(ctx, p.llm.CallTimeout)
	defer cancel()
	res, err := p.llm.Proposer.Propose(callCtx, st)
	if err != nil {
		return failed(err)
	}
	return llmAnswer{proposal: &res}
}

// readState loads the Home's State for date in a short transaction of its own,
// without the Home lock.
func (p *Planner) readState(ctx context.Context, homeID string, date allocation.Date) (allocation.State, error) {
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return allocation.State{}, fmt.Errorf("read state: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	st, err := loadState(ctx, tx, homeID, date)
	return st.state, err
}

// worthAsking reports whether there is anything for the LLM to plan: an open
// Task and a Resident with Energy. Otherwise the baseline plans for free.
func worthAsking(st allocation.State) bool {
	return len(st.Tasks) > 0 && slices.ContainsFunc(st.Residents, func(r allocation.Resident) bool { return r.Energy > 0 })
}

func violationsOf(vs []allocation.Violation) []violation {
	out := make([]violation, 0, len(vs))
	for _, v := range vs {
		out = append(out, violation{Kind: string(v.Kind), TaskID: v.TaskID, ResidentID: v.ResidentID, Level: string(v.Level), Detail: v.Detail})
	}
	return out
}
