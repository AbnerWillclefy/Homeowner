package dayplan

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"
)

// The errors of Swaps, beside those of the other Day Plan actions.
var (
	// ErrNotHeldByOther: the requested Task is in the pool or the caller's
	// own, so there is nobody to offer the Swap to.
	ErrNotHeldByOther = errors.New("task is not held by another resident")
	// ErrSwapPending: the same Swap is already offered and waiting.
	ErrSwapPending = errors.New("swap is already offered")
	// ErrSwapNotFound: no such offer for the caller to answer today. An unknown
	// id, another Home's, another day's and one the caller has no part in look
	// alike, so ids do not leak.
	ErrSwapNotFound = errors.New("swap not found")
	// ErrSwapClosed: the offer was already accepted, declined or cancelled.
	ErrSwapClosed = errors.New("swap is closed")
	// ErrSwapStale: one of the two Tasks no longer sits with the Resident the
	// offer assumed, or is done.
	ErrSwapStale = errors.New("swap is stale")
	// ErrRecipientDrained: a Resident who checked in Drained today is not given
	// work, and a Swap would give them some.
	ErrRecipientDrained = errors.New("resident is drained today")
)

// ReasonSwapped is the assignment reason of a Task that changed hands in a
// Swap.
const ReasonSwapped = "swapped"

// The statuses of a swap offer, as the swap_offers table allows them.
const (
	swapPending   = "pending"
	swapAccepted  = "accepted"
	swapDeclined  = "declined"
	swapCancelled = "cancelled"
)

// swapOffer is a row of swap_offers, locked for the rest of the transaction.
type swapOffer struct {
	id            string
	offeredTask   string
	requestedTask string
	from, to      string
	status        string
	planDate      time.Time
}

// loadOffer finds the offer in the Home and locks it. It is ErrSwapNotFound
// unless it is dated today and the caller is the Resident who must answer
// (the recipient when byRecipient, else the offerer).
func (a *acting) loadOffer(ctx context.Context, residentID, offerID string, byRecipient bool) (swapOffer, error) {
	var o swapOffer
	err := a.tx.QueryRow(ctx, `
		SELECT id, offered_task_id, requested_task_id, from_resident_id, to_resident_id, status, plan_date
		FROM swap_offers WHERE id = $1 AND home_id = $2
		FOR UPDATE`, offerID, a.home).Scan(&o.id, &o.offeredTask, &o.requestedTask, &o.from, &o.to, &o.status, &o.planDate)
	if errors.Is(err, pgx.ErrNoRows) {
		return swapOffer{}, ErrSwapNotFound
	}
	if err != nil {
		return swapOffer{}, fmt.Errorf("load swap: %w", err)
	}
	answerer := o.from
	if byRecipient {
		answerer = o.to
	}
	if answerer != residentID || !o.planDate.Equal(a.date.Time()) {
		return swapOffer{}, ErrSwapNotFound
	}
	if o.status != swapPending {
		return swapOffer{}, ErrSwapClosed
	}
	return o, nil
}

// closeOffer records the answer to a pending offer.
func (a *acting) closeOffer(ctx context.Context, offerID, status string) error {
	if _, err := a.tx.Exec(ctx, `UPDATE swap_offers SET status = $2, answered_at = $3 WHERE id = $1`,
		offerID, status, a.now); err != nil {
		return fmt.Errorf("close swap: %w", err)
	}
	return nil
}

// holder is the Resident the run gave the Task to; false when it is in the
// pool.
func holder(ctx context.Context, tx pgx.Tx, runID, taskID string) (string, bool, error) {
	var id string
	err := tx.QueryRow(ctx, `SELECT resident_id FROM day_plan_assignments WHERE run_id = $1 AND task_id = $2`,
		runID, taskID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("look for assignment: %w", err)
	}
	return id, true, nil
}

// lockBoth locks two Tasks in a fixed order, so no two actions can wait on
// each other, and returns them in the order asked.
func (a *acting) lockBoth(ctx context.Context, first, second string) (taskState, taskState, error) {
	ids := []string{first, second}
	slices.Sort(ids)
	states := map[string]taskState{}
	for _, id := range ids {
		ts, err := lockTask(ctx, a.tx, a.home, id)
		if err != nil {
			return taskState{}, taskState{}, err
		}
		states[id] = ts
	}
	return states[first], states[second], nil
}

