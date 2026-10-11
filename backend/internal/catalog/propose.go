package catalog

import (
	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

// Proposal is a Chore the answers call for. Instance is 1-based when the
// answers produce several of the same Catalog entry (two bathrooms), and nil
// when they produce one.
type Proposal struct {
	CatalogID string `json:"catalogId"`
	Instance  *int   `json:"instance"`
	chores.Fields
}

// Propose turns answers into proposed Chores, in Catalog display order. It is
// deterministic. Invalid answers (see ValidateAnswers) propose nothing.
func Propose(a Answers) []Proposal {
	c, errs := normalise(a)
	if errs != nil {
		return []Proposal{}
	}
	out := []Proposal{}
	for _, e := range table {
		n := e.count(c)
		for i := 1; i <= n; i++ {
			f := cloneFields(e.Fields)
			if e.adjust != nil {
				e.adjust(&f, c)
			}
			p := Proposal{CatalogID: e.ID, Fields: f}
			if e.PerRoom && n > 1 {
				p.Instance = ptr(i)
			}
			out = append(out, p)
		}
	}
	return out
}
