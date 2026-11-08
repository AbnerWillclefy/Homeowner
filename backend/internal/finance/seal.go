package finance

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
)

// The two credential fields. The field name is part of the additional data, so
// a Client ID blob cannot be opened as a Client Secret.
const (
	FieldClientID     = "client_id"
	FieldClientSecret = "client_secret"
)

// KeyVersion is the first byte of every blob and the key_version column, so a
// later rotation can find old rows with SQL.
const KeyVersion = 1

const nonceSize = 12

// ErrOpen is the only error Open returns. It carries no detail on purpose.
var ErrOpen = errors.New("cannot open sealed value")

func newGCM(key *[32]byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func aad(userID, field string) []byte { return []byte(userID + "|" + field) }

// Seal encrypts plaintext with AES-256-GCM under a fresh random nonce and
// returns version || nonce || ciphertext+tag, bound to userID and field.
func Seal(key *[32]byte, userID, field string, plaintext []byte) ([]byte, error) {
	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	out := make([]byte, 1+nonceSize, 1+nonceSize+len(plaintext)+gcm.Overhead())
	out[0] = KeyVersion
	if _, err := rand.Read(out[1:]); err != nil {
		return nil, err
	}
	return gcm.Seal(out, out[1:], plaintext, aad(userID, field)), nil
}

// Open reverses Seal. A short blob, an unknown version or any authentication
// failure all answer ErrOpen.
func Open(key *[32]byte, userID, field string, blob []byte) ([]byte, error) {
	gcm, err := newGCM(key)
	if err != nil || len(blob) < 1+nonceSize+gcm.Overhead() || blob[0] != KeyVersion {
		return nil, ErrOpen
	}
	pt, err := gcm.Open(nil, blob[1:1+nonceSize], blob[1+nonceSize:], aad(userID, field))
	if err != nil {
		return nil, ErrOpen
	}
	return pt, nil
}
