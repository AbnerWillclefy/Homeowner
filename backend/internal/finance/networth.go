package finance

import "time"

// SourceBalance is a Source's latest balance; Card marks a credit card Source,
// whose balance Net worth never counts (its bill is subtracted instead).
type SourceBalance struct {
	Card  bool
	Cents int64
}

// NetWorthParts is today's Net worth with its three parts, so they always add up.
type NetWorthParts struct {
	TotalCents, BalancesCents, InvestmentsCents, CardBillsCents int64
}

// NetWorth is Source balances + Investments - card bills not yet paid. Card
// Sources' own balances are left out so nothing is subtracted twice.
func NetWorth(balances []SourceBalance, investments, cardBills []int64) NetWorthParts {
	var n NetWorthParts
	for _, b := range balances {
		if !b.Card {
			n.BalancesCents += b.Cents
		}
	}
	for _, v := range investments {
		n.InvestmentsCents += v
	}
	for _, v := range cardBills {
		n.CardBillsCents += v
	}
	n.TotalCents = n.BalancesCents + n.InvestmentsCents - n.CardBillsCents
	return n
}

// UnpaidCardBills lists the card bill amounts of the Outlook months (the first
// starting at `from`) that count as not yet paid on `today`. Nothing records a
// card bill as paid, so a bill counts until its due date passes: the due date
// of the bill the bank reported for the month, else the card's due day. A paid
// bill leaves a checking balance, so counting it after that would subtract it twice.
//
// shortcut: a card with neither a reported bill nor a due day counts only its first month, upgrade when a bill payment can be matched to its card.
func UnpaidCardBills(cards []Card, outlook []MonthOutlook, from, today time.Time) []int64 {
	var out []int64
	for i, m := range outlook {
		month := from.AddDate(0, i, 0)
		for _, cb := range m.Cards {
			for _, c := range cards {
				if c.ID != cb.SourceID {
					continue
				}
				due, known := cardDue(c, month)
				if (known && !due.Before(today)) || (!known && i == 0) {
					out = append(out, cb.AmountCents)
				}
			}
		}
	}
	return out
}

// cardDue is the due date of the card's bill for the month: the reported one, else from the due day.
func cardDue(c Card, month time.Time) (time.Time, bool) {
	for _, b := range c.Bills {
		if monthIndex(b.DueOn) == monthIndex(month) {
			return b.DueOn, true
		}
	}
	if c.DueDay > 0 {
		return DueDate(month.Year(), month.Month(), c.DueDay), true
	}
	return time.Time{}, false
}

// SeriesPoint is one day of the Net worth series.
type SeriesPoint struct {
	Day   time.Time
	Cents int64
}

// NetWorthSeries gives one point per day from..to: the carried-forward balances
// plus Investments. A day before every stored value has no point, and a value
// counts from its first stored day. Card bills are left out: past days' bills
// are not stored.
func NetWorthSeries(balances, investments map[string][]Point[int64], from, to time.Time) []SeriesPoint {
	out := []SeriesPoint{}
	var days [][]*int64
	for _, group := range []map[string][]Point[int64]{balances, investments} {
		for _, pts := range group {
			days = append(days, CarryForward(pts, from, to))
		}
	}
	for i := 0; ; i++ {
		day := from.AddDate(0, 0, i)
		if day.After(to) {
			return out
		}
		var sum int64
		seen := false
		for _, d := range days {
			if d[i] != nil {
				sum, seen = sum+*d[i], true
			}
		}
		if seen {
			out = append(out, SeriesPoint{day, sum})
		}
	}
}
