package finance

import "time"

// Card is a credit card Source, with whether both its bill days are set, its due day and
// the bills its bank reported.
type Card struct {
	ID, Name      string
	CloseDay      int // the bill close day, 0 when unknown
	DueDay        int // the bill due day, 0 when unknown
	BillDaysKnown bool
	Bills         []StoredBill
}

// StoredBill is a card bill as the bank reported it: the day it closed, the day
// it is due and its total, which may be negative (a credit balance).
type StoredBill struct {
	ClosesOn, DueOn time.Time
	TotalCents      int64
	Paid            bool // a debit off the cards matched its total
}

// CardBill is what one card's bill takes from a month. FromBank is true when
// AmountCents is the bank's total for a bill due in the month; DueOn and
// ClosesOn are that bill's days, nil otherwise.
type CardBill struct {
	SourceID, Name  string
	AmountCents     int64
	BillDaysKnown   bool
	FromBank        bool
	DueOn, ClosesOn *time.Time
}

// OtherBill is a Bill to pay that is not a card bill; Cents is the snapshot
// amount of a paid month.
type OtherBill struct {
	ID, Name string
	Cents    int64
	Paid     bool
}

// MonthOutlook is what a month takes from the Monthly income.
type MonthOutlook struct {
	Cards                  []CardBill
	OtherBills             []OtherBill
	OtherInstallmentsCents int64
	// Planned is the rest of what each Spending Category plans, in
	// SpendingCategories order, only for those planning more than 0.
	Planned      []PlannedLine
	PlannedCents int64
	// SpentOffCardCents is set only on the current month.
	SpentOffCardCents *int64
	// SavingCents is the larger of the month's actual saving and the Monthly contribution.
	SavingCents int64
	TotalCents  int64
	// LeftoverCents is income minus total; nil when no income is set.
	LeftoverCents *int64
}

// PlannedLine is what is still planned for one Spending Category.
type PlannedLine struct {
	Category string
	Cents    int64
}

