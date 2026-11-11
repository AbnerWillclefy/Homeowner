package finance

import (
	"cmp"
	"math"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

// Sign convention: amount_cents is signed from the Source's point of view,
// negative is money out and positive is money in. The direction is the sign,
// never Pluggy's type. Pluggy signs a card row the other way (a purchase is
// positive), so the sync flips it (toRows). The amount spent on an expense is
// -amount_cents, so a refund is a negative spend.

var (
	saoPaulo = mustLoad("America/Sao_Paulo")
	// installmentMark is "PARC 03/10" in a description, which changes per charge.
	installmentMark = regexp.MustCompile(`\bPARC\s*\d+\s*/\s*\d+`)
	// installmentText captures "PARC 03/10" or "PARCELA 3/10": number, then total.
	installmentText = regexp.MustCompile(`(?i)\bPARC(?:ELA)?\s*(\d{1,2})\s*/\s*(\d{1,2})\b`)
	notLetters      = regexp.MustCompile(`[^A-Z]+`)
	accents         = strings.NewReplacer(
		"Á", "A", "À", "A", "Â", "A", "Ã", "A", "Ä", "A",
		"É", "E", "È", "E", "Ê", "E", "Ë", "E",
		"Í", "I", "Ì", "I", "Î", "I", "Ï", "I",
		"Ó", "O", "Ò", "O", "Ô", "O", "Õ", "O", "Ö", "O",
		"Ú", "U", "Ù", "U", "Û", "U", "Ü", "U",
		"Ç", "C", "Ñ", "N")
)

func mustLoad(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// MerchantKey is the stable form of a description: uppercase, accents folded,
// "PARC nn/mm", digits and punctuation removed, spaces collapsed. The same
// merchant gives the same key across charges.
func MerchantKey(description string) string {
	s := accents.Replace(strings.ToUpper(description))
	// shortcut: letters outside A-Z (other alphabets) are dropped, when Finances leave pt-BR.
	return strings.TrimSpace(notLetters.ReplaceAllString(installmentMark.ReplaceAllString(s, " "), " "))
}

// pluggyCategories maps the categories Pluggy sends (seen in the sandbox
// capture) to a Spending Category id. A category not here, or none, goes on to
// the Categorizer. shortcut: only the capture's categories, add more as real
// Items show them.
var pluggyCategories = map[string]string{
	"Housing":                  "housing",
	"Electricity":              "household_bills",
	"Internet":                 "household_bills",
	"Mobile":                   "household_bills",
	"Telecommunications":       "household_bills",
	"Music streaming":          "subscriptions",
	"Video streaming":          "subscriptions",
	"Gyms and fitness centers": "health",
}

// postedOn is the São Paulo calendar day of a Pluggy timestamp, as a UTC
// midnight so it stores and compares as a plain date. The User has no zone.
func postedOn(at time.Time) time.Time {
	y, m, d := at.In(saoPaulo).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// Kind is a Source's kind as stored: checking, savings or credit_card.
type Kind string

// transferWindowDays is "a few days": how far apart the two halves of a Transfer
// may post.
const transferWindowDays = 3

// billPayments are merchant keys that mark a card bill payment, on either side.
var billPayments = []string{"PAGAMENTO FATURA", "PAGAMENTO DE FATURA", "PAGAMENTO RECEBIDO"}

// Txn is the part of a Transaction the rules read and decide.
type Txn struct {
	ID, SourceID, Currency, MerchantKey string
	// Description is the raw text, read only by MatchBills.
	Description string
	PostedOn    time.Time
	// Posted is the posted day; PostedOn may hold CountsOn.
	Posted          time.Time
	AmountCents     int64
	Type, TypeSetBy string
	// Category is the spending category, empty unless Type is expense.
	Category, CategorySetBy string
	// Linked (a Bill payment, not undone, points at it) is read by SuggestBills
	// and Outlook; Installment (a PARC nn/mm charge) only by SuggestBills.
	Linked, Installment bool
}

// Classify sets the type of every auto Txn and returns those whose type or
// category changed. A row the User set is neither changed nor used as a partner.
//
// Rules, in order: a bill payment is a Transfer, by its words or, on a Source
// that is not a credit card, by a debit equal to a stored closed bill's total
// posted within transferWindowDays of its due date; a debit and a credit of the
// same amount and currency on two Sources within transferWindowDays are both
// Transfers; any other credit on a credit_card Source is an Expense, a refund
// (a negative spend); any other credit is Income, any other debit an Expense.
//
// Accepted: a Transfer has no category, so a row the User only categorised
// loses that category when it pairs. An unrelated debit and credit that coincide are paired. The User
// can correct it, and their choice is never overwritten. A row that drops out
// of a pair after a re-fetch goes back to its single-row rule, so callers pass
// the whole window, not only the new rows.
func Classify(txns []Txn, kinds map[string]Kind, bills []StoredBill) []Txn {
	var auto []Txn
	for _, t := range txns {
		if t.TypeSetBy == "auto" {
			auto = append(auto, t)
		}
	}
	transfer := map[string]bool{}
	for _, t := range auto {
		for _, p := range billPayments {
			if strings.Contains(t.MerchantKey, p) {
				transfer[t.ID] = true
			}
		}
	}
	for _, t := range auto {
		for _, b := range bills {
			if t.AmountCents < 0 && kinds[t.SourceID] != "credit_card" && t.Currency == "BRL" && -t.AmountCents == b.TotalCents && math.Abs(t.PostedOn.Sub(b.DueOn).Hours()/24) <= transferWindowDays {
				transfer[t.ID] = true
			}
		}
	}
	type pair struct {
		debit, credit Txn
		gap           int
	}
	var pairs []pair
	for _, d := range auto {
		for _, c := range auto {
			if d.AmountCents >= 0 || c.AmountCents != -d.AmountCents || d.SourceID == c.SourceID || d.Currency != c.Currency {
				continue
			}
			if gap := int(math.Abs(c.PostedOn.Sub(d.PostedOn).Hours() / 24)); gap <= transferWindowDays {
				pairs = append(pairs, pair{d, c, gap})
			}
		}
	}
	slices.SortFunc(pairs, func(a, b pair) int {
		return cmp.Or(cmp.Compare(a.gap, b.gap), cmp.Compare(a.debit.ID, b.debit.ID), cmp.Compare(a.credit.ID, b.credit.ID))
	})
	paired := map[string]bool{}
	for _, p := range pairs {
		if !paired[p.debit.ID] && !paired[p.credit.ID] {
			paired[p.debit.ID], paired[p.credit.ID] = true, true
			transfer[p.debit.ID], transfer[p.credit.ID] = true, true
		}
	}

	var changed []Txn
	for _, t := range auto {
		n := t
		switch {
		case transfer[t.ID]:
			n.Type = "transfer"
		case t.AmountCents < 0, kinds[t.SourceID] == "credit_card":
			n.Type = "expense"
		default:
			n.Type = "income"
		}
		switch {
		case n.Type != "expense":
			n.Category, n.CategorySetBy = "", ""
		case n.Category == "":
			n.Category, n.CategorySetBy = "other", "fallback"
		}
		if n != t {
			changed = append(changed, n)
		}
	}
	return changed
}

// ParseInstallment is the installment a charge belongs to: Pluggy's own numbers
// (metaN of metaM, 0 when absent) first, else a "PARC 03/10" in the description.
// Only 1 <= n <= m with m >= 2 is accepted, so "PARC 10/10" is the last one and
// "PARC 00/10", "PARC 11/10", "PARC 3/" and a bare date "10/11" are refused.
func ParseInstallment(description string, metaN, metaM int) (n, m int, ok bool) {
	if validInstallment(metaN, metaM) {
		return metaN, metaM, true
	}
	g := installmentText.FindStringSubmatch(description)
	if g == nil {
		return 0, 0, false
	}
	n, _ = strconv.Atoi(g[1])
	m, _ = strconv.Atoi(g[2])
	if !validInstallment(n, m) {
		return 0, 0, false
	}
	return n, m, true
}

func validInstallment(n, m int) bool { return m >= 2 && n >= 1 && n <= m }

// Plan is the latest seen charge of an Installment plan.
type Plan struct {
	Name          string
	Number, Total int
	AmountCents   int64 // what one installment costs, positive
	// Month is the month (first day, UTC) of the charge numbered Number.
	Month time.Time
	// SourceID is the Source the plan is charged on; Card is whether it is a credit card.
	SourceID string
	Card     bool
	// Category is the Spending Category of the latest charge, empty when it has none.
	Category string
}

// PlanName is the description without its installment token, or the merchant
// key when nothing else is left.
func PlanName(description, merchantKey string) string {
	if name := strings.Join(strings.Fields(installmentText.ReplaceAllString(description, " ")), " "); name != "" {
		return name
	}
	return merchantKey
}

// InstallmentLine is one plan's installment due in a month.
type InstallmentLine struct {
	Name        string `json:"name"`
	Number      int    `json:"number"`
	Total       int    `json:"total"`
	AmountCents int64  `json:"amountCents"`
}

// ProjectInstallments lists, for each of the months months from from (a first
// of month), the installments the plans still owe: number n+1 falls one month
// after the latest seen charge, and so on to the last. A finished plan owes
// nothing. shortcut: the current amount is repeated, a plan whose price changes is wrong.
func ProjectInstallments(plans []Plan, from time.Time, months int) [][]InstallmentLine {
	out := make([][]InstallmentLine, months)
	for _, p := range plans {
		first := p.Number + 1
		if monthIndex(p.Month) > monthIndex(from) {
			first = p.Number // the charge is on a bill not yet due, so it is still to come
		}
		for k := first; k <= p.Total; k++ {
			i := monthIndex(p.Month.AddDate(0, k-p.Number, 0)) - monthIndex(from)
			if i >= 0 && i < months {
				out[i] = append(out[i], InstallmentLine{p.Name, k, p.Total, p.AmountCents})
			}
		}
	}
	return out
}

func monthIndex(t time.Time) int { return t.Year()*12 + int(t.Month()) }

// DueDate is the day a Bill with dueDay falls due in the month, as a UTC
// midnight: a day past the month end falls on its last day.
func DueDate(year int, month time.Month, dueDay int) time.Time {
	last := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC)
	return time.Date(year, month, min(dueDay, last.Day()), 0, 0, 0, 0, time.UTC)
}

// CountsOn is the day a Transaction counts as spent: a card charge counts on
// the due date of the bill it falls in, so a month's spending is what its bills
// and its non-card rows take; any other row counts on posted. A charge on the
// closing day or later goes to the next bill. A card with no known closeDay
// or dueDay (0) counts on posted too.
func CountsOn(posted time.Time, kind Kind, closeDay, dueDay int) time.Time {
	if kind != "credit_card" || closeDay == 0 || dueDay == 0 {
		return posted
	}
	closes := DueDate(posted.Year(), posted.Month(), closeDay)
	if !posted.Before(closes) {
		closes = DueDate(posted.Year(), posted.Month()+1, closeDay)
	}
	if dueDay > closeDay {
		return DueDate(closes.Year(), closes.Month(), dueDay)
	}
	return DueDate(closes.Year(), closes.Month()+1, dueDay)
}

// ReminderQuietUntilHour is the local hour before which no Bill reminder is
// sent: the job is hourly, so without it a reminder could arrive at 01:00.
const ReminderQuietUntilHour = 9

// The ledger kinds of a Bill reminder (finance_bill_reminders.kind).
const (
	ledgerDueSoon = "due_soon"
	ledgerOverdue = "overdue"
)

// The Notices a reminder can carry; reminders.go maps them to push Kinds.
const (
	noticeDueToday = "due_today"
	noticeDueSoon  = "due_soon"
	noticeOverdue  = "overdue"
)

// ReminderBill is a Bill as the reminder rule sees it. Paid is whether the
// local month has a payment that is not undone.
type ReminderBill struct {
	ID     string
	DueDay int
	Paid   bool
}

// BillReminder is a reminder to send: the Bill, its ledger kind and the
// Notice the worker words.
type BillReminder struct {
	BillID, Ledger, Notice string
}

// DueReminders picks the Bills to remind about at local, the User's wall clock.
// Unpaid Bills due today or tomorrow are due_soon and those due earlier in the
// month are overdue; nothing is sent before ReminderQuietUntilHour. Earlier
// months are left out, so it never nags about history.
// shortcut: a Bill due on the 1st is not reminded on the last day of the month
// before, because payments are read for the local month only; add next month's
// payments if that is missed.
func DueReminders(bills []ReminderBill, local time.Time) []BillReminder {
	if local.Hour() < ReminderQuietUntilHour {
		return nil
	}
	y, m, d := local.Date()
	today := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	var out []BillReminder
	for _, b := range bills {
		if b.Paid {
			continue
		}
		switch due := DueDate(y, m, b.DueDay); {
		case due.Equal(today):
			out = append(out, BillReminder{b.ID, ledgerDueSoon, noticeDueToday})
		case due.Equal(today.AddDate(0, 0, 1)):
			out = append(out, BillReminder{b.ID, ledgerDueSoon, noticeDueSoon})
		case due.Before(today):
			out = append(out, BillReminder{b.ID, ledgerOverdue, noticeOverdue})
		}
	}
	return out
}

// Totals is the spend of a set of Transactions, in centavos.
type Totals struct {
	Spend      int64
	ByCategory map[string]int64
}

// MonthTotals sums the Expenses by Spending Category. Transfers and Income are
// ignored; a refund (a negative spend) offsets its category. A category can end
// negative in a refund-heavy month: it is returned as is, not clamped.
func MonthTotals(txns []Txn) Totals {
	out := Totals{ByCategory: map[string]int64{}}
	for _, t := range txns {
		if t.Type == "expense" {
			out.Spend -= t.AmountCents
			out.ByCategory[t.Category] -= t.AmountCents
		}
	}
	return out
}

// CumulativeDaily is the running spend at the end of each day of month (a UTC
// first-of-month), one entry per day. The rule is MonthTotals', applied to each
// day's Txns; Txns outside the month are the caller's to leave out.
func CumulativeDaily(txns []Txn, month time.Time) []int64 {
	byDay := make([][]Txn, month.AddDate(0, 1, -1).Day())
	for _, t := range txns {
		byDay[t.PostedOn.Day()-1] = append(byDay[t.PostedOn.Day()-1], t)
	}
	out := make([]int64, len(byDay))
	var sum int64
	for i, day := range byDay {
		sum += MonthTotals(day).Spend
		out[i] = sum
	}
	return out
}

// UsualPace averages cumulative month series by day of month, for a month of
// `days` days. A day past a shorter month's end takes that month's final total.
// No series gives an empty result. Rounds half up.
func UsualPace(months [][]int64, days int) []int64 {
	if len(months) == 0 {
		return []int64{}
	}
	n := int64(len(months))
	out := make([]int64, days)
	for d := range out {
		var sum int64
		for _, m := range months {
			sum += m[min(d, len(m)-1)]
		}
		q := 2*sum + n
		out[d] = q / (2 * n)
		if q%(2*n) < 0 {
			out[d]-- // floor for negatives, so half up holds for both signs
		}
	}
	return out
}

// Bill is the part of a Bill the matcher reads.
type Bill struct {
	ID, Name      string
	ExpectedCents int64
}

// billMonth is one Bill in one month (the first day, UTC): the key of a payment.
type billMonth struct {
	BillID string
	Month  time.Time
}

// Match says a Transaction pays a Bill for the month of its posted_on.
type Match struct {
	BillID, TxnID string
	Month         time.Time
}

// minBillName keeps a two-letter name such as "Gá" from matching everything.
const minBillName = 3

// fold is uppercase with accents folded and spaces collapsed.
func fold(s string) string {
	return strings.Join(strings.Fields(accents.Replace(strings.ToUpper(s))), " ")
}

// MatchBills pairs Expenses with the Bills they pay. A Bill matches a
// Transaction posted in the Bill's month when its folded name is contained in
// the folded description and -amount equals the expected amount exactly. A
// Transaction pays one Bill: the longest name, then the lowest id. A Bill-month
// takes one Transaction: the earliest, then the lowest id. A Bill-month in
// taken (paid by hand, by the bank, or undone) is skipped. Matches come ordered
// by month, then Bill id.
//
// shortcut: a Bill paid early, in the month before its Transaction posts, does
// not match; when that hurts, widen the month by the Bill's due day.
func MatchBills(bills []Bill, txns []Txn, taken map[billMonth]bool) []Match {
	txns = slices.Clone(txns)
	slices.SortFunc(txns, func(a, b Txn) int { return cmp.Or(a.PostedOn.Compare(b.PostedOn), cmp.Compare(a.ID, b.ID)) })
	names := make([]string, len(bills))
	for i, b := range bills {
		names[i] = fold(b.Name)
	}
	won := map[billMonth]Match{}
	for _, t := range txns {
		if t.Type != "expense" {
			continue
		}
		desc := fold(t.Description)
		month := time.Date(t.PostedOn.Year(), t.PostedOn.Month(), 1, 0, 0, 0, 0, time.UTC)
		best := -1
		for i, b := range bills {
			if len(names[i]) < minBillName || b.ExpectedCents != -t.AmountCents || !strings.Contains(desc, names[i]) {
				continue
			}
			if best < 0 || cmp.Or(cmp.Compare(len(names[i]), len(names[best])), cmp.Compare(bills[best].ID, b.ID)) > 0 {
				best = i
			}
		}
		if best < 0 {
			continue
		}
		k := billMonth{bills[best].ID, month}
		if taken[k] { // the best Bill is spoken for: do not fall through to a shorter name
			continue
		}
		if _, done := won[k]; !done {
			won[k] = Match{k.BillID, t.ID, month}
		}
	}
	var out []Match
	for _, m := range won {
		out = append(out, m)
	}
	slices.SortFunc(out, func(a, b Match) int { return cmp.Or(a.Month.Compare(b.Month), cmp.Compare(a.BillID, b.BillID)) })
	return out
}

// Suggestion is a Bill the Resident may accept: a merchant that charges every month.
type Suggestion struct {
	MerchantKey, Name string
	AmountCents       int64
	DueDay            int
}

const (
	suggestMonths  = 3
	suggestDayGap  = 5
	suggestPercent = 10
)

// SuggestBills is the product definition of "recurring" (data-model.md). A
// merchant (by MerchantKey) is suggested when each of the suggestMonths complete
// months before now's has an Expense; taking each month's largest, the amounts
// are within 10% of their median and the days within 5 of the median day
// (clamped to each month's length); no Bill covers it and it is not dismissed.
// Linked payments, refunds, non-Expenses and installment charges are ignored.
// The name is the longest run of the key's leading words contained in the folded
// description of all three charges, so MatchBills can pay it later; under
// minBillName characters, nothing is suggested.
//
// shortcut: days do not wrap around a month end (the 30th and the 2nd are far
// apart), when that hurts, compare days modulo the month length.
func SuggestBills(txns []Txn, bills []Bill, dismissed map[string]bool, now time.Time) []Suggestion {
	first := monthIndex(now) - suggestMonths
	type pick struct {
		cents int64
		day   int
		desc  string
	}
	byMerchant := map[string]*[suggestMonths]*pick{}
	descs := map[string][]string{}
	for _, t := range txns {
		i := monthIndex(t.PostedOn) - first
		if t.Type != "expense" || t.AmountCents >= 0 || t.Linked || t.Installment || t.MerchantKey == "" || i < 0 || i >= suggestMonths {
			continue
		}
		months := byMerchant[t.MerchantKey]
		if months == nil {
			months = new([suggestMonths]*pick)
			byMerchant[t.MerchantKey] = months
		}
		p := pick{-t.AmountCents, t.PostedOn.Day(), fold(t.Description)}
		descs[t.MerchantKey] = append(descs[t.MerchantKey], p.desc)
		// the largest charge of the month; the earlier day on a tie
		if o := months[i]; o == nil || p.cents > o.cents || (p.cents == o.cents && p.day < o.day) {
			months[i] = &p
		}
	}
	var out []Suggestion
	for key, months := range byMerchant {
		if dismissed[key] || slices.Contains(months[:], nil) {
			continue
		}
		cents, days := make([]int64, suggestMonths), make([]int, suggestMonths)
		for i, p := range months {
			cents[i], days[i] = p.cents, p.day
		}
		slices.Sort(cents)
		slices.Sort(days)
		med, medDay := cents[1], days[1]
		ok := true
		for i, p := range months {
			m := first + i - 1 // monthIndex is year*12 + month, so this is zero-based
			clamped := DueDate(m/12, time.Month(m%12+1), medDay).Day()
			ok = ok && absInt(p.cents-med)*100 <= med*suggestPercent && absInt(int64(p.day-clamped)) <= suggestDayGap
		}
		name := bankName(key, months[0].desc, months[1].desc, months[2].desc)
		if !ok || len(name) < minBillName || coveredBy(bills, descs[key]) {
			continue
		}
		out = append(out, Suggestion{key, name, months[2].cents, medDay})
	}
	slices.SortFunc(out, func(a, b Suggestion) int {
		return cmp.Or(cmp.Compare(a.DueDay, b.DueDay), cmp.Compare(a.Name, b.Name), cmp.Compare(a.MerchantKey, b.MerchantKey))
	})
	return out
}

func absInt(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}

// bankName is the longest prefix of the key's words contained in every description.
func bankName(key string, descs ...string) string {
	words := strings.Fields(key)
	for n := len(words); n > 0; n-- {
		name := strings.Join(words[:n], " ")
		if len(name) > 60 { // a Bill name is at most 60 code points
			continue
		}
		if !slices.ContainsFunc(descs, func(d string) bool { return !strings.Contains(d, name) }) {
			return name
		}
	}
	return ""
}

// coveredBy is MatchBills' name test without the amount.
func coveredBy(bills []Bill, descs []string) bool {
	for _, b := range bills {
		name := fold(b.Name)
		if len(name) >= minBillName && slices.ContainsFunc(descs, func(d string) bool { return strings.Contains(d, name) }) {
			return true
		}
	}
	return false
}
