package invites

import (
	"bytes"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestCheckIsTheValidityRule(t *testing.T) {
	t.Parallel()
	created := time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC)
	expires := created.Add(Validity)
	used := created.Add(time.Hour)

	tests := []struct {
		name   string
		usedAt *time.Time
		now    time.Time
		want   error
	}{
		{"unused, just created", nil, created, nil},
		{"unused, one second before expiry", nil, expires.Add(-time.Second), nil},
		{"unused, exactly at expiry", nil, expires, ErrExpired},
		{"unused, after expiry", nil, expires.Add(time.Second), ErrExpired},
		{"used, before expiry", &used, created.Add(2 * time.Hour), ErrUsed},
		{"used and expired is reported as used", &used, expires.Add(time.Hour), ErrUsed},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := check(tt.usedAt, expires, tt.now); !errors.Is(got, tt.want) {
				t.Errorf("check = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestValidityIsSevenDays(t *testing.T) {
	t.Parallel()
	if Validity != 168*time.Hour {
		t.Errorf("Validity = %v, want 168h", Validity)
	}
}

func TestTokensHashToWhatIsStored(t *testing.T) {
	t.Parallel()
	token, hash, err := newToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(token) != 43 || len(hash) != 32 {
		t.Fatalf("token length %d, hash length %d, want 43 and 32", len(token), len(hash))
	}
	got, ok := hashToken(token)
	if !ok || !bytes.Equal(got, hash) {
		t.Errorf("hashToken(token) = %x %v, want the stored hash %x", got, ok, hash)
	}
	if strings.Contains(string(hash), token) {
		t.Error("the hash must not contain the token")
	}
	other, _, _ := newToken()
	if other == token {
		t.Error("two tokens are equal")
	}
}

func TestMalformedTokensHaveNoHash(t *testing.T) {
	t.Parallel()
	canonical := strings.Repeat("A", 43)
	if _, ok := hashToken(canonical); !ok {
		t.Fatal("a 43-character base64url token should be well formed")
	}
	for name, tok := range map[string]string{
		"empty":                  "",
		"too short":              "AAAA",
		"too long":               canonical + "A",
		"padded":                 canonical + "=",
		"not base64url":          strings.Repeat("!", 43),
		"standard alphabet":      strings.Repeat("+", 43),
		"non-canonical trailing": strings.Repeat("A", 42) + "B",
	} {
		if _, ok := hashToken(tok); ok {
			t.Errorf("%s: %q was accepted", name, tok)
		}
	}
}
