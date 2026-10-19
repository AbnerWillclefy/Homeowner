package photos

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

const (
	maxBody = 1024
	// sniffBytes covers the longest signature Sniff reads (12 bytes).
	sniffBytes = 16
)

// Keys stores the key of a User's photo. users.Store satisfies it; photos
// may import users, but users must never import photos.
type Keys interface {
	// SetPhotoKey stores key and returns the previous one (nil if none).
	SetPhotoKey(ctx context.Context, userID, key string, now time.Time) (*string, error)
	// ClearPhotoKey clears the key and returns the previous one.
	ClearPhotoKey(ctx context.Context, userID string, now time.Time) (*string, error)
}

// Handler serves the /me/photo routes.
type Handler struct {
	store ObjectStore
	keys  Keys
	url   func(*string) *string
	clock clock.Clock
	log   *slog.Logger
}

// NewHandler returns a Handler. A nil store means photos are off. url turns a
// stored key into the public URL.
func NewHandler(store ObjectStore, keys Keys, url func(*string) *string, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, keys: keys, url: url, clock: clk, log: log}
}

// RequireConfigured wraps a handler so it answers 503 when photos are off.
func (h *Handler) RequireConfigured(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h.store == nil {
			httpx.WriteError(w, http.StatusServiceUnavailable, "photos not configured")
			return
		}
		next(w, r)
	}
}

// Presign answers POST /me/photo/uploads with a short-lived presigned upload
// to a fresh pending key that binds the content type and exact size.
func (h *Handler) Presign(w http.ResponseWriter, r *http.Request) {
	var body uploadRequest
	if !httpx.DecodeBody(w, r, &body, maxBody, true) {
		return
	}
	if !Accepted(body.ContentType) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_type")
		return
	}
	if body.Size <= 0 || body.Size > MaxBytes {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_size")
		return
	}
	u := identity.CurrentUser(r.Context())
	key := NewPendingKey(u.ID)
	up, err := h.store.PresignPut(r.Context(), key, body.ContentType, body.Size)
	if err != nil {
		httpx.InternalError(w, h.log, "presign photo upload", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, uploadResponse{
		Key: key, URL: up.URL, Method: up.Method, Headers: up.Headers,
		ExpiresAt: h.clock.Now().Add(UploadTTL).UTC(),
	})
}

// Confirm answers PUT /me/photo: it checks the uploaded object, promotes it
// to a public key and stores that key on the User. Every check that fails
// answers 400 and changes nothing.
func (h *Handler) Confirm(w http.ResponseWriter, r *http.Request) {
	var body confirmRequest
	if !httpx.DecodeBody(w, r, &body, maxBody, true) {
		return
	}
	ctx := r.Context()
	u := identity.CurrentUser(ctx)
	// The key holds the caller's id, so a User can only confirm a key issued
	// to them.
	if !OwnsPendingKey(u.ID, body.Key) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_key")
		return
	}
	obj, err := h.store.Head(ctx, body.Key)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusBadRequest, "not_found")
		return
	}
	if err != nil {
		httpx.InternalError(w, h.log, "head pending photo", err)
		return
	}
	if obj.Size <= 0 || obj.Size > MaxBytes || !Accepted(obj.ContentType) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_object")
		return
	}
	prefix, err := h.store.ReadPrefix(ctx, body.Key, sniffBytes)
	if err != nil {
		httpx.InternalError(w, h.log, "read pending photo", err)
		return
	}
	if sniffed, ok := Sniff(prefix); !ok || sniffed != obj.ContentType {
		httpx.WriteError(w, http.StatusBadRequest, "not_an_image")
		return
	}

	avatar := NewAvatarKey(ExtensionFor(obj.ContentType))
	if err := h.store.Copy(ctx, body.Key, avatar, obj.ContentType); err != nil {
		httpx.InternalError(w, h.log, "promote photo", err)
		return
	}
	old, err := h.keys.SetPhotoKey(ctx, u.ID, avatar, h.clock.Now())
	if err != nil {
		h.deleteBestEffort(avatar)
		httpx.InternalError(w, h.log, "store photo key", err)
		return
	}
	// The change is committed: from here, cleanup never fails the request.
	h.deleteBestEffort(body.Key)
	if old != nil {
		h.deleteBestEffort(*old)
	}
	httpx.WriteJSON(w, http.StatusOK, confirmResponse{PhotoURL: h.url(&avatar)})
}

// Remove answers DELETE /me/photo: it clears the photo, then deletes the
// object. It is idempotent.
func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	u := identity.CurrentUser(r.Context())
	old, err := h.keys.ClearPhotoKey(r.Context(), u.ID, h.clock.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "clear photo key", err)
		return
	}
	if old != nil {
		h.deleteBestEffort(*old)
	}
	w.WriteHeader(http.StatusNoContent)
}

// deleteBestEffort deletes key after the commit. It uses its own context, as
// the request may be ending, and only logs a failure.
func (h *Handler) deleteBestEffort(key string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := h.store.Delete(ctx, key); err != nil {
		h.log.Warn("delete photo object failed", "key", key, "error", err.Error())
	}
}
