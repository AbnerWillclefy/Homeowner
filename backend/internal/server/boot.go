package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// gate is the access check a boot read needs, the same one its own route has.
type gate int

const (
	gateUser gate = iota
	gateResident
	gateFinance
)

// bootRead is one read GET /boot serves: the path its own route has, that
// route's handler, and the gate. A non-empty month names the query parameter
// that carries the PWA's ?month=, which GET /boot passes on.
type bootRead struct {
	path  string
	h     http.HandlerFunc
	gate  gate
	month string
}

// section is one answer of GET /boot: the key the PWA would request and the
// handler that answers it (a gate's refusal is a handler too).
type section struct {
	key string
	h   http.HandlerFunc
}

// bootSection is the answer to one request: its status and its body, byte for
// byte what the endpoint returns.
type bootSection struct {
	Status int             `json:"status"`
	Body   json.RawMessage `json:"body"`
}

// boot serves GET /boot behind requireUser: every read the home screen makes at
// app open, run in parallel, in one response that is 200 whatever a section
// does. Sections whose gate refuses are 404 no home or 503 finance not
// configured as their own routes answer; off the finance allowlist they are
// left out, and so are the month-bound ones when ?month is missing.
func (s *server) boot(allow finance.Allowlist, reads []bootRead) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		month := r.URL.Query().Get("month")
		resident, rstatus, rmsg := s.residentScope(r)
		financeStatus := s.financeGate(allow, identity.CurrentUser(r.Context()).Email)
		var secs []section
		for _, rd := range reads {
			key, h := rd.path, rd.h
			if rd.month != "" {
				if month == "" {
					continue
				}
				key += "?" + rd.month + "=" + url.QueryEscape(month)
			}
			switch {
			case rd.gate == gateResident && rstatus != 0:
				h = refuse(rstatus, rmsg)
			case rd.gate == gateFinance && financeStatus == http.StatusForbidden:
				continue
			case rd.gate == gateFinance && financeStatus != 0:
				h = refuse(financeStatus, "finance not configured")
			}
			secs = append(secs, section{key, h})
		}
		req := r
		if rstatus == 0 {
			req = resident
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"sections": runSections(req, secs, s.deps.Logger)})
	}
}

func refuse(status int, msg string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) { httpx.WriteError(w, status, msg) }
}

// runSections serves each section as a GET of its key in its own goroutine and
// collects the recorded answers. Each goroutine recovers its own panic, which
// recoverPanics cannot (it only covers the request's goroutine), into a 500
// section; every failing section is logged by key and status.
func runSections(r *http.Request, secs []section, log *slog.Logger) map[string]bootSection {
	out := make(map[string]bootSection, len(secs))
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, sec := range secs {
		wg.Go(func() {
			ans := serve(r, sec, log)
			if ans.Status >= http.StatusInternalServerError {
				log.Error("boot section failed", "section", sec.key, "status", ans.Status)
			}
			mu.Lock()
			out[sec.key] = ans
			mu.Unlock()
		})
	}
	wg.Wait()
	return out
}

func serve(r *http.Request, sec section, log *slog.Logger) (ans bootSection) {
	defer func() {
		if v := recover(); v != nil {
			log.Error("boot section panic recovered", "section", sec.key, "panic", v)
			ans = bootSection{http.StatusInternalServerError, json.RawMessage(`{"error":"internal error"}`)}
		}
	}()
	u, err := url.Parse(sec.key)
	if err != nil {
		return bootSection{http.StatusInternalServerError, json.RawMessage(`{"error":"internal error"}`)}
	}
	req := r.Clone(r.Context())
	req.Method, req.URL, req.RequestURI = http.MethodGet, u, sec.key
	rec := httptest.NewRecorder()
	sec.h(rec, req)
	body := rec.Body.Bytes()
	if !json.Valid(body) {
		body = []byte("null")
	}
	return bootSection{rec.Code, body}
}
