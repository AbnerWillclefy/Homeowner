// Package nfcetest is a fake SEFAZ: an httptest server that answers the
// Ceará consultation with the captured fixture, so the real adapter runs in
// tests and CI never calls SEFAZ. Only tests import it.
package nfcetest

import (
	"embed"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

//go:embed testdata/*.html
var fixtures embed.FS

// Keys the fake serves. Both answer the same page (23-1.html); the second lets
// a test see a later trip with the same products.
const (
	Key      = "23261175315333015807655140000123451111111115"
	OtherKey = "23261175315333015807655140000123461111111112"
	// CPF and Name are planted in every fixture; no column or response may carry them.
	CPF  = "111.444.777-35"
	Name = "CONSUMIDOR TESTE"
	// Path is where the fake answers, as the table in nfce.Hosts has it.
	Path = "/nfce/api/notasFiscal/qrcodev3/"
)

// Server is the fake SEFAZ.
type Server struct {
	*httptest.Server
	mu       sync.Mutex
	hits     int
	status   int
	body     string
	delay    time.Duration
	redirect string
}

// NewServer starts the fake and stops it when the test ends.
func NewServer(t testing.TB) *Server {
	s := &Server{}
	s.Server = httptest.NewServer(http.HandlerFunc(s.serve))
	t.Cleanup(s.Close)
	return s
}

// Hits is how many requests the fake has received.
func (s *Server) Hits() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.hits
}

// Fail makes every answer status with body (raw, not JSON) from now on.
func (s *Server) Fail(status int, body string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status, s.body = status, body
}

// Delay holds each answer for d.
func (s *Server) Delay(d time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.delay = d
}

// RedirectTo makes every request answer a 302 to url.
func (s *Server) RedirectTo(url string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.redirect = url
}

func (s *Server) serve(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	s.hits++
	status, body, delay, redirect := s.status, s.body, s.delay, s.redirect
	s.mu.Unlock()
	time.Sleep(delay)
	if redirect != "" {
		http.Redirect(w, r, redirect, http.StatusFound)
		return
	}
	if status != 0 {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
		return
	}
	var req struct {
		Key string `json:"chave_acesso"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost || r.URL.Path != Path || (req.Key != Key && req.Key != OtherKey) {
		_ = json.NewEncoder(w).Encode(map[string]string{"erro": "999 - not found"})
		return
	}
	page, _ := fixtures.ReadFile("testdata/23-1.html")
	_ = json.NewEncoder(w).Encode(map[string]string{"xml": strings.TrimSpace(string(page))})
}

// Page is the fixture's HTML fragment, for parser tests.
func Page(name string) string {
	b, err := fixtures.ReadFile("testdata/" + name)
	if err != nil {
		panic(err)
	}
	return string(b)
}
