package finance

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
)

const (
	maxBodyBytes  = 2 << 10
	maxCredential = 200
)

// itemIDPattern accepts only a uuid, the form Pluggy issues Item ids in.
var itemIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// Handler serves the Finances routes behind the allowlist guard. The key is
// never nil here: the guard answers 503 first.
type Handler struct {
	store  *Store
	key    *[32]byte
	pluggy pluggy.Client // nil: the routes that call Pluggy answer 503
	env    string
	clk    clock.Clock
	log    *slog.Logger
}

// NewHandler returns a Handler that seals with key and reads banks through
// client. env is the deployment name: only production hides Pluggy's sandbox.
func NewHandler(store *Store, key *[32]byte, client pluggy.Client, env string, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, key: key, pluggy: client, env: env, clk: clk, log: log}
}

// Status answers GET /me/finance. It never decrypts anything.
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	userID := identity.CurrentUser(r.Context()).ID
	st, err := h.store.Overview(r.Context(), userID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read status", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, st)
}

// BadParam is a request parameter a view method refuses; its text is the 400
// message the route answers with.
type BadParam string

func (e BadParam) Error() string { return string(e) }

const (
	errInvalidMonth  = BadParam("invalid month")
	errInvalidMonths = BadParam("invalid months")
	errInvalidSource = BadParam("invalid source")
	errInvalidRange  = BadParam("invalid range")
)

// viewFailed answers a view method's error: a BadParam as 400 with its text,
// anything else as the fixed 500 after logging it.
func (h *Handler) viewFailed(w http.ResponseWriter, err error) {
	if bad, ok := errors.AsType[BadParam](err); ok {
		httpx.WriteError(w, http.StatusBadRequest, string(bad))
		return
	}
	httpx.InternalError(w, h.log, "finance: view", err)
}

// writeView answers a view method's result as 200 JSON, or its error.
func (h *Handler) writeView(w http.ResponseWriter, v any, err error) {
	if err != nil {
		h.viewFailed(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, v)
}

// Month answers GET /me/finance/transactions?month=YYYY-MM from MonthView.
func (h *Handler) Month(w http.ResponseWriter, r *http.Request) {
	res, err := h.MonthView(r.Context(), identity.CurrentUser(r.Context()).ID, r.URL.Query().Get("month"))
	h.writeView(w, res, err)
}

// MonthView is the month `month` (YYYY-MM) of userID. The totals come from
// MonthTotals over the rows just read, so every endpoint that shows money agrees.
// Committed is Outlook's card bills for the month plus the non-card Expenses
// counted in it; Spent since the 1st is every Expense by posted day. The caller
// names the User, so a chat tool never reads the id from the context.
func (h *Handler) MonthView(ctx context.Context, userID, month string) (MonthResponse, error) {
	from, to, ok := parseMonth(month)
	if !ok {
		return MonthResponse{}, errInvalidMonth
	}
	txns, err := h.store.MonthTransactions(ctx, userID, from, to)
	if err != nil {
		return MonthResponse{}, fmt.Errorf("read month: %w", err)
	}
	limits, err := h.store.Budgets(ctx, userID)
	if err != nil {
		return MonthResponse{}, fmt.Errorf("read budgets: %w", err)
	}
	totals := MonthTotals(toTxns(txns))
	// Committed needs Outlook's card bills, so Month costs one loadOutlook more; no cache (one User).
	in, err := h.loadOutlook(ctx, userID, from, 1)
	if err != nil {
		return MonthResponse{}, fmt.Errorf("read month outlook: %w", err)
	}
	spentSince, err := h.store.SpentByPosted(ctx, userID, from, to)
	if err != nil {
		return MonthResponse{}, fmt.Errorf("read spent since the 1st: %w", err)
	}
	committed := MonthTotals(in.offCardRows()).Spend
	for _, c := range in.outlook[0].Cards {
		committed += c.AmountCents
	}
	cats := []CategoryTotal{}
	for c, cents := range totals.ByCategory {
		if cents != 0 {
			cats = append(cats, CategoryTotal{Category: c, SpentCents: cents})
		}
	}
	slices.SortFunc(cats, func(a, b CategoryTotal) int {
		return cmp.Or(cmp.Compare(b.SpentCents, a.SpentCents), cmp.Compare(a.Category, b.Category))
	})
	return MonthResponse{Month: month, SpentCents: totals.Spend, Categories: cats, Transactions: txns, Limits: limits, CommittedCents: committed, SpentSinceFirstCents: spentSince}, nil
}

// SpendingCategories is the fixed, ordered list of Spending Category ids.
var SpendingCategories = llmalloc.SpendingCategories

func toTxns(rows []TransactionResponse) []Txn {
	in := make([]Txn, len(rows))
	for i, t := range rows {
		in[i] = Txn{Type: t.Type, AmountCents: t.AmountCents}
		if t.SpendingCategory != nil {
			in[i].Category = *t.SpendingCategory
		}
	}
	return in
}

const (
	historyMonths    = 6  // default window of History
	historyMaxMonths = 12 // matches commitmentMonths
)

// History answers GET /me/finance/history?to=YYYY-MM&months=N from HistoryView.
// `to` defaults to the current São Paulo month; an empty `to=` is a 400.
func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	to := q.Get("to")
	if !q.Has("to") {
		to = postedOn(h.clk.Now()).Format("2006-01")
	}
	n := historyMonths
	if q.Has("months") {
		var err error
		if n, err = strconv.Atoi(q.Get("months")); err != nil {
			n = 0 // HistoryView refuses it as invalid months
		}
	}
	res, err := h.HistoryView(r.Context(), identity.CurrentUser(r.Context()).ID, to, n)
	h.writeView(w, res, err)
}

