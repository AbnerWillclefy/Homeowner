package users

import (
	"hash/fnv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// pastels are the Category ids whose pastel the PWA draws, one per pastel and
// in the order the PWA lists them (peach, mint, lavender, blue, yellow,
// salmon). "other" is neutral, so it is never an avatar tone.
var pastels = [...]string{"kitchen", "bathroom", "bedroom", "laundry", "trash", "pets"}

// AvatarTone is the Category id whose pastel an initials avatar wears: a
// FNV-1a hash of the user id, so the same person always gets the same colours
// and the id itself never leaves the server.
func AvatarTone(userID string) string {
	h := fnv.New32a()
	h.Write([]byte(userID)) //nolint:errcheck // hash.Hash never errors
	return pastels[h.Sum32()%uint32(len(pastels))]
}

// zwj is the zero width joiner, which glues emoji into one sequence.
const zwj rune = 0x200D

func isInitialsSeparator(r rune) bool {
	return unicode.IsSpace(r) || r == '.' || r == '_' || r == '-' || r == '+'
}

// Initials is the letters of an initials avatar, from the shown name only:
// the first letter of the first and of the last word, or of the only word.
// Words split on spaces, dots, underscores, hyphens and plus signs. A letter
// is a whole user-perceived character: an accent, a skin tone or a joined
// emoji sequence is never cut. A name with no words gives "".
func Initials(name string) string {
	words := strings.FieldsFunc(name, isInitialsSeparator)
	if len(words) == 0 {
		return ""
	}
	first := firstGrapheme(words[0])
	if len(words) == 1 {
		return strings.ToUpper(first)
	}
	return strings.ToUpper(first + firstGrapheme(words[len(words)-1]))
}

// firstGrapheme approximates the first extended grapheme cluster: a rune plus
// the combining marks, variation selectors and emoji modifiers after it, and
// anything a zero width joiner glues on.
func firstGrapheme(word string) string {
	end := 0
	var prev rune
	for i, r := range word {
		if i == 0 {
			end = utf8.RuneLen(r)
			prev = r
			continue
		}
		if prev != zwj && !extends(r) {
			break
		}
		end = i + utf8.RuneLen(r)
		prev = r
	}
	return word[:end]
}

func extends(r rune) bool {
	return unicode.In(r, unicode.Mn, unicode.Me, unicode.Mc) ||
		r == zwj || (r >= 0xFE00 && r <= 0xFE0F) || (r >= 0x1F3FB && r <= 0x1F3FF)
}
