package admin

// Everything here is an aggregate or an opaque count: no email, name, user id
// or Chore title ever enters these types (a test walks the response keys).

// OverviewResponse is GET /admin/overview.
type OverviewResponse struct {
	Range  string `json:"range"`
	From   string `json:"from"`
	To     string `json:"to"`
	Totals Totals `json:"totals"`
	Active Active `json:"active"`
	Days   []Day  `json:"days"`
}

// Totals counts every row of four tables, whatever the range.
type Totals struct {
	Users     int `json:"users"`
	Homes     int `json:"homes"`
	Residents int `json:"residents"`
	Chores    int `json:"chores"`
}

// Active counts the Homes and Residents with a Check-in, Commitment or
// Completion in the range. Residents who left a Home are gone (their rows
// cascade), so this describes current Residents only.
type Active struct {
	Homes     int `json:"homes"`
	Residents int `json:"residents"`
}

// Day is one date of the range. Dates are the stored Home-local date where a
// table has one, otherwise UTC.
//
// Refuses and Takes are current state, not an event log: a refused Task that
// someone later Takes leaves the pool (take releases it), so Refuses is a
// lower bound. A replanned day (staging only) is deleted and recreated, so it
// counts once.
type Day struct {
	Date          string `json:"date"`
	Runs          int    `json:"runs"`
	Rejected      int    `json:"rejected"`
	Fallbacks     int    `json:"fallbacks"`
	Checkins      int    `json:"checkins"`
	Completions   int    `json:"completions"`
	Refuses       int    `json:"refuses"`
	Takes         int    `json:"takes"`
	SwapsAccepted int    `json:"swapsAccepted"`
	Pushes        Pushes `json:"pushes"`
}

// Pushes counts nudges by what the push service answered. Unknown is a NULL
// outcome: a row from before the column, a crash, or a send dropped by the
// tick's deadline. Both nudge kinds are counted together. Delivered means
// accepted by the push service, not shown on a phone.
type Pushes struct {
	Delivered int `json:"delivered"`
	Failed    int `json:"failed"`
	Gone      int `json:"gone"`
	Unknown   int `json:"unknown"`
}

// AIResponse is GET /admin/ai. Every cost is an estimate (CostIsEstimate): the
// Anthropic Console is the source of truth. Money is integer micro-USD
// (millionths of a dollar); the page formats it.
type AIResponse struct {
	Range          string      `json:"range"`
	From           string      `json:"from"`
	To             string      `json:"to"`
	CostIsEstimate bool        `json:"costIsEstimate"`
	Days           []AIDay     `json:"days"`
	MonthToDate    MonthToDate `json:"monthToDate"`
	// DailyCapPerHome is the cap the Allocation job enforces, shown as
	// configured on the API (same Terraform local).
	DailyCapPerHome    int              `json:"dailyCapPerHome"`
	AllocatorShare     AllocatorShare   `json:"allocatorShare"`
	ExplanationShare   ExplanationShare `json:"explanationShare"`
	TopViolationKinds  []KindCount      `json:"topViolationKinds"`
	TopFallbackReasons []ReasonCount    `json:"topFallbackReasons"`
}

// AIDay is one date of the range, a ServiceDay per LLM service.
type AIDay struct {
	Date     string     `json:"date"`
	Services AIServices `json:"services"`
}

// AIServices holds the two LLM services of the Allocation job.
type AIServices struct {
	Allocator ServiceDay `json:"allocator"`
	Explainer ServiceDay `json:"explainer"`
}

// ServiceDay is one service's llm_call_events on one local date.
//
// A "call" is a row with a latency: the model was asked. UncostedCalls counts
// those without an estimated cost (an unknown model, or no usage reported, as
// after a timeout). They add nothing to EstCostMicros, so the cost is a lower
// bound. The latency figures ignore rows with no latency (skips), and are null
// on a day with no calls.
type ServiceDay struct {
	Outcomes      Outcomes `json:"outcomes"`
	LatencyP50Ms  *float64 `json:"latencyP50Ms"`
	LatencyMaxMs  *int     `json:"latencyMaxMs"`
	InputTokens   int64    `json:"inputTokens"`
	OutputTokens  int64    `json:"outputTokens"`
	EstCostMicros int64    `json:"estCostMicros"`
	UncostedCalls int      `json:"uncostedCalls"`
}

// Outcomes counts llm_call_events by outcome.
type Outcomes struct {
	Accepted          int `json:"accepted"`
	RejectedByReferee int `json:"rejected_by_referee"`
	InvalidResponse   int `json:"invalid_response"`
	Timeout           int `json:"timeout"`
	Error             int `json:"error"`
	SkippedCap        int `json:"skipped_cap"`
	SkippedBudget     int `json:"skipped_budget"`
}

// MonthToDate is the estimated cost of the current calendar month, whatever
// the range. The month boundary is UTC, taken from the clock, because
// Anthropic bills by calendar month. LimitMicros is null when no limit is
// configured; it is the Console's limit as configured here, never enforced.
type MonthToDate struct {
	Month         string `json:"month"` // YYYY-MM
	EstCostMicros int64  `json:"estCostMicros"`
	UncostedCalls int    `json:"uncostedCalls"`
	LimitMicros   *int64 `json:"limitMicros"`
}

// AllocatorShare counts the planned runs of the range by who planned them:
// the LLM allocator, or everything else (the baseline, after a fallback or
// with the LLM off). Rejected runs are not planned and are not counted.
type AllocatorShare struct {
	LLM      int `json:"llm"`
	Baseline int `json:"baseline"`
}

// ExplanationShare counts Resident explanations of the planned runs of the
// range. LLM is "written by the LLM" (a stored day_plan_explanations row), not
// "shown": a stored text whose fingerprint later mismatches is shown as the
// template but still counts here. Template is every other (run, Resident)
// pair, and TemplateReasons splits it by why: the explainer outcomes other
// than accepted, "partial" and "notAsked", all always present. Assignments
// change after planning (Take, Swap), so Template is approximate.
type ExplanationShare struct {
	LLM             int             `json:"llm"`
	Template        int             `json:"template"`
	TemplateReasons TemplateReasons `json:"templateReasons"`
}

// TemplateReasons splits the Residents left on the template by why. The first
// six are the explainer outcomes (same keys as Outcomes); Partial is an
// accepted call that kept only some Residents; NotAsked is everyone the
// explainer never accounted for.
type TemplateReasons struct {
	RejectedByReferee int `json:"rejected_by_referee"`
	InvalidResponse   int `json:"invalid_response"`
	Timeout           int `json:"timeout"`
	Error             int `json:"error"`
	SkippedCap        int `json:"skipped_cap"`
	SkippedBudget     int `json:"skipped_budget"`
	Partial           int `json:"partial"`
	NotAsked          int `json:"notAsked"`
}

// KindCount is how many allocator calls in the range reported a violation kind.
type KindCount struct {
	Kind  string `json:"kind"`
	Count int    `json:"count"`
}

// ReasonCount is how many runs in the range fell back for a reason.
type ReasonCount struct {
	Reason string `json:"reason"`
	Count  int    `json:"count"`
}
