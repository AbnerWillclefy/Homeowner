// Package voice interprets a Resident's spoken command. Unlike the Allocator
// and the Explainer, it sends the model Chore titles and the Resident's words,
// behind a Resident confirmation (ADR 0020). It never sends Energy,
// Restrictions, Preferences, Check-ins, Resident names or another Home. A
// transcript is neither stored nor logged; voice_calls and voice rows in
// llm_call_events hold ids, counts and fixed vocabulary only.
//
// A later tool that reads data or acts without confirmation, or an MCP
// server, needs a new ADR.
package voice

// DailyLimit is the voice calls a Resident may make per local day, apart from
// the Home's allocator and explanation calls.
const DailyLimit = 20
