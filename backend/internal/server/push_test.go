package server_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
)

// Valid base64url (unpadded) key material, as PushSubscription.toJSON() emits.
const (
	p256dhA = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"
	p256dhB = "BLc4xRzKlKORKWlbdgFaBrrPK3ydWAHo4M0gs0i1oEKgPpWC5cW8OCzVrOQRv-1npXRWk8udnW3oYhIO4475rds"
	authA   = "tBHItJI5svbpez7KI4CCXg"
	authB   = "8eDyX_uCN0XRhSbY5hs7Hg"

	endpointA = "https://push.example.com/send/device-a"
	endpointB = "https://push.example.com/send/device-b"
)

func subscription(endpoint, p256dh, auth string) map[string]any {
	return map[string]any{
		"endpoint": endpoint,
		"keys":     map[string]string{"p256dh": p256dh, "auth": auth},
	}
}

func countSubscriptions(t *testing.T, app *apitest.App) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), "SELECT count(*) FROM push_subscriptions").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestPushVAPIDPublicKeyIsServed(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("public-key-123"))

	res := app.Get("/push/vapid-public-key")

	if res.Status != http.StatusOK || res.Body["key"] != "public-key-123" {
		t.Fatalf("got %d %s, want 200 with the key", res.Status, res.Raw)
	}
}

func TestSubscribedDeviceReceivesTestNotification(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))

	if res := app.Put("/push/subscription", subscription(endpointA, p256dhA, authA)); res.Status != http.StatusNoContent {
		t.Fatalf("PUT status = %d (%s), want 204", res.Status, res.Raw)
	}
	if res := app.Post("/push/test", map[string]string{"endpoint": endpointA}); res.Status != http.StatusNoContent {
		t.Fatalf("POST status = %d (%s), want 204", res.Status, res.Raw)
	}

	sent := app.Push.Sent()
	if len(sent) != 1 {
		t.Fatalf("sends = %d, want 1", len(sent))
	}
	wantSub := push.Subscription{Endpoint: endpointA, P256dh: p256dhA, Auth: authA}
	if sent[0].Subscription != wantSub {
		t.Errorf("subscription = %+v, want %+v", sent[0].Subscription, wantSub)
	}
	p := sent[0].Payload
	if p.Title == "" || p.Body == "" || p.URL == "" {
		t.Errorf("payload must have title, body and url, got %+v", p)
	}
}

func TestSubscriptionTimestampsComeFromTheClock(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	app.Put("/push/subscription", subscription(endpointA, p256dhA, authA))
	app.Clock.Advance(time.Hour)
	app.Put("/push/subscription", subscription(endpointA, p256dhB, authB))

	var created, updated time.Time
	err := app.DB.QueryRow(context.Background(),
		"SELECT created_at, updated_at FROM push_subscriptions WHERE endpoint = $1", endpointA).Scan(&created, &updated)
	if err != nil {
		t.Fatal(err)
	}
	if !created.Equal(apitest.StartTime) {
		t.Errorf("created_at = %v, want %v", created, apitest.StartTime)
	}
	if !updated.Equal(apitest.StartTime.Add(time.Hour)) {
		t.Errorf("updated_at = %v, want one hour later", updated)
	}
}

func TestResubscribingSameEndpointReplacesKeysWithoutDuplicating(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))

	app.Put("/push/subscription", subscription(endpointA, p256dhA, authA))
	res := app.Put("/push/subscription", subscription(endpointA, p256dhB, authB))
	if res.Status != http.StatusNoContent {
		t.Fatalf("second PUT status = %d, want 204", res.Status)
	}
	if n := countSubscriptions(t, app); n != 1 {
		t.Fatalf("rows = %d, want 1", n)
	}

	app.Post("/push/test", map[string]string{"endpoint": endpointA})
	sent := app.Push.Sent()
	if len(sent) != 1 || sent[0].Subscription.P256dh != p256dhB || sent[0].Subscription.Auth != authB {
		t.Fatalf("send should use the new keys, got %+v", sent)
	}
}

func TestTestSendReachesOnlyTheEndpointAskedFor(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	app.Put("/push/subscription", subscription(endpointA, p256dhA, authA))
	app.Put("/push/subscription", subscription(endpointB, p256dhB, authB))
	if n := countSubscriptions(t, app); n != 2 {
		t.Fatalf("rows = %d, want 2 (one per device)", n)
	}

	app.Post("/push/test", map[string]string{"endpoint": endpointB})

	sent := app.Push.Sent()
	if len(sent) != 1 || sent[0].Subscription.Endpoint != endpointB {
		t.Fatalf("want exactly one send to B, got %+v", sent)
	}
}

