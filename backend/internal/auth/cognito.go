package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/clock"
)

const (
	// keysTTL is how long fetched keys are trusted before a refresh.
	keysTTL = time.Hour
	// unknownKeyRefetchInterval is the least time between refetches caused by
	// a token naming a key we do not have, so garbage tokens with random key
	// ids cannot make every request hit Cognito.
	unknownKeyRefetchInterval = time.Minute
	// failedFetchBackoff is the least time between fetch attempts after one
	// failed or while the cache is stale.
	failedFetchBackoff = 5 * time.Second
	// leeway tolerates small clock differences between Cognito and us.
	leeway = 30 * time.Second
	// maxKeysBody caps the JWKS response we are willing to read.
	maxKeysBody = 64 * 1024
)

// ErrKeysUnavailable is wrapped along with ErrInvalidToken when the pool's
// public keys could not be fetched and none are cached. The request still
// fails closed; callers use this to log it as an error rather than a bad token.
var ErrKeysUnavailable = errors.New("signing keys unavailable")

// Cognito verifies Cognito user pool ID tokens: RS256 only, signed by a key in
// the pool's JWKS, from this pool and app client, still valid on the injected
// clock, with a verified email. Safe for concurrent use.
type Cognito struct {
	issuer   string
	clientID string
	http     *http.Client
	clock    clock.Clock
	parser   *jwt.Parser

	mu          sync.Mutex
	keys        map[string]*rsa.PublicKey
	loaded      bool
	fetchedAt   time.Time // last successful fetch
	lastAttempt time.Time // last fetch attempt, successful or not
}

// NewCognito returns a verifier for the pool at issuer (for example
// https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_abc) and app client
// clientID. It makes no request until the first token is verified. The
// library reads time only through clk.
func NewCognito(issuer, clientID string, httpClient *http.Client, clk clock.Clock) *Cognito {
	return &Cognito{
		issuer:   issuer,
		clientID: clientID,
		http:     httpClient,
		clock:    clk,
		parser: jwt.NewParser(
			jwt.WithValidMethods([]string{"RS256"}),
			jwt.WithIssuer(issuer),
			jwt.WithAudience(clientID),
			jwt.WithExpirationRequired(),
			jwt.WithTimeFunc(clk.Now),
			jwt.WithLeeway(leeway),
		),
	}
}

// Verify checks token and returns who it is for. Every failure wraps
// ErrInvalidToken.
func (c *Cognito) Verify(ctx context.Context, token string) (Claims, error) {
	claims := jwt.MapClaims{}
	_, err := c.parser.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("token has no key id")
		}
		return c.key(ctx, kid)
	})
	if err != nil {
		return Claims{}, invalid(err)
	}
	if use, _ := claims["token_use"].(string); use != "id" {
		return Claims{}, invalid(errors.New("not an ID token"))
	}
	if !emailVerified(claims["email_verified"]) {
		return Claims{}, invalid(errors.New("email not verified"))
	}
	sub, _ := claims["sub"].(string)
	email, _ := claims["email"].(string)
	if sub == "" || email == "" {
		return Claims{}, invalid(errors.New("token has no subject or email"))
	}
	return Claims{Subject: sub, Email: email}, nil
}

func invalid(reason error) error {
	return fmt.Errorf("%w: %w", ErrInvalidToken, reason)
}

// emailVerified reads Cognito's email_verified, a JSON bool (older pools
// emitted the string "true").
func emailVerified(v any) bool {
	switch b := v.(type) {
	case bool:
		return b
	case string:
		return b == "true"
	}
	return false
}

// key returns the public key for kid, fetching the pool's keys lazily.
func (c *Cognito) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.clock.Now()

	stale := !c.loaded || now.Sub(c.fetchedAt) >= keysTTL
	if stale && now.Sub(c.lastAttempt) >= failedFetchBackoff {
		c.refresh(ctx, now)
	}
	if k, ok := c.keys[kid]; ok {
		return k, nil
	}
	if c.loaded && now.Sub(c.lastAttempt) >= unknownKeyRefetchInterval {
		c.refresh(ctx, now)
		if k, ok := c.keys[kid]; ok {
			return k, nil
		}
	}
	if !c.loaded {
		return nil, ErrKeysUnavailable
	}
	return nil, errors.New("no signing key with that id")
}

// refresh fetches the keys. On failure it keeps any keys it already has.
// Caller holds c.mu.
func (c *Cognito) refresh(ctx context.Context, now time.Time) {
	c.lastAttempt = now
	keys, err := c.fetchKeys(ctx)
	if err != nil {
		return
	}
	c.keys, c.loaded, c.fetchedAt = keys, true, now
}

type jwksDocument struct {
	Keys []struct {
		Kty string `json:"kty"`
		Kid string `json:"kid"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func (c *Cognito) fetchKeys(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.issuer+"/.well-known/jwks.json", nil)
	if err != nil {
		return nil, err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jwks: status %d", res.StatusCode)
	}
	var doc jwksDocument
	if err := json.NewDecoder(io.LimitReader(res.Body, maxKeysBody)).Decode(&doc); err != nil {
		return nil, fmt.Errorf("jwks: %w", err)
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range doc.Keys {
		if k.Kty != "RSA" || k.Kid == "" {
			continue
		}
		n, errN := base64.RawURLEncoding.DecodeString(strings.TrimRight(k.N, "="))
		e, errE := base64.RawURLEncoding.DecodeString(strings.TrimRight(k.E, "="))
		if errN != nil || errE != nil || len(n) == 0 || len(e) == 0 {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	if len(keys) == 0 {
		return nil, errors.New("jwks: no usable keys")
	}
	return keys, nil
}
