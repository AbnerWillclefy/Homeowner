// Package evals compares the LLM allocator with the baseline on a dataset of
// synthetic days (ADR 0004). It works at the Allocation seam: per day it builds
// an allocation.State, asks each allocator for a Result and measures it, with
// allocation.Check as the only judge of violations. It never touches Postgres,
// dayplan or HTTP, and it does not wire in the production fallback: a raw LLM
// proposal that breaks a rule is counted, not hidden.
//
// The evals are a report, not a gate, and they cost money, so they run only
// through cmd/evals, never inside go test. See cmd/evals for the flags.
package evals
