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
}

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

// New returns a Planner that asks alloc for every proposal.
func New(db *pgxpool.Pool, alloc allocation.Allocator, log *slog.Logger, opts ...Option) *Planner {
	p := &Planner{db: db, tasks: tasks.NewStore(db), alloc: alloc, log: log}
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
	for _, id := range due {
		outcome, err := p.PlanHome(ctx, id, now)
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
// logged and swallowed: nothing here may change the tick's answer.
func (p *Planner) sendNudges(ctx context.Context, planned []string, now time.Time) {
	if p.nudge == nil {
		return
	}
	defer func() {
		if r := recover(); r != nil {
			p.log.Error("nudges panicked", "panic", fmt.Sprint(r))
		}
	}()
	p.nudge.DayPlanReady(ctx, planned, now)
	p.nudge.CheckinReminders(ctx, now)
}

// DueHomes returns the ids of the Homes whose local time at now is at or past
// their Allocation time and that have no run for their local date. "At or
// past", not "equal", so a late or skipped tick, or a daylight-saving gap that
// skips the exact time, still plans the Home once. A Home with an unknown
// timezone is logged and skipped.
func (p *Planner) DueHomes(ctx context.Context, now time.Time) ([]string, error) {
	type home struct {
		id, zone string
		minutes  int
	}
	rows, err := p.db.Query(ctx, `
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
	rows, err = p.db.Query(ctx, `SELECT home_id, plan_date FROM allocation_runs WHERE plan_date >= $1`,
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

	var due []string
	for _, h := range homes {
		loc, err := time.LoadLocation(h.zone)
		if err != nil {
			p.log.Warn("home skipped: unknown timezone", "home", h.id, "timezone", h.zone)
			continue
		}
		local := now.In(loc)
		if local.Hour()*60+local.Minute() < h.minutes {
			continue
		}
		if slices.Contains(planned, key{h.id, allocation.DateOf(local)}) {
			continue
		}
		due = append(due, h.id)
	}
	return due, nil
}

// PlanHome makes the Day Plan of the Home for its local date at now, unless the
// Home already has a run for that date. It does not look at the Allocation
// time: choosing when to plan is the caller's business (see DueHomes).
//
// Steps: bring the Tasks up to date, then in one transaction lock the Home,
// look for the day's run, build the State, ask the Allocator, have Check
// referee the proposal and store the run with its assignments. The lock makes
// overlapping invocations plan once, and the unique key on the run is the last
// guard. A crash leaves nothing half-written.
//
// The Tasks are refreshed before the lock, not inside it, so a call never holds
// a connection while waiting for a second one from the pool. Refresh is
// idempotent, so overlapping calls only repeat it.
func (p *Planner) PlanHome(ctx context.Context, homeID string, now time.Time) (Outcome, error) {
	if done, err := p.planned(ctx, homeID, now); err != nil || done {
		return AlreadyPlanned, err
	}
	if err := p.tasks.Refresh(ctx, homeID, now); err != nil {
		return "", err
	}

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

	st, err := loadState(ctx, tx, homeID, date)
	if err != nil {
		return "", err
	}
	run := p.propose(st)
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

	if run.outcome == Rejected {
		p.log.Error("allocator proposal rejected by the checker", "home", homeID, "date", date.Time().Format(time.DateOnly),
			"allocator", run.allocator, "violations", len(run.reasons.Violations), "reason", run.reasons.Error)
		return Rejected, nil
	}
	p.log.Info("day planned", "home", homeID, "date", date.Time().Format(time.DateOnly), "allocator", run.allocator,
		"assigned", len(run.result.DayPlan.Assignments), "pooled", len(run.result.Pool))
	return Planned, nil
}

// planned reports whether the Home already has a run for its local date at
// now, without taking any lock.
func (p *Planner) planned(ctx context.Context, homeID string, now time.Time) (bool, error) {
	var zone string
	if err := p.db.QueryRow(ctx, `SELECT timezone FROM homes WHERE id = $1`, homeID).Scan(&zone); err != nil {
		return false, fmt.Errorf("plan home: load home: %w", err)
	}
	date, err := LocalDate(zone, now)
	if err != nil {
		return false, fmt.Errorf("plan home: %w", err)
	}
	exists, err := runExists(ctx, p.db, homeID, date)
	if err != nil {
		return false, fmt.Errorf("plan home: %w", err)
	}
	return exists, nil
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
}

// propose asks the Allocator and referees the answer. A proposal that errors or
// breaks a rule is never stored as a plan (ADR 0004): the run is rejected with
// nothing assigned.
func (p *Planner) propose(st loaded) runRecord {
	rec := runRecord{allocator: p.alloc.Name(), outcome: Planned,
		reasons: reasons{Energy: st.energy, Assigned: []assigned{}, Pool: []pooled{}}}
	res, err := p.alloc.Plan(st.state)
	if err != nil {
		rec.outcome, rec.reasons.Error = Rejected, "allocator_failed"
		return rec
	}
	if vs := allocation.Check(res.DayPlan, st.state); len(vs) > 0 {
		rec.outcome, rec.reasons.Error = Rejected, "referee_rejected"
		for _, v := range vs {
			rec.reasons.Violations = append(rec.reasons.Violations,
				violation{Kind: string(v.Kind), TaskID: v.TaskID, ResidentID: v.ResidentID, Level: string(v.Level), Detail: v.Detail})
		}
		return rec
	}
	rec.result = res
	rec.reasons.add(res)
	return rec
}
