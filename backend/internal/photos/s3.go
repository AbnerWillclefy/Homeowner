package photos

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
)

// S3 is the ObjectStore over an AWS S3 bucket.
type S3 struct {
	client  *s3.Client
	presign *s3.PresignClient
	bucket  string
	log     *slog.Logger
}

// NewS3 returns an S3 store over bucket.
func NewS3(client *s3.Client, bucket string) *S3 {
	return &S3{client: client, presign: s3.NewPresignClient(client), bucket: bucket, log: slog.Default()}
}

// PresignPut signs a PUT of key that binds the content type and the exact
// size, valid for UploadTTL. The signature is made with the API role's own
// credentials, so that role must itself hold s3:PutObject: S3 checks the
// signer's permission when the URL is used. The URL also dies with those
// credentials if they expire before UploadTTL.
func (s *S3) PresignPut(ctx context.Context, key, contentType string, size int64) (Upload, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
	}, s3.WithPresignExpires(UploadTTL))
	if err != nil {
		return Upload{}, fmt.Errorf("presign put %s: %w", key, err)
	}
	return Upload{URL: req.URL, Method: req.Method, Headers: map[string]string{"Content-Type": contentType}}, nil
}

// Head returns the object's size and type. The API role has no s3:ListBucket,
// so S3 answers 403, not 404, for a missing key; both mean ErrNotFound.
func (s *S3) Head(ctx context.Context, key string) (Object, error) {
	out, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil {
		var nf *types.NotFound
		if errors.As(err, &nf) || httpStatus(err) == http.StatusNotFound {
			return Object{}, ErrNotFound
		}
		if httpStatus(err) == http.StatusForbidden {
			s.log.Info("photo head answered 403, treating as not found", "key", key)
			return Object{}, ErrNotFound
		}
		return Object{}, fmt.Errorf("head %s: %w", key, err)
	}
	return Object{Size: aws.ToInt64(out.ContentLength), ContentType: aws.ToString(out.ContentType)}, nil
}

// ReadPrefix reads the first n bytes with a ranged GET.
func (s *S3) ReadPrefix(ctx context.Context, key string, n int) ([]byte, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Range:  aws.String(fmt.Sprintf("bytes=0-%d", n-1)),
	})
	if err != nil {
		var nk *types.NoSuchKey
		if errors.As(err, &nk) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("read prefix of %s: %w", key, err)
	}
	defer out.Body.Close()
	b, err := io.ReadAll(io.LimitReader(out.Body, int64(n)))
	if err != nil {
		return nil, fmt.Errorf("read prefix of %s: %w", key, err)
	}
	return b, nil
}

// Copy copies src to dst, replacing the metadata with contentType and
// CacheControl.
func (s *S3) Copy(ctx context.Context, src, dst, contentType string) error {
	_, err := s.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:            aws.String(s.bucket),
		Key:               aws.String(dst),
		CopySource:        aws.String(s.bucket + "/" + escapeKey(src)),
		MetadataDirective: types.MetadataDirectiveReplace,
		ContentType:       aws.String(contentType),
		CacheControl:      aws.String(CacheControl),
	})
	if err != nil {
		return fmt.Errorf("copy %s to %s: %w", src, dst, err)
	}
	return nil
}

// Delete removes key. S3 answers success for a missing key.
func (s *S3) Delete(ctx context.Context, key string) error {
	if _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)}); err != nil {
		return fmt.Errorf("delete %s: %w", key, err)
	}
	return nil
}

// escapeKey percent-encodes each path segment, as CopySource requires.
func escapeKey(key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}

// httpStatus returns the HTTP status of an S3 error, or 0.
func httpStatus(err error) int {
	var re interface{ HTTPStatusCode() int }
	if errors.As(err, &re) {
		return re.HTTPStatusCode()
	}
	var ae smithy.APIError
	if errors.As(err, &ae) {
		switch ae.ErrorCode() {
		case "NotFound", "NoSuchKey":
			return http.StatusNotFound
		case "Forbidden", "AccessDenied":
			return http.StatusForbidden
		}
	}
	return 0
}
