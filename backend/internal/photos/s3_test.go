package photos_test

import (
	"context"
	"net/url"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/photos"
)

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
