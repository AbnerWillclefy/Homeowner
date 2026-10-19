package users

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

// MaxNameLength is the longest display name, in code points.
const MaxNameLength = 40

// Codes NormalizeName answers with.
const (
	NameTooLong = "too_long"
	NameInvalid = "invalid"
)

// NormalizeName trims raw and checks it. A blank name clears the display name
// (nil, no code). Length counts code points, not graphemes, so a family emoji
// counts as several. Control characters (category Cc, including NUL, which
// Postgres rejects in text) and the bidi override and isolate characters,
// which can make a name render as someone else's, are invalid. Other format
// characters stay: ZWJ builds family and skin-tone emoji.
func NormalizeName(raw string) (name *string, code string) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, ""
	}
	for _, r := range trimmed {
		if unicode.IsControl(r) || isBidiControl(r) {
			return nil, NameInvalid
		}
	}
	if utf8.RuneCountInString(trimmed) > MaxNameLength {
		return nil, NameTooLong
	}
	return &trimmed, ""
}

func isBidiControl(r rune) bool {
	return (r >= 0x202A && r <= 0x202E) || (r >= 0x2066 && r <= 0x2069)
}

// ShownName is the name to show for a User: the display name, else the part of
// the email before the last @ (the whole email when it has none). It is
// computed on read, never stored, so it follows email changes.
func ShownName(displayName *string, email string) string {
	if displayName != nil {
		return *displayName
	}
	if i := strings.LastIndex(email, "@"); i >= 0 {
		return email[:i]
	}
	return email
}
