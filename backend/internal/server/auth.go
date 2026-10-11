package server

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/auth"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/users"
)

// userKey is the context key for the signed-in User. A private type, so no
// other package can collide with it.
type userKey struct{}

// currentUser returns the User requireUser put in the request context.
func currentUser(ctx context.Context) users.User {
	u, _ := ctx.Value(userKey{}).(users.User)
	return u
}

// bearerToken extracts the token from "Authorization: Bearer <token>". The
// scheme is case-insensitive and exactly one token must follow.
func bearerToken(h string) (string, bool) {
	parts := strings.Fields(h)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}
	return parts[1], true
}

func unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", "Bearer")
	writeError(w, http.StatusUnauthorized, "unauthorized")
}

// requireUser wraps a handler so it only runs for a signed-in User, whom it
// finds or creates on first sight. Every verification failure is the same 401;
// with no Verifier configured it fails closed with 503.
func (s *server) requireUser(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.deps.Verifier == nil {
			writeError(w, http.StatusServiceUnavailable, "auth not configured")
			return
		}
		token, ok := bearerToken(r.Header.Get("Authorization"))
		if !ok {
			unauthorized(w)
			return
		}
		claims, err := s.deps.Verifier.Verify(r.Context(), token)
		if err != nil {
			// The reason never contains the token.
			if errors.Is(err, auth.ErrKeysUnavailable) {
				s.deps.Logger.Error("token not verified: signing keys unavailable", "reason", err.Error())
			} else {
				s.deps.Logger.Info("token rejected", "reason", err.Error())
			}
			unauthorized(w)
			return
		}
		u, err := s.users.FindOrCreate(r.Context(), claims.Subject, claims.Email, s.deps.Clock.Now())
		if err != nil {
			s.deps.Logger.Error("find or create user", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), userKey{}, u)))
	}
}

func (s *server) getMe(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r.Context())
	writeJSON(w, http.StatusOK, map[string]string{"id": u.ID, "email": u.Email})
}
