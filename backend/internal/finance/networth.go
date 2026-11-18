package finance

import "time"

// NetWorthParts is today's Net worth with its three parts, so they always add up.
type NetWorthParts struct {
	TotalCents, BalancesCents, InvestmentsCents, CardBillsCents int64
}

// NetWorth is Source balances + Investments - card bills not yet paid. Card
// Sources' own balances are never stored (UpsertBalances skips them), so
// nothing is subtracted twice.
func NetWorth(balances, investments, cardBills []int64) NetWorthParts {
	var n NetWorthParts
	for _, v := range balances {
		n.BalancesCents += v
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
// starting at `from`) that count as not yet paid on `today`. The month today is
// in always counts: Outlook gives it the bill still to pay. A later month's
// bill counts until its due date passes: the due date of the bill the bank
// reported for it, else the card's due day. A paid
// bill leaves a checking balance, so counting it after that would subtract it twice.
// A later month holds the bill due the card's shift after it (Outlook: the months from
// the current month to the due month of the bill it counts, read from the current month's
// Cycles), so both checks use that due month.
//
// A bill that has not opened yet holds only future installments, so with both
// bill days known a month whose bill is due after the open bill's due month is skipped.
//
// shortcut: a card with neither a reported bill nor a due day counts only its first month, upgrade when a bill payment can be matched to its card.
func UnpaidCardBills(cards []Card, outlook []MonthOutlook, from, today time.Time) []int64 {
	var out []int64
	var cycles map[string]BillCycle // the current month's, when the outlook has it
	if cur := monthIndex(today) - monthIndex(from); cur >= 0 && cur < len(outlook) {
		cycles = outlook[cur].Cycles
	}
	for i, m := range outlook {
		month := from.AddDate(0, i, 0)
		for _, cb := range m.Cards {
			for _, c := range cards {
				if c.ID != cb.SourceID {
					continue
				}
				if monthIndex(month) == monthIndex(today) { // Outlook's current bill is the one still to pay
					out = append(out, cb.AmountCents)
					continue
				}
				dueMonth := month
				if on := cycles[c.ID].DueOn; on != nil {
					dueMonth = month.AddDate(0, max(0, monthIndex(*on)-monthIndex(today)), 0)
				}
				if c.CloseDay > 0 && c.DueDay > 0 && monthIndex(dueMonth) > monthIndex(CountsOn(today, "credit_card", c.CloseDay, c.DueDay)) {
					continue
				}
				due, known := cardDue(c, dueMonth)
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

// MonthStartParts is the balances and Investments the month started with.
type MonthStartParts struct{ BalancesCents, InvestmentsCents int64 }

// MonthStart sums each Source's and Investment's value on `day` (the last day of
// the previous month): the last value on or before it. One with no value by then
// (a bank connected, an Investment created this month) counts its first stored
// value, so connecting it does not show as growth. It is nil when nothing has a
// value. Card bills are not part of it: past days' bills are not stored.
func MonthStart(balances, investments map[string][]Point[int64], day time.Time) *MonthStartParts {
	var out MonthStartParts
	seen := false
	for _, g := range []struct {
		pts map[string][]Point[int64]
		sum *int64
	}{{balances, &out.BalancesCents}, {investments, &out.InvestmentsCents}} {
		for _, pts := range g.pts {
			if len(pts) == 0 {
				continue
			}
			seen = true
			v := pts[0].Value
			for _, p := range pts {
				if p.Day.After(day) {
					break
				}
				v = p.Value
			}
			*g.sum += v
		}
	}
	if !seen {
		return nil
	}
	return &out
}
