package auth_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/auth"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
)

const clientID = "client-123"

var t0 = time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC)

type signingKey struct {
	kid string
	key *rsa.PrivateKey
}

func newKey(t *testing.T, kid string) signingKey {
	t.Helper()
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	return signingKey{kid: kid, key: k}
}

func (k signingKey) jwk() map[string]string {
	return map[string]string{
		"kty": "RSA", "alg": "RS256", "use": "sig", "kid": k.kid,
		"n": base64.RawURLEncoding.EncodeToString(k.key.N.Bytes()),
		"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(k.key.E)).Bytes()),
	}
}

// pool is a fake Cognito user pool: it serves a JWKS and counts fetches.
type pool struct {
	srv     *httptest.Server
	fetches atomic.Int32
	mu      sync.Mutex
	keys    []signingKey
	down    bool
}

func newPool(t *testing.T, keys ...signingKey) *pool {
	t.Helper()
	p := &pool{keys: keys}
	p.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}
		p.fetches.Add(1)
		p.mu.Lock()
		defer p.mu.Unlock()
		if p.down {
			http.Error(w, "down", http.StatusInternalServerError)
			return
		}
		set := make([]map[string]string, 0, len(p.keys))
		for _, k := range p.keys {
			set = append(set, k.jwk())
		}
		writeJSONBody(w, map[string]any{"keys": set})
	}))
	t.Cleanup(p.srv.Close)
	return p
}

func writeJSONBody(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func (p *pool) issuer() string { return p.srv.URL }

func (p *pool) setDown(down bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.down = down
}

func (p *pool) addKey(k signingKey) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.keys = append(p.keys, k)
}

// claims returns a valid ID token's claims; tests break one at a time.
func (p *pool) claims() jwt.MapClaims {
	return jwt.MapClaims{
		"iss":            p.issuer(),
		"aud":            clientID,
		"token_use":      "id",
		"sub":            "sub-1",
		"email":          "a@example.com",
		"email_verified": true,
		"iat":            t0.Unix(),
		"exp":            t0.Add(time.Hour).Unix(),
	}
}

func sign(t *testing.T, k signingKey, c jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, c)
	tok.Header["kid"] = k.kid
	s, err := tok.SignedString(k.key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func verifier(p *pool) (*auth.Cognito, *clock.Fake) {
	clk := clock.NewFake(t0)
	return auth.NewCognito(p.issuer(), clientID, p.srv.Client(), clk), clk
}

func TestCognitoAcceptsAValidIDToken(t *testing.T) {
	t.Parallel()
	k := newKey(t, "k1")
	p := newPool(t, k)
	v, _ := verifier(p)

	got, err := v.Verify(context.Background(), sign(t, k, p.claims()))

	if err != nil {
		t.Fatal(err)
	}
	if got != (auth.Claims{Subject: "sub-1", Email: "a@example.com"}) {
		t.Fatalf("claims = %+v", got)
	}
}

func TestCognitoRejectsInvalidTokens(t *testing.T) {
	t.Parallel()
	k := newKey(t, "k1")
	other := newKey(t, "k1") // same kid, different key
	p := newPool(t, k)
	v, clk := verifier(p)

	with := func(change func(jwt.MapClaims)) string {
		c := p.claims()
		change(c)
		return sign(t, k, c)
	}
	without := func(name string) string { return with(func(c jwt.MapClaims) { delete(c, name) }) }

	none := jwt.NewWithClaims(jwt.SigningMethodNone, p.claims())
	none.Header["kid"] = "k1"
	noneToken, err := none.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatal(err)
	}
	// HS256 using the public key's bytes as the shared secret.
	hs := jwt.NewWithClaims(jwt.SigningMethodHS256, p.claims())
	hs.Header["kid"] = "k1"
	hsToken, err := hs.SignedString(k.key.N.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	noKid := jwt.NewWithClaims(jwt.SigningMethodRS256, p.claims())
	noKidToken, err := noKid.SignedString(k.key)
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name  string
		token string
	}{
		{"empty", ""},
		{"garbage", "not-a-token"},
		{"wrong issuer", with(func(c jwt.MapClaims) { c["iss"] = "https://cognito-idp.eu-west-1.amazonaws.com/other-pool" })},
		{"wrong audience", with(func(c jwt.MapClaims) { c["aud"] = "another-client" })},
		{"no audience", without("aud")},
		{"access token", with(func(c jwt.MapClaims) { c["token_use"] = "access" })},
		{"no token_use", without("token_use")},
		{"email not verified", with(func(c jwt.MapClaims) { c["email_verified"] = false })},
		{"email_verified missing", without("email_verified")},
		{"no email", without("email")},
		{"empty sub", with(func(c jwt.MapClaims) { c["sub"] = "" })},
		{"no expiry", without("exp")},
		{"already expired", with(func(c jwt.MapClaims) { c["exp"] = t0.Add(-time.Hour).Unix() })},
		{"signed by a different key", sign(t, other, p.claims())},
		{"unknown kid", sign(t, newKey(t, "unknown"), p.claims())},
		{"no kid", noKidToken},
		{"alg none", noneToken},
		{"alg HS256 with the public key", hsToken},
	}
	for _, c := range cases {
		_, err := v.Verify(context.Background(), c.token)
		if !errors.Is(err, auth.ErrInvalidToken) {
			t.Errorf("%s: err = %v, want ErrInvalidToken", c.name, err)
		}
	}

	// Sanity: the same pool and clock do accept a good token, so the cases
	// above fail for their own reason.
	if _, err := v.Verify(context.Background(), sign(t, k, p.claims())); err != nil {
		t.Fatalf("valid token rejected: %v", err)
	}

	// Expiry follows the injected clock, not the system clock.
	token := sign(t, k, p.claims())
	clk.Advance(2 * time.Hour)
	if _, err := v.Verify(context.Background(), token); !errors.Is(err, auth.ErrInvalidToken) {
		t.Fatalf("expired after the clock moved: err = %v, want ErrInvalidToken", err)
	}
}

