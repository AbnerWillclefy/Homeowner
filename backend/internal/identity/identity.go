// Package identity is who is calling: the signed-in User and, on a Home's
// routes, their Membership. The server's middleware puts them in the request
// context and every domain handler reads them from here, so no domain imports
// another just to know its caller.
package identity

import (
	"context"
	"time"
)

// User is a person with an account.
type User struct {
	ID         string
	CognitoSub string
	Email      string
	CreatedAt  time.Time
	// DisplayName and PhotoKey are null until the User sets them.
	DisplayName *string
	PhotoKey    *string
}

// Home is the place Residents look after together. AllocationTime is the
// local wall-clock time "HH:MM" in Timezone.
type Home struct {
	ID             string
	Timezone       string
	AllocationTime string
}

// Membership is a User's place in a Home: their own residents row and the
// Home it belongs to.
type Membership struct {
	ResidentID string
	Home       Home
}

// Private key types, so no other package can collide with them.
type (
	userKey       struct{}
	membershipKey struct{}
)

// WithUser returns ctx carrying the signed-in User.
func WithUser(ctx context.Context, u User) context.Context {
	return context.WithValue(ctx, userKey{}, u)
}

// CurrentUser returns the User WithUser put in ctx.
func CurrentUser(ctx context.Context) User {
	u, _ := ctx.Value(userKey{}).(User)
	return u
}

// WithMembership returns ctx carrying the caller's Membership.
func WithMembership(ctx context.Context, m Membership) context.Context {
	return context.WithValue(ctx, membershipKey{}, m)
}

// CurrentMembership returns the Membership WithMembership put in ctx.
func CurrentMembership(ctx context.Context) Membership {
	m, _ := ctx.Value(membershipKey{}).(Membership)
	return m
}