// OfferSwap offers the Resident's Task (offered) to whoever holds the
// requested Task today, in exchange for it. Nothing moves until that Resident
// accepts. Both Tasks must be open and for one person, the Resident must hold
// the offered one and another Resident the requested one, and each side must
// be allowed the Task they would receive: the referee that checks Take decides,
// and going over Energy is allowed. A Resident who checked in Drained today
// cannot receive a Task.
func (p *Planner) OfferSwap(ctx context.Context, homeID, residentID, offeredTaskID, requestedTaskID string, now time.Time) error {
	return p.act(ctx, homeID, now, "offer swap", func(a *acting) error {
		if err := a.requirePlan(); err != nil {
			return err
		}
		offered, requested, err := a.lockBoth(ctx, offeredTaskID, requestedTaskID)
		if err != nil {
			return err
		}
		if offered.done || requested.done {
			return ErrAlreadyDone
		}
		// A Swap of a two-person Task is refused: its partner would end up
		// holding it twice.
		if offered.people > 1 || requested.people > 1 {
			return ErrTwoPersonTask
		}
		mine, err := holds(ctx, a.tx, a.run.id, offeredTaskID, residentID)
		if err != nil {
			return err
		}
		if !mine {
			return ErrNotYours
		}
		other, assigned, err := holder(ctx, a.tx, a.run.id, requestedTaskID)
		if err != nil {
			return err
		}
		if !assigned || other == residentID {
			return ErrNotHeldByOther
		}
		if err := a.swapAllowed(ctx, residentID, offeredTaskID, other, requestedTaskID); err != nil {
			return err
		}
		var pending bool
		if err := a.tx.QueryRow(ctx, `
			SELECT EXISTS (SELECT 1 FROM swap_offers
			               WHERE plan_date = $3 AND offered_task_id = $1 AND requested_task_id = $2 AND status = $4)`,
			offeredTaskID, requestedTaskID, a.date.Time(), swapPending).Scan(&pending); err != nil {
			return fmt.Errorf("offer swap: %w", err)
		}
		if pending {
			return ErrSwapPending
		}
		if _, err := a.tx.Exec(ctx, `
			INSERT INTO swap_offers (home_id, plan_date, offered_task_id, requested_task_id, from_resident_id, to_resident_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			homeID, a.date.Time(), offeredTaskID, requestedTaskID, residentID, other, a.now); err != nil {
			return fmt.Errorf("offer swap: %w", err)
		}
		return nil
	})
}

// swapAllowed is nil when `from` may hold the `want` Task and `to` the `give`
// Task, and neither is Drained today.
func (a *acting) swapAllowed(ctx context.Context, from, give, to, want string) error {
	cis, err := checkin.LoadMany(ctx, a.tx, []string{from, to}, a.date)
	if err != nil {
		return err
	}
	for _, r := range []string{from, to} {
		if ci, ok := cis[r]; ok && ci.Level == checkin.Drained {
			return ErrRecipientDrained
		}
	}
	st, err := loadState(ctx, a.tx, a.home, a.date)
	if err != nil {
		return err
	}
	if err := mayDoIn(st, from, want, ReasonSwapped); err != nil {
		return err
	}
	return mayDoIn(st, to, give, ReasonSwapped)
}

// AcceptSwap makes the offer happen, for the Resident it was offered to: the
// two Tasks change hands, and both new holders are Committed to what they
// receive while neither keeps a Commitment on what they gave away. Restrictions
// are checked again, since a Check-in may have added one since the offer; a
// break leaves the offer pending. An offer whose Tasks no longer sit where it
// assumed is ErrSwapStale.
func (p *Planner) AcceptSwap(ctx context.Context, homeID, residentID, offerID string, now time.Time) error {
	return p.act(ctx, homeID, now, "accept swap", func(a *acting) error {
		o, err := a.loadOffer(ctx, residentID, offerID, true)
		if err != nil {
			return err
		}
		if err := a.requirePlan(); err != nil {
			return err
		}
		offered, requested, err := a.lockBoth(ctx, o.offeredTask, o.requestedTask)
		if err != nil {
			return err
		}
		if offered.done || requested.done {
			return ErrSwapStale
		}
		if err := a.liveOffer(ctx, o); err != nil {
			return err
		}
		if offered.people > 1 || requested.people > 1 {
			return ErrTwoPersonTask
		}
		if err := a.swapAllowed(ctx, o.from, o.offeredTask, o.to, o.requestedTask); err != nil {
			return err
		}
		if err := a.moveCommitment(ctx, o.offeredTask, o.to); err != nil {
			return err
		}
		if err := a.moveCommitment(ctx, o.requestedTask, o.from); err != nil {
			return err
		}
		if err := a.closeOffer(ctx, o.id, swapAccepted); err != nil {
			return err
		}
		if _, err := a.tx.Exec(ctx, `
			UPDATE swap_offers SET status = $6, answered_at = $4
			WHERE home_id = $1 AND plan_date = $5 AND status = $7
			  AND (offered_task_id = ANY($2) OR requested_task_id = ANY($2)) AND id <> $3`,
			a.home, []string{o.offeredTask, o.requestedTask}, o.id, a.now, a.date.Time(), swapCancelled, swapPending); err != nil {
			return fmt.Errorf("accept swap: %w", err)
		}
		a.run.reasons.swap(o.offeredTask, o.to, o.requestedTask, o.from)
		return writeReasons(ctx, a.tx, a.run.id, a.run.reasons)
	})
}

// moveCommitment gives the Task to its new holder: the assignment moves, the
// old holder's Commitment for today is deleted (the one exception to "never
// deleted") and the new holder says yes by accepting the Swap.
func (a *acting) moveCommitment(ctx context.Context, taskID, newHolder string) error {
	if _, err := a.tx.Exec(ctx, `
		UPDATE day_plan_assignments SET resident_id = $3, reason = $4 WHERE run_id = $1 AND task_id = $2`,
		a.run.id, taskID, newHolder, ReasonSwapped); err != nil {
		return fmt.Errorf("accept swap: %w", err)
	}
	if _, err := a.tx.Exec(ctx, `DELETE FROM task_residents WHERE task_id = $1 AND committed_on = $2`,
		taskID, a.date.Time()); err != nil {
		return fmt.Errorf("accept swap: %w", err)
	}
	if _, err := a.tx.Exec(ctx, `
		INSERT INTO task_residents (task_id, resident_id, committed_on, committed_at) VALUES ($1, $2, $3, $4)
		ON CONFLICT DO NOTHING`, taskID, newHolder, a.date.Time(), a.now); err != nil {
		return fmt.Errorf("accept swap: %w", err)
	}
	return nil
}

// liveOffer is ErrSwapStale unless the offered Task is still the offerer's and
// the requested one the recipient's.
func (a *acting) liveOffer(ctx context.Context, o swapOffer) error {
	x, err := holds(ctx, a.tx, a.run.id, o.offeredTask, o.from)
	if err != nil {
		return err
	}
	y, err := holds(ctx, a.tx, a.run.id, o.requestedTask, o.to)
	if err != nil {
		return err
	}
	if !x || !y {
		return ErrSwapStale
	}
	return nil
}

// DeclineSwap closes the offer for the Resident it was offered to. Nothing
// else changes, and there is no penalty.
func (p *Planner) DeclineSwap(ctx context.Context, homeID, residentID, offerID string, now time.Time) error {
	return p.answerSwap(ctx, homeID, residentID, offerID, now, "decline swap", true, swapDeclined)
}

// CancelSwap withdraws the offer, for the Resident who made it.
func (p *Planner) CancelSwap(ctx context.Context, homeID, residentID, offerID string, now time.Time) error {
	return p.answerSwap(ctx, homeID, residentID, offerID, now, "cancel swap", false, swapCancelled)
}

func (p *Planner) answerSwap(ctx context.Context, homeID, residentID, offerID string, now time.Time, name string, byRecipient bool, status string) error {
	return p.act(ctx, homeID, now, name, func(a *acting) error {
		o, err := a.loadOffer(ctx, residentID, offerID, byRecipient)
		if err != nil {
			return err
		}
		return a.closeOffer(ctx, o.id, status)
	})
}