// HistoryView is the n months (1 to 12) of userID ending at `to` (YYYY-MM),
// oldest first, from one read and MonthTotals on each month, so it agrees with
// Month. Each month carries income, spent and saved, so a client gets the change
// against last month by asking for two months.
func (h *Handler) HistoryView(ctx context.Context, userID, to string, n int) (HistoryResponse, error) {
	last, end, ok := parseMonth(to)
	if !ok {
		return HistoryResponse{}, errInvalidMonth
	}
	if n < 1 || n > historyMaxMonths {
		return HistoryResponse{}, errInvalidMonths
	}
	first := last.AddDate(0, -(n - 1), 0)
	txns, err := h.store.MonthTransactions(ctx, userID, first, end)
	if err != nil {
		return HistoryResponse{}, fmt.Errorf("read history: %w", err)
	}
	byMonth := map[string][]TransactionResponse{}
	for _, t := range txns {
		byMonth[t.CountsOn[:7]] = append(byMonth[t.CountsOn[:7]], t)
	}
	months := make([]HistoryMonth, n)
	for i := range months {
		m := first.AddDate(0, i, 0).Format("2006-01")
		months[i] = historyMonth(m, byMonth[m])
	}
	return HistoryResponse{To: to, Months: months}, nil
}

// PastCardBills answers GET /me/finance/card-bills?source=ID&months=N from
// PastCardBillsView; a Source it does not find is 404, so the answer never says which.
func (h *Handler) PastCardBills(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	n := historyMonths
	if q.Has("months") {
		var err error
		if n, err = strconv.Atoi(q.Get("months")); err != nil {
			n = 0 // PastCardBillsView refuses it as invalid months
		}
	}
	out, found, err := h.PastCardBillsView(r.Context(), identity.CurrentUser(r.Context()).ID, q.Get("source"), n)
	if err == nil && !found {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	h.writeView(w, out, err)
}

// PastCardBillsView is the latest n (1 to 12) closed bills of userID's card
// `source`, oldest first, with their average. A card whose connector sends no
// bills gets an empty list. A malformed n or source is a BadParam (n is checked
// first); another User's, an unknown and a non-card Source are all found=false.
func (h *Handler) PastCardBillsView(ctx context.Context, userID, source string, n int) (PastCardBillsResponse, bool, error) {
	if n < 1 || n > historyMaxMonths {
		return PastCardBillsResponse{}, false, errInvalidMonths
	}
	if !chores.ValidID(source) {
		return PastCardBillsResponse{}, false, errInvalidSource
	}
	bills, found, err := h.store.PastCardBills(ctx, userID, source, postedOn(h.clk.Now()), n)
	if err != nil {
		return PastCardBillsResponse{}, false, fmt.Errorf("read past card bills: %w", err)
	}
	if !found {
		return PastCardBillsResponse{}, false, nil
	}
	out := PastCardBillsResponse{SourceID: source, Bills: []PastBill{}}
	var sum int64
	for _, b := range bills {
		out.Bills = append(out.Bills, PastBill{ClosesOn: b.ClosesOn.Format(time.DateOnly), DueOn: b.DueOn.Format(time.DateOnly), TotalCents: b.TotalCents})
		sum += b.TotalCents
	}
	if len(bills) > 0 {
		out.AverageCents = new(halfUp(sum, int64(len(bills))))
	}
	return out, true, nil
}

func historyMonth(month string, rows []TransactionResponse) HistoryMonth {
	totals := MonthTotals(toTxns(rows))
	cats := make([]CategoryTotal, len(SpendingCategories))
	for i, c := range SpendingCategories {
		cats[i] = CategoryTotal{Category: c, SpentCents: totals.ByCategory[c]}
	}
	return HistoryMonth{Month: month, IncomeCents: totals.Income, SpentCents: totals.Spend, SavedCents: totals.Saving, Categories: cats}
}

// paceMonths is how many months before the asked one the usual pace averages.
const paceMonths = 3

// Daily answers GET /me/finance/daily?month=YYYY-MM from DailyView.
func (h *Handler) Daily(w http.ResponseWriter, r *http.Request) {
	res, err := h.DailyView(r.Context(), identity.CurrentUser(r.Context()).ID, r.URL.Query().Get("month"))
	h.writeView(w, res, err)
}

// DailyView is the daily pace of userID in `month` (YYYY-MM), from one read of the three
// months before it and the month itself. A previous month has history when it
// has at least one Transaction of any type, so a month of only Transfers counts
// as a real zero and a month before the first import does not count.
func (h *Handler) DailyView(ctx context.Context, userID, month string) (DailyResponse, error) {
	from, to, ok := parseMonth(month)
	if !ok {
		return DailyResponse{}, errInvalidMonth
	}
	rows, err := h.store.SpendRows(ctx, userID, from.AddDate(0, -paceMonths, 0), to)
	if err != nil {
		return DailyResponse{}, fmt.Errorf("read daily: %w", err)
	}
	byMonth := map[time.Time][]Txn{}
	for _, t := range rows {
		m := time.Date(t.PostedOn.Year(), t.PostedOn.Month(), 1, 0, 0, 0, 0, time.UTC)
		byMonth[m] = append(byMonth[m], t)
	}
	days := int(to.Sub(from).Hours() / 24)
	current := CumulativeDaily(byMonth[from], from)
	today := postedOn(h.clk.Now())
	switch thisMonth := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC); {
	case from.After(thisMonth):
		current = []int64{}
	case from.Equal(thisMonth):
		current = current[:today.Day()]
	}
	var history [][]int64
	for i := paceMonths; i >= 1; i-- {
		m := from.AddDate(0, -i, 0)
		if len(byMonth[m]) > 0 {
			history = append(history, CumulativeDaily(byMonth[m], m))
		}
	}
	prev := from.AddDate(0, -1, 0)
	return DailyResponse{
		Month: month, Days: days, Current: current,
		Previous: CumulativeDaily(byMonth[prev], prev), Average: UsualPace(history, days), AverageMonths: len(history),
	}, nil
}

