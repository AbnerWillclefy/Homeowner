package finchat

import (
	"strconv"
	"strings"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

// transferWord is the label of a transfer word, "" for any other word.
func transferWord(w string) string {
	switch {
	case w == "PIX":
		return "Pix"
	case w == "TED" || w == "DOC":
		return w
	case strings.HasPrefix(w, "TRANSF"):
		return "Transfer"
	}
	return ""
}

// transferLabel is the fixed label for a description whose key holds a
// transfer word, chosen by the first such word and the amount's sign; "" when
// it holds none. Sendable decides whether there is one, so the rule stays in
// one place with the Categorizer's.
func transferLabel(key string, amountCents int64) string {
	if llmalloc.Sendable(key) || key == "" {
		return ""
	}
	dir := "received"
	if amountCents < 0 {
		dir = "sent"
	}
	for _, w := range strings.Fields(key) {
		if l := transferWord(w); l != "" {
			return l + " " + dir
		}
	}
	return ""
}

// redactDescription is the only way a description reaches the model: a
// transfer becomes a fixed label, a payment to a Manual card becomes "Manual
// card N payment", anything else goes as it is.
func redactDescription(description string, amountCents int64, cards []finance.ManualCard) string {
	key := finance.MerchantKey(description)
	if l := transferLabel(key, amountCents); l != "" {
		return l
	}
	for i, c := range cards {
		for _, name := range []string{c.Name, deref(c.PixRecipient)} {
			if k := finance.MerchantKey(name); k != "" && strings.Contains(key, k) {
				return "Manual card " + strconv.Itoa(i+1) + " payment"
			}
		}
	}
	return description
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// What the model sees of a month. Each struct lists its fields: a field added
// to a finance DTO later does not reach the model until someone adds it here.
type (
	monthResult struct {
		Month                string           `json:"month"`
		SpentCents           int64            `json:"spentCents"`
		CommittedCents       int64            `json:"committedCents"`
		SpentSinceFirstCents int64            `json:"spentSinceFirstCents"`
		LimitsCents          map[string]int64 `json:"limitsCents"`
		Categories           []categoryView   `json:"categories"`
		LeftoverCents        *int64           `json:"leftoverCents,omitempty"`
		PaceLeftoverCents    *int64           `json:"paceLeftoverCents,omitempty"`
		Planned              []plannedView    `json:"planned"`
		Transactions         []txnView        `json:"transactions"`
	}
	categoryView struct {
		Category   string `json:"category"`
		SpentCents int64  `json:"spentCents"`
	}
	plannedView struct {
		Category string `json:"category"`
		Cents    int64  `json:"cents"`
	}
	txnView struct {
		PostedOn         string  `json:"postedOn"`
		CountsOn         string  `json:"countsOn"`
		Description      string  `json:"description"`
		AmountCents      int64   `json:"amountCents"`
		Type             string  `json:"type"`
		SpendingCategory *string `json:"spendingCategory"`
		SourceName       string  `json:"sourceName"`
		Installment      string  `json:"installment,omitempty"`
		Note             *string `json:"note"`
	}
)

// redactMonth turns a month view and its Commitments entry into what the
// model sees. It is the single redaction step of the month tool.
func redactMonth(m finance.MonthResponse, c finance.MonthCommitment, cards []finance.ManualCard) monthResult {
	out := monthResult{Month: m.Month, SpentCents: m.SpentCents, CommittedCents: m.CommittedCents,
		SpentSinceFirstCents: m.SpentSinceFirstCents, LimitsCents: m.Limits,
		Categories: []categoryView{}, Planned: []plannedView{}, Transactions: []txnView{},
		LeftoverCents: c.LeftoverCents, PaceLeftoverCents: c.PaceLeftoverCents}
	for _, k := range m.Categories {
		out.Categories = append(out.Categories, categoryView{k.Category, k.SpentCents})
	}
	for _, p := range c.Planned {
		out.Planned = append(out.Planned, plannedView{p.Category, p.Cents})
	}
	for _, t := range m.Transactions {
		v := txnView{PostedOn: t.PostedOn, CountsOn: t.CountsOn, Description: redactDescription(t.Description, t.AmountCents, cards),
			AmountCents: t.AmountCents, Type: t.Type, SpendingCategory: t.SpendingCategory, SourceName: t.SourceName, Note: t.Note}
		if i := t.Installment; i != nil {
			v.Installment = strconv.Itoa(i.Number) + "/" + strconv.Itoa(i.Total)
		}
		out.Transactions = append(out.Transactions, v)
	}
	return out
}

// What the model sees of the other tools, by the same rule: only the fields
// listed here are sent, never an id, a Pix recipient or a bank connection.
type (
	historyResult struct {
		Months []historyMonthView `json:"months"`
	}
	historyMonthView struct {
		Month       string         `json:"month"`
		IncomeCents int64          `json:"incomeCents"`
		SpentCents  int64          `json:"spentCents"`
		SavedCents  int64          `json:"savedCents"`
		Categories  []categoryView `json:"categories"`
	}
	dailyResult struct {
		Month         string  `json:"month"`
		Days          int     `json:"days"`
		Current       []int64 `json:"current"`
		Previous      []int64 `json:"previous"`
		Average       []int64 `json:"average"`
		AverageMonths int     `json:"averageMonths"`
	}
	commitmentsResult struct {
		MonthlyIncomeCents *int64                `json:"monthlyIncomeCents,omitempty"`
		Months             []commitmentMonthView `json:"months"`
	}
	commitmentMonthView struct {
		Month               string            `json:"month"`
		Cards               []cardLineView    `json:"cards"`
		OtherBills          []otherBillView   `json:"otherBills"`
		Installments        []installmentView `json:"installments"`
		Planned             []plannedView     `json:"planned"`
		PlannedCents        int64             `json:"plannedCents"`
		SavingCents         int64             `json:"savingCents"`
		TotalCents          int64             `json:"totalCents"`
		LeftoverCents       *int64            `json:"leftoverCents,omitempty"`
		PaceLeftoverCents   *int64            `json:"paceLeftoverCents,omitempty"`
		DailyAllowanceCents *int64            `json:"dailyAllowanceCents,omitempty"`
	}
	cardLineView struct {
		Name        string  `json:"name"`
		AmountCents int64   `json:"amountCents"`
		DueOn       *string `json:"dueOn"`
		ClosesOn    *string `json:"closesOn"`
		Closed      bool    `json:"closed"`
		Manual      bool    `json:"manual"`
	}
	otherBillView struct {
		Name  string `json:"name"`
		Cents int64  `json:"cents"`
		Paid  bool   `json:"paid"`
	}
	installmentView struct {
		Name        string `json:"name"`
		Number      int    `json:"number"`
		Total       int    `json:"total"`
		AmountCents int64  `json:"amountCents"`
	}
	billsResult struct {
		Bills []billView `json:"bills"`
	}
	billView struct {
		Name          string  `json:"name"`
		ExpectedCents int64   `json:"expectedCents"`
		DueDate       string  `json:"dueDate"`
		Paid          bool    `json:"paid"`
		PaidBy        *string `json:"paidBy"`
		PaidCents     *int64  `json:"paidCents"`
	}
	cardBillsResult struct {
		Cards []cardBillsView `json:"cards"`
	}
	cardBillsView struct {
		Name         string         `json:"name"`
		Bills        []pastBillView `json:"bills"`
		AverageCents *int64         `json:"averageCents"`
	}
	pastBillView struct {
		ClosesOn   string `json:"closesOn"`
		DueOn      string `json:"dueOn"`
		TotalCents int64  `json:"totalCents"`
	}
	savingsResult struct {
		ContributionBaseCents *int64           `json:"contributionBaseCents"`
		ReserveSharePercent   *int16           `json:"reserveSharePercent"`
		Reserve               reserveView      `json:"reserve"`
		Goals                 []goalView       `json:"goals"`
		Investments           []investmentView `json:"investments"`
		UnassignedCents       int64            `json:"unassignedCents"`
		Leftover              *leftoverView    `json:"leftover,omitempty"`
		OverLimit             *[]overLimitView `json:"overLimit,omitempty"`
	}
	reserveView struct {
		TargetCents   *int64  `json:"targetCents"`
		SavedCents    int64   `json:"savedCents"`
		MonthCents    *int64  `json:"monthCents"`
		ExpectedMonth *string `json:"expectedMonth"`
	}
	goalView struct {
		Name          string  `json:"name"`
		TargetCents   int64   `json:"targetCents"`
		TargetMonth   *string `json:"targetMonth"`
		SavedCents    int64   `json:"savedCents"`
		MonthCents    *int64  `json:"monthCents"`
		ExpectedMonth *string `json:"expectedMonth"`
		Late          bool    `json:"late"`
	}
	investmentView struct {
		Name       string  `json:"name"`
		ValueCents int64   `json:"valueCents"`
		Serves     *string `json:"serves"`
		Source     string  `json:"source"` // "bank" or "hand"
	}
	leftoverView struct {
		LeftoverCents int64 `json:"leftoverCents"`
		ExtraCents    int64 `json:"extraCents"`
		MonthsSooner  *int  `json:"monthsSooner"`
	}
	overLimitView struct {
		Category  string `json:"category"`
		OverCents int64  `json:"overCents"`
	}
	netWorthResult struct {
		Today       *netWorthToday  `json:"today"`
		MonthStart  *netWorthStart  `json:"monthStart"`
		MonthChange *netWorthChange `json:"monthChange"`
	}
	netWorthToday struct {
		TotalCents       int64 `json:"totalCents"`
		BalancesCents    int64 `json:"balancesCents"`
		InvestmentsCents int64 `json:"investmentsCents"`
		CardBillsCents   int64 `json:"cardBillsCents"`
	}
	netWorthStart struct {
		Day              string `json:"day"`
		BalancesCents    int64  `json:"balancesCents"`
		InvestmentsCents int64  `json:"investmentsCents"`
	}
	netWorthChange struct {
		BalancesCents    int64 `json:"balancesCents"`
		InvestmentsCents int64 `json:"investmentsCents"`
		TotalCents       int64 `json:"totalCents"`
	}
)

func redactHistory(h finance.HistoryResponse) historyResult {
	out := historyResult{Months: []historyMonthView{}}
	for _, m := range h.Months {
		v := historyMonthView{Month: m.Month, IncomeCents: m.IncomeCents, SpentCents: m.SpentCents, SavedCents: m.SavedCents, Categories: []categoryView{}}
		for _, c := range m.Categories {
			v.Categories = append(v.Categories, categoryView{c.Category, c.SpentCents})
		}
		out.Months = append(out.Months, v)
	}
	return out
}

func redactDaily(d finance.DailyResponse) dailyResult {
	return dailyResult{d.Month, d.Days, d.Current, d.Previous, d.Average, d.AverageMonths}
}

// redactCommitments keeps the first months entries. A Manual card's name
// becomes "Manual card N" and a plan's name goes through redactDescription,
// since it is a card Transaction's description.
func redactCommitments(c finance.CommitmentsResponse, months int, cards []finance.ManualCard) commitmentsResult {
	out := commitmentsResult{MonthlyIncomeCents: c.MonthlyIncomeCents, Months: []commitmentMonthView{}}
	for _, m := range c.Months[:min(months, len(c.Months))] {
		v := commitmentMonthView{Month: m.Month, Cards: []cardLineView{}, OtherBills: []otherBillView{}, Installments: []installmentView{},
			Planned: []plannedView{}, PlannedCents: m.PlannedCents, SavingCents: m.SavingCents, TotalCents: m.TotalCents,
			LeftoverCents: m.LeftoverCents, PaceLeftoverCents: m.PaceLeftoverCents, DailyAllowanceCents: m.DailyAllowanceCents}
		for _, l := range m.Cards {
			name := l.Name
			if l.Manual {
				name = manualCardName(cards, l.SourceID)
			}
			v.Cards = append(v.Cards, cardLineView{name, l.AmountCents, l.DueOn, l.ClosesOn, l.Closed, l.Manual})
		}
		for _, b := range m.OtherBills {
			v.OtherBills = append(v.OtherBills, otherBillView{b.Name, b.Cents, b.Paid})
		}
		for _, i := range m.Installments {
			v.Installments = append(v.Installments, installmentView{redactDescription(i.Name, -i.AmountCents, cards), i.Number, i.Total, i.AmountCents})
		}
		for _, p := range m.Planned {
			v.Planned = append(v.Planned, plannedView{p.Category, p.Cents})
		}
		out.Months = append(out.Months, v)
	}
	return out
}

// manualCardName is "Manual card N", N being the card's place in cards; a card
// not found there is still never sent by its name.
func manualCardName(cards []finance.ManualCard, id string) string {
	for i, c := range cards {
		if c.ID == id {
			return "Manual card " + strconv.Itoa(i+1)
		}
	}
	return "Manual card"
}

func redactBills(bills []finance.MonthBill) billsResult {
	out := billsResult{Bills: []billView{}}
	for _, b := range bills {
		out.Bills = append(out.Bills, billView{b.Name, b.ExpectedCents, b.DueDate, b.Paid, b.PaidBy, b.PaidCents})
	}
	return out
}

func redactPastBills(name string, r finance.PastCardBillsResponse) cardBillsView {
	v := cardBillsView{Name: name, Bills: []pastBillView{}, AverageCents: r.AverageCents}
	for _, b := range r.Bills {
		v.Bills = append(v.Bills, pastBillView{b.ClosesOn, b.DueOn, b.TotalCents})
	}
	return v
}

func redactSavings(s finance.SavingsResponse) savingsResult {
	out := savingsResult{ContributionBaseCents: s.ContributionBaseCents, ReserveSharePercent: s.ReserveSharePercent,
		Reserve: reserveView(s.Reserve), Goals: []goalView{}, Investments: []investmentView{}, UnassignedCents: s.UnassignedCents}
	for _, g := range s.Goals {
		out.Goals = append(out.Goals, goalView{g.Name, g.TargetCents, g.TargetMonth, g.SavedCents, g.MonthCents, g.ExpectedMonth, g.Late})
	}
	for _, i := range s.Investments {
		out.Investments = append(out.Investments, investmentView{i.Name, i.ValueCents, i.Serves, i.Source})
	}
	if l := s.Leftover; l != nil {
		out.Leftover = &leftoverView{l.LeftoverCents, l.ExtraCents, l.MonthsSooner}
	}
	if o := s.OverLimit; o != nil {
		lines := []overLimitView{}
		for _, l := range *o {
			lines = append(lines, overLimitView{l.Category, l.OverCents})
		}
		out.OverLimit = &lines
	}
	return out
}

// redactNetWorth drops the daily series: it is the largest part and the
// questions are about today and the month's change.
func redactNetWorth(n finance.NetWorthResponse) netWorthResult {
	var out netWorthResult
	if t := n.Today; t != nil {
		v := netWorthToday(*t)
		out.Today = &v
	}
	if s := n.MonthStart; s != nil {
		out.MonthStart = &netWorthStart{s.Day, s.BalancesCents, s.InvestmentsCents}
	}
	if c := n.MonthChange; c != nil {
		v := netWorthChange(*c)
		out.MonthChange = &v
	}
	return out
}
