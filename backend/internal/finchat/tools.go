package finchat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"slices"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

// tool is one read-only tool. run answers with a result for the model, or a
// toolErr the model is told about; a non-nil err is the database failing and
// ends the question. userID is the token's, never the model's.
type tool struct {
	name, description string
	schema            map[string]any
	run               func(ctx context.Context, h *Handler, userID string, raw json.RawMessage) (result any, toolErr string, err error)
	// result is a zero value of the allowlist struct run returns, so a test can
	// walk the fields the model may see.
	result any
}

// tools is the tool table. A new tool is a new row.
var tools = []tool{{
	name: "month",
	description: "One month of the User's finances: spending by category, what is committed, the spending limits, " +
		"the Leftover of the income, the planned spending still to come and every Transaction of the month. " +
		"Amounts are in cents; negative is money out.",
	schema: map[string]any{
		"type":                 "object",
		"properties":           map[string]any{"month": map[string]any{"type": "string", "description": "The month as YYYY-MM"}},
		"required":             []string{"month"},
		"additionalProperties": false,
	},
	run:    runMonth,
	result: monthResult{},
}, {
	name:        "history",
	description: "Income, spending, saving and the spending of each category for each of the last months months up to the month to. Amounts are in cents.",
	schema:      objectSchema(map[string]any{"to": monthProp("The last month, YYYY-MM"), "months": monthsProp("How many months, 1 to 12")}),
	run: runWith(`{"to":"YYYY-MM","months":1-12}`, func(ctx context.Context, h *Handler, uid string, in struct {
		To     string `json:"to"`
		Months int    `json:"months"`
	}) (any, error) {
		r, err := h.fin.HistoryView(ctx, uid, in.To, in.Months)
		return redactHistory(r), err
	}),
	result: historyResult{},
}, {
	name:        "daily",
	description: "The pace of a month's spending: the cumulative spend at the end of each day, this month, the month before and the usual pace. Amounts are in cents.",
	schema:      objectSchema(map[string]any{"month": monthProp("The month as YYYY-MM")}),
	run: runWith(`{"month":"YYYY-MM"}`, func(ctx context.Context, h *Handler, uid string, in struct {
		Month string `json:"month"`
	}) (any, error) {
		r, err := h.fin.DailyView(ctx, uid, in.Month)
		return redactDaily(r), err
	}),
	result: dailyResult{},
}, {
	name: "commitments",
	description: "What the User already owes, month by month from the month from, for months months: card bills, other Bills with whether each is paid, " +
		"the parts of Installment plans still to come, what is planned, the Leftover and the Daily allowance. Manual cards are named Manual card 1, 2... " +
		"Amounts are in cents. A year of it is very large: ask for 6 months or fewer unless the question needs more.",
	schema: objectSchema(map[string]any{"from": monthProp("The first month, YYYY-MM"), "months": monthsProp("How many months, 1 to 12")}),
	run: runWith(`{"from":"YYYY-MM","months":1-12}`, func(ctx context.Context, h *Handler, uid string, in struct {
		From   string `json:"from"`
		Months int    `json:"months"`
	}) (any, error) {
		if in.Months < 1 || in.Months > 12 {
			return nil, finance.BadParam("invalid months")
		}
		r, err := h.fin.CommitmentsView(ctx, uid, in.From)
		if err != nil {
			return nil, err
		}
		cards, err := h.store.fin.ManualCards(ctx, uid)
		return redactCommitments(r, in.Months, cards), err
	}),
	result: commitmentsResult{},
}, {
	name:        "bills",
	description: "The User's Bills in a month, each with its due date and whether it is paid. Amounts are in cents.",
	schema:      objectSchema(map[string]any{"month": monthProp("The month as YYYY-MM")}),
	run: runWith(`{"month":"YYYY-MM"}`, func(ctx context.Context, h *Handler, uid string, in struct {
		Month string `json:"month"`
	}) (any, error) {
		r, err := h.fin.BillsView(ctx, uid, in.Month)
		return redactBills(r), err
	}),
	result: billsResult{},
}, {
	name:        "card_bills",
	description: "The closed bills of each of the User's bank credit cards, with their average, for the last months months. Amounts are in cents. Manual cards are in commitments.",
	schema:      objectSchema(map[string]any{"months": monthsProp("How many months, 1 to 12; 6 is usual")}),
	run: runWith(`{"months":1-12}`, func(ctx context.Context, h *Handler, uid string, in struct {
		Months int `json:"months"`
	}) (any, error) {
		if in.Months < 1 || in.Months > 12 {
			return nil, finance.BadParam("invalid months")
		}
		cards, err := h.store.fin.CardSources(ctx, uid)
		if err != nil {
			return nil, err
		}
		out := cardBillsResult{Cards: []cardBillsView{}}
		for _, c := range cards {
			r, _, err := h.fin.PastCardBillsView(ctx, uid, c.ID, in.Months)
			if err != nil {
				return nil, err
			}
			out.Cards = append(out.Cards, redactPastBills(c.Name, r))
		}
		return out, nil
	}),
	result: cardBillsResult{},
}, {
	name: "savings",
	description: "The User's Goals with the amount saved, the Monthly contribution and how it is split, the Investments, the Emergency reserve " +
		"and when each is expected to be reached. Amounts are in cents.",
	schema: objectSchema(map[string]any{}),
	run: runWith(`{}`, func(ctx context.Context, h *Handler, uid string, _ struct{}) (any, error) {
		r, err := h.fin.SavingsView(ctx, uid)
		return redactSavings(r), err
	}),
	result: savingsResult{},
}, {
	name: "net_worth",
	description: "The User's Net worth today (balances plus Investments minus card bills) and how it changed since the start of the month. " +
		"The daily series is not available. Amounts are in cents.",
	schema: objectSchema(map[string]any{}),
	run: runWith(`{}`, func(ctx context.Context, h *Handler, uid string, _ struct{}) (any, error) {
		r, err := h.fin.NetWorthView(ctx, uid, "30d")
		return redactNetWorth(r), err
	}),
	result: netWorthResult{},
}}