// commitmentMonths is the horizon of GET /me/finance/commitments.
const commitmentMonths = 12

// Commitments answers GET /me/finance/commitments?from=YYYY-MM from CommitmentsView.
func (h *Handler) Commitments(w http.ResponseWriter, r *http.Request) {
	res, err := h.CommitmentsView(r.Context(), identity.CurrentUser(r.Context()).ID, r.URL.Query().Get("from"))
	h.writeView(w, res, err)
}

// CommitmentsView is 12 months of userID from `from` (YYYY-MM), each with the installments its plans still owe.
// Each month carries the outlook Outlook works out on each read from the counted
// Transactions, the card Sources, the plans and every Bill: one bill per credit
// card, the other Bills paid or not, the rest of each Spending limit as planned
// spending, in the current month (São Paulo) what was spent off the card, a total
// and the leftover of the income. With a Monthly income, the current month (São
// Paulo) also carries the Daily allowance and every month up to it the Pace; both
// are absent without income (see DailyAllowance and Pace).
func (h *Handler) CommitmentsView(ctx context.Context, userID, fromMonth string) (CommitmentsResponse, error) {
	from, _, ok := parseMonth(fromMonth)
	if !ok {
		return CommitmentsResponse{}, errInvalidMonth
	}
	in, err := h.loadOutlook(ctx, userID, from, commitmentMonths)
	if err != nil {
		return CommitmentsResponse{}, fmt.Errorf("read commitments: %w", err)
	}
	plans, income, outlook := in.plans, in.income, in.outlook
	today := postedOn(h.clk.Now())
	byMonth := map[time.Time][]Txn{}
	for _, t := range in.rows {
		m := time.Date(t.PostedOn.Year(), t.PostedOn.Month(), 1, 0, 0, 0, 0, time.UTC)
		byMonth[m] = append(byMonth[m], t)
	}
	months := make([]MonthCommitment, commitmentMonths)
	for i, lines := range ProjectInstallments(plans, from, commitmentMonths) {
		m := MonthCommitment{Month: from.AddDate(0, i, 0).Format("2006-01"), Installments: append([]InstallmentLine{}, lines...)}
		o := outlook[i]
		m.Cards, m.OtherBills = []CardBillLine{}, []OtherBillLine{}
		for _, c := range o.Cards {
			line := CardBillLine{SourceID: c.SourceID, Name: c.Name, AmountCents: c.AmountCents, BillDaysKnown: c.BillDaysKnown, FromBank: c.FromBank, Manual: c.Manual,
				DueOn: dateOrNil(c.DueOn), ClosesOn: dateOrNil(c.ClosesOn)}
			if cy, ok := o.Cycles[c.SourceID]; ok {
				line.DueOn, line.ClosesOn, line.Closed = dateOrNil(cy.DueOn), dateOrNil(cy.ClosesOn), cy.Closed
				line.HeldFrom, line.HeldTo = dateOrNil(cy.HeldFrom), dateOrNil(cy.HeldTo)
			}
			m.Cards = append(m.Cards, line)
		}
		for _, b := range o.OtherBills {
			m.OtherBills = append(m.OtherBills, OtherBillLine(b))
		}
		m.Planned = []PlannedLineDTO{}
		for _, p := range o.Planned {
			m.Planned = append(m.Planned, PlannedLineDTO(p))
		}
		m.PlannedCents, m.SpentOffCardCents, m.SavingCents = o.PlannedCents, o.SpentOffCardCents, o.SavingCents
		m.OtherInstallmentsCents, m.TotalCents, m.LeftoverCents = o.OtherInstallmentsCents, o.TotalCents, o.LeftoverCents
		if o.PaceLeftoverCents != nil {
			m.PacePlannedCents, m.PaceLeftoverCents = &o.PacePlannedCents, o.PaceLeftoverCents
		}
		month := from.AddDate(0, i, 0)
		if o.LeftoverCents != nil {
			// the planned spending is what the days left are for, so it is not taken out of them twice
			m.DailyAllowanceCents = DailyAllowance(new(*o.LeftoverCents+o.PlannedCents), today, month)
		}
		if p := Pace(byMonth[month], income, o.LeftoverCents, today, month); p != nil {
			m.Pace = &PaceDTO{SpentCents: p.SpentCents, LineEndCents: p.LineEndCents}
		}
		months[i] = m
	}
	return CommitmentsResponse{From: from.Format("2006-01"), MonthlyIncomeCents: income, Months: months}, nil
}

