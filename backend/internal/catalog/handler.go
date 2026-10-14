package catalog

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const maxAnswersBody = 4 * 1024

// entryResponse is an Entry on the wire.
type entryResponse struct {
	ID string `json:"id"`
	chores.Fields
	PerRoom bool `json:"perRoom"`
}

// ServeEntries answers GET /catalog.
func ServeEntries(w http.ResponseWriter, _ *http.Request) {
	entries := []entryResponse{}
	for _, e := range Entries() {
		entries = append(entries, entryResponse{ID: e.ID, Fields: e.Fields, PerRoom: e.PerRoom})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

// ServeProposals turns the questionnaire into proposed Chores. It writes
// nothing, so it needs no Home.
func ServeProposals(w http.ResponseWriter, r *http.Request) {
	var a Answers
	if !httpx.DecodeBody(w, r, &a, maxAnswersBody, true) {
		return
	}
	if errs := ValidateAnswers(a); len(errs) > 0 {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid answers", "fields": errs})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"proposals": Propose(a)})
}
