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

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/nudge"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/photos"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/auth"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/db"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/replan"
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
	// Photos is the fake object store; nil unless started WithPhotos.
	Photos *photos.Fake
	// Auth is the fake token verifier; nil when started WithoutAuth.
	Auth *auth.Fake
	// Planner is the Allocation job's planner over the same database. It
	// plans with the baseline allocator unless UseAllocator replaces it.
	Planner *dayplan.Planner

	alloc  *swapAllocator
	nudger dayplan.Nudger
	llm    dayplan.Option
	llmCfg dayplan.LLMConfig
}

// swapAllocator is the Allocator the server and the job share, so a test can
// change it after the server started.
type swapAllocator struct {
	mu    sync.Mutex
	inner allocation.Allocator
}

func (s *swapAllocator) get() allocation.Allocator {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.inner
}

func (s *swapAllocator) Name() string { return s.get().Name() }

func (s *swapAllocator) Plan(st allocation.State) (allocation.Result, error) {
	return s.get().Plan(st)
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

// PhotosBaseURL is the public base URL WithPhotos configures.
const PhotosBaseURL = "https://cdn.test/avatars"

// WithPhotos configures photos with an in-memory object store and the base
// URL PhotosBaseURL; the fake is exposed as App.Photos.
func WithPhotos() Option {
	return func(d *server.Deps) {
		d.Photos = photos.NewFake()
		d.PhotosBaseURL = PhotosBaseURL
	}
}

// WithReplanner switches the staging-only POST /dev/replan route on, backed by r
// (usually a *replan.Fake).
func WithReplanner(r replan.Replanner) Option {
	return func(d *server.Deps) { d.Replanner = r }
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

	pool, err := db.Connect(context.Background(), dbURL, 0)
	if err != nil {
		t.Fatalf("apitest: connect: %v", err)
	}
	// Registered after the database cleanup, so it runs first (LIFO) and the
	// DROP DATABASE does not see open connections.
	t.Cleanup(pool.Close)

	swappable := &swapAllocator{inner: allocation.Baseline{}}
	fake := clock.NewFake(StartTime)
	logs := &LogBuffer{}
	deps := server.Deps{
		DB:     pool,
		Clock:  fake,
		Logger: slog.New(slog.NewJSONHandler(logs, nil)),
		// Tests sign in through the fake, never real Cognito.
		Verifier: auth.NewFake(),
		// The API re-plans a Resident who checks in through the same Allocator
		// as the job, so UseAllocator reaches both.
		Allocator: swappable,
	}
	for _, opt := range opts {
		opt(&deps)
	}
	srv := httptest.NewServer(server.New(deps))
	t.Cleanup(srv.Close)

	app := &App{URL: srv.URL, Clock: fake, DB: pool, Logs: logs, alloc: swappable}
	app.Push, _ = deps.Push.(*push.Fake)
	app.Photos, _ = deps.Photos.(*photos.Fake)
	if app.Push != nil {
		// The job nudges through the same fake the server sends with.
		app.nudger = nudge.New(pool, app.Push, slog.New(slog.NewJSONHandler(logs, nil)))
	}
	app.UseAllocator(allocation.Baseline{})
	app.Auth, _ = deps.Verifier.(*auth.Fake)
	return app
}

// UseAllocator makes the Allocation job plan with al, for example a stub that
// proposes something the checker must reject.
func (a *App) UseAllocator(al allocation.Allocator) {
	if a.alloc != nil {
		a.alloc.mu.Lock()
		a.alloc.inner = al
		a.alloc.mu.Unlock()
	}
	var opts []dayplan.Option
	if a.nudger != nil {
		opts = append(opts, dayplan.WithNudger(a.nudger))
	}
	if a.llm != nil {
		opts = append(opts, a.llm)
	}
	a.Planner = dayplan.New(a.DB, al, slog.New(slog.NewJSONHandler(a.Logs, nil)), opts...)
}

// UseLLM makes the Allocation job ask p first, with a daily cap of dailyCap
// calls per Home and timeout per call, falling back to the current allocator.
func (a *App) UseLLM(p dayplan.Proposer, dailyCap int, timeout time.Duration) {
	a.llmCfg.Proposer, a.llmCfg.DailyCap, a.llmCfg.CallTimeout = p, dailyCap, timeout
	a.llm = dayplan.WithLLM(a.llmCfg)
	a.UseAllocator(a.alloc.get())
}

// UseExplainer makes the Allocation job explain each planned Home's Day Plan
// through e, with budget as the time for all the explanation calls of a tick
// (zero means the default). It shares the cap and the call timeout set by
// UseLLM, so call UseLLM first. Give it its own fake client, so the allocator
// and the explainer script and count their calls independently.
func (a *App) UseExplainer(e dayplan.Explainer, budget time.Duration) {
	a.llmCfg.Explainer, a.llmCfg.ExplainBudget = e, budget
	a.llm = dayplan.WithLLM(a.llmCfg)
	a.UseAllocator(a.alloc.get())
}

// RunAllocation runs the Allocation job once at the fake clock's current time,
// exactly as the scheduled tick does, and returns what it did.
func (a *App) RunAllocation(t testing.TB) dayplan.Summary {
	t.Helper()
	sum, err := a.Planner.RunDue(context.Background(), a.Clock.Now())
	if err != nil {
		t.Fatalf("apitest: RunAllocation: %v", err)
	}
	return sum
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

// JoinHome makes this User a Resident of the existing Home homeID by inserting
// the residents row directly, so tests do not depend on the Invite flow. The
// User is created if this is their first request.
func (c *Client) JoinHome(t testing.TB, homeID string) {
	t.Helper()
	me := c.Get("/me")
	id, _ := me.Body["id"].(string)
	if id == "" {
		t.Fatalf("apitest: JoinHome: GET /me = %d %s", me.Status, me.Raw)
	}
	_, err := c.app.DB.Exec(context.Background(),
		`INSERT INTO residents (user_id, home_id, created_at) VALUES ($1, $2, $3)`,
		id, homeID, c.app.Clock.Now())
	if err != nil {
		t.Fatalf("apitest: JoinHome: %v", err)
	}
}

// Delete sends DELETE path as this User.
func (c *Client) Delete(path string) Response { return c.Do(http.MethodDelete, path, nil, nil) }

// SendRaw sends method path with a raw body as this User, for malformed or
// oversized input.
func (c *Client) SendRaw(method, path string, body []byte) Response {
	return c.app.sendRaw(method, path, body, c.header)
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
	return a.sendRaw(method, path, body, nil)
}

func (a *App) sendRaw(method, path string, body []byte, header http.Header) Response {
	req, err := http.NewRequest(method, a.URL+path, bytes.NewReader(body))
	if err != nil {
		panic(err)
	}
	req.Header.Set("Content-Type", "application/json")
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