// outlookInputs is what loadOutlook read, with the Outlook it worked out.
type outlookInputs struct {
	plans   []Plan
	rows    []Txn
	income  *int64
	limits  map[string]int64
	cards   []Card
	manual  []ManualCard
	outlook []MonthOutlook
}

// offCardRows are the counted rows of Sources that are not credit cards, Bill
// payments included: money out of the account is committed whether or not a Bill lists it.
func (in outlookInputs) offCardRows() []Txn {
	var out []Txn
	for _, t := range in.rows {
		if !slices.ContainsFunc(in.cards, func(c Card) bool { return c.ID == t.SourceID }) {
			out = append(out, t)
		}
	}
	return out
}

// loadOutlook reads the inputs of Outlook for `months` months from `from` and works
// it out. Commitments and Savings both call it, so their leftovers cannot differ.
func (h *Handler) loadOutlook(ctx context.Context, uid string, from time.Time, months int) (outlookInputs, error) {
	var in outlookInputs
	var err error
	if in.plans, err = h.store.InstallmentPlans(ctx, uid); err != nil {
		return in, err
	}
	if in.income, err = h.store.Income(ctx, uid); err != nil {
		return in, err
	}
	now := postedOn(h.clk.Now())
	current := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	// The current month's open bill holds charges counting up to billLead months later, past a short horizon,
	// and a later month shifted by its card's bill counts up to billLead months past the last asked month.
	end := from.AddDate(0, months+billLead, 0)
	if lead := current.AddDate(0, billLead+1, 0); lead.After(end) {
		end = lead
	}
	wide, err := h.store.SpendRows(ctx, uid, from, end)
	if err != nil {
		return in, err
	}
	for _, t := range wide {
		if t.PostedOn.Before(from.AddDate(0, months, 0)) { // the rows of the asked months only
			in.rows = append(in.rows, t)
		}
	}
	cards, err := h.store.CardSources(ctx, uid)
	in.cards = cards
	if err != nil {
		return in, err
	}
	if in.manual, err = h.store.ManualCards(ctx, uid); err != nil {
		return in, err
	}
	bills := make([][]MonthBill, months)
	for i := range bills {
		if bills[i], err = h.store.MonthBills(ctx, uid, from.AddDate(0, i, 0)); err != nil {
			return in, err
		}
	}
	if in.limits, err = h.store.Budgets(ctx, uid); err != nil {
		return in, err
	}
	_, base, _, err := h.store.SavingsSettings(ctx, uid)
	if err != nil {
		return in, err
	}
	var contribution int64
	if base != nil {
		contribution = *base
	}
	prev, err := h.store.SpendRows(ctx, uid, current.AddDate(0, -paceMonths, 0), current)
	if err != nil {
		return in, err
	}
	registered, err := h.store.MonthBills(ctx, uid, current)
	if err != nil {
		return in, err
	}
	known := make([]Bill, len(registered))
	for i, b := range registered {
		known[i] = Bill{ID: b.ID, Name: b.Name, ExpectedCents: b.ExpectedCents}
	}
	in.outlook = Outlook(wide, cards, in.manual, in.plans, bills, in.income, in.limits, plannedBaseline(prev, cards, known, current), contribution, now, from, months)
	return in, nil
}

