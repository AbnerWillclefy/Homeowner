package photos

import (
	"crypto/rand"
	"encoding/base64"
	"regexp"
	"strings"
)

// randomID is 16 random bytes (128 bits) as 22 base64url characters.
func randomID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("photos: no randomness: " + err.Error())
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// NewPendingKey returns the key a User uploads to before confirming. It holds
// the User's id so ownership needs no table.
func NewPendingKey(userID string) string {
	return "pending/" + userID + "/" + randomID()
}

// NewAvatarKey returns a public key for a photo of type ext ("webp" or
// "jpg"). Its id is fresh, so a pending key and a public URL never link.
func NewAvatarKey(ext string) string {
	return "avatars/" + randomID() + "." + ext
}

// ExtensionFor returns the key extension for an accepted content type.
func ExtensionFor(contentType string) string { return extensions[contentType] }

var pendingPattern = regexp.MustCompile(`^pending/([0-9A-Za-z-]{1,64})/[A-Za-z0-9_-]{22}$`)

// OwnsPendingKey reports whether key is a well-formed pending key issued to
// userID.
func OwnsPendingKey(userID, key string) bool {
	m := pendingPattern.FindStringSubmatch(key)
	return m != nil && m[1] == userID
}

// URLBuilder returns the function that turns a stored photo key into its
// public URL: base + "/" + the key without its avatars/ prefix. With an
// empty base (photos off) or a nil key it returns nil, so a misconfigured
// environment shows initials rather than broken images.
func URLBuilder(base string) func(*string) *string {
	return func(key *string) *string {
		if base == "" || key == nil {
			return nil
		}
		u := base + "/" + strings.TrimPrefix(*key, "avatars/")
		return &u
	}
}

// Sniff reports the content type the leading bytes of a file declare: JPEG
// starts FF D8 FF; WebP is RIFF at 0-3 and WEBP at 8-11. It proves the type,
// not that the image decodes.
func Sniff(prefix []byte) (contentType string, ok bool) {
	switch {
	case len(prefix) >= 3 && prefix[0] == 0xFF && prefix[1] == 0xD8 && prefix[2] == 0xFF:
		return ContentTypeJPEG, true
	case len(prefix) >= 12 && string(prefix[0:4]) == "RIFF" && string(prefix[8:12]) == "WEBP":
		return ContentTypeWebP, true
	}
	return "", false
}