func TestTestSendToUnknownEndpointIs404AndSendsNothing(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))

	res := app.Post("/push/test", map[string]string{"endpoint": endpointA})

	if res.Status != http.StatusNotFound || res.Body["error"] == nil {
		t.Fatalf("got %d %s, want 404 with error", res.Status, res.Raw)
	}
	if len(app.Push.Sent()) != 0 {
		t.Fatal("nothing should be sent")
	}
}

func TestGoneSubscriptionIsDeletedAnd410Returned(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	app.Put("/push/subscription", subscription(endpointA, p256dhA, authA))
	app.Push.AnswerGone(endpointA)

	res := app.Post("/push/test", map[string]string{"endpoint": endpointA})
	if res.Status != http.StatusGone {
		t.Fatalf("status = %d, want 410", res.Status)
	}
	if n := countSubscriptions(t, app); n != 0 {
		t.Fatalf("rows = %d, want the rejected subscription dropped", n)
	}
	if res := app.Post("/push/test", map[string]string{"endpoint": endpointA}); res.Status != http.StatusNotFound {
		t.Fatalf("following send status = %d, want 404", res.Status)
	}
}

func TestSenderErrorIs502AndKeepsTheRow(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))
	app.Put("/push/subscription", subscription(endpointA, p256dhA, authA))
	app.Push.AnswerError(endpointA)

	res := app.Post("/push/test", map[string]string{"endpoint": endpointA})

	if res.Status != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", res.Status)
	}
	if n := countSubscriptions(t, app); n != 1 {
		t.Fatalf("rows = %d, want the row kept", n)
	}
}

func TestInvalidPushRequestsAreRejectedAndStoreNothing(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithPush("k"))

	cases := []struct {
		name string
		body []byte
		want int
	}{
		{"http endpoint", []byte(`{"endpoint":"http://push.example.com/x","keys":{"p256dh":"` + p256dhA + `","auth":"` + authA + `"}}`), 400},
		{"not a url", []byte(`{"endpoint":"https://","keys":{"p256dh":"` + p256dhA + `","auth":"` + authA + `"}}`), 400},
		{"missing keys", []byte(`{"endpoint":"` + endpointA + `"}`), 400},
		{"missing auth", []byte(`{"endpoint":"` + endpointA + `","keys":{"p256dh":"` + p256dhA + `"}}`), 400},
		{"keys not base64url", []byte(`{"endpoint":"` + endpointA + `","keys":{"p256dh":"!!!","auth":"` + authA + `"}}`), 400},
		{"malformed json", []byte(`{"endpoint":`), 400},
		{"oversized body", []byte(`{"endpoint":"https://push.example.com/` + strings.Repeat("a", 64*1024) + `"}`), 413},
	}
	for _, c := range cases {
		res := app.SendRaw(http.MethodPut, "/push/subscription", c.body)
		if res.Status != c.want {
			t.Errorf("%s: status = %d, want %d", c.name, res.Status, c.want)
		}
		if res.Body["error"] == nil {
			t.Errorf("%s: want a JSON error, got %s", c.name, res.Raw)
		}
	}
	if n := countSubscriptions(t, app); n != 0 {
		t.Fatalf("rows = %d, want nothing stored", n)
	}

	for _, body := range [][]byte{[]byte(`{`), []byte(`{}`)} {
		if res := app.SendRaw(http.MethodPost, "/push/test", body); res.Status != http.StatusBadRequest {
			t.Errorf("POST /push/test %s: status = %d, want 400", body, res.Status)
		}
	}
}

func TestPushRoutesAnswer503WhenNotConfigured(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)

	for _, r := range []struct{ method, path string }{
		{http.MethodGet, "/push/vapid-public-key"},
		{http.MethodPut, "/push/subscription"},
		{http.MethodPost, "/push/test"},
	} {
		res := app.SendRaw(r.method, r.path, []byte(`{}`))
		if res.Status != http.StatusServiceUnavailable || res.Body["error"] != "push not configured" {
			t.Errorf("%s %s: got %d %s, want 503 push not configured", r.method, r.path, res.Status, res.Raw)
		}
	}
	if res := app.Get("/healthz"); res.Status != http.StatusOK {
		t.Fatalf("healthz = %d, want 200", res.Status)
	}
}