// Outlook works out `months` months from `from` (a UTC first-of-month). rows
// are the counted Txns (PostedOn is the CountsOn day), plans the Installment
// plans and bills[i] every Bill of month i, paid or not.
//
// limits are the Spending limits by category; today is the real day (zero when
// unknown), and its month is the only one with SpentOffCardCents.
// Planned for a category is its limit, or without a limit its baseline (the
// average of its spend in the 3 months before current, see plannedBaseline, the
// same for every month of the horizon; a negative one plans 0), minus what already counts for it in the
// month (every row, card or not, plus the installments still to come; in the
// current month the rows the shown card bills hold and those off the cards),
// the counted amount clamped at zero and the result too.
//
// contribution is the Monthly contribution (0 when none). Each month puts aside
// the larger of its actual saving (never below 0) and the contribution, so the
// two are never added: that is SavingCents, part of the total. SpentOffCardCents is the
// month's Expenses on Sources that are not cards, without those a Bill payment
// points to: the paid Bill is already in the other Bills.
//
// shortcut: a Bill in a category with a limit counts in both in future months, upgrade when a Bill can name its Spending Category.
//
// In the month today is in, a card's bill is the one still to pay
// (currentCardBill, ADR 0024), and later months leave out the charges it holds.
// In any other month it is, when the bank reported a bill due in the month, that bill's
// total (ADR 0021), the owed installments not added because the total holds
// them. Otherwise it is the card's Expenses counting in the month plus the
// installments of its plans numbered above Plan.Number due in it; for a card
// with reported bills only the Expenses posted on or after the closing of the latest
// reported bill due before the month count, the earlier ones being inside a
// bank total. A card with no reported bill uses the second rule over every
// Expense. ProjectInstallments is not used because it emits the latest charge
// again when it is on a bill not yet due, and that charge is already in rows. A
// plan on a Source that is not a card stays in OtherInstallmentsCents. A Bill whose month was paid with a card
// Transaction is left out: that money is in a card bill.
//
// shortcut: a card-paid Bill counts twice in the current month until its charge posts (last month's charge is in this month's card bill, this month's is still expected), upgrade when the PWA shows it.
func Outlook(rows []Txn, cards []Card, plans []Plan, bills [][]MonthBill, income *int64, limits, baseline map[string]int64, contribution int64, today, from time.Time, months int) []MonthOutlook {
	byCard := map[string][]Txn{}
	for _, t := range rows {
		byCard[t.SourceID] = append(byCard[t.SourceID], t)
	}
	var loose []Plan
	owed := map[string][]int64{}               // card id -> installments owed per month
	toCome := make([]map[string]int64, months) // month -> category -> installments not yet charged
	for i := range toCome {
		toCome[i] = map[string]int64{}
	}
	for _, p := range plans {
		if !p.Card {
			loose = append(loose, p)
			continue
		}
		if owed[p.SourceID] == nil {
			owed[p.SourceID] = make([]int64, months)
		}
		for k := p.Number + 1; k <= p.Total; k++ {
			if i := monthIndex(p.Month.AddDate(0, k-p.Number, 0)) - monthIndex(from); i >= 0 && i < months {
				owed[p.SourceID][i] += p.AmountCents
				toCome[i][p.Category] += p.AmountCents
			}
		}
	}
	other := ProjectInstallments(loose, from, months)
	for _, p := range loose {
		for i, lines := range ProjectInstallments([]Plan{p}, from, months) {
			for _, l := range lines {
				toCome[i][p.Category] += l.AmountCents
			}
		}
	}
	current := today
	if !today.IsZero() {
		current = time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	}
	isCurrent := func(m time.Time) bool { return !today.IsZero() && monthIndex(m) == monthIndex(current) }
	taken := map[string]billSpan{} // card id -> the charges the current month's bill holds
	isCard := map[string]bool{}
	for _, c := range cards {
		isCard[c.ID] = true
	}
	out := make([]MonthOutlook, months)
	for i := range out {
		m := from.AddDate(0, i, 0)
		o := MonthOutlook{Cards: []CardBill{}, OtherBills: []OtherBill{}, Planned: []PlannedLine{}}
		var monthRows, offCard []Txn
		for _, t := range rows {
			if monthIndex(t.PostedOn) != monthIndex(m) {
				continue
			}
			monthRows = append(monthRows, t)
			if !isCard[t.SourceID] && !t.Linked {
				offCard = append(offCard, t)
			}
		}
		var held []Txn // in the current month: the rows the shown card bills hold, and the month's off the cards
		for _, c := range cards {
			var bill CardBill
			var span billSpan
			if isCurrent(m) {
				bill, span = currentCardBill(c, byCard[c.ID], today)
				for _, t := range byCard[c.ID] {
					if span.from.IsZero() && monthIndex(t.PostedOn) == monthIndex(m) || !span.from.IsZero() && span.holds(t.Posted) {
						held = append(held, t)
					}
				}
				if !span.from.IsZero() {
					taken[c.ID] = span
				}
			} else {
				bill = dueCardBill(c, byCard[c.ID], taken[c.ID], m)
			}
			// A closed bill holds no installment still to be charged: those go to the open one.
			if !bill.FromBank && span.to.IsZero() && owed[c.ID] != nil {
				bill.AmountCents += owed[c.ID][i]
			}
			o.Cards = append(o.Cards, bill)
			o.TotalCents += bill.AmountCents
		}
		if i < len(bills) {
			for _, b := range bills[i] {
				if b.CardPaid {
					continue
				}
				o.OtherBills = append(o.OtherBills, OtherBill{b.ID, b.Name, b.ExpectedCents, b.Paid})
				o.TotalCents += b.ExpectedCents
			}
		}
		for _, l := range other[i] {
			o.OtherInstallmentsCents += l.AmountCents
		}
		o.TotalCents += o.OtherInstallmentsCents
		counted := MonthTotals(monthRows).ByCategory
		if isCurrent(m) {
			for _, t := range monthRows {
				if !isCard[t.SourceID] {
					held = append(held, t)
				}
			}
			counted = MonthTotals(held).ByCategory
		}
		for _, c := range SpendingCategories {
			plan, ok := limits[c]
			if !ok {
				plan = max(0, baseline[c])
			}
			if plan <= 0 {
				continue
			}
			left := max(0, plan-max(0, counted[c]+toCome[i][c]))
			o.Planned = append(o.Planned, PlannedLine{c, left})
			o.PlannedCents += left
		}
		o.TotalCents += o.PlannedCents
		if isCurrent(m) {
			spent := MonthTotals(offCard).Spend
			o.SpentOffCardCents = &spent
			o.TotalCents += spent
		}
		o.SavingCents = max(max(0, MonthTotals(monthRows).Saving), contribution)
		o.TotalCents += o.SavingCents
		if income != nil { // income <= maxIncomeCents, so the subtraction cannot overflow
			left := *income - o.TotalCents
			o.LeftoverCents = &left
		}
		out[i] = o
	}
	return out
}

