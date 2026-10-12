package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/homes"
)

const (
	maxHomeBody = 4 * 1024
	// maxNewHomeBody and maxNewHomeChores bound POST /home, which also carries
	// the reviewed Chores. The Catalog proposes at most catalog.MaxProposals.
	maxNewHomeBody   = 64 * 1024
	maxNewHomeChores = 100
)

// membershipKey is the context key for the caller's Membership.
type membershipKey struct{}

// currentMembership returns the Membership requireResident put in the request
// context: the caller's Home and their own Resident id in it.
func currentMembership(ctx context.Context) homes.Membership {
	m, _ := ctx.Value(membershipKey{}).(homes.Membership)
	return m
}

// currentHome returns the Home requireResident put in the request context.
func currentHome(ctx context.Context) homes.Home {
	return currentMembership(ctx).Home
}

// requireResident wraps a handler so it only runs for a signed-in User who
// lives in a Home, which it puts in the context. A User with no Home gets 404.
// Every route on a Home's data goes behind it, so "any Resident" and "no
// access to another Home" are one code path.
func (s *server) requireResident(next http.HandlerFunc) http.HandlerFunc {
	return s.requireUser(func(w http.ResponseWriter, r *http.Request) {
		m, err := s.homes.ForUser(r.Context(), currentUser(r.Context()).ID)
		if errors.Is(err, homes.ErrNoHome) {
			writeError(w, http.StatusNotFound, "no home")
			return
		}
		if err != nil {
			s.deps.Logger.Error("load home", "error", err.Error())
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), membershipKey{}, m)))
	})
}

type homeSettings struct {
	Timezone       string `json:"timezone"`
	AllocationTime string `json:"allocationTime"`
}

type homeResponse struct {
	ID             string `json:"id"`
	Timezone       string `json:"timezone"`
	AllocationTime string `json:"allocationTime"`
}

func toHomeResponse(h homes.Home) homeResponse {
	return homeResponse{ID: h.ID, Timezone: h.Timezone, AllocationTime: h.AllocationTime}
}

var allocationTimePattern = regexp.MustCompile(`^([01][0-9]|2[0-3]):([0-5][0-9])$`)

// validate returns a stable machine code per invalid field, all at once.
// "not_quarter_hour" exists because the Allocator job runs every 15 minutes.
func (b homeSettings) validate() map[string]string {
	fields := map[string]string{}
	switch {
	case b.Timezone == "":
		fields["timezone"] = "required"
	case b.Timezone == "Local":
		// LoadLocation accepts it and means the server's zone.
		fields["timezone"] = "unknown"
	default:
		if _, err := time.LoadLocation(b.Timezone); err != nil {
			fields["timezone"] = "unknown"
		}
	}
	m := allocationTimePattern.FindStringSubmatch(b.AllocationTime)
	switch {
	case b.AllocationTime == "":
		fields["allocationTime"] = "required"
	case m == nil:
		fields["allocationTime"] = "invalid"
	case m[2] != "00" && m[2] != "15" && m[2] != "30" && m[2] != "45":
		fields["allocationTime"] = "not_quarter_hour"
	}
	return fields
}

// readHomeSettings decodes and validates the body, writing the error response
// itself when it is not acceptable.
func readHomeSettings(w http.ResponseWriter, r *http.Request) (homeSettings, bool) {
	var body homeSettings
	if !decodeBody(w, r, &body, maxHomeBody, true) {
		return body, false
	}
	if fields := body.validate(); len(fields) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid home", "fields": fields})
		return body, false
	}
	return body, true
}

// newHome is the body of POST /home: the settings plus the Chores the User
// reviewed, if any.
type newHome struct {
	homeSettings
	Chores []chores.Input `json:"chores"`
}

// readNewHome decodes and validates the body, settings and Chores together
// with all errors at once, writing the error response itself when it is not
// acceptable.
func readNewHome(w http.ResponseWriter, r *http.Request) (homeSettings, []chores.Fields, bool) {
	var body newHome
	if !decodeBody(w, r, &body, maxNewHomeBody, true) {
		return body.homeSettings, nil, false
	}
	fields := body.validate()
	var parsed []chores.Fields
	if len(body.Chores) > maxNewHomeChores {
		fields["chores"] = "too_many"
	} else {
		for i, in := range body.Chores {
			f, errs := chores.Validate(in)
			for name, code := range errs {
				fields[fmt.Sprintf("chores.%d.%s", i, name)] = code
			}
			parsed = append(parsed, f)
		}
	}
	if len(fields) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid home", "fields": fields})
		return body.homeSettings, nil, false
	}
	return body.homeSettings, parsed, true
}

func (s *server) postHome(w http.ResponseWriter, r *http.Request) {
	body, cs, ok := readNewHome(w, r)
	if !ok {
		return
	}
	now := s.deps.Clock.Now()
	h, err := s.homes.Create(r.Context(), currentUser(r.Context()).ID, body.Timezone, body.AllocationTime, now, cs)
	if errors.Is(err, homes.ErrAlreadyResident) {
		writeError(w, http.StatusConflict, "already a resident")
		return
	}
	if err != nil {
		s.deps.Logger.Error("create home", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, toHomeResponse(h))
}

func (s *server) getHome(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, toHomeResponse(currentHome(r.Context())))
}

// leaveHome removes the caller from their Home. The Resident and Home come
// from the Membership, so the request names no one and cannot remove another
// Resident. A repeated leave that races past requireResident is a no-op.
func (s *server) leaveHome(w http.ResponseWriter, r *http.Request) {
	m := currentMembership(r.Context())
	if err := s.homes.Leave(r.Context(), m.ResidentID, m.Home.ID); err != nil {
		s.deps.Logger.Error("leave home", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) putHome(w http.ResponseWriter, r *http.Request) {
	body, ok := readHomeSettings(w, r)
	if !ok {
		return
	}
	h := currentHome(r.Context())
	err := s.homes.UpdateSettings(r.Context(), h.ID, body.Timezone, body.AllocationTime, s.deps.Clock.Now())
	if errors.Is(err, homes.ErrNoHome) {
		writeError(w, http.StatusNotFound, "no home")
		return
	}
	if err != nil {
		s.deps.Logger.Error("update home settings", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	h.Timezone, h.AllocationTime = body.Timezone, body.AllocationTime
	writeJSON(w, http.StatusOK, toHomeResponse(h))
}
