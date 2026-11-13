package finance

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
)

const (
	// DefaultSyncBudget is how long one run works before it stops.
	DefaultSyncBudget = 60 * time.Second
	// reserve is the budget kept back: no new window starts with less left.
	reserve = 10 * time.Second
	// staleAfter is how old a sync gets before the next one is due.
	staleAfter = 24 * time.Hour
	// refreshDays is how far back a daily sync re-reads, because rows post late:
	// a whole open bill and some, since a card charge can reach the feed weeks after it posted.
	refreshDays = 45
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
	// cat and model are set by WithCategorizer; nil cat skips step 3.
	cat   *llmalloc.Categorizer
	model string
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
	synced := map[string]bool{} // Users with an Item finished this run
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
			synced[it.UserID] = true
		default:
			sum.Partial++
		}
	}
	// Bills are paid from the fresh rows before anything reads them (reminders).
	// A failure is logged; the next run matches again.
	from := time.Date(today.Year(), today.Month()-1, 1, 0, 0, 0, 0, time.UTC) // the previous and the current month
	for userID := range synced {
		if err := s.store.PayBillsFromBank(ctx, userID, from, from.AddDate(0, 2, 0), now); err != nil {
			s.log.Error("finance sync failed", "user", userID, "step", "bills", "error", safeErr(err))
		}
	}
	// After the imports, and for every User with a fallback Expense, not only
	// those just synced: a day later the cap is fresh.
	s.categorize(ctx, now, deadline)
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
// window re-reads the last refreshDays up to today. A window cut off mid-way is simply read
// again next run: the upsert makes that harmless.
func (s *Syncer) syncItem(ctx context.Context, it DueItem, apiKey string, now, today time.Time, deadline time.Time, sum *Summary) (bool, error) {
	// Fills the bill days of a card that has none, such as a Source connected before they were kept; days the User typed stay.
	accounts, err := s.pluggy.ListAccounts(ctx, apiKey, it.PluggyItemID)
	if err != nil {
		return false, err
	}
	if err := s.store.SetBillDays(ctx, it.ID, accounts); err != nil {
		return false, err
	}
	// A balance never fails the Transactions import: log and go on.
	if err := s.store.UpsertBalances(ctx, it.ID, accounts, today); err != nil {
		s.log.Error("finance sync failed", "user", it.UserID, "step", "balances", "error", safeErr(err))
	}
	sources, err := s.store.SyncSources(ctx, it.ID)
	if err != nil {
		return false, err
	}
	// A connector may not support /bills: the card then keeps the computed rule (ADR 0021), so a failure only logs.
	for _, src := range sources {
		if !src.Card {
			continue
		}
		bills, err := s.pluggy.ListBills(ctx, apiKey, src.PluggyAccountID)
		if err == nil {
			err = s.store.UpsertCardBills(ctx, it.UserID, src.ID, bills)
		}
		if err != nil {
			s.log.Error("finance sync failed", "user", it.UserID, "step", "card bills", "error", safeErr(err))
		}
	}
	s.syncInvestments(ctx, it, apiKey, now)
	var owner pluggy.Party
	for _, a := range accounts {
		if a.TaxNumber != "" || a.Owner != "" {
			owner = pluggy.Party{Name: a.Owner, Document: a.TaxNumber}
			break
		}
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
			if to.After(today) || it.ImportComplete { // a re-read is one window up to today
				to = today
			}
			if err := s.syncWindow(ctx, it.UserID, apiKey, *src, owner, from, to, now, sum); err != nil {
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

// syncInvestments stores the Investments the bank holds. An Item with none is
// not a failure, and a failed call only logs: the Transactions import goes on.
// Rows that are not BRL are left out and counted in the log.
func (s *Syncer) syncInvestments(ctx context.Context, it DueItem, apiKey string, now time.Time) {
	invs, err := s.pluggy.ListInvestments(ctx, apiKey, it.PluggyItemID)
	if err == nil {
		var rows []BankInvestment
		skipped := 0
		for _, inv := range invs {
			if inv.Currency != "BRL" {
				skipped++
				continue
			}
			rows = append(rows, BankInvestment{PluggyID: inv.ID, Name: inv.Name, ValueCents: inv.ValueCents})
		}
		if err = s.store.UpsertBankInvestments(ctx, it.UserID, it.ID, rows, now); err == nil {
			if skipped > 0 {
				s.log.Info("finance sync skipped investments", "user", it.UserID, "skipped_currency", skipped)
			}
			return
		}
	}
	s.log.Error("finance sync failed", "user", it.UserID, "step", "investments", "error", safeErr(err))
}

// syncWindow stores every page of one Source's window, then moves its cursor.
func (s *Syncer) syncWindow(ctx context.Context, userID, apiKey string, src SyncSource, owner pluggy.Party, from, to, now time.Time, sum *Summary) error {
	cursor := ""
	for {
		page, err := s.pluggy.ListTransactions(ctx, apiKey, src.PluggyAccountID, from, to, cursor)
		if err != nil {
			return err
		}
		rows, skipped := toRows(page.Transactions, src.Card, owner)
		if len(rows) > 0 {
			if err := s.store.UpsertTransactions(ctx, userID, src.ID, rows, now); err != nil {
				return err
			}
			if err := s.classify(ctx, userID, rows, now); err != nil {
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

// classify re-runs the type rules over the User's auto rows around a stored
// page, across all their Sources: the other half of a Transfer may have arrived
// in an earlier run, or may arrive in a later one.
func (s *Syncer) classify(ctx context.Context, userID string, rows []Row, now time.Time) error {
	from, to := rows[0].PostedOn, rows[0].PostedOn
	for _, r := range rows {
		if r.PostedOn.Before(from) {
			from = r.PostedOn
		}
		if r.PostedOn.After(to) {
			to = r.PostedOn
		}
	}
	// Read twice the window so rows at its edge see their partners, but write
	// only rows within one window of the page, so no Transfer is split.
	wideFrom, wideTo := from.AddDate(0, 0, -2*transferWindowDays), to.AddDate(0, 0, 2*transferWindowDays)
	txns, kinds, err := s.store.ClassifyInput(ctx, userID, wideFrom, wideTo)
	if err != nil {
		return err
	}
	bills, err := s.store.CardBillsDue(ctx, userID, wideFrom, wideTo)
	if err != nil {
		return err
	}
	changed := slices.DeleteFunc(Classify(txns, kinds, bills), func(t Txn) bool {
		return t.PostedOn.Before(from.AddDate(0, 0, -transferWindowDays)) || t.PostedOn.After(to.AddDate(0, 0, transferWindowDays))
	})
	if len(changed) == 0 {
		return nil
	}
	return s.store.SetClassified(ctx, changed, now)
}

// sameParty reports whether other is the owner. Documents decide when both
// have the same number of digits (a masked one has fewer); otherwise folded
// names are compared. Empty values never match.
// shortcut: a masked document falls back to the name blindly; compare its
// visible digits if false Transfers appear.
func sameParty(owner, other pluggy.Party) bool {
	o, p := digits(owner.Document), digits(other.Document)
	if o != "" && len(o) == len(p) {
		return o == p
	}
	return fold(owner.Name) != "" && fold(owner.Name) == fold(other.Name)
}

func digits(s string) string {
	return strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, s)
}

// toRows picks what to store: pending rows are left out (they come back as
// posted), and so are rows that are not BRL, which are counted. On a card
// Pluggy sends a purchase positive and a bill payment negative, so its sign is
// flipped to the Source's point of view. A row's counterpart is reduced to
// OwnCounterpart here and goes no further. A card row never has one: its payer
// or receiver was picked from Pluggy's raw sign, which the flip inverts.
func toRows(txs []pluggy.Transaction, card bool, owner pluggy.Party) (rows []Row, skippedCurrency int) {
	for _, tx := range txs {
		if tx.Status == "PENDING" {
			continue
		}
		if tx.Currency != "BRL" {
			skippedCurrency++
			continue
		}
		amount := tx.AmountCents
		if card {
			amount = -amount
		}
		r := Row{ProviderID: tx.ID, PostedOn: postedOn(tx.Date), AmountCents: amount,
			Description: tx.Description, MerchantKey: MerchantKey(tx.Description), Type: "income"}
		r.OwnCounterpart = !card && tx.Counterpart != nil && sameParty(owner, *tx.Counterpart)
		if amount < 0 {
			r.Type = "expense"
		}
		if tx.Category != nil && r.Type == "expense" {
			r.Category = pluggyCategories[*tx.Category]
		}
		var metaN, metaM int
		if m := tx.CreditCardMetadata; m != nil {
			metaN, metaM = m.InstallmentNumber, m.TotalInstallments
		}
		if n, m, ok := ParseInstallment(tx.Description, metaN, metaM); ok {
			r.InstallmentNumber, r.TotalInstallments = int32(n), int32(m)
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
