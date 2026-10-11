// Package apitest is the harness for black-box API tests (seam 1). It runs the
// real HTTP server against a real, isolated Postgres database, with the
// outside world faked at its boundary.
//
// App.SignInAs(email) returns a client signed in through the fake token
// verifier, never real Cognito. Later tickets add the fake LLM client and wire
// it into server.Deps in Start.
package apitest

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/auth"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/db"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/server"
)

// StartTime is the fixed instant the fake clock starts at (not midnight).
var StartTime = time.Date(2026, 3, 4, 9, 0, 0, 0, time.UTC)

// App is a running API for one test.
type App struct {
	URL   string
	Clock *clock.Fake
	DB    *pgxpool.Pool
	Logs  *LogBuffer
	// Push is the fake Web Push sender; nil unless started WithPush.
	Push *push.Fake
	// Auth is the fake token verifier; nil when started WithoutAuth.
	Auth *auth.Fake
}

// Response is a decoded HTTP response.
type Response struct {
	Status int
	Header http.Header
	Raw    []byte
	// Body is the response decoded as a JSON object; nil if it is not one.
	Body map[string]any
}

// Option adjusts the server.Deps a test starts the API with.
type Option func(*server.Deps)

// WithCORSAllowedOrigins sets the browser origins the API accepts.
func WithCORSAllowedOrigins(origins ...string) Option {
	return func(d *server.Deps) { d.CORSAllowedOrigins = origins }
}

// WithPush configures push with a recording fake sender and the given public
// VAPID key; the fake is exposed as App.Push.
func WithPush(publicKey string) Option {
	return func(d *server.Deps) {
		d.Push = push.NewFake()
		d.VAPIDPublicKey = publicKey
	}
}

// WithoutAuth leaves the token verifier unconfigured (nil), so routes that
// need a signed-in User answer 503.
func WithoutAuth() Option {
	return func(d *server.Deps) { d.Verifier = nil }
}

// Start boots the API on a fresh database cloned from the migrated template.
func Start(t testing.TB, opts ...Option) *App {
	t.Helper()
	dbURL := NewMigratedDatabase(t)

	pool, err := db.Connect(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("apitest: connect: %v", err)
	}
	// Registered after the database cleanup, so it runs first (LIFO) and the
	// DROP DATABASE does not see open connections.
	t.Cleanup(pool.Close)

	fake := clock.NewFake(StartTime)
	logs := &LogBuffer{}
	deps := server.Deps{
		DB:     pool,
		Clock:  fake,
		Logger: slog.New(slog.NewJSONHandler(logs, nil)),
		// Tests sign in through the fake, never real Cognito.
		Verifier: auth.NewFake(),
	}
	for _, opt := range opts {
		opt(&deps)
	}
	srv := httptest.NewServer(server.New(deps))
	t.Cleanup(srv.Close)

	app := &App{URL: srv.URL, Clock: fake, DB: pool, Logs: logs}
	app.Push, _ = deps.Push.(*push.Fake)
	app.Auth, _ = deps.Verifier.(*auth.Fake)
	return app
}

// Client is a signed-in caller: every request carries its bearer token.
type Client struct {
	app    *App
	Token  string
	header http.Header
}

// SignInAs returns a Client signed in as the person with email. The same
// email is the same User; a different email is a different one. It needs the
// fake verifier, so it fails the test under WithoutAuth.
func (a *App) SignInAs(email string) *Client {
	if a.Auth == nil {
		panic("apitest: SignInAs needs the fake verifier (do not use WithoutAuth)")
	}
	return a.client(a.Auth.SignIn(email))
}

// SignInAsSubject is SignInAs for a given Cognito subject, to model a person
// whose email changed in Cognito.
func (a *App) SignInAsSubject(sub, email string) *Client {
	if a.Auth == nil {
		panic("apitest: SignInAsSubject needs the fake verifier (do not use WithoutAuth)")
	}
	return a.client(a.Auth.SignInSubject(sub, email))
}

func (a *App) client(token string) *Client {
	return &Client{app: a, Token: token, header: http.Header{"Authorization": {"Bearer " + token}}}
}

// Get sends GET path as this User.
func (c *Client) Get(path string) Response { return c.Do(http.MethodGet, path, nil, nil) }

// Post sends body as JSON to path as this User.
func (c *Client) Post(path string, body any) Response {
	return c.Do(http.MethodPost, path, body, nil)
}

// Put sends body as JSON to path as this User.
func (c *Client) Put(path string, body any) Response {
	return c.Do(http.MethodPut, path, body, nil)
}

// Do sends method path as this User, with an optional JSON body and extra
// request headers.
func (c *Client) Do(method, path string, body any, extra http.Header) Response {
	h := c.header.Clone()
	for k, vs := range extra {
		for _, v := range vs {
			h.Add(k, v)
		}
	}
	return c.app.doWith(method, path, body, h)
}

// Get sends GET path to the server.
func (a *App) Get(path string) Response { return a.do(http.MethodGet, path, nil) }

// Post sends body as JSON to path.
func (a *App) Post(path string, body any) Response { return a.do(http.MethodPost, path, body) }

// Put sends body as JSON to path.
func (a *App) Put(path string, body any) Response { return a.do(http.MethodPut, path, body) }

// SendRaw sends method path with a raw body, for malformed or oversized input.
func (a *App) SendRaw(method, path string, body []byte) Response {
	req, err := http.NewRequest(method, a.URL+path, bytes.NewReader(body))
	if err != nil {
		panic(err)
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	out := Response{Status: res.StatusCode, Header: res.Header, Raw: raw}
	_ = json.Unmarshal(raw, &out.Body)
	return out
}

// Do sends method path with the given request headers and no body.
func (a *App) Do(method, path string, header http.Header) Response {
	return a.doWith(method, path, nil, header)
}

func (a *App) do(method, path string, body any) Response {
	return a.doWith(method, path, body, nil)
}

func (a *App) doWith(method, path string, body any, header http.Header) Response {
	var rd io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			panic(err)
		}
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, a.URL+path, rd)
	if err != nil {
		panic(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, vs := range header {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	out := Response{Status: res.StatusCode, Header: res.Header, Raw: raw}
	_ = json.Unmarshal(raw, &out.Body)
	return out
}

// LogBuffer is a goroutine-safe io.Writer that captures server logs.
type LogBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (l *LogBuffer) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.buf.Write(p)
}

func (l *LogBuffer) String() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.buf.String()
}

// Contains reports whether the captured logs contain s.
func (l *LogBuffer) Contains(s string) bool { return strings.Contains(l.String(), s) }
