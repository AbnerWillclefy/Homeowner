// Package chores validates and stores a Home's Chores (see GLOSSARY.md).
package chores

import "errors"

// ErrNotFound means the Chore does not exist in that Home.
var ErrNotFound = errors.New("chore not found")

// Fields are the editable parts of a Chore, in the normalised form the
// database holds. IntervalDays nil means one-off. AllowedWeekdays uses
// 0 = Sunday to 6 = Saturday; empty means any day.
type Fields struct {
	Name            string   `json:"name"`
	Category        string   `json:"category"`
	Demands         []string `json:"demands"`
	BaseEffort      int      `json:"baseEffort"`
	Importance      string   `json:"importance"`
	People          int      `json:"people"`
	IntervalDays    *int     `json:"intervalDays"`
	AllowedWeekdays []int    `json:"allowedWeekdays"`
	BuildsUp        bool     `json:"buildsUp"`
}

// Chore is a stored Chore.
type Chore struct {
	ID string `json:"id"`
	Fields
	// ResponsibleResidentID is the Resident the Chore is theirs, or nil for
	// Nobody. It is not in Fields: the PUT body never carries it, so editing a
	// Chore cannot change it (see choresettings.Store.SetResponsible).
	ResponsibleResidentID *string `json:"responsibleResidentId"`
}

// ErrResponsibleRestricted means an edit would add a Demand the Chore's
// responsible Resident is Restricted on.
type ErrResponsibleRestricted struct {
	ResidentID string
	Demands    []string
}

func (e ErrResponsibleRestricted) Error() string {
	return "responsible resident is restricted on a demand of the chore"
}
