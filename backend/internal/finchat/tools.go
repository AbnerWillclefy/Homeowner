package finchat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"

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
	run: runMonth,
}}

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
