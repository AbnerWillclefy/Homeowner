package voice

// interpretRequest is the body of POST /home/voice/interpret.
type interpretRequest struct {
	Transcript string `json:"transcript"`
	Locale     string `json:"locale"`
}

// Statuses of a Response.
const (
	statusOK                = "ok"
	statusNothingUnderstood = "nothing_understood"
	statusTooMany           = "too_many"
)

// Response is what the Resident is shown to confirm. Every field is fixed
// vocabulary, ids, Chore data or the Resident's own words turned into a
// validated Chore: the model's free text is never passed on.
type Response struct {
	Status    string   `json:"status"`
	Actions   []Action `json:"actions"`
	Remaining int      `json:"remaining"`
}

// Action is one proposal. With Candidates, Request and ChoreID are absent and
// each candidate is a fully resolved action of its own.
type Action struct {
	Kind       string       `json:"kind"`
	Request    *HTTPRequest `json:"request,omitempty"`
	ChoreID    string       `json:"choreId,omitempty"`
	ChoreName  string       `json:"choreName,omitempty"`
	Changed    []string     `json:"changed,omitempty"`
	Candidates []Action     `json:"candidates,omitempty"`
}

// HTTPRequest is the exact call the browser makes when the Resident confirms.
type HTTPRequest struct {
	Method string `json:"method"`
	Path   string `json:"path"`
	Body   any    `json:"body"`
}
