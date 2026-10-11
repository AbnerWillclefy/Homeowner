// Package auth verifies the sign-in token a request carries. The Verifier is
// one more thing outside the system that tests fake, like clock.Clock.
package auth

import (
	"context"
	"errors"
)

// ErrInvalidToken wraps every rejection. The HTTP layer answers 401 for it
// without distinguishing causes; the wrapped reason is for logs only (never
// log the token itself).
var ErrInvalidToken = errors.New("invalid token")

// Claims is what the API needs to know about a verified token.
type Claims struct {
	// Subject is the stable identity (Cognito "sub"), not the email.
	Subject string
	Email   string
}

// Verifier turns a raw bearer token into Claims, or an error wrapping
// ErrInvalidToken. Any error means the request is not authenticated.
type Verifier interface {
	Verify(ctx context.Context, token string) (Claims, error)
}