// maxIncomeCents bounds the income so the income stays far from int64 overflow in the sums.
const maxIncomeCents = 1_000_000_000_000

// PutIncome answers PUT /me/finance/income: sets the Monthly income, or clears it with null.
func (h *Handler) PutIncome(w http.ResponseWriter, r *http.Request) {
	var req IncomeRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if v := req.MonthlyIncomeCents; v != nil && (*v <= 0 || *v > maxIncomeCents) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid income")
		return
	}
	if err := h.store.SetIncome(r.Context(), identity.CurrentUser(r.Context()).ID, req.MonthlyIncomeCents, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: set income", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PutBillDays answers PUT /me/finance/sources/{id}/bill-days: sets a card's
// closing and due days together, or clears both with null (or {}). One day
// without the other, or a day outside 1 to 31, answers 400 with the bad keys
// under "fields". A malformed id, another User's Source and a Source that is
// not a card all answer 404.
func (h *Handler) PutBillDays(w http.ResponseWriter, r *http.Request) {
	var req BillDaysRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	fields := map[string]string{}
	for key, v := range map[string]*int{"closeDay": req.CloseDay, "dueDay": req.DueDay} {
		switch {
		case v == nil && (req.CloseDay != nil || req.DueDay != nil):
			fields[key] = "required"
		case v != nil && (*v < 1 || *v > 31):
			fields[key] = "invalid"
		}
	}
	if len(fields) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid bill days", "fields": fields})
		return
	}
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	found, err := h.store.SetBillDaysByHand(r.Context(), identity.CurrentUser(r.Context()).ID, id, req.CloseDay, req.DueDay)
	h.answer(w, found, err, "set bill days", func() { w.WriteHeader(http.StatusNoContent) })
}

