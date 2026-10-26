// Package choresettings stores a Resident's Preference and Restriction on a
// specific Chore of their Home, and works out the effective ones: the specific
// setting beats the User's general one (see GLOSSARY.md). It is kept apart from
// profile (the User's general settings) and chores (the Home's Chores).
package choresettings

import "slices"

// Preference values and the sources of an effective Preference.
const (
	Like    = "like"
	Neutral = "neutral"
	Dislike = "dislike"

	SourceSpecific = "specific"
	SourceGeneral  = "general"
	SourceDefault  = "default"
)

// ValidPreference reports whether p is one of like, neutral or dislike.
func ValidPreference(p string) bool {
	return p == Like || p == Neutral || p == Dislike
}

// Chore is the part of a Chore the rules look at.
type Chore struct {
	Category string
	Demands  []string
}

// General is the User's profile as far as these rules go: a Preference per
// Category (neutral is absent) and the Demands they are Restricted on.
type General struct {
	Preferences  map[string]string
	Restrictions []string
}

// Specific is what the Resident set on this one Chore. Preference is empty
// when none is set; Neutral is a real value that beats a general one.
type Specific struct {
	Preference string
	Restricted bool
}

// Effective is the outcome for one Resident and one Chore. RestrictedBy lists
// the Chore's Demands that the User is generally Restricted on, in the Chore's
// Demand order, never nil. RestrictedByChore is the specific Restriction.
// Restricted is true when either reason holds.
type Effective struct {
	Preference        string
	Source            string
	Restricted        bool
	RestrictedBy      []string
	RestrictedByChore bool
}

// Resolve applies the rules. A specific Preference (including neutral) wins,
// then the general one for the Chore's Category, else neutral. Restrictions
// only add: a specific one never lifts a general one, because a Restriction
// means "never given".
func Resolve(c Chore, g General, s Specific) Effective {
	e := Effective{Preference: Neutral, Source: SourceDefault, RestrictedBy: []string{}}
	if s.Preference != "" {
		e.Preference, e.Source = s.Preference, SourceSpecific
	} else if general, ok := g.Preferences[c.Category]; ok {
		e.Preference, e.Source = general, SourceGeneral
	}
	for _, d := range c.Demands {
		if slices.Contains(g.Restrictions, d) {
			e.RestrictedBy = append(e.RestrictedBy, d)
		}
	}
	e.RestrictedByChore = s.Restricted
	e.Restricted = len(e.RestrictedBy) > 0 || s.Restricted
	return e
}
