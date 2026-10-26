// Package nudge sends the two pushes the Allocation job owns: the Check-in
// reminder an hour before a Home's Allocation time, for Residents who have not
// checked in, and "Day Plan ready" when the Home has just been planned. Push is
// a best-effort nudge (ADR 0005): every failure here is logged and swallowed,
// and nothing in this package can fail or delay an Allocation. The caller runs
// it after planning (dayplan.Planner.RunDue).
//
// A ledger table (nudges) is claimed before each send, so a nudge goes out at
// most once per Resident, kind and local date, however many ticks run.
package nudge

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
)

const (
	// sendTimeout bounds one push. The deadline for all the nudging of a tick
	// belongs to the caller (dayplan); whatever is claimed and not yet sent when
	// it runs out is lost, by design.
	sendTimeout = 5 * time.Second

	// outcomeTimeout bounds the update that records a send's outcome.
	outcomeTimeout = 2 * time.Second

	// reminderLead is how long before the Allocation time the reminder goes.
	reminderLead = time.Hour
)

// Nudger sends the nudges. Build it with New; the zero value does nothing useful.
type Nudger struct {
	db     *pgxpool.Pool
	sender push.Sender
	subs   *push.Store
	log    *slog.Logger
}

// New returns a Nudger that sends through sender and prunes gone subscriptions
// from the database.
func New(db *pgxpool.Pool, sender push.Sender, log *slog.Logger) *Nudger {
	return &Nudger{db: db, sender: sender, subs: push.NewStore(db), log: log}
}

var _ dayplan.Nudger = (*Nudger)(nil)

// target is a Resident to nudge about one local date.
type target struct {
	residentID, homeID, userID string
	date                       allocation.Date
}

// inReminderWindow reports whether a Home whose local time of day is local and
// whose Allocation time is alloc (both offsets since local midnight) is
// between its reminder moment and its Allocation time. The reminder moment is
// an hour before, clamped to local midnight: an Allocation time before 01:00
// would otherwise fall on the previous date, where "checked in today" means
// something else. The test is "at or after", never "equal", so a late or
// skipped tick still works. Wall-clock arithmetic in the Home's zone, like
// dayplan.DueHomes: a daylight-saving change can shift the reminder by an hour
// on two days a year.
func inReminderWindow(local, alloc time.Duration) bool {
	return local >= max(alloc-reminderLead, 0) && local < alloc
}

// CheckinReminders sends a Check-in reminder to every Resident of a Home that
// is in its reminder window at now, has no run for its local date, and has not
// checked in for that date.
func (n *Nudger) CheckinReminders(ctx context.Context, now time.Time) {
	window, err := dayplan.UnplannedHomes(ctx, n.db, n.log, now, inReminderWindow)
	if err != nil {
		n.log.Error("check-in reminders: find homes failed", "error", err.Error())
		return
	}
	if len(window) == 0 {
		return
	}
	homes := make(map[string]allocation.Date, len(window))
	ids := make([]string, 0, len(window))
	for _, h := range window {
		homes[h.ID] = h.Date
		ids = append(ids, h.ID)
	}
	all, err := n.residents(ctx, ids, now)
	if err != nil {
		n.log.Error("check-in reminders: find residents failed", "error", err.Error())
		return
	}

	byHome := map[string][]string{}
	for _, t := range all {
		byHome[t.homeID] = append(byHome[t.homeID], t.residentID)
	}
	checked := map[string]bool{}
	unknown := map[string]bool{}
	for id, residents := range byHome {
		got, err := checkin.LoadMany(ctx, n.db, residents, homes[id])
		if err != nil {
			// One Home's failure must not cost the others their reminder. This
			// Home is left out: without its Check-ins nobody can be told apart.
			n.log.Error("check-in reminders: load check-ins failed", "home", id, "error", err.Error())
			unknown[id] = true
			continue
		}
		for r := range got {
			checked[r] = true
		}
	}
	var todo []target
	for _, t := range all {
		if !checked[t.residentID] && !unknown[t.homeID] {
			todo = append(todo, t)
		}
	}
	n.deliver(ctx, todo, push.KindCheckinReminder, push.Payload{
		Title: "Time to check in",
		Body:  "Tell Homeowner how you feel today so your tasks fit your energy.",
		URL:   "/",
		Kind:  push.KindCheckinReminder,
	}, now)
}

// DayPlanReady tells every Resident of each of the Homes that today's Day Plan
// is ready. The caller passes only Homes it has just planned.
func (n *Nudger) DayPlanReady(ctx context.Context, homeIDs []string, now time.Time) {
	if len(homeIDs) == 0 {
		return
	}
	all, err := n.residents(ctx, homeIDs, now)
	if err != nil {
		n.log.Error("day plan ready: find residents failed", "error", err.Error())
		return
	}
	n.deliver(ctx, all, push.KindDayPlanReady, push.Payload{
		Title: "Your Day Plan is ready",
		Body:  "See what is on your plate today.",
		URL:   "/",
		Kind:  push.KindDayPlanReady,
	}, now)
}

