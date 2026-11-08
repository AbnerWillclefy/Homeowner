package finance

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
)

const (
	// defaultZone is the zone of a User with no Home.
	defaultZone = "America/Sao_Paulo"
	// reminderSendTimeout bounds one push; outcomeTimeout the update that records it.
	reminderSendTimeout = 5 * time.Second
	outcomeTimeout      = 2 * time.Second
)

// Reminders sends the push reminders for Bills to pay. It follows
// nudge.Nudger: a ledger row is claimed first, so a repeated run sends nothing
// twice, and delivery is at most once. A User has notifications off exactly
// when they have no push subscription.
type Reminders struct {
	store  *Store
	subs   *push.Store
	sender push.Sender
	allow  Allowlist
	log    *slog.Logger
}

// NewReminders returns Reminders that send through sender to the devices in subs.
func NewReminders(store *Store, subs *push.Store, sender push.Sender, allow Allowlist, log *slog.Logger) *Reminders {
	return &Reminders{store: store, subs: subs, sender: sender, allow: allow, log: log}
}

// claim is one reminder to record and send.
type claim struct {
	userID string
	month  time.Time
	BillReminder
}

// Run sends the reminders due at now. The first error stops the run; the rest
// is retried at the next hourly run.
func (r *Reminders) Run(ctx context.Context, now time.Time) error {
	todo, err := r.due(ctx, now)
	if err != nil || len(todo) == 0 {
		return err
	}
	ids := make([]string, 0, len(todo))
	for _, c := range todo {
		ids = append(ids, c.userID)
	}
	subs, err := r.subs.ListByUsers(ctx, ids)
	if err != nil {
		return err
	}
	// Only Users with a device are claimed, so one who subscribes later can still be reminded.
	var users, bills, kinds []string
	var months []time.Time
	for _, c := range todo {
		if len(subs[c.userID]) > 0 {
			users, bills, kinds, months = append(users, c.userID), append(bills, c.BillID), append(kinds, c.Ledger), append(months, c.month)
		}
	}
	if len(bills) == 0 {
		return nil
	}
	rows, err := r.store.db.Query(ctx, `
		INSERT INTO finance_bill_reminders (user_id, bill_id, month, kind, sent_at)
		SELECT t.user_id, t.bill_id, t.month, t.kind, $5
		FROM unnest($1::uuid[], $2::uuid[], $3::date[], $4::text[]) AS t(user_id, bill_id, month, kind)
		ON CONFLICT DO NOTHING
		RETURNING bill_id, month, kind`, users, bills, months, kinds, now)
	if err != nil {
		return err
	}
	type key struct {
		bill  string
		month time.Time
		kind  string
	}
	claimed := map[key]bool{}
	for rows.Next() {
		var k key
		if err := rows.Scan(&k.bill, &k.month, &k.kind); err != nil {
			rows.Close()
			return err
		}
		claimed[k] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, c := range todo {
		if !claimed[key{c.BillID, c.month, c.Ledger}] {
			continue
		}
		outcome, attempted := r.send(ctx, subs[c.userID], reminderPayload(c.Notice))
		if attempted {
			r.record(ctx, c, outcome)
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
	}
	return nil
}

// due loads every allowed User's Bills and applies the rule in the User's zone.
func (r *Reminders) due(ctx context.Context, now time.Time) ([]claim, error) {
	rows, err := r.store.db.Query(ctx, `
		SELECT b.user_id, u.email, b.id, b.due_day, COALESCE(h.timezone, $1),
		       ARRAY(SELECT p.month FROM finance_bill_payments p WHERE p.bill_id = b.id AND p.undone_at IS NULL)
		FROM finance_bills b
		JOIN users u ON u.id = b.user_id
		LEFT JOIN residents res ON res.user_id = b.user_id
		LEFT JOIN homes h ON h.id = res.home_id
		ORDER BY b.user_id, b.id`, defaultZone)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []claim
	byUser := map[string][]ReminderBill{}
	var order []string
	zone := map[string]string{}
	paid := map[string][]time.Time{}
	for rows.Next() {
		var user, email, id, tz string
		var day int
		var months []time.Time
		if err := rows.Scan(&user, &email, &id, &day, &tz, &months); err != nil {
			return nil, err
		}
		if !r.allow.Allows(email) {
			continue
		}
		if _, ok := zone[user]; !ok {
			order = append(order, user)
		}
		zone[user] = tz
		byUser[user] = append(byUser[user], ReminderBill{ID: id, DueDay: day})
		paid[id] = months
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, user := range order {
		loc, err := time.LoadLocation(zone[user])
		if err != nil {
			r.log.Warn("finance reminders: user skipped, unknown timezone", "timezone", zone[user])
			continue
		}
		local := now.In(loc)
		month := time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, time.UTC)
		bills := byUser[user]
		for i := range bills {
			for _, p := range paid[bills[i].ID] {
				bills[i].Paid = bills[i].Paid || p.Equal(month)
			}
		}
		for _, rem := range DueReminders(bills, local) {
			out = append(out, claim{user, month, rem})
		}
	}
	return out, nil
}

// send pushes to each device and combines the answers: delivered if any device
// accepted, else failed if any failed, else gone. attempted is false when the
// deadline ended before the first send.
func (r *Reminders) send(ctx context.Context, devices []push.Subscription, p push.Payload) (outcome string, attempted bool) {
	rank := map[string]int{"gone": 0, "failed": 1, "delivered": 2}
	for _, sub := range devices {
		if ctx.Err() != nil {
			break
		}
		sctx, cancel := context.WithTimeout(ctx, reminderSendTimeout)
		err := r.subs.Deliver(sctx, r.sender, sub, p)
		cancel()
		got := "delivered"
		if err != nil {
			r.log.Warn("finance reminders: send failed", "error", err.Error())
			got = "failed"
			if errors.Is(err, push.ErrGone) {
				got = "gone"
			}
		}
		if !attempted || rank[got] > rank[outcome] {
			outcome = got
		}
		attempted = true
	}
	return outcome, attempted
}

// record stores the outcome on the claimed row, detached from ctx because the
// deadline may have ended during the send. A failure is logged and swallowed.
func (r *Reminders) record(ctx context.Context, c claim, outcome string) {
	uctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), outcomeTimeout)
	defer cancel()
	_, err := r.store.db.Exec(uctx, `
		UPDATE finance_bill_reminders SET outcome = $4 WHERE bill_id = $1 AND month = $2 AND kind = $3`,
		c.BillID, c.month, c.Ledger, outcome)
	if err != nil {
		r.log.Warn("finance reminders: outcome update failed", "error", safeErr(err))
	}
}

// reminderPayload is the generic English text; the worker words the Notice for
// the device language. It names no Bill and no amount.
func reminderPayload(notice string) push.Payload {
	body := map[string]string{
		push.KindBillDueToday: "A bill to pay is due today.",
		push.KindBillDueSoon:  "A bill to pay is due tomorrow.",
		push.KindBillOverdue:  "A bill to pay is still open.",
	}[notice]
	return push.Payload{Title: "Bill to pay", Body: body, URL: "/finances", Kind: notice}
}
