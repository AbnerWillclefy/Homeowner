package photos_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/photos"
)

// stubHTTP answers every request with a fixed status and body, and records
// the last request.
type stubHTTP struct {
	status int
	body   string
	last   *http.Request
}

func (s *stubHTTP) Do(r *http.Request) (*http.Response, error) {
	s.last = r
	return &http.Response{
		StatusCode: s.status,
		Header:     http.Header{"Etag": {`"abc"`}, "Content-Type": {"application/xml"}},
		Body:       io.NopCloser(strings.NewReader(s.body)),
		Request:    r,
	}, nil
}

func stubbedStore(status int, body string) (*photos.S3, *stubHTTP) {
	stub := &stubHTTP{status: status, body: body}
	client := s3.New(s3.Options{
		Region:           "us-east-1",
		Credentials:      credentials.NewStaticCredentialsProvider("AKIATEST", "secret", ""),
		HTTPClient:       stub,
		RetryMaxAttempts: 1,
	})
	return photos.NewS3(client, "photos-bucket"), stub
}

func TestS3HeadOnlyMapsA404ToNotFound(t *testing.T) {
	for name, tc := range map[string]struct {
		status       int
		wantNotFound bool
	}{
		"404": {http.StatusNotFound, true},
		"403": {http.StatusForbidden, false},
		"500": {http.StatusInternalServerError, false},
	} {
		store, _ := stubbedStore(tc.status, "")
		_, err := store.Head(context.Background(), "pending/u/abc")
		if err == nil || errors.Is(err, photos.ErrNotFound) != tc.wantNotFound {
			t.Errorf("%s: err = %v, want not found = %v", name, err, tc.wantNotFound)
		}
	}
}

func TestS3HeadReturnsTheETag(t *testing.T) {
	store, _ := stubbedStore(http.StatusOK, "")
	obj, err := store.Head(context.Background(), "pending/u/abc")
	if err != nil || obj.ETag != `"abc"` {
		t.Errorf("obj = %+v, err = %v", obj, err)
	}
}

func TestS3CopyIsConditionalOnTheETag(t *testing.T) {
	store, stub := stubbedStore(http.StatusOK, `<CopyObjectResult><ETag>"x"</ETag></CopyObjectResult>`)
	if err := store.Copy(context.Background(), "pending/u/abc", "avatars/x.webp", "image/webp", `"abc"`); err != nil {
		t.Fatal(err)
	}
	if got := stub.last.Header.Get("X-Amz-Copy-Source-If-Match"); got != `"abc"` {
		t.Errorf("If-Match header = %q", got)
	}

	store, _ = stubbedStore(http.StatusPreconditionFailed, `<Error><Code>PreconditionFailed</Code><Message>x</Message></Error>`)
	err := store.Copy(context.Background(), "pending/u/abc", "avatars/x.webp", "image/webp", `"old"`)
	if !errors.Is(err, photos.ErrChanged) {
		t.Errorf("err = %v, want ErrChanged", err)
	}
}

// The presigned upload must bind the content type and the exact size: both
// headers have to be part of the signature, or a browser could send anything.
func TestS3PresignBindsContentTypeAndSize(t *testing.T) {
	client := s3.New(s3.Options{
		Region:      "us-east-1",
		Credentials: credentials.NewStaticCredentialsProvider("AKIATEST", "secret", ""),
	})
	store := photos.NewS3(client, "photos-bucket")

	up, err := store.PresignPut(context.Background(), "pending/u/abc", "image/webp", 1234)
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(up.URL)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(u.Host, "photos-bucket") || !strings.HasSuffix(u.Path, "/pending/u/abc") {
		t.Errorf("url = %s", up.URL)
	}
	signed := strings.Split(u.Query().Get("X-Amz-SignedHeaders"), ";")
	for _, want := range []string{"content-length", "content-type"} {
		found := false
		for _, h := range signed {
			found = found || h == want
		}
		if !found {
			t.Errorf("SignedHeaders = %v, want %s in it", signed, want)
		}
	}
	if u.Query().Get("X-Amz-Expires") != "300" {
		t.Errorf("X-Amz-Expires = %q, want 300", u.Query().Get("X-Amz-Expires"))
	}
	if up.Method != "PUT" || up.Headers["Content-Type"] != "image/webp" {
		t.Errorf("method/headers = %s %v", up.Method, up.Headers)
	}
}
