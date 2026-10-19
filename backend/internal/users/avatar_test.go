package users_test

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/users"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

func TestInitials(t *testing.T) {
	t.Parallel()
	for name, want := range map[string]string{
		"Abner":          "A",
		"Ana Souza":      "AS",
		"Maria da Silva": "MS",
		"abner.w":        "AW",
		"bruna_souza":    "BS",
		"joao+casa":      "JC",
		"  ana   souza ": "AS",
		"..ana..":        "A",
		"élio":           "É",
		"Ângela Maria":   "ÂM",
		"🙂 Ana":          "🙂A",
		"👩🏽‍🦰":           "👩🏽‍🦰",
		"":               "",
		"   ":            "",
		"._-":            "",
	} {
		if got := users.Initials(name); got != want {
			t.Errorf("Initials(%q) = %q, want %q", name, got, want)
		}
	}
}

func TestAvatarToneIsAStableCategoryID(t *testing.T) {
	t.Parallel()
	seen := map[string]bool{}
	for _, id := range []string{"u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10", "u11", "u12"} {
		tone := users.AvatarTone(id)
		if !vocab.IsCategory(tone) || tone == "other" {
			t.Errorf("AvatarTone(%q) = %q, want a pastel Category id", id, tone)
		}
		if users.AvatarTone(id) != tone {
			t.Errorf("AvatarTone(%q) is not stable", id)
		}
		seen[tone] = true
	}
	if len(seen) < 3 {
		t.Errorf("12 ids gave only %d tones", len(seen))
	}
	// FNV-1a of "" is its offset basis, 2166136261, and 2166136261 % 6 = 1:
	// the second pastel (mint, the bathroom's), as the PWA's avatarTone picks today.
	if got := users.AvatarTone(""); got != "bathroom" {
		t.Errorf("AvatarTone(\"\") = %q, want bathroom", got)
	}
}
