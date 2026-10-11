package push_test

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/SherClockHolmes/webpush-go"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
)

// browserSubscription builds the key material a browser would hand over, with
// the endpoint pointing at a stand-in push service.
func browserSubscription(t *testing.T, endpoint string) push.Subscription {
	t.Helper()
	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	auth := make([]byte, 16)
	if _, err := rand.Read(auth); err != nil {
		t.Fatal(err)
	}
	return push.Subscription{
		Endpoint: endpoint,
		P256dh:   base64.RawURLEncoding.EncodeToString(key.PublicKey().Bytes()),
		Auth:     base64.RawURLEncoding.EncodeToString(auth),
	}
}

func newSender(t *testing.T) *push.WebPushSender {
	t.Helper()
	return newSenderWithSubject(t, "mailto:ops@example.com")
}

func newSenderWithSubject(t *testing.T, subject string) *push.WebPushSender {
	t.Helper()
	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatal(err)
	}
	return push.NewWebPushSender(pub, priv, subject)
}

// vapidSubject sends one message to a stand-in push service and returns the
// "sub" claim of the VAPID JWT it received.
func vapidSubject(t *testing.T, subject string) string {
	t.Helper()
	var auth string
	svc := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusCreated)
	}))
	defer svc.Close()
	if err := newSenderWithSubject(t, subject).Send(context.Background(), browserSubscription(t, svc.URL), push.Payload{Title: "t"}); err != nil {
		t.Fatalf("Send: %v", err)
	}
	// Header shape: vapid t=<jwt>, k=<key>
	rest, ok := strings.CutPrefix(auth, "vapid t=")
	if !ok {
		t.Fatalf("Authorization = %q, want a vapid header", auth)
	}
	token, _, _ := strings.Cut(rest, ", k=")
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("Authorization = %q, want a JWT", auth)
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	var claims struct {
		Sub string `json:"sub"`
	}
	if err := json.Unmarshal(raw, &claims); err != nil {
		t.Fatal(err)
	}
	return claims.Sub
}

func TestWebPushSenderSignsWithTheSubjectNormalised(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ name, subject, want string }{
		{"mailto prefix", "mailto:x@y.z", "mailto:x@y.z"},
		{"bare address", "x@y.z", "mailto:x@y.z"},
		{"https url", "https://example.com/contact", "https://example.com/contact"},
		{"padded mailto", " mailto:x@y.z ", "mailto:x@y.z"},
		{"upper-case mailto", "MAILTO:x@y.z", "mailto:x@y.z"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := vapidSubject(t, tc.subject); got != tc.want {
				t.Errorf("sub = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestWebPushSenderPostsAnEncryptedVAPIDSignedMessage(t *testing.T) {
	t.Parallel()
	var got http.Header
	var bodyLen int
	svc := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
		buf := make([]byte, 8192)
		bodyLen, _ = r.Body.Read(buf)
		w.WriteHeader(http.StatusCreated)
	}))
	defer svc.Close()

	err := newSender(t).Send(context.Background(), browserSubscription(t, svc.URL), push.Payload{Title: "t", Body: "b", URL: "/"})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if !strings.HasPrefix(got.Get("Authorization"), "vapid ") {
		t.Errorf("Authorization = %q, want a vapid header", got.Get("Authorization"))
	}
	if got.Get("TTL") == "" || got.Get("TTL") == "0" {
		t.Errorf("TTL = %q, want a positive value", got.Get("TTL"))
	}
	if got.Get("Content-Encoding") != "aes128gcm" || bodyLen == 0 {
		t.Errorf("want an aes128gcm encrypted body, got encoding %q, %d bytes", got.Get("Content-Encoding"), bodyLen)
	}
}

func TestWebPushSenderMapsNotFoundAndGoneToErrGone(t *testing.T) {
	t.Parallel()
	for _, status := range []int{http.StatusNotFound, http.StatusGone} {
		svc := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(status)
		}))
		err := newSender(t).Send(context.Background(), browserSubscription(t, svc.URL), push.Payload{Title: "t"})
		svc.Close()
		if !errors.Is(err, push.ErrGone) {
			t.Errorf("status %d: err = %v, want ErrGone", status, err)
		}
	}
}

func TestWebPushSenderTreatsOtherStatusesAsPlainErrors(t *testing.T) {
	t.Parallel()
	svc := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer svc.Close()

	err := newSender(t).Send(context.Background(), browserSubscription(t, svc.URL), push.Payload{Title: "t"})

	if err == nil || errors.Is(err, push.ErrGone) {
		t.Fatalf("err = %v, want a non-gone error", err)
	}
}
