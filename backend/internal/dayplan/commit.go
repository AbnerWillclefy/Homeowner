package dayplan

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// The errors of the Day Plan actions. The server maps each to a status and a
// stable code; this package knows no HTTP.
var (
	// ErrTaskNotFound: the Task does not exist or is not in the Home.
	ErrTaskNotFound = errors.New("task not found")
	// ErrNoPlanToday: the Home has no run for its local date, or it was
	// rejected, so there is no Day Plan to act on.
	ErrNoPlanToday = errors.New("no day plan today")
	// ErrNotProposed: the Task is not Proposed to the caller today.
	ErrNotProposed = errors.New("task is not proposed to you")
	// ErrAlreadyCommitted: the caller already accepted the Task today.
	ErrAlreadyCommitted = errors.New("task is already committed")
	// ErrNotInPool: the Task is assigned to someone today.
	ErrNotInPool = errors.New("task is not in the pool")
	// ErrNotYours: the caller does not hold the Task today.
	ErrNotYours = errors.New("task is not yours")
	// ErrAlreadyDone: the Task was completed.
	ErrAlreadyDone = errors.New("task is already done")
	// ErrTwoPersonTask: a Task for two people cannot be taken yet.
	ErrTwoPersonTask = errors.New("task needs two people")
	// ErrRestricted: the Resident may not do the Task today, because of a
	// Restriction or because its Chore is not allowed on this weekday.
	ErrRestricted = errors.New("task is restricted for you")
)

// ReasonRefused is the pool reason of a Task a Resident refused. A refused Task
// stays in the pool until the next Allocation: no re-plan hands it out again.
const ReasonRefused = "refused"

// ReasonTaken is the assignment reason of a Task a Resident took from the pool.
const ReasonTaken = "taken"

// acting is what an action sees once the Home is locked and today's planned
// run is loaded.
type acting struct {
	tx   pgx.Tx
	home string
	// date is the Home's local date; now the instant of the request.
	date allocation.Date
	now  time.Time
	run  storedRun
}

// act runs do in one transaction that locks the Home as the job, a Check-in
// and "right away" do, so actions and plans serialise. It needs today's run to
// exist and to have produced a plan; any error rolls everything back.
func (p *Planner) act(ctx context.Context, homeID string, now time.Time, name string, do func(a *acting) error) error {
	return p.actOn(ctx, homeID, now, name, true, do)
}

// actOn is act, and with needPlan unset it also runs when there is no plan,
// leaving do to say what that means.
func (p *Planner) actOn(ctx context.Context, homeID string, now time.Time, name string, needPlan bool, do func(a *acting) error) error {
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	date, err := lockHome(ctx, tx, homeID, now)
	if err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	run, found, err := loadRun(ctx, tx, homeID, date)
	if err != nil {
		return err
	}
	if needPlan && (!found || run.outcome != Planned) {
		return ErrNoPlanToday
	}
	if !found || run.outcome != Planned {
		run = storedRun{}
	}
	if err := do(&acting{tx: tx, home: homeID, date: date, now: now, run: run}); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("%s: commit: %w", name, err)
	}
	return nil
}

// taskState is a Task of the Home, locked for the rest of the transaction.
type taskState struct {
	done   bool
	people int
}

// lockTask finds the Task in the Home and locks its row, so two actions on one
// Task serialise.
func lockTask(ctx context.Context, tx pgx.Tx, homeID, taskID string) (taskState, error) {
	var (
		ts     taskState
		status string
		people int16
	)
	err := tx.QueryRow(ctx, `
		SELECT t.status, c.people
		FROM tasks t JOIN chores c ON c.id = t.chore_id
		WHERE t.id = $1 AND c.home_id = $2
		FOR UPDATE OF t`, taskID, homeID).Scan(&status, &people)
	if errors.Is(err, pgx.ErrNoRows) {
		return taskState{}, ErrTaskNotFound
	}
	if err != nil {
		return taskState{}, fmt.Errorf("lock task: %w", err)
	}
	ts.done, ts.people = status == "done", int(people)
	return ts, nil
}

