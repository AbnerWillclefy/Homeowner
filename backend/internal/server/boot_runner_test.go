package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRunSectionsIsolatesFailuresAndRunsConcurrently(t *testing.T) {
	t.Parallel()
	aReady, bReady := make(chan struct{}), make(chan struct{})
	meet := func(mine, theirs chan struct{}) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) {
			close(mine)
			select {
			case <-theirs:
				w.Write([]byte(`{"ok":true}`))
			case <-time.After(2 * time.Second):
				http.Error(w, `{"error":"serial"}`, http.StatusGatewayTimeout)
			}
		}
	}
	secs := []section{
		{"/a", meet(aReady, bReady)},
		{"/b", meet(bReady, aReady)},
		{"/boom", func(http.ResponseWriter, *http.Request) { panic("boom") }},
		{"/fail", func(w http.ResponseWriter, _ *http.Request) { http.Error(w, `{"error":"x"}`, 500) }},
		{"/q?month=2026-03", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`"` + r.URL.Query().Get("month") + `"`)) }},
	}
	got := runSections(httptest.NewRequest("GET", "/boot", nil), secs, slog.New(slog.NewTextHandler(io.Discard, nil)))
	want := map[string]int{"/a": 200, "/b": 200, "/boom": 500, "/fail": 500, "/q?month=2026-03": 200}
	for k, st := range want {
		if got[k].Status != st {
			t.Errorf("%s = %d, want %d", k, got[k].Status, st)
		}
	}
	if string(got["/boom"].Body) != `{"error":"internal error"}` {
		t.Errorf("panic body = %s", got["/boom"].Body)
	}
	if string(got["/q?month=2026-03"].Body) != `"2026-03"` {
		t.Errorf("query not passed: %s", got["/q?month=2026-03"].Body)
	}
}
