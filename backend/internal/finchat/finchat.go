// Package finchat answers a User's question about their own Finances through
// the model and read-only tools (ADR 0027). It is the one place that sends
// amounts, dates and descriptions to the model, and only for Users on the
// finance allowlist.
//
// Sent: Transaction descriptions, amounts, dates, Spending Categories, Source
// display names, Notes, today's São Paulo date, the screen key, the locale and
// the conversation. Never sent: a description with a transfer word (PIX, TED,
// DOC, TRANSF...), which becomes a fixed label such as "Pix sent"; a Manual
// card's name or Pix recipient; row ids; credentials; another User's data. The
// User id comes from the token, never from the model. The conversation lives
// in the browser: nothing the User asked, the model answered or a tool
// returned is stored or logged. finance_chat_calls holds counts only, and chat
// rows in llm_call_events hold numbers and fixed vocabulary only.
//
// A tool that writes, or that reads outside the caller's Finances, needs a
// new ADR.
package finchat

import "time"

const (
	// DailyLimit is the questions a User may ask per São Paulo day, apart from
	// the Categorizer's and voice's allowances.
	DailyLimit = 20
	// MaxRounds is the tool rounds one question may take.
	MaxRounds = 4
)

// questionTimeout bounds one question, all its model calls together. The API
// Lambda stops at 25 s; the rest is for decoding, the reserve and the events.
// shortcut: fixed 20 s, move to config if staging shows it is wrong.
var questionTimeout = 20 * time.Second