// plannedBaseline is what each category plans without a Spending limit: its
// spend averaged over the 3 months before current (a UTC first-of-month), rounded
// half up, signed so a refund offsets another month's purchase (Outlook clamps at
// 0). rows are SpendRows, PostedOn being the CountsOn day. A month counts when it
// has any row, a Bill payment (Linked) or a Transfer included, so a month with no
// spend in the category is a 0 and months before the User's first data are not
// divided by. The sum leaves Linked rows out: the paid Bill is already in the
// other Bills. current is the real current month, not the month asked for.
//
// A registered Bill is in the other Bills too, but the bank rarely names it, so
// in each month every Bill also leaves out the Expense off the cards nearest
// its expected amount, within a tenth of it either way (billPaymentRows). A Linked
// row can be that nearest one, and then nothing more is left out.
//
// shortcut: a Bill is matched by amount alone, so a Bill varying more than a tenth (power) still counts twice and one can take an unrelated payment of the same size; upgrade when a Bill can name its Spending Category.
func plannedBaseline(rows []Txn, cards []Card, bills []Bill, current time.Time) map[string]int64 {
	first := monthIndex(current) - paceMonths
	counted := map[int]bool{}
	var window []Txn
	for _, t := range rows {
		if m := monthIndex(t.PostedOn); m >= first && m < monthIndex(current) {
			counted[m] = true
			window = append(window, t)
		}
	}
	out := map[string]int64{}
	if len(counted) == 0 {
		return out
	}
	paid := billPaymentRows(window, cards, bills)
	var spent []Txn
	for i, t := range window {
		if !t.Linked && !paid[i] {
			spent = append(spent, t)
		}
	}
	for c, sum := range MonthTotals(spent).ByCategory {
		out[c] = halfUp(sum, int64(len(counted)))
	}
	return out
}