// PutSourceName answers PUT /me/finance/sources/{id}/name: sets the name shown
// for a Source, or clears it with null. An empty, over-long or control-character
// name answers 400 with fields.name. A malformed id and another User's Source
// answer 404.
func (h *Handler) PutSourceName(w http.ResponseWriter, r *http.Request) {
	var req SourceNameRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if req.Name != nil {
		name, field := nameField(*req.Name)
		req.Name = &name
		if field != "" {
			httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid source name", "fields": map[string]string{"name": field}})
			return
		}
	}
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	found, err := h.store.SetDisplayName(r.Context(), identity.CurrentUser(r.Context()).ID, id, req.Name)
	h.answer(w, found, err, "set source name", func() { w.WriteHeader(http.StatusNoContent) })
}

// PatchTransaction answers PATCH /me/finance/transactions/{id}. A malformed id
// and another User's row both answer 404, so ids cannot be probed.
func (h *Handler) PatchTransaction(w http.ResponseWriter, r *http.Request) {
	var req PatchTransactionRequest
	if !httpx.DecodeBody(w, r, &req, 4<<10, true) { // 200 astral characters as \u escapes are 2,400 bytes
		return
	}
	if req.Note != nil {
		n := strings.TrimSpace(*req.Note)
		req.Note = &n
		if utf8.RuneCountInString(n) > 200 {
			httpx.WriteError(w, http.StatusBadRequest, "note too long")
			return
		}
	}
	if (req.Type == nil && req.SpendingCategory == nil && req.Note == nil) ||
		(req.Note != nil && strings.IndexFunc(*req.Note, unicode.IsControl) >= 0) ||
		(req.Type != nil && !slices.Contains([]string{"income", "expense", "transfer", "saving"}, *req.Type)) ||
		(req.SpendingCategory != nil && !slices.Contains(llmalloc.SpendingCategories, *req.SpendingCategory)) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid transaction edit")
		return
	}
	id := r.PathValue("id")
	if !chores.ValidID(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	t, found, err := h.store.UpdateTransaction(r.Context(), identity.CurrentUser(r.Context()).ID, id, req.Type, req.SpendingCategory, req.Note, h.clk.Now())
	switch {
	case errors.Is(err, ErrCategoryNeedsExpense):
		httpx.WriteError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		httpx.InternalError(w, h.log, "finance: update transaction", err)
	case !found:
		httpx.WriteError(w, http.StatusNotFound, "not found")
	default:
		httpx.WriteJSON(w, http.StatusOK, t)
	}
}

