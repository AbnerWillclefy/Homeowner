package photos

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// StoredObject is one object in the Fake.
type StoredObject struct {
	Bytes        []byte
	ContentType  string
	CacheControl string
}

// Presigned is one presign the Fake recorded: what the upload binds.
type Presigned struct {
	Key         string
	ContentType string
	Size        int64
}

// Fake is an in-memory ObjectStore for tests. Safe for concurrent use.
type Fake struct {
	mu       sync.Mutex
	objects  map[string]StoredObject
	presign  []Presigned
	failDel  map[string]bool
	failSign bool
}

// NewFake returns an empty Fake.
func NewFake() *Fake {
	return &Fake{objects: map[string]StoredObject{}, failDel: map[string]bool{}}
}

// Upload simulates the browser's PUT to a presigned URL.
func (f *Fake) Upload(key string, bytes []byte, contentType string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.objects[key] = StoredObject{Bytes: append([]byte(nil), bytes...), ContentType: contentType}
}

// Objects returns a copy of every stored object by key.
func (f *Fake) Objects() map[string]StoredObject {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make(map[string]StoredObject, len(f.objects))
	for k, v := range f.objects {
		out[k] = v
	}
	return out
}

// Presigned returns every presign recorded, in order.
func (f *Fake) Presigned() []Presigned {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]Presigned(nil), f.presign...)
}

// FailDelete makes Delete of key fail, to test best-effort cleanup.
func (f *Fake) FailDelete(key string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.failDel[key] = true
}

// PresignPut records the bound type and size and returns a fake URL.
func (f *Fake) PresignPut(_ context.Context, key, contentType string, size int64) (Upload, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.presign = append(f.presign, Presigned{Key: key, ContentType: contentType, Size: size})
	return Upload{
		URL:     "https://uploads.test/" + key + "?signed=fake",
		Method:  "PUT",
		Headers: map[string]string{"Content-Type": contentType},
	}, nil
}

// Head answers the stored object's size and type, or ErrNotFound.
func (f *Fake) Head(_ context.Context, key string) (Object, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	o, ok := f.objects[key]
	if !ok {
		return Object{}, ErrNotFound
	}
	return Object{Size: int64(len(o.Bytes)), ContentType: o.ContentType}, nil
}

// ReadPrefix answers the first n bytes.
func (f *Fake) ReadPrefix(_ context.Context, key string, n int) ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	o, ok := f.objects[key]
	if !ok {
		return nil, ErrNotFound
	}
	if n > len(o.Bytes) {
		n = len(o.Bytes)
	}
	return append([]byte(nil), o.Bytes[:n]...), nil
}

// Copy stores src's bytes under dst with the type and CacheControl.
func (f *Fake) Copy(_ context.Context, src, dst, contentType string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	o, ok := f.objects[src]
	if !ok {
		return ErrNotFound
	}
	f.objects[dst] = StoredObject{Bytes: o.Bytes, ContentType: contentType, CacheControl: CacheControl}
	return nil
}

// Delete removes key, unless FailDelete was set for it.
func (f *Fake) Delete(_ context.Context, key string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.failDel[key] {
		return errors.New(fmt.Sprintf("fake delete failure for %s", key))
	}
	delete(f.objects, key)
	return nil
}
