// Package explain holds the pure rules behind the plain-language explanation
// of a Day Plan: the facts an explanation may be built from, the template that
// is the fallback when the LLM has not written one, the check every LLM text
// must pass, and the fingerprint that tells whether a stored text still
// describes the Resident's plan.
//
// Facts are the reasons the allocator recorded, as stable ids, numbers and
// the fixed Category vocabulary. They carry no names, Chore titles or any text
// a User typed, so they can be sent to a model and rendered without trust.
//
// The package does no I/O and reads no clock.
package explain

import (
	"crypto/sha256"
	"encoding/hex"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Task is one Task a Resident was given, as facts. Reason is the recorded
// reason id; People is 2 for a Task shared with a partner.
type Task struct {
	Reason     string `json:"reason"`
	Category   string `json:"category"`
	Effort     int    `json:"effort"`
	Importance string `json:"importance"`
	People     int    `json:"people"`
}

// Facts are what one Resident's explanation is built from: their Energy, their
// Tasks, and the reason of each Task left in the pool (about everyone, not
// about them).
type Facts struct {
	Energy int      `json:"energy"`
	Tasks  []Task   `json:"tasks"`
	Pool   []string `json:"pool"`
}

// ResidentFacts is the Facts of the Resident with the id.
type ResidentFacts struct {
	ResidentID string
	Facts      Facts
}

// Texts is one explanation in both languages the PWA ships. The backend does
// not know a Resident's locale (ADR 0006), so it keeps both.
type Texts struct {
	EnUS string `json:"en-US"`
	PtBR string `json:"pt-BR"`
}

// MaxLength is the most characters an explanation may have in one language.
const MaxLength = 400

// Valid reports whether both texts are fit to show: not blank, at most
// MaxLength characters, no control characters (a newline included), no markup
// and no link. It is the only check on model prose; the plan itself is
// refereed elsewhere.
func Valid(t Texts) bool {
	return validText(t.EnUS) && validText(t.PtBR)
}

func validText(s string) bool {
	if strings.TrimSpace(s) == "" || utf8.RuneCountInString(s) > MaxLength {
		return false
	}
	if strings.IndexFunc(s, func(r rune) bool { return unicode.IsControl(r) || r == '<' || r == '>' }) >= 0 {
		return false
	}
	lower := strings.ToLower(s)
	for _, bad := range []string{"://", "www.", "//"} {
		if strings.Contains(lower, bad) {
			return false
		}
	}
	return true
}

// Pair is one assignment as the fingerprint sees it.
type Pair struct{ TaskID, Reason string }

// Fingerprint identifies the Energy and assignments an explanation was written
// for. It does not depend on the order of pairs, and it changes when any pair
// or the Energy does. The caller's slice is left as it is.
func Fingerprint(energy int, pairs []Pair) string {
	sorted := slices.Clone(pairs)
	slices.SortFunc(sorted, func(a, b Pair) int {
		if c := strings.Compare(a.TaskID, b.TaskID); c != 0 {
			return c
		}
		return strings.Compare(a.Reason, b.Reason)
	})
	h := sha256.New()
	h.Write([]byte(strconv.Itoa(energy)))
	for _, p := range sorted {
		// Length-prefixed, so no two different lists make the same bytes.
		h.Write([]byte("|" + strconv.Itoa(len(p.TaskID)) + ":" + p.TaskID + strconv.Itoa(len(p.Reason)) + ":" + p.Reason))
	}
	return hex.EncodeToString(h.Sum(nil))
}
