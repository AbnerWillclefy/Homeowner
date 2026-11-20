package finance

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
)

// netWorthRanges are the series ranges in days; "1y" is the last 365 days, today included.
var netWorthRanges = map[string]int{"30d": 30, "90d": 90, "1y": 365}

// NetWorth answers GET /me/finance/net-worth?range=30d|90d|1y (default 30d) from NetWorthView.
func (h *Handler) NetWorth(w http.ResponseWriter, r *http.Request) {
	rng := r.URL.Query().Get("range")
	if rng == "" {
		rng = "30d"
	}
	res, err := h.NetWorthView(r.Context(), identity.CurrentUser(r.Context()).ID, rng)
	h.writeView(w, res, err)
}

// NetWorthView is userID's Net worth over `rng` (any other value than the keys of
// netWorthRanges is a BadParam): today's Net worth with its parts and a daily series of
// balances plus Investments. The card bills come from the month outlook of the
// current and next two months (a bill closing late can fall due two months on), those not yet past their due date (UnpaidCardBills).
// MonthStart and MonthChange (see NetWorthResponse) come from the same history, read from the earlier of the range start and the month start.
// Today's Investments come from each Investment's current value and the start from its history; they agree because every value change writes history.
func (h *Handler) NetWorthView(ctx context.Context, uid, rng string) (NetWorthResponse, error) {
	days, ok := netWorthRanges[rng]
	if !ok {
		return NetWorthResponse{}, errInvalidRange
	}
	today := postedOn(h.clk.Now())
	from := today.AddDate(0, 0, 1-days)
	month := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	startDay := month.AddDate(0, 0, -1)
	read := from
	if startDay.Before(read) {
		read = startDay
	}
	fail := func(err error) (NetWorthResponse, error) {
		return NetWorthResponse{}, fmt.Errorf("read net worth: %w", err)
	}

	balances, err := h.store.BalanceHistory(ctx, uid, read, today)
	if err != nil {
		return fail(err)
	}
	res := NetWorthResponse{Series: []NetWorthPoint{}, SeriesExcludesCardBills: true}
	if len(balances) == 0 {
		return res, nil
	}
	values, err := h.store.InvestmentValues(ctx, uid, read, today)
	if err != nil {
		return fail(err)
	}
	investments, err := h.store.Investments(ctx, uid)
	if err != nil {
		return fail(err)
	}
	in, err := h.loadOutlook(ctx, uid, month, 3)
	if err != nil {
		return fail(err)
	}
	var latest []int64
	for _, pts := range balances {
		latest = append(latest, pts[len(pts)-1].Value)
	}
	var held []int64
	for _, i := range investments {
		held = append(held, i.ValueCents)
	}
	n := NetWorth(latest, held, UnpaidCardBills(in.cards, in.outlook, month, today))
	res.HasData, res.Today = true, (*NetWorthToday)(&n)
	for _, p := range NetWorthSeries(balances, values, from, today) {
		res.Series = append(res.Series, NetWorthPoint{Day: p.Day.Format(time.DateOnly), Cents: p.Cents})
	}
	if s := MonthStart(balances, values, startDay); s != nil {
		res.MonthStart = &NetWorthStart{startDay.Format(time.DateOnly), s.BalancesCents, s.InvestmentsCents}
		b, i := n.BalancesCents-s.BalancesCents, n.InvestmentsCents-s.InvestmentsCents
		res.MonthChange = &NetWorthChange{b, i, b + i}
	}
	return res, nil
}
