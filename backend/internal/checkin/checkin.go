// Package checkin holds the Check-in rule: how a Resident's answer to "how are
// you today?" scales their Baseline into today's Energy. It is pure: no
// database, HTTP or clock. Storing Check-ins is internal/checkinstore.
package checkin

// Level is how a Resident says they feel today.
type Level string

const (
	Drained   Level = "drained"
	Low       Level = "low"
	Normal    Level = "normal"
	Energized Level = "energized"
)

// Valid reports whether l is one of the four levels.
func (l Level) Valid() bool {
	switch l {
	case Drained, Low, Normal, Energized:
		return true
	}
	return false
}

// Scale is today's Energy for a Baseline of base points: Drained 0, Low 50%,
// Normal 100%, Energized 130%. Energy is whole points and the result rounds
// down, so a Check-in never promises more than the percentage. A base of 0
// stays 0 at every level, and an unknown level gives 0.
func Scale(base int, l Level) int {
	switch l {
	case Low:
		return base * 50 / 100
	case Normal:
		return base
	case Energized:
		return base * 130 / 100
	}
	return 0
}
