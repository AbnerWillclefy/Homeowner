package finance

import "time"

// Card is a credit card Source, with whether both its bill days are set and
// the bills its bank reported.
type Card struct {
	ID, Name      string
	BillDaysKnown bool
	Bills         []StoredBill
}

// StoredBill is a card bill as the bank reported it: the day it closed, the day
// it is due and its total, which may be negative (a credit balance).
type StoredBill struct {
	ClosesOn, DueOn time.Time
	TotalCents      int64
}

// CardBill is what one card's bill takes from a month.
type CardBill struct {
	SourceID, Name string
	AmountCents    int64
	BillDaysKnown  bool
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
// limits are the Spending limits by category; current is the first of the month
// "now" is in (zero when unknown), the only month with SpentOffCardCents.
// Planned for a category is its limit, or without a limit its baseline (the
// average of its spend in the 3 months before current, see plannedBaseline, the
// same for every month of the horizon; a negative one plans 0), minus what already counts for it in the
// month (every row, card or not, plus the installments still to come), the
// counted amount clamped at zero and the result too.
//
// contribution is the Monthly contribution (0 when none). Each month puts aside
// the larger of its actual saving (never below 0) and the contribution, so the
// two are never added: that is SavingCents, part of the total. SpentOffCardCents is the
// month's Expenses on Sources that are not cards, without those a Bill payment
// points to: the paid Bill is already in the other Bills.
//
// shortcut: a Bill in a category with a limit counts in both in future months, upgrade when a Bill can name its Spending Category.
//
// A card's bill is, when the bank reported a bill due in the month, that bill's
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
func Outlook(rows []Txn, cards []Card, plans []Plan, bills [][]MonthBill, income *int64, limits, baseline map[string]int64, contribution int64, current, from time.Time, months int) []MonthOutlook {
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
		for _, c := range cards {
			var closed *StoredBill // a bill due in the month
			var cutoff time.Time   // the latest closing of a bill due before the month
			for _, b := range c.Bills {
				switch {
				case monthIndex(b.DueOn) == monthIndex(m):
					closed = &b
				case monthIndex(b.DueOn) < monthIndex(m) && b.ClosesOn.After(cutoff):
					cutoff = b.ClosesOn
				}
			}
			var amount int64
			if closed != nil {
				amount = closed.TotalCents
			} else {
				var inMonth []Txn
				for _, t := range byCard[c.ID] {
					if monthIndex(t.PostedOn) == monthIndex(m) && (cutoff.IsZero() || !t.Posted.Before(cutoff)) {
						inMonth = append(inMonth, t)
					}
				}
				amount = MonthTotals(inMonth).Spend
				if owed[c.ID] != nil {
					amount += owed[c.ID][i]
				}
			}
			o.Cards = append(o.Cards, CardBill{c.ID, c.Name, amount, c.BillDaysKnown})
			o.TotalCents += amount
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
		if monthIndex(m) == monthIndex(current) {
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
func plannedBaseline(rows []Txn, current time.Time) map[string]int64 {
	first := monthIndex(current) - paceMonths
	counted := map[int]bool{}
	var spent []Txn
	for _, t := range rows {
		if m := monthIndex(t.PostedOn); m >= first && m < monthIndex(current) {
			counted[m] = true
			if !t.Linked {
				spent = append(spent, t)
			}
		}
	}
	out := map[string]int64{}
	if len(counted) == 0 {
		return out
	}
	for c, sum := range MonthTotals(spent).ByCategory {
		out[c] = halfUp(sum, int64(len(counted)))
	}
	return out
}