// residents lists the Residents of the Homes, each with the Home's local date
// at now. A Home with an unknown timezone is logged and skipped.
func (n *Nudger) residents(ctx context.Context, homeIDs []string, now time.Time) ([]target, error) {
	rows, err := n.db.Query(ctx, `
		SELECT r.id, r.home_id, r.user_id, h.timezone
		FROM residents r JOIN homes h ON h.id = r.home_id
		WHERE r.home_id = ANY($1::uuid[]) ORDER BY r.created_at, r.id`, homeIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []target
	for rows.Next() {
		var t target
		var zone string
		if err := rows.Scan(&t.residentID, &t.homeID, &t.userID, &zone); err != nil {
			return nil, err
		}
		t.date, err = dayplan.LocalDate(zone, now)
		if err != nil {
			n.log.Warn("home skipped: unknown timezone", "home", t.homeID, "timezone", zone)
			continue
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// deliver sends payload to every device of each target Resident that has one,
// claiming the ledger row first so a repeat sends nothing. Errors are logged.
func (n *Nudger) deliver(ctx context.Context, targets []target, kind string, payload push.Payload, now time.Time) {
	if len(targets) == 0 {
		return
	}
	userIDs := make([]string, 0, len(targets))
	for _, t := range targets {
		userIDs = append(userIDs, t.userID)
	}
	subs, err := n.subs.ListByUsers(ctx, userIDs)
	if err != nil {
		n.log.Error("nudge: list subscriptions failed", "kind", kind, "error", err.Error())
		return
	}

	// Only Residents with a device are claimed, so one who subscribes later in
	// the window can still be nudged.
	var withDevice []target
	var ids []string
	var dates []time.Time
	for _, t := range targets {
		if len(subs[t.userID]) > 0 {
			withDevice = append(withDevice, t)
			ids = append(ids, t.residentID)
			dates = append(dates, t.date.Time())
		}
	}
	if len(withDevice) == 0 {
		return
	}
	rows, err := n.db.Query(ctx, `
		INSERT INTO nudges (resident_id, kind, local_date, sent_at)
		SELECT t.resident_id, $3, t.local_date, $4 FROM unnest($1::uuid[], $2::date[]) AS t(resident_id, local_date)
		ON CONFLICT DO NOTHING
		RETURNING resident_id`, ids, dates, kind, now)
	if err != nil {
		n.log.Error("nudge: claim failed", "kind", kind, "error", err.Error())
		return
	}
	claimed, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		n.log.Error("nudge: claim failed", "kind", kind, "error", err.Error())
		return
	}
	isClaimed := map[string]bool{}
	for _, id := range claimed {
		isClaimed[id] = true
	}

	for _, t := range withDevice {
		if !isClaimed[t.residentID] {
			continue
		}
		attempted, delivered, failed := false, false, false
		for _, sub := range subs[t.userID] {
			if ctx.Err() != nil {
				n.log.Warn("nudge: deadline reached, the rest is dropped", "kind", kind)
				break
			}
			attempted = true
			sctx, cancel := context.WithTimeout(ctx, sendTimeout)
			err := n.subs.Deliver(sctx, n.sender, sub, payload)
			cancel()
			if err != nil {
				n.log.Warn("nudge: send failed", "kind", kind, "home", t.homeID, "resident", t.residentID, "error", err.Error())
			}
			switch {
			case err == nil:
				delivered = true
			case !errors.Is(err, push.ErrGone):
				failed = true
			}
		}
		if attempted {
			n.recordOutcome(ctx, t, kind, outcomeOf(delivered, failed))
		}
		if ctx.Err() != nil {
			return
		}
	}
}

// outcomeOf combines the answers of a Resident's devices: delivered if any
// device accepted, else failed if any failed, else gone.
func outcomeOf(delivered, failed bool) string {
	switch {
	case delivered:
		return "delivered"
	case failed:
		return "failed"
	default:
		return "gone"
	}
}

// recordOutcome stores the outcome on the claimed ledger row. It runs detached
// from ctx, because the nudge deadline may have ended during the send. A failure
// is logged and swallowed: the push has gone out either way.
func (n *Nudger) recordOutcome(ctx context.Context, t target, kind, outcome string) {
	uctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), outcomeTimeout)
	defer cancel()
	_, err := n.db.Exec(uctx, `
		UPDATE nudges SET outcome = $4
		WHERE resident_id = $1 AND kind = $2 AND local_date = $3`,
		t.residentID, kind, t.date.Time(), outcome)
	if err != nil {
		n.log.Warn("nudge: outcome update failed", "kind", kind, "home", t.homeID, "error", err.Error())
	}
}