// holds reports whether the run gave the Task to the Resident.
func holds(ctx context.Context, tx pgx.Tx, runID, taskID, residentID string) (bool, error) {
	var ok bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM day_plan_assignments WHERE run_id = $1 AND task_id = $2 AND resident_id = $3)`,
		runID, taskID, residentID).Scan(&ok)
	if err != nil {
		return false, fmt.Errorf("look for assignment: %w", err)
	}
	return ok, nil
}

// Accept makes the Resident's Proposed Task Committed for the Home's local
// date at now. Accepting again changes nothing. A Task that is not Proposed to
// the Resident today (someone else's, or in the pool) is ErrNotProposed.
func (p *Planner) Accept(ctx context.Context, homeID, residentID, taskID string, now time.Time) error {
	return p.act(ctx, homeID, now, "accept", func(a *acting) error {
		ts, err := lockTask(ctx, a.tx, homeID, taskID)
		if err != nil {
			return err
		}
		mine, err := holds(ctx, a.tx, a.run.id, taskID, residentID)
		if err != nil {
			return err
		}
		if ts.done {
			return ErrAlreadyDone
		}
		if !mine {
			return ErrNotProposed
		}
		_, err = a.tx.Exec(ctx, `
			INSERT INTO task_residents (task_id, resident_id, committed_on, committed_at) VALUES ($1, $2, $3, $4)
			ON CONFLICT DO NOTHING`, taskID, residentID, a.date.Time(), a.now)
		if err != nil {
			return fmt.Errorf("accept: %w", err)
		}
		return nil
	})
}

// Refuse sends the Resident's Proposed Task back to the pool, with no penalty.
// No re-plan hands it out again until the next Allocation. A Task the Resident
// already accepted cannot be refused (ErrAlreadyCommitted).
func (p *Planner) Refuse(ctx context.Context, homeID, residentID, taskID string, now time.Time) error {
	return p.act(ctx, homeID, now, "refuse", func(a *acting) error {
		ts, err := lockTask(ctx, a.tx, homeID, taskID)
		if err != nil {
			return err
		}
		mine, err := holds(ctx, a.tx, a.run.id, taskID, residentID)
		if err != nil {
			return err
		}
		if ts.done {
			return ErrAlreadyDone
		}
		if !mine {
			return ErrNotProposed
		}
		committed, err := committedOn(ctx, a.tx, taskID, residentID, a.date)
		if err != nil {
			return err
		}
		if committed {
			return ErrAlreadyCommitted
		}
		if _, err := a.tx.Exec(ctx, `DELETE FROM day_plan_assignments WHERE run_id = $1 AND task_id = $2`, a.run.id, taskID); err != nil {
			return fmt.Errorf("refuse: %w", err)
		}
		a.run.reasons.refuse(taskID)
		return writeReasons(ctx, a.tx, a.run.id, a.run.reasons)
	})
}

// Take gives the Resident a Task from today's pool and Commits them to it. It
// may go over the Resident's Energy (they chose it), but never over a
// Restriction or the Chore's allowed weekdays: the same referee that checks
// every plan decides that. A Task for two people cannot be taken yet.
func (p *Planner) Take(ctx context.Context, homeID, residentID, taskID string, now time.Time) error {
	return p.act(ctx, homeID, now, "take", func(a *acting) error {
		ts, err := lockTask(ctx, a.tx, homeID, taskID)
		if err != nil {
			return err
		}
		if ts.done {
			return ErrAlreadyDone
		}
		var assignedToday bool
		err = a.tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM day_plan_assignments WHERE run_id = $1 AND task_id = $2)`,
			a.run.id, taskID).Scan(&assignedToday)
		if err != nil {
			return fmt.Errorf("take: %w", err)
		}
		if assignedToday {
			return ErrNotInPool
		}
		if ts.people > 1 {
			return ErrTwoPersonTask
		}
		if err := a.checkTake(ctx, residentID, taskID); err != nil {
			return err
		}
		if _, err := a.tx.Exec(ctx, `
			INSERT INTO day_plan_assignments (run_id, task_id, resident_id, reason) VALUES ($1, $2, $3, $4)`,
			a.run.id, taskID, residentID, ReasonTaken); err != nil {
			return fmt.Errorf("take: %w", err)
		}
		if _, err := a.tx.Exec(ctx, `
			INSERT INTO task_residents (task_id, resident_id, committed_on, committed_at) VALUES ($1, $2, $3, $4)`,
			taskID, residentID, a.date.Time(), a.now); err != nil {
			return fmt.Errorf("take: %w", err)
		}
		a.run.reasons.take(taskID, residentID)
		return writeReasons(ctx, a.tx, a.run.id, a.run.reasons)
	})
}

// checkTake has the referee look at a plan of only this Task for only this
// Resident, and turns what it finds into ErrRestricted. Going over Energy is
// the one thing a Resident may choose, so it is not held against them.
func (a *acting) checkTake(ctx context.Context, residentID, taskID string) error {
	st, err := loadState(ctx, a.tx, a.home, a.date)
	if err != nil {
		return err
	}
	sub, ok := subState(st.state, residentID, nil)
	if !ok {
		return fmt.Errorf("take: resident %s is not in the home", residentID)
	}
	sub.Tasks = slices.DeleteFunc(sub.Tasks, func(t allocation.Task) bool { return t.ID != taskID })
	plan := allocation.DayPlan{Assignments: []allocation.Assignment{{TaskID: taskID, ResidentID: residentID, Reason: ReasonTaken}}}
	for _, v := range allocation.Check(plan, sub) {
		switch v.Kind {
		case allocation.OverEnergy:
		case allocation.BrokenRestriction, allocation.WeekdayNotAllowed:
			return ErrRestricted
		default:
			return fmt.Errorf("take: referee: %s", v.Detail)
		}
	}
	return nil
}

// committedOn reports whether the Resident committed to the Task on the date.
func committedOn(ctx context.Context, tx pgx.Tx, taskID, residentID string, date allocation.Date) (bool, error) {
	var ok bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM task_residents WHERE task_id = $1 AND resident_id = $2 AND committed_on = $3)`,
		taskID, residentID, date.Time()).Scan(&ok)
	if err != nil {
		return false, fmt.Errorf("look for commitment: %w", err)
	}
	return ok, nil
}

// AcceptAll makes every Task Proposed to the Resident Committed, in one
// statement. With nothing Proposed it changes nothing and is not an error.
func (p *Planner) AcceptAll(ctx context.Context, homeID, residentID string, now time.Time) error {
	return p.act(ctx, homeID, now, "accept all", func(a *acting) error {
		_, err := a.tx.Exec(ctx, `
			INSERT INTO task_residents (task_id, resident_id, committed_on, committed_at)
			SELECT d.task_id, d.resident_id, $3, $4
			FROM day_plan_assignments d JOIN tasks t ON t.id = d.task_id
			WHERE d.run_id = $1 AND d.resident_id = $2 AND t.status = 'open'
			ON CONFLICT DO NOTHING`, a.run.id, residentID, a.date.Time(), a.now)
		if err != nil {
			return fmt.Errorf("accept all: %w", err)
		}
		return nil
	})
}
