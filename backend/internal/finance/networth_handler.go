package finance

import (
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// netWorthRanges are the series ranges in days; "1y" is the last 365 days, today included.
var netWorthRanges = map[string]int{"30d": 30, "90d": 90, "1y": 365}

// NetWorth answers GET /me/finance/net-worth?range=30d|90d|1y (default 30d; any
// other value is 400): today's Net worth with its parts and a daily series of
// balances plus Investments. The card bills come from the month outlook of the
// current and next two months (a bill closing late can fall due two months on), those not yet past their due date (UnpaidCardBills).
func (h *Handler) NetWorth(w http.ResponseWriter, r *http.Request) {
	rng := r.URL.Query().Get("range")
	if rng == "" {
		rng = "30d"
	}
	days, ok := netWorthRanges[rng]
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid range")
		return
	}
	ctx, uid := r.Context(), identity.CurrentUser(r.Context()).ID
	today := postedOn(h.clk.Now())
	from := today.AddDate(0, 0, 1-days)
	month := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	fail := func(err error) { httpx.InternalError(w, h.log, "finance: read net worth", err) }

	balances, err := h.store.BalanceHistory(ctx, uid, from, today)
	if err != nil {
		fail(err)
		return
	}
	res := NetWorthResponse{Series: []NetWorthPoint{}, SeriesExcludesCardBills: true}
	if len(balances) == 0 {
		httpx.WriteJSON(w, http.StatusOK, res)
		return
	}
	values, err := h.store.InvestmentValues(ctx, uid, from, today)
	if err != nil {
		fail(err)
		return
	}
	investments, err := h.store.Investments(ctx, uid)
	if err != nil {
		fail(err)
		return
	}
	in, err := h.loadOutlook(ctx, uid, month, 3)
	if err != nil {
		fail(err)
		return
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
	httpx.WriteJSON(w, http.StatusOK, res)
}