// billPaymentRows marks, by index in rows, the Expense off the cards each Bill
// takes in each month: the nearest to its expected amount within a tenth of it,
// the earliest on a tie. A row pays one Bill, the first to take it.
func billPaymentRows(rows []Txn, cards []Card, bills []Bill) map[int]bool {
	isCard := map[string]bool{}
	for _, c := range cards {
		isCard[c.ID] = true
	}
	taken := map[int]bool{}
	months := map[int]bool{}
	for _, t := range rows {
		months[monthIndex(t.PostedOn)] = true
	}
	for _, b := range bills {
		for m := range months {
			best, gap := -1, b.ExpectedCents/10+1
			for i, t := range rows {
				if taken[i] || t.Type != "expense" || isCard[t.SourceID] || monthIndex(t.PostedOn) != m {
					continue
				}
				if g := abs(-t.AmountCents - b.ExpectedCents); g < gap || g == gap && best >= 0 && t.PostedOn.Before(rows[best].PostedOn) {
					best, gap = i, g
				}
			}
			if best >= 0 {
				taken[best] = true
			}
		}
	}
	return taken
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

// closingDrift is how many days a bank's closing may differ from the typed day.
const closingDrift = 7

// billSpan is the posted days [from, to) of a card's charges one bill holds; a zero to is open-ended.
type billSpan struct{ from, to time.Time }

func (s billSpan) holds(posted time.Time) bool {
	return !posted.Before(s.from) && (s.to.IsZero() || posted.Before(s.to))
}

// currentCardBill is the bill a card takes from the month today is in: the
// latest bill closed on or before today until it is paid or past due, then the
// open one, the charges posted on or after that closing (installments still to
// be charged are the caller's). The closing days are the bank's, or the typed
// ones without bank bills or when the bank has not reported the latest closing; a closed bill from typed days is its charges, with
// no total to tell it paid, so only its due day ends it. A card with neither
// keeps dueCardBill. span is the charges the bill holds (for a bank total, those
// since the closing before, or a month), zero when dueCardBill decided.
func currentCardBill(c Card, rows []Txn, today time.Time) (CardBill, billSpan) {
	out := CardBill{SourceID: c.ID, Name: c.Name, BillDaysKnown: c.BillDaysKnown}
	var last *StoredBill // the latest bank bill closed on or before today
	for _, b := range c.Bills {
		if !b.ClosesOn.After(today) && (last == nil || b.ClosesOn.After(last.ClosesOn)) {
			last = &b
		}
	}
	var closes time.Time // the latest typed closing on or before today
	if c.CloseDay > 0 && c.DueDay > 0 {
		if closes = DueDate(today.Year(), today.Month(), c.CloseDay); closes.After(today) {
			closes = DueDate(today.Year(), today.Month()-1, c.CloseDay)
		}
	}
	// Banks move a closing by a few days; a typed one a week past the bank's latest is a bill not reported yet.
	if last != nil && closes.After(last.ClosesOn.AddDate(0, 0, closingDrift)) {
		last = nil
	}
	var span billSpan
	switch {
	case last != nil && !last.Paid && !today.After(last.DueOn):
		out.AmountCents, out.FromBank, out.DueOn, out.ClosesOn = last.TotalCents, true, &last.DueOn, &last.ClosesOn
		span = billSpan{last.ClosesOn.AddDate(0, -1, 0), last.ClosesOn}
		for _, b := range c.Bills {
			if b.ClosesOn.Before(last.ClosesOn) && b.ClosesOn.After(span.from) {
				span.from = b.ClosesOn
			}
		}
		return out, span
	case last != nil:
		span.from = last.ClosesOn
	case !closes.IsZero():
		span.from = closes
		if due := CountsOn(closes.AddDate(0, 0, -1), "credit_card", c.CloseDay, c.DueDay); !today.After(due) {
			span = billSpan{DueDate(closes.Year(), closes.Month()-1, c.CloseDay), closes}
		}
	default:
		return dueCardBill(c, rows, billSpan{}, time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)), span
	}
	var held []Txn
	for _, t := range rows {
		if span.holds(t.Posted) {
			held = append(held, t)
		}
	}
	out.AmountCents = MonthTotals(held).Spend
	return out, span
}

// dueCardBill is a card's bill due in month m (a first-of-month): the bank's
// total when it reported one (ADR 0021), else the charges counting in m, only
// those posted on or after the closing of the latest bank bill due before m,
// and none the current month's bill already holds (taken).
func dueCardBill(c Card, rows []Txn, taken billSpan, m time.Time) CardBill {
	out := CardBill{SourceID: c.ID, Name: c.Name, BillDaysKnown: c.BillDaysKnown}
	var cutoff time.Time
	for _, b := range c.Bills {
		switch {
		case monthIndex(b.DueOn) == monthIndex(m):
			out.AmountCents, out.FromBank, out.DueOn, out.ClosesOn = b.TotalCents, true, &b.DueOn, &b.ClosesOn
			return out
		case monthIndex(b.DueOn) < monthIndex(m) && b.ClosesOn.After(cutoff):
			cutoff = b.ClosesOn
		}
	}
	var inMonth []Txn
	for _, t := range rows {
		if monthIndex(t.PostedOn) == monthIndex(m) && !t.Posted.Before(cutoff) && (taken.from.IsZero() || !taken.holds(t.Posted)) {
			inMonth = append(inMonth, t)
		}
	}
	out.AmountCents = MonthTotals(inMonth).Spend
	return out
}
