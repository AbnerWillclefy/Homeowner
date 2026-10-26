package server

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// adminRoute is one route of the operator API. Every one sits on the admin
// sub-mux, which is wrapped once in requireSuperAdmin (ADR 0017), so a route
// added to adminRoutes cannot skip the guard.
type adminRoute struct {
	method, pattern string
	handler         func(s *server, w http.ResponseWriter, r *http.Request)
}

// adminRoutes is the admin route table. Patterns carry their full path.
var adminRoutes = []adminRoute{
	{http.MethodGet, "/admin/me", (*server).adminMe},
}

// adminMux builds the sub-mux from the table. Unknown /admin/ paths 404 here,
// but only a super admin gets that far: the guard answers everyone else first.
func (s *server) adminMux() http.Handler {
	mux := http.NewServeMux()
	for _, r := range adminRoutes {
		handle := r.handler
		mux.HandleFunc(r.method+" "+r.pattern, func(w http.ResponseWriter, req *http.Request) {
			handle(s, w, req)
		})
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
	})
	return mux
}

// adminMe tells the maintainer's app which environment it is talking to.
func (s *server) adminMe(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"environment": s.deps.Environment})
}
