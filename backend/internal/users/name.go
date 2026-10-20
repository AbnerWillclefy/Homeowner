package users

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

// MaxNameLength is the longest display name, in code points.
const MaxNameLength = 40

// What NormalizeName rejects a name for.
var (
	ErrNameTooLong = errors.New("name too long")
	ErrNameInvalid = errors.New("name invalid")
)

// NormalizeName trims raw and checks it. A blank name clears the display name
// (""). Length counts code points, not graphemes, so a family emoji
// counts as several. Control characters (category Cc, including NUL, which
// Postgres rejects in text) and the bidi override and isolate characters,
// which can make a name render as someone else's, are invalid. Other format
// characters stay: ZWJ builds family and skin-tone emoji.
func NormalizeName(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	for _, r := range trimmed {
		if unicode.IsControl(r) || isBidiControl(r) {
			return "", ErrNameInvalid
		}
	}
	if utf8.RuneCountInString(trimmed) > MaxNameLength {
		return "", ErrNameTooLong
	}
	return trimmed, nil
}

func isBidiControl(r rune) bool {
	return (r >= 0x202A && r <= 0x202E) || (r >= 0x2066 && r <= 0x2069)
}