func TestCognitoFetchesTheKeysOnceForManyTokens(t *testing.T) {
	t.Parallel()
	k := newKey(t, "k1")
	p := newPool(t, k)
	v, _ := verifier(p)

	for range 20 {
		if _, err := v.Verify(context.Background(), sign(t, k, p.claims())); err != nil {
			t.Fatal(err)
		}
	}

	if n := p.fetches.Load(); n != 1 {
		t.Fatalf("JWKS fetches = %d, want 1", n)
	}
}

func TestCognitoMakesNoRequestAtConstruction(t *testing.T) {
	t.Parallel()
	p := newPool(t, newKey(t, "k1"))

	verifier(p)

	if n := p.fetches.Load(); n != 0 {
		t.Fatalf("JWKS fetches = %d, want 0 until the first token", n)
	}
}

func TestCognitoPicksUpARotatedKeyAfterOneRefetch(t *testing.T) {
	t.Parallel()
	old := newKey(t, "old")
	p := newPool(t, old)
	v, clk := verifier(p)
	if _, err := v.Verify(context.Background(), sign(t, old, p.claims())); err != nil {
		t.Fatal(err)
	}

	fresh := newKey(t, "new")
	p.addKey(fresh)
	clk.Advance(2 * time.Minute)
	_, err := v.Verify(context.Background(), sign(t, fresh, p.claims()))

	if err != nil {
		t.Fatalf("token from the rotated-in key: %v", err)
	}
	if n := p.fetches.Load(); n != 2 {
		t.Fatalf("JWKS fetches = %d, want 2", n)
	}
}

func TestCognitoLimitsRefetchesCausedByUnknownKeyIDs(t *testing.T) {
	t.Parallel()
	k := newKey(t, "k1")
	p := newPool(t, k)
	v, clk := verifier(p)
	v.Verify(context.Background(), sign(t, k, p.claims())) //nolint:errcheck // warms the cache

	unknown := func(n int) {
		for i := range n {
			bad := sign(t, newKey(t, "random"+string(rune('a'+i))), p.claims())
			if _, err := v.Verify(context.Background(), bad); !errors.Is(err, auth.ErrInvalidToken) {
				t.Fatalf("err = %v, want ErrInvalidToken", err)
			}
		}
	}

	unknown(5)
	if n := p.fetches.Load(); n != 1 {
		t.Fatalf("JWKS fetches = %d right after loading, want 1 (nothing new to learn)", n)
	}

	clk.Advance(61 * time.Second)
	unknown(10)
	if n := p.fetches.Load(); n != 2 {
		t.Fatalf("JWKS fetches = %d after 10 unknown kids, want 2 (one refetch)", n)
	}

	clk.Advance(61 * time.Second)
	unknown(1)
	if n := p.fetches.Load(); n != 3 {
		t.Fatalf("JWKS fetches = %d a minute later, want 3", n)
	}
}

func TestCognitoFailsClosedWhenKeysCannotBeFetched(t *testing.T) {
	t.Parallel()
	k := newKey(t, "k1")
	p := newPool(t, k)
	p.setDown(true)
	v, _ := verifier(p)

	_, err := v.Verify(context.Background(), sign(t, k, p.claims()))

	if !errors.Is(err, auth.ErrInvalidToken) {
		t.Fatalf("err = %v, want ErrInvalidToken", err)
	}
}

func TestCognitoKeepsUsingCachedKeysWhenARefreshFails(t *testing.T) {
	t.Parallel()
	k := newKey(t, "k1")
	p := newPool(t, k)
	v, clk := verifier(p)
	if _, err := v.Verify(context.Background(), sign(t, k, p.claims())); err != nil {
		t.Fatal(err)
	}

	p.setDown(true)
	clk.Advance(2 * time.Hour) // past the cache lifetime
	c := p.claims()
	c["exp"] = clk.Now().Add(time.Hour).Unix()
	_, err := v.Verify(context.Background(), sign(t, k, c))

	if err != nil {
		t.Fatalf("with a warm cache and Cognito down: %v", err)
	}
}
