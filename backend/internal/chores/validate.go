package chores

import (
	"cmp"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

// Input is what a caller sends, decoded straight from the request body,
// before validation. The numbers are `any` (a JSON number arrives as float64)
// so a string or 2.5 is a field error with a code rather than an
// undifferentiated bad request. nil means missing.
type Input struct {
	Name            string   `json:"name"`
	Category        string   `json:"category"`
	Demands         []string `json:"demands"`
	BaseEffort      any      `json:"baseEffort"`
	Importance      string   `json:"importance"`
	People          any      `json:"people"`
	IntervalDays    any      `json:"intervalDays"` // nil means one-off
	AllowedWeekdays []any    `json:"allowedWeekdays"`
	BuildsUp        bool     `json:"buildsUp"`
}

// FieldErrors maps a wire field name to a stable machine code. The first
// error recorded for a field wins.
type FieldErrors map[string]string

func (e FieldErrors) add(field, code string) {
	if _, seen := e[field]; !seen {
		e[field] = code
	}
}

// oneOf records "required" for an empty value and "unknown" for one that
// valid rejects.
func (e FieldErrors) oneOf(field, value string, valid func(string) bool) {
	switch {
	case value == "":
		e.add(field, "required")
	case !valid(value):
		e.add(field, "unknown")
	}
}

// intInRange returns v as a whole number in lo..hi, or records why not and
// returns 0.
func (e FieldErrors) intInRange(field string, v any, lo, hi int) int {
	if v == nil {
		e.add(field, "required")
		return 0
	}
	n, ok := integer(v)
	switch {
	case !ok:
		e.add(field, "invalid")
	case n < lo || n > hi:
		e.add(field, "out_of_range")
	default:
		return n
	}
	return 0
}

const maxNameRunes = 100

var idPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// ValidID reports whether id is a well-formed uuid. A Chore with any other id
// cannot exist, so callers answer not found without asking the Store.
func ValidID(id string) bool { return idPattern.MatchString(id) }

// integer reports v as an int when it is a whole number.
func integer(v any) (int, bool) {
	f, ok := v.(float64)
	if !ok || f != float64(int(f)) || f > 1e9 || f < -1e9 {
		return 0, false
	}
	return int(f), true
}

// uniqueSorted returns the distinct values of in in ascending order, never nil.
func uniqueSorted[T cmp.Ordered](in []T) []T {
	out := append([]T{}, in...)
	slices.Sort(out)
	return slices.Compact(out)
}

// Validate checks in and returns it normalised: trimmed name, de-duplicated
// and sorted Demands and weekdays. All problems are reported at once.
func Validate(in Input) (Fields, FieldErrors) {
	errs := FieldErrors{}
	out := Fields{Category: in.Category, Importance: in.Importance, BuildsUp: in.BuildsUp}

	out.Name = strings.TrimSpace(in.Name)
	switch n := utf8.RuneCountInString(out.Name); {
	case n == 0:
		errs.add("name", "required")
	case n > maxNameRunes:
		errs.add("name", "too_long")
	}
	errs.oneOf("category", in.Category, vocab.IsCategory)
	errs.oneOf("importance", in.Importance, vocab.IsImportance)

	for _, d := range in.Demands {
		if !vocab.IsDemand(d) {
			errs.add("demands", "unknown")
		}
	}
	out.Demands = uniqueSorted(in.Demands)

	out.BaseEffort = errs.intInRange("baseEffort", in.BaseEffort, 1, 5)
	out.People = errs.intInRange("people", in.People, 1, 2)
	if in.IntervalDays != nil {
		n := errs.intInRange("intervalDays", in.IntervalDays, 1, 365)
		out.IntervalDays = &n
	}

	days := make([]int, 0, len(in.AllowedWeekdays))
	for _, v := range in.AllowedWeekdays {
		switch d, ok := integer(v); {
		case !ok:
			errs.add("allowedWeekdays", "invalid")
		case d < 0 || d > 6:
			errs.add("allowedWeekdays", "out_of_range")
		default:
			days = append(days, d)
		}
	}
	out.AllowedWeekdays = uniqueSorted(days)

	if len(errs) > 0 {
		return Fields{}, errs
	}
	return out, nil
}
