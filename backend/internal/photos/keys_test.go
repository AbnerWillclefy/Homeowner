package photos_test

import (
	"regexp"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/photos"
)

const uid = "0b9f3a52-1c1e-4a6f-9d55-2f0f6f1f2a11"

func TestPendingKeysHoldTheOwnerAnd128BitsOfRandomness(t *testing.T) {
	k := photos.NewPendingKey(uid)
	if !regexp.MustCompile(`^pending/` + uid + `/[A-Za-z0-9_-]{22}$`).MatchString(k) {
		t.Fatalf("key = %q", k)
	}
	if k == photos.NewPendingKey(uid) {
		t.Error("two keys are equal")
	}
	if !photos.OwnsPendingKey(uid, k) {
		t.Error("owner does not own own key")
	}
}

func TestOwnsPendingKeyIsStrict(t *testing.T) {
	id := strings.Repeat("A", 22)
	for name, tc := range map[string]struct {
		user, key string
		want      bool
	}{
		"owner":       {uid, "pending/" + uid + "/" + id, true},
		"other user":  {"someone-else", "pending/" + uid + "/" + id, false},
		"short id":    {uid, "pending/" + uid + "/" + id[:21], false},
		"long id":     {uid, "pending/" + uid + "/" + id + "A", false},
		"traversal":   {uid, "pending/" + uid + "/../" + id, false},
		"prefix":      {uid, "xpending/" + uid + "/" + id, false},
		"newline":     {uid, "pending/" + uid + "/" + id + "\n", false},
		"avatar key":  {uid, "avatars/" + id + ".webp", false},
		"user prefix": {uid[:10], "pending/" + uid + "/" + id, false},
		"empty":       {uid, "", false},
	} {
		if got := photos.OwnsPendingKey(tc.user, tc.key); got != tc.want {
			t.Errorf("%s: got %v, want %v", name, got, tc.want)
		}
	}
}

func TestAvatarKeysAreFreshAndShaped(t *testing.T) {
	re := regexp.MustCompile(`^avatars/[A-Za-z0-9_-]{22}\.(webp|jpg)$`)
	a, b := photos.NewAvatarKey("webp"), photos.NewAvatarKey("jpg")
	if !re.MatchString(a) || !re.MatchString(b) || a == b {
		t.Errorf("keys = %q, %q", a, b)
	}
}

func TestURLBuilder(t *testing.T) {
	key := "avatars/abc.webp"
	if got := photos.URLBuilder("https://x.test/avatars")(&key); got == nil || *got != "https://x.test/avatars/abc.webp" {
		t.Errorf("got %v", got)
	}
	if got := photos.URLBuilder("https://x.test/avatars")(nil); got != nil {
		t.Errorf("nil key gave %v", *got)
	}
	if got := photos.URLBuilder("")(&key); got != nil {
		t.Errorf("empty base gave %v", *got)
	}
}

func TestSniff(t *testing.T) {
	webp := append(append([]byte("RIFF"), 1, 2, 3, 4), []byte("WEBPVP8 ")...)
	wav := append(append([]byte("RIFF"), 1, 2, 3, 4), []byte("WAVEfmt ")...)
	for name, tc := range map[string]struct {
		in   []byte
		want string
		ok   bool
	}{
		"jpeg":       {[]byte{0xFF, 0xD8, 0xFF, 0xE0, 0, 0}, "image/jpeg", true},
		"webp":       {webp, "image/webp", true},
		"png":        {[]byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"), "", false},
		"text":       {[]byte("hello world, not an image"), "", false},
		"wav":        {wav, "", false},
		"short jpeg": {[]byte{0xFF, 0xD8}, "", false},
		"empty":      {nil, "", false},
		"short riff": {[]byte("RIFF\x00\x00\x00\x00WEB"), "", false},
	} {
		got, ok := photos.Sniff(tc.in)
		if got != tc.want || ok != tc.ok {
			t.Errorf("%s: got %q,%v want %q,%v", name, got, ok, tc.want, tc.ok)
		}
	}
}
