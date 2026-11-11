// Package pluggytest is a fake Pluggy: an httptest server that replays the
// sandbox capture in testdata/sandbox, so the real adapter runs in tests and
// CI never calls Pluggy. It is a separate package so the embedded fixtures
// never reach the production binary; only tests import it. The card
// transactions' amounts are negated from the capture: the sandbox signs a card
// purchase negative, real cards and Pluggy's docs sign it positive.
package pluggytest

import (
	"embed"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

//go:embed testdata/sandbox/*.json
var fixtures embed.FS

// What the fake accepts and serves; all but the credentials come from the capture.
const (
	ClientID      = "test-client-id"
	ClientSecret  = "test-client-secret"
	APIKey        = "test-api-key"
	ConnectToken  = "test-connect-token"
	ItemID        = "72ff2ef2-60b0-42d5-9514-7b9a55eb4267"
	UnknownItemID = "00000000-0000-4000-8000-0000000000ff"
	// EmptyItemID is an Item with no checking, savings or card accounts.
	EmptyItemID       = "00000000-0000-4000-8000-0000000000ee"
	CheckingAccountID = "7e5bc95d-85bb-4b3a-9b97-58d456872529"
	CardAccountID     = "8e09cce6-cf99-433f-9d73-f9bd99b9ca3f"
	// FailBody is the body a forced failure answers, so a test can check it
	// never reaches an error or a log.
	FailBody = "FIXTURE-BODY-must-not-leak"

	// secondPageCursor is the query the fake gives as "next" on the checking
	// account's first page; the capture fits in one page, so page 2 is synthetic.
	secondPageCursor = "?accountId=" + CheckingAccountID + "&after=synthetic-page-2"
)

// Server is the fake Pluggy.
type Server struct {
	*httptest.Server
	mu    sync.Mutex
	fails map[string]int
}

// NewServer starts the fake and stops it when the test ends.
func NewServer(t testing.TB) *Server {
	s := &Server{fails: map[string]int{}}
	s.Server = httptest.NewServer(http.HandlerFunc(s.serve))
	t.Cleanup(s.Close)
	return s
}

// Fail makes every request to path (without its query) answer status with FailBody.
func (s *Server) Fail(path string, status int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.fails[path] = status
}

func (s *Server) serve(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	status, failed := s.fails[r.URL.Path]
	s.mu.Unlock()
	if failed {
		http.Error(w, FailBody, status)
		return
	}
	q := r.URL.Query()
	switch r.Method + " " + r.URL.Path {
	case "POST /auth":
		var body struct{ ClientID, ClientSecret string }
		_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10)).Decode(&body)
		if body.ClientID != ClientID || body.ClientSecret != ClientSecret {
			serveFixture(w, 401, "auth_401.json")
			return
		}
		serveFixture(w, 200, "auth.json")
	case "POST /connect_token":
		if authorized(w, r) {
			serveFixture(w, 200, "connect_token.json")
		}
	case "GET /items/" + EmptyItemID, "GET /items/" + ItemID:
		if authorized(w, r) {
			serveFixture(w, 200, "item.json")
		}
	case "GET /accounts":
		if !authorized(w, r) {
			return
		}
		if q.Get("itemId") == EmptyItemID {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"results":[]}`))
			return
		}
		if q.Get("itemId") != ItemID {
			serveFixture(w, 404, "item_404.json")
			return
		}
		serveFixture(w, 200, "accounts.json")
	case "GET /bills":
		if !authorized(w, r) {
			return
		}
		if q.Get("accountId") == CardAccountID {
			serveFixture(w, 200, "bills.json")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[]}`))
	case "GET /v2/transactions":
		if authorized(w, r) {
			s.transactions(w, q.Get("accountId"), q.Get("after"), q.Get("dateFrom") != "" && q.Get("dateTo") != "" || q.Get("after") != "")
		}
	default:
		// Includes GET /items/<other> and the removed v1 GET /transactions.
		serveFixture(w, 404, "item_404.json")
	}
}

func (s *Server) transactions(w http.ResponseWriter, account, after string, haveDates bool) {
	switch {
	case !haveDates:
		http.Error(w, "dateFrom and dateTo are required", http.StatusBadRequest)
	case account == CardAccountID && after == "":
		serveFixture(w, 200, "transactions_card_page1.json")
	case account == CheckingAccountID && after == "":
		// The capture fits in one page; point its "next" at the synthetic one.
		var page map[string]json.RawMessage
		_ = json.Unmarshal(fixture("transactions_checking_page1.json"), &page)
		page["next"], _ = json.Marshal(secondPageCursor)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(page)
	case account == CheckingAccountID && after == "synthetic-page-2":
		serveFixture(w, 200, "transactions_checking_page2_synthetic.json")
	default:
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[],"next":null}`))
	}
}

// authorized answers 401 itself unless the request carries the fake's API key.
func authorized(w http.ResponseWriter, r *http.Request) bool {
	if r.Header.Get("X-API-KEY") == APIKey {
		return true
	}
	serveFixture(w, 401, "auth_401.json")
	return false
}

func fixture(name string) []byte {
	b, err := fixtures.ReadFile("testdata/sandbox/" + name)
	if err != nil {
		panic(err)
	}
	return b
}

func serveFixture(w http.ResponseWriter, status int, name string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(fixture(name))
}
