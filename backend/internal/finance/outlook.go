package finance

import "time"

// Card is a credit card Source, with whether both its bill days are set.
type Card struct {
	ID, Name      string
	BillDaysKnown bool
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
	TotalCents             int64
	// LeftoverCents is income minus total; nil when no income is set.
	LeftoverCents *int64
}

// Outlook works out `months` months from `from` (a UTC first-of-month). rows
// are the counted Txns (PostedOn is the CountsOn day), plans the Installment
// plans and bills[i] every Bill of month i, paid or not.
//
// A card's bill is its Expenses counting in the month plus the installments of
// its plans numbered above Plan.Number due in it; ProjectInstallments is not
// used because it emits the latest charge again when it is on a bill not yet
// due, and that charge is already in rows. A plan on a Source that is not a
// card stays in OtherInstallmentsCents. A Bill whose month was paid with a card
// Transaction is left out: that money is in a card bill.
//
// shortcut: a card-paid Bill counts twice in the current month until its charge posts (last month's charge is in this month's card bill, this month's is still expected), upgrade when the PWA shows it.
func Outlook(rows []Txn, cards []Card, plans []Plan, bills [][]MonthBill, income *int64, from time.Time, months int) []MonthOutlook {
	byCard := map[string][]Txn{}
	for _, t := range rows {
		byCard[t.SourceID] = append(byCard[t.SourceID], t)
	}
	var loose []Plan
	owed := map[string][]int64{} // card id -> installments owed per month
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
			}
		}
	}
	other := ProjectInstallments(loose, from, months)
	out := make([]MonthOutlook, months)
	for i := range out {
		m := from.AddDate(0, i, 0)
		o := MonthOutlook{Cards: []CardBill{}, OtherBills: []OtherBill{}}
		for _, c := range cards {
			var inMonth []Txn
			for _, t := range byCard[c.ID] {
				if monthIndex(t.PostedOn) == monthIndex(m) {
					inMonth = append(inMonth, t)
				}
			}
			amount := MonthTotals(inMonth).Spend
			if owed[c.ID] != nil {
				amount += owed[c.ID][i]
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
		if income != nil { // income <= maxIncomeCents, so the subtraction cannot overflow
			left := *income - o.TotalCents
			o.LeftoverCents = &left
		}
		out[i] = o
	}
	return out
}
