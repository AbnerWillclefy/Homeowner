package server

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/catalog"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

const maxAnswersBody = 4 * 1024

// catalogEntry is an Entry on the wire.
type catalogEntry struct {
	ID string `json:"id"`
	chores.Fields
	PerRoom bool `json:"perRoom"`
}

func (s *server) getCatalog(w http.ResponseWriter, r *http.Request) {
	entries := []catalogEntry{}
	for _, e := range catalog.Entries() {
		entries = append(entries, catalogEntry{ID: e.ID, Fields: e.Fields, PerRoom: e.PerRoom})
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

// postProposals turns the questionnaire into proposed Chores. It writes
// nothing, so it needs no Home.
func (s *server) postProposals(w http.ResponseWriter, r *http.Request) {
	var a catalog.Answers
	if !decodeBody(w, r, &a, maxAnswersBody, true) {
		return
	}
	if errs := catalog.ValidateAnswers(a); len(errs) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid answers", "fields": errs})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"proposals": catalog.Propose(a)})
}
