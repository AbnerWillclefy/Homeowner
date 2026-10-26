package server

import (
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/homes"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/auth"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

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
	httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
}

// verifiedClaims answers the request itself (503 or 401) and returns ok=false
// when the caller has no valid token. Every verification failure is the same
// 401; with no Verifier configured it fails closed with 503.
func (s *server) verifiedClaims(w http.ResponseWriter, r *http.Request) (auth.Claims, bool) {
	if s.deps.Verifier == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "auth not configured")
		return auth.Claims{}, false
	}
	token, ok := bearerToken(r.Header.Get("Authorization"))
	if !ok {
		unauthorized(w)
		return auth.Claims{}, false
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
		return auth.Claims{}, false
	}
	return claims, true
}

// requireUser wraps a handler so it only runs for a signed-in User, whom it
// finds or creates on first sight.
func (s *server) requireUser(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := s.verifiedClaims(w, r)
		if !ok {
			return
		}
		u, err := s.users.FindOrCreate(r.Context(), claims.Subject, claims.Email, s.deps.Clock.Now())
		if err != nil {
			s.deps.Logger.Error("find or create user", "error", err.Error())
			httpx.WriteError(w, http.StatusInternalServerError, "internal error")
			return
		}
		next(w, r.WithContext(identity.WithUser(r.Context(), u)))
	}
}

// superAdminGroup is the Cognito group whose members may call /admin/ routes.
const superAdminGroup = "super-admin"

// requireSuperAdmin wraps a handler so it only runs for a caller whose ID
// token names the super-admin group (ADR 0017). It verifies the token like
// requireUser, but never finds or creates a User and never looks at a Home:
// the role says nothing about Homes. No valid token is 401, no group is 403.
func (s *server) requireSuperAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := s.verifiedClaims(w, r)
		if !ok {
			return
		}
		if !slices.Contains(claims.Groups, superAdminGroup) {
			s.deps.Logger.Info("admin access refused", "path", r.URL.Path)
			httpx.WriteError(w, http.StatusForbidden, "forbidden")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requireResident wraps a handler so it only runs for a signed-in User who
// lives in a Home, which it puts in the context. A User with no Home gets 404.
// Every route on a Home's data goes behind it, so "any Resident" and "no
// access to another Home" are one code path.
func (s *server) requireResident(next http.HandlerFunc) http.HandlerFunc {
	return s.requireUser(func(w http.ResponseWriter, r *http.Request) {
		m, err := s.homes.ForUser(r.Context(), identity.CurrentUser(r.Context()).ID)
		if errors.Is(err, homes.ErrNoHome) {
			httpx.WriteError(w, http.StatusNotFound, "no home")
			return
		}
		if err != nil {
			s.deps.Logger.Error("load home", "error", err.Error())
			httpx.WriteError(w, http.StatusInternalServerError, "internal error")
			return
		}
		next(w, r.WithContext(identity.WithMembership(r.Context(), m)))
	})
}
