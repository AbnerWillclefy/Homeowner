package finance

import (
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// ReserveRequest is the body of PUT /me/finance/reserve; null clears the target.
type ReserveRequest struct {
	TargetCents *int64 `json:"targetCents"`
}

// ContributionRequest is the body of PUT /me/finance/contribution. Both fields
// are null to clear, or both set; a share of 0 and of 100 are valid.
type ContributionRequest struct {
	BaseCents           *int64 `json:"baseCents"`
	ReserveSharePercent *int16 `json:"reserveSharePercent"`
}

// ReserveProgress is the Emergency reserve in the savings answer. SavedCents is
// the sum of the Investments that serve it; TargetCents is null without a target,
// MonthCents is null without a Monthly contribution; ExpectedMonth ("YYYY-MM") is
// null then too, and also with no target or when not reached within 120 months.
type ReserveProgress struct {
	TargetCents   *int64  `json:"targetCents"`
	SavedCents    int64   `json:"savedCents"`
	MonthCents    *int64  `json:"monthCents"`
	ExpectedMonth *string `json:"expectedMonth"`
}

// SavingsGoal is a Goal in the savings answer. MonthCents and ExpectedMonth are
// null without a Monthly contribution; ExpectedMonth also when the Goal is not
// reached within 120 months.
type SavingsGoal struct {
	GoalResponse
	SavedCents    int64   `json:"savedCents"`
	MonthCents    *int64  `json:"monthCents"`
	ExpectedMonth *string `json:"expectedMonth"`
	Late          bool    `json:"late"`
}

// LeftoverExtra is given when the month's leftover is above the Base: MonthsSooner
// is how many months sooner the reserve, or the first unfilled Goal, is reached.
// MonthsSooner is null when nothing is left to fill or either date is beyond 120 months.
type LeftoverExtra struct {
	LeftoverCents int64 `json:"leftoverCents"`
	ExtraCents    int64 `json:"extraCents"`
	MonthsSooner  *int  `json:"monthsSooner"`
}

// OverLimitLine is a Spending Category over its Spending limit.
type OverLimitLine struct {
	Category  string `json:"category"`
	OverCents int64  `json:"overCents"`
}

// SavingsResponse answers GET /me/finance/savings. Goals are in the User's order.
// Leftover is set when the month's leftover is above the Base, OverLimit (an empty
// list when no category is over) when it is below; neither is set with no income,
// no Monthly contribution or a leftover equal to the Base.
type SavingsResponse struct {
	ReserveTargetCents    *int64               `json:"reserveTargetCents"`
	ContributionBaseCents *int64               `json:"contributionBaseCents"`
	ReserveSharePercent   *int16               `json:"reserveSharePercent"`
	Investments           []InvestmentResponse `json:"investments"`
	Reserve               ReserveProgress      `json:"reserve"`
	Goals                 []SavingsGoal        `json:"goals"`
	UnassignedCents       int64                `json:"unassignedCents"` // money no Goal takes
	Leftover              *LeftoverExtra       `json:"leftover,omitempty"`
	OverLimit             *[]OverLimitLine     `json:"overLimit,omitempty"`
}

// PutReserve answers PUT /me/finance/reserve: sets the Emergency reserve target, or clears it with null.
func (h *Handler) PutReserve(w http.ResponseWriter, r *http.Request) {
	var req ReserveRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	if v := req.TargetCents; v != nil && (*v <= 0 || *v > maxIncomeCents) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid reserve target")
		return
	}
	if err := h.store.SetReserveTarget(r.Context(), identity.CurrentUser(r.Context()).ID, req.TargetCents, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: set reserve target", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PutContribution answers PUT /me/finance/contribution: sets the Monthly
// contribution and the reserve's share of it, or clears both with nulls.
func (h *Handler) PutContribution(w http.ResponseWriter, r *http.Request) {
	var req ContributionRequest
	if !httpx.DecodeBody(w, r, &req, maxBodyBytes, true) {
		return
	}
	base, share := req.BaseCents, req.ReserveSharePercent
	if (base == nil) != (share == nil) ||
		(base != nil && (*base <= 0 || *base > maxIncomeCents)) ||
		(share != nil && (*share < 0 || *share > 100)) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid contribution")
		return
	}
	if err := h.store.SetContribution(r.Context(), identity.CurrentUser(r.Context()).ID, base, share, h.clk.Now()); err != nil {
		httpx.InternalError(w, h.log, "finance: set contribution", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Savings answers GET /me/finance/savings: the settings, the Investments and the
// Goals, with this month's suggestion. A User with no settings row gets nulls, never a 404.
// The reserve's saved amount is the sum of the Investments that serve it, the Goals' pot
// the sum of those that serve Goals. With no Monthly contribution the saved amounts are
// still given, with no monthly amounts or expected months. The leftover is the current
// month's of loadOutlook, the one Commitments gives; above the Base it gives the extra,
// below it the Spending Categories over their limit, and with no income or no Base neither.
func (h *Handler) Savings(w http.ResponseWriter, r *http.Request) {
	uid := identity.CurrentUser(r.Context()).ID
	reserve, base, share, err := h.store.SavingsSettings(r.Context(), uid)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read savings", err)
		return
	}
	investments, err := h.store.Investments(r.Context(), uid)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read investments", err)
		return
	}
	goals, err := h.store.Goals(r.Context(), uid)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read goals", err)
		return
	}
	today := postedOn(h.clk.Now())
	month := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	in, err := h.loadOutlook(r.Context(), uid, month, 1)
	if err != nil {
		httpx.InternalError(w, h.log, "finance: read savings outlook", err)
		return
	}
	var reserveSaved, goalsPot int64
	for _, i := range investments {
		if i.Serves == "reserve" {
			reserveSaved += i.ValueCents
		} else {
			goalsPot += i.ValueCents
		}
	}
	cin := ContributionIn{ReserveTarget: reserve, ReserveSaved: reserveSaved, GoalsPot: goalsPot, Now: month}
	planned := base != nil // without a Base there are no monthly amounts and no expected months
	if planned {
		cin.Base, cin.SharePercent = *base, int64(*share)
	}
	for _, g := range goals {
		cg := ContributionGoal{ID: g.ID, Target: g.TargetCents}
		if g.TargetMonth != nil {
			due, err := time.Parse("2006-01", *g.TargetMonth)
			if err != nil {
				httpx.InternalError(w, h.log, "finance: read goal month", err)
				return
			}
			cg.Due = &due
		}
		cin.Goals = append(cin.Goals, cg)
	}
	split := SplitContribution(cin)
	resp := SavingsResponse{
		ReserveTargetCents: reserve, ContributionBaseCents: base, ReserveSharePercent: share,
		Investments: investments, Goals: make([]SavingsGoal, len(goals)), UnassignedCents: split.Unassigned,
		Reserve: ReserveProgress{TargetCents: reserve, SavedCents: reserveSaved},
	}
	if planned {
		resp.Reserve.MonthCents, resp.Reserve.ExpectedMonth = &split.ReserveAmount, monthText(split.ReserveMonth)
	}
	for i, g := range goals {
		sg := SavingsGoal{GoalResponse: g, SavedCents: split.Goals[i].Saved}
		if planned {
			sg.MonthCents, sg.ExpectedMonth, sg.Late = &split.Goals[i].Amount, monthText(split.Goals[i].Month), split.Goals[i].Late
		}
		resp.Goals[i] = sg
	}
	if left := in.outlook[0].LeftoverCents; left != nil && planned {
		if extra, ok := Extra(cin, *left); ok {
			resp.Leftover = &LeftoverExtra{*left, extra.Extra, extra.MonthsSooner}
		} else if *left < *base {
			over := []OverLimitLine{}
			for _, c := range OverLimit(MonthTotals(in.rows).ByCategory, in.limits) {
				over = append(over, OverLimitLine(c))
			}
			resp.OverLimit = &over
		}
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}
