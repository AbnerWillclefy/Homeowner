// Package invites stores Invites: single-use links a Resident shares to bring
// a new Resident into their Home (see CONTEXT.md).
package invites

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"
)

const (
	// Validity is how long an Invite works after it is created.
	Validity = 7 * 24 * time.Hour
	// MaxOpenPerHome caps the unused, unexpired Invites a Home can have, so a
	// loop of creates cannot grow the table.
	MaxOpenPerHome = 10

	tokenBytes = 32
)

var (
	// ErrNotFound means no Invite has this token (or it is malformed).
	ErrNotFound = errors.New("invite not found")
	// ErrUsed means the Invite was already accepted.
	ErrUsed = errors.New("invite already used")
	// ErrExpired means the Invite is older than Validity.
	ErrExpired = errors.New("invite expired")
	// ErrWouldLeaveHome means the User lives in another Home and has not
	// confirmed leaving it.
	ErrWouldLeaveHome = errors.New("accepting would leave the current home")
	// ErrAlreadyHere means the User already lives in the Invite's Home.
	ErrAlreadyHere = errors.New("user already lives in this home")
	// ErrTooManyOpen means the Home has MaxOpenPerHome open Invites.
	ErrTooManyOpen = errors.New("too many open invites")
)

// newToken returns a random token to share and the hash to store. Only the
// hash is ever stored or compared.
func newToken() (token string, hash []byte, err error) {
	b := make([]byte, tokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", nil, fmt.Errorf("invite token: %w", err)
	}
	h := sha256.Sum256(b)
	return base64.RawURLEncoding.EncodeToString(b), h[:], nil
}

// hashToken returns the stored hash for token, or false if token is not the
// canonical base64url of 32 bytes. Such a token cannot exist, so callers
// answer "not found" without asking the database.
func hashToken(token string) ([]byte, bool) {
	b, err := base64.RawURLEncoding.Strict().DecodeString(token)
	if err != nil || len(b) != tokenBytes {
		return nil, false
	}
	h := sha256.Sum256(b)
	return h[:], true
}

// check is the validity rule: an Invite works while it is unused and now is
// before expiresAt (at expiresAt it is already expired). It returns nil when
// the Invite is valid, else ErrUsed or ErrExpired.
func check(usedAt *time.Time, expiresAt, now time.Time) error {
	switch {
	case usedAt != nil:
		return ErrUsed
	case !now.Before(expiresAt):
		return ErrExpired
	}
	return nil
}
