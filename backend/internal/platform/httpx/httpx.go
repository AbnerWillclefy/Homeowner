// Package httpx holds the JSON helpers every handler shares: writing a body or
// an error, and reading a bounded body.
package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

// WriteJSON writes v as the JSON body with status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// WriteError writes {"error": msg} with status.
func WriteError(w http.ResponseWriter, status int, msg string) {
	WriteJSON(w, status, map[string]string{"error": msg})
}

// InternalError logs err under what and answers a bare 500, so no detail
// reaches the caller.
func InternalError(w http.ResponseWriter, log *slog.Logger, what string, err error) {
	log.Error(what, "error", err.Error())
	WriteError(w, http.StatusInternalServerError, "internal error")
}

// DecodeBody reads a JSON body of at most maxBytes into v and writes the
// error response itself when it fails. With strict set, a field v does not
// declare is an error, so a typo is not silently ignored.
func DecodeBody(w http.ResponseWriter, r *http.Request, v any, maxBytes int64, strict bool) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	dec := json.NewDecoder(r.Body)
	if strict {
		dec.DisallowUnknownFields()
	}
	if err := dec.Decode(v); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			WriteError(w, http.StatusRequestEntityTooLarge, "request body too large")
			return false
		}
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}
