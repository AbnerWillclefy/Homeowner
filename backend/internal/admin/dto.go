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