// PutCredentials answers PUT /me/finance/credentials.
func (h *Handler) PutCredentials(w http.ResponseWriter, r *http.Request) {
	var req CredentialsRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	id, secret := strings.TrimSpace(req.ClientID), strings.TrimSpace(req.ClientSecret)
	fields := map[string]string{}
	if msg := credentialProblem(id); msg != "" {
		fields["clientId"] = msg
	}
	if msg := credentialProblem(secret); msg != "" {
		fields["clientSecret"] = msg
	}
	if len(fields) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid credentials", "fields": fields})
		return
	}
	userID := identity.CurrentUser(r.Context()).ID
	idEnc, err := Seal(h.key, userID, FieldClientID, []byte(id))
	if err != nil {
		httpx.InternalError(w, h.log, "finance: seal client id", err)
		return
	}
	secretEnc, err := Seal(h.key, userID, FieldClientSecret, []byte(secret))
	if err != nil {
		httpx.InternalError(w, h.log, "finance: seal client secret", err)
		return
	}
	if err := h.store.SaveCredentials(r.Context(), userID, idEnc, secretEnc, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: save credentials", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteCredentials answers DELETE /me/finance/credentials.
func (h *Handler) DeleteCredentials(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteCredentials(r.Context(), identity.CurrentUser(r.Context()).ID); err != nil {
		httpx.InternalError(w, h.log, "finance: delete credentials", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteAll answers DELETE /me/finance: all the User's finance data, nothing else.
func (h *Handler) DeleteAll(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteAll(r.Context(), identity.CurrentUser(r.Context()).ID); err != nil {
		httpx.InternalError(w, h.log, "finance: delete all", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ConnectToken answers POST /me/finance/connect-token: a short-lived token the
// PWA hands to Pluggy Connect.
func (h *Handler) ConnectToken(w http.ResponseWriter, r *http.Request) {
	apiKey, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	token, err := h.pluggy.CreateConnectToken(r.Context(), apiKey)
	if err != nil {
		h.pluggyFailed(w, "create connect token", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ConnectTokenResponse{ConnectToken: token, IncludeSandbox: h.env != "production"})
}

// ConnectItem answers POST /me/finance/items: it registers an Item the User
// authorised and stores one Source per account. Repeating it adds nothing.
func (h *Handler) ConnectItem(w http.ResponseWriter, r *http.Request) {
	var req ConnectItemRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if !itemIDPattern.MatchString(req.ItemID) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid item id")
		return
	}
	apiKey, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	// Asking Pluggy with the User's own key stops them registering an Item
	// from someone else's Pluggy application.
	item, err := h.pluggy.GetItem(r.Context(), apiKey, req.ItemID)
	if errors.Is(err, pluggy.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "item not found")
		return
	} else if err != nil {
		h.pluggyFailed(w, "get item", err)
		return
	}
	if item.Status == "LOGIN_ERROR" {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "item login failed")
		return
	}
	accounts, err := h.pluggy.ListAccounts(r.Context(), apiKey, req.ItemID)
	if err != nil {
		h.pluggyFailed(w, "list accounts", err)
		return
	}
	var sources []NewSource
	for _, a := range accounts {
		if kind := sourceKind(a); kind != "" {
			sources = append(sources, NewSource{PluggyAccountID: a.ID, Kind: kind, Name: a.Name, Currency: a.Currency, CloseDay: a.CloseDay, DueDay: a.DueDay, CreditLimitCents: a.CreditLimitCents})
		}
	}
	if len(sources) == 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "no supported accounts")
		return
	}
	if err := h.store.ConnectItem(r.Context(), identity.CurrentUser(r.Context()).ID, req.ItemID, h.clk.Now(), item, sources); err != nil {
		httpx.InternalError(w, h.log, "finance: connect item", err)
		return
	}
	h.Status(w, r)
}

// sourceKind maps a Pluggy account to a Source kind; investments, loans and
// anything else give "" and are skipped.
func sourceKind(a pluggy.Account) string {
	switch {
	case a.Type == "BANK" && a.Subtype == "CHECKING_ACCOUNT":
		return "checking"
	case a.Type == "BANK" && a.Subtype == "SAVINGS_ACCOUNT":
		return "savings"
	case a.Type == "CREDIT":
		return "credit_card"
	}
	return ""
}

// authenticate opens the User's credentials into locals, trades them for an
// API key and returns it; on failure it has answered. The plaintext and the
// key live only in this call and its caller's frame.
func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request) (apiKey string, ok bool) {
	if h.pluggy == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "finance not configured")
		return "", false
	}
	userID := identity.CurrentUser(r.Context()).ID
	idEnc, secretEnc, found, err := h.store.Credentials(r.Context(), userID)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: load credentials", err)
		return "", false
	}
	if !found {
		httpx.WriteError(w, http.StatusConflict, "no credentials")
		return "", false
	}
	id, err := Open(h.key, userID, FieldClientID, idEnc)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: open client id", err)
		return "", false
	}
	secret, err := Open(h.key, userID, FieldClientSecret, secretEnc)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: open client secret", err)
		return "", false
	}
	apiKey, err = h.pluggy.Auth(r.Context(), string(id), string(secret))
	if errors.Is(err, pluggy.ErrUnauthorized) {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "pluggy_credentials_rejected")
		return "", false
	}
	if err != nil {
		h.pluggyFailed(w, "auth", err)
		return "", false
	}
	return apiKey, true
}

// pluggyFailed answers a calm 502. The adapter's errors hold the operation
// and the status only, so logging err is safe.
func (h *Handler) pluggyFailed(w http.ResponseWriter, what string, err error) {
	h.log.Error("finance: pluggy "+what, "error", err.Error())
	httpx.WriteError(w, http.StatusBadGateway, "pluggy unavailable")
}

// credentialProblem is empty when v is 1 to 200 characters with no control ones.
func credentialProblem(v string) string {
	if n := utf8.RuneCountInString(v); n < 1 || n > maxCredential {
		return "must be 1 to 200 characters"
	}
	if strings.IndexFunc(v, unicode.IsControl) >= 0 {
		return "must not contain control characters"
	}
	return ""
}

// dateOrNil formats a day as YYYY-MM-DD, nil when unknown.
func dateOrNil(t *time.Time) *string {
	if t == nil {
		return nil
	}
	d := t.Format(time.DateOnly)
	return &d
}
