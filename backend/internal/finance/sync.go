package finance

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
)

const (
	// DefaultSyncBudget is how long one run works before it stops.
	DefaultSyncBudget = 60 * time.Second
	// reserve is the budget kept back: no new window starts with less left.
	reserve = 10 * time.Second
	// staleAfter is how old a sync gets before the next one is due.
	staleAfter = 24 * time.Hour
	// refreshDays is how far back a daily sync re-reads, because rows post late.
	refreshDays = 10
)

// Summary is what one run did, in counts only.
type Summary struct {
	Due int `json:"due"`
	// Synced Items finished; Partial ones ran out of budget and resume next run.
	Synced  int `json:"synced"`
	Partial int `json:"partial"`
	Failed  int `json:"failed"`
	// Rows were written; SkippedCurrency were not BRL and left out.
	Rows            int `json:"rows"`
	SkippedCurrency int `json:"skippedCurrency"`
}

// Syncer imports and refreshes the Transactions of every Item that is due.
type Syncer struct {
	store  *Store
	pluggy pluggy.Client
	key    *[32]byte
	allow  Allowlist
	log    *slog.Logger
	budget time.Duration
}

// NewSyncer returns a Syncer that stops a run after budget (zero: DefaultSyncBudget).
func NewSyncer(store *Store, client pluggy.Client, key *[32]byte, allow Allowlist, log *slog.Logger, budget time.Duration) *Syncer {
	if budget <= 0 {
		budget = DefaultSyncBudget
	}
	return &Syncer{store: store, pluggy: client, key: key, allow: allow, log: log, budget: budget}
}

// Run syncs the Items that are due, the longest-waiting first, until the budget
// is spent. An Item that fails is logged and the run moves on: its last sync
// does not change, so the next run tries it again. The error is only for not
// being able to find the Items. Logs carry counts and ids, never a Transaction.
func (s *Syncer) Run(ctx context.Context, now time.Time) (Summary, error) {
	all, err := s.store.DueItems(ctx, now.Add(-staleAfter))
	if err != nil {
		return Summary{}, err
	}
	var items []DueItem
	for _, it := range all {
		// A User taken off the list stops being synced.
		if s.allow.Allows(it.Email) {
			items = append(items, it)
		}
	}
	sum := Summary{Due: len(items)}
	deadline := time.Now().Add(s.budget)
	today := postedOn(now)
	keys := map[string]string{} // one Auth per User
	failedAuth := map[string]error{}
	for i, it := range items {
		if i > 0 && time.Until(deadline) < reserve {
			break
		}
		if _, tried := failedAuth[it.UserID]; !tried && keys[it.UserID] == "" {
			var err error
			if keys[it.UserID], err = s.authenticate(ctx, it); err != nil {
				failedAuth[it.UserID] = err
			}
		}
		if err := failedAuth[it.UserID]; err != nil {
			sum.Failed++
			s.log.Error("finance sync failed", "user", it.UserID, "step", "auth", "error", safeErr(err))
			continue
		}
		finished, err := s.syncItem(ctx, it, keys[it.UserID], now, today, deadline, &sum)
		switch {
		case err != nil:
			sum.Failed++
			s.log.Error("finance sync failed", "user", it.UserID, "step", "transactions", "error", safeErr(err))
		case finished:
			sum.Synced++
		default:
			sum.Partial++
		}
	}
	s.log.Info("finance sync done", "due", sum.Due, "synced", sum.Synced, "partial", sum.Partial, "failed", sum.Failed,
		"rows", sum.Rows, "skipped_currency", sum.SkippedCurrency)
	return sum, nil
}

func (s *Syncer) authenticate(ctx context.Context, it DueItem) (string, error) {
	id, err := Open(s.key, it.UserID, FieldClientID, it.IDEnc)
	if err != nil {
		return "", err
	}
	secret, err := Open(s.key, it.UserID, FieldClientSecret, it.SecretEnc)
	if err != nil {
		return "", err
	}
	return s.pluggy.Auth(ctx, string(id), string(secret))
}

