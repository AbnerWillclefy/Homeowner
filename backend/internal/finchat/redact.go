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
