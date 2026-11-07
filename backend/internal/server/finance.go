package server

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// requireFinance wraps a handler so it only runs for a signed-in User whose
// verified email is on the allowlist. No token is 401 (requireUser); a User
// off the list, or an empty list, is 403.
func (s *server) requireFinance(allow finance.Allowlist, next http.Handler) http.Handler {
	return s.requireUser(func(w http.ResponseWriter, r *http.Request) {
		if !allow.Allows(identity.CurrentUser(r.Context()).Email) {
			s.deps.Logger.Info("finance access refused", "path", r.URL.Path)
			httpx.WriteError(w, http.StatusForbidden, "forbidden")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// financeMux holds the /me/finance routes. The guard wraps it once, so every
// path under the prefix, known or not, meets the allowlist first.
func financeMux() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /me/finance", finance.Status)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
	})
	return mux
}