// syncItem reads one window of each Source per round, moving each Source's
// cursor on, until every Source has reached today or the budget runs low. It
// reports whether the Item finished. During the import a window is a month
// from the day after the cursor (at most 12 months back); once imported, one
// window re-reads the last refreshDays. A window cut off mid-way is simply read
// again next run: the upsert makes that harmless.
func (s *Syncer) syncItem(ctx context.Context, it DueItem, apiKey string, now, today time.Time, deadline time.Time, sum *Summary) (bool, error) {
	sources, err := s.store.SyncSources(ctx, it.ID)
	if err != nil {
		return false, err
	}
	floor := today.AddDate(-1, 0, 0)
	for round := 0; ; round++ {
		// The first round always runs, so every run makes progress.
		if round > 0 && time.Until(deadline) < reserve {
			return false, nil
		}
		pending := false
		for i := range sources {
			src := &sources[i]
			from := floor
			switch {
			case it.ImportComplete:
				from = today.AddDate(0, 0, -refreshDays)
			case src.ImportCursor != nil && src.ImportCursor.After(floor.AddDate(0, 0, -1)):
				from = src.ImportCursor.AddDate(0, 0, 1)
			}
			if from.After(today) {
				continue
			}
			to := from.AddDate(0, 1, -1)
			if to.After(today) {
				to = today
			}
			if err := s.syncWindow(ctx, it.UserID, apiKey, *src, from, to, now, sum); err != nil {
				return false, err
			}
			src.ImportCursor = &to
			pending = pending || to.Before(today)
		}
		if !pending {
			return true, s.store.FinishSync(ctx, it.ID, now)
		}
	}
}

// syncWindow stores every page of one Source's window, then moves its cursor.
func (s *Syncer) syncWindow(ctx context.Context, userID, apiKey string, src SyncSource, from, to, now time.Time, sum *Summary) error {
	cursor := ""
	for {
		page, err := s.pluggy.ListTransactions(ctx, apiKey, src.PluggyAccountID, from, to, cursor)
		if err != nil {
			return err
		}
		rows, skipped := toRows(page.Transactions)
		if len(rows) > 0 {
			if err := s.store.UpsertTransactions(ctx, userID, src.ID, rows, now); err != nil {
				return err
			}
		}
		sum.Rows += len(rows)
		sum.SkippedCurrency += skipped
		if page.Next == "" {
			return s.store.SetImportCursor(ctx, src.ID, to)
		}
		cursor = page.Next
	}
}

// toRows picks what to store: pending rows are left out (they come back as
// posted), and so are rows that are not BRL, which are counted.
func toRows(txs []pluggy.Transaction) (rows []Row, skippedCurrency int) {
	for _, tx := range txs {
		if tx.Status == "PENDING" {
			continue
		}
		if tx.Currency != "BRL" {
			skippedCurrency++
			continue
		}
		r := Row{ProviderID: tx.ID, PostedOn: postedOn(tx.Date), AmountCents: tx.AmountCents,
			Description: tx.Description, MerchantKey: MerchantKey(tx.Description), Type: "income"}
		if tx.AmountCents < 0 {
			r.Type = "expense"
		}
		if m := tx.CreditCardMetadata; m != nil && m.InstallmentNumber >= 1 && m.InstallmentNumber <= m.TotalInstallments {
			r.InstallmentNumber, r.TotalInstallments = int32(m.InstallmentNumber), int32(m.TotalInstallments)
		}
		rows = append(rows, r)
	}
	return rows, skippedCurrency
}

// safeErr is an error text fit for the logs: the adapter's errors hold the
// operation and status only, and a database error could quote a row, so only
// its code is kept.
func safeErr(err error) string {
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		return "database error " + pg.Code
	}
	return err.Error()
}