// objectSchema is a strict schema in which every property is required.
func objectSchema(props map[string]any) map[string]any {
	required := make([]string, 0, len(props))
	for k := range props {
		required = append(required, k)
	}
	slices.Sort(required)
	return map[string]any{"type": "object", "properties": props, "required": required, "additionalProperties": false}
}

func monthProp(desc string) map[string]any {
	return map[string]any{"type": "string", "description": desc}
}

func monthsProp(desc string) map[string]any {
	return map[string]any{"type": "integer", "description": desc}
}

// runWith builds a tool's run from a typed read: it decodes the input strictly
// (usage is what the model is told on a bad one) and turns a BadParam into a
// tool error. Whatever else f returns is the database failing.
func runWith[In any](usage string, f func(ctx context.Context, h *Handler, userID string, in In) (any, error)) func(context.Context, *Handler, string, json.RawMessage) (any, string, error) {
	return func(ctx context.Context, h *Handler, userID string, raw json.RawMessage) (any, string, error) {
		var in In
		if !decodeInput(raw, &in) {
			return nil, "invalid input: expected " + usage, nil
		}
		res, err := f(ctx, h, userID, in)
		if bad, ok := errors.AsType[finance.BadParam](err); ok {
			return nil, string(bad) + ": expected " + usage, nil
		}
		return res, "", err
	}
}

func toolTable() []llmalloc.Tool {
	out := make([]llmalloc.Tool, len(tools))
	for i, t := range tools {
		out[i] = llmalloc.Tool{Name: t.name, Description: t.description, InputSchema: t.schema}
	}
	return out
}

// decodeInput decodes a tool input strictly: an argument the schema does not
// declare, such as a user_id the model made up, is an error.
func decodeInput(raw json.RawMessage, v any) bool {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	return dec.Decode(v) == nil
}

func runMonth(ctx context.Context, h *Handler, userID string, raw json.RawMessage) (any, string, error) {
	var in struct {
		Month string `json:"month"`
	}
	if !decodeInput(raw, &in) {
		return nil, `invalid input: expected {"month":"YYYY-MM"}`, nil
	}
	m, err := h.fin.MonthView(ctx, userID, in.Month)
	if err == nil {
		var c finance.CommitmentsResponse
		if c, err = h.fin.CommitmentsView(ctx, userID, in.Month); err == nil {
			var cards []finance.ManualCard
			if cards, err = h.store.fin.ManualCards(ctx, userID); err == nil {
				return redactMonth(m, c.Months[0], cards), "", nil
			}
		}
	}
	if _, ok := errors.AsType[finance.BadParam](err); ok {
		return nil, "invalid month: use YYYY-MM", nil
	}
	return nil, "", err
}
