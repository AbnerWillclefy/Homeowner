package auth

import (
	"context"
	"fmt"
	"sync"
)

// Fake is a Verifier for tests: SignIn mints an opaque token for an email and
// Verify looks it up. It never touches the network. Safe for concurrent use.
type Fake struct {
	mu     sync.Mutex
	tokens map[string]Claims
}

// NewFake returns a Fake that accepts only tokens it minted.
func NewFake() *Fake { return &Fake{tokens: map[string]Claims{}} }

// SignIn returns a token for email. The subject is stable per email, so
// signing in twice is the same person; a different email is a different one.
func (f *Fake) SignIn(email string) string {
	return f.SignInSubject("fake-sub-"+email, email)
}

// SignInSubject returns a token for the given Cognito subject and email, for
// tests of a person whose email changed (same subject, new email).
func (f *Fake) SignInSubject(sub, email string) string {
	f.mu.Lock()
	defer f.mu.Unlock()
	token := "fake-token-for-" + sub + "-" + email
	f.tokens[token] = Claims{Subject: sub, Email: email}
	return token
}

// Verify returns the claims registered for token.
func (f *Fake) Verify(_ context.Context, token string) (Claims, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.tokens[token]
	if !ok {
		return Claims{}, fmt.Errorf("%w: unknown fake token", ErrInvalidToken)
	}
	return c, nil
}
