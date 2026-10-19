// Package photos lets a User upload, replace and remove their photo (see
// CONTEXT.md, User). The browser uploads straight to a private bucket through
// a presigned URL; the API only signs it, checks what arrived and promotes it
// to a public key. The bucket sits behind the ObjectStore interface, so tests
// use the in-memory Fake as push tests use push.Fake.
package photos

import (
	"context"
	"errors"
	"time"
)

const (
	// MaxBytes is the largest photo accepted (512 KB). The web app uses the
	// same number.
	MaxBytes = 512 * 1024
	// UploadTTL is how long a presigned upload stays valid. The signature also
	// dies with the Lambda's session credentials if those expire first, which
	// does not matter at 5 minutes.
	UploadTTL = 5 * time.Minute
	// CacheControl is stored with each public photo. A removed photo may stay
	// cached for up to a day: an accepted trade-off.
	CacheControl = "public, max-age=86400, immutable"

	// ContentTypeWebP and ContentTypeJPEG are the only types accepted, compared
	// exactly (not image/jpg). JPEG is there because Safari cannot encode WebP.
	ContentTypeWebP = "image/webp"
	ContentTypeJPEG = "image/jpeg"
)

// extensions maps each accepted content type to its public key extension.
var extensions = map[string]string{
	ContentTypeWebP: "webp",
	ContentTypeJPEG: "jpg",
}

// Accepted reports whether contentType is one of the two accepted types.
func Accepted(contentType string) bool {
	_, ok := extensions[contentType]
	return ok
}

// ErrNotFound means the object does not exist.
var ErrNotFound = errors.New("photos: object not found")

// ErrChanged means the object was replaced after it was checked.
var ErrChanged = errors.New("photos: object changed")

// Upload is a presigned upload: the browser sends Method to URL with Headers
// and the bytes as the body.
type Upload struct {
	URL     string
	Method  string
	Headers map[string]string
}

// Object is what the store knows about a stored object.
type Object struct {
	Size        int64
	ContentType string
	// ETag identifies this version of the object; Copy takes it back so a
	// replaced object is not promoted.
	ETag string
}

// ObjectStore is the private bucket the photos live in.
type ObjectStore interface {
	// PresignPut signs an upload to key that binds contentType and the exact
	// size, valid for UploadTTL.
	PresignPut(ctx context.Context, key, contentType string, size int64) (Upload, error)
	// Head returns the object's size and type, or ErrNotFound.
	Head(ctx context.Context, key string) (Object, error)
	// ReadPrefix returns the first n bytes (fewer for a smaller object).
	ReadPrefix(ctx context.Context, key string, n int) ([]byte, error)
	// Copy copies src to dst with the given type and CacheControl, only if
	// src still has etag; otherwise it returns ErrChanged.
	Copy(ctx context.Context, src, dst, contentType, etag string) error
	// Delete removes key; deleting a missing key is not an error.
	Delete(ctx context.Context, key string) error
}
