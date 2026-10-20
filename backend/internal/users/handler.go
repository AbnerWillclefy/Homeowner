package users

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/identity"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/onboarding"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// maxOnboardingBody is far above any valid body; it only bounds abuse.
const maxOnboardingBody = 1024

// Homes says whether a User already lives in a Home. homes.Store is one; it is
// an interface because homes imports users.
type Homes interface {
	HasHome(ctx context.Context, userID string) (bool, error)
}

// Handler serves the /me and /me/onboarding routes.
type Handler struct {
	store    *Store
	homes    Homes
	photoURL func(*string) *string
	clock    clock.Clock
	log      *slog.Logger
}

// maxNameBody bounds PUT /me/name; a 40-code-point name fits many times over.
const maxNameBody = 1024

// NewHandler returns a Handler over store. photoURL turns a stored photo key
// into its public URL (nil when photos are off).
func NewHandler(store *Store, homes Homes, photoURL func(*string) *string, clk clock.Clock, log *slog.Logger) *Handler {
	return &Handler{store: store, homes: homes, photoURL: photoURL, clock: clk, log: log}
}

type onboardingState struct {
	Step string `json:"step"`
}

// Me answers GET /me.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	u := identity.CurrentUser(r.Context())
	httpx.WriteJSON(w, http.StatusOK, NewMeResponse(u, h.photoURL))
}

// SetName answers PUT /me/name: it stores the trimmed name, or clears it when
// the name is null or blank, and answers the updated User.
func (h *Handler) SetName(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeBody(w, r, &body, maxNameBody, true) {
		return
	}
	name, err := NormalizeName(body.Name)
	switch {
	case errors.Is(err, ErrNameTooLong):
		httpx.WriteError(w, http.StatusBadRequest, "too_long")
		return
	case errors.Is(err, ErrNameInvalid):
		httpx.WriteError(w, http.StatusBadRequest, "invalid")
		return
	}
	u := identity.CurrentUser(r.Context())
	if err := h.store.SetDisplayName(r.Context(), u.ID, name, h.clock.Now()); err != nil {
		httpx.InternalError(w, h.log, "set display name", err)
		return
	}
	u.DisplayName = nil
	if name != "" {
		u.DisplayName = &name
	}
	httpx.WriteJSON(w, http.StatusOK, NewMeResponse(u, h.photoURL))
}

// Onboarding answers the step to show: the one after the stored step, or
// done (see writeNextStep).
func (h *Handler) Onboarding(w http.ResponseWriter, r *http.Request) {
	u := identity.CurrentUser(r.Context())
	stored, err := h.store.OnboardingStep(r.Context(), u.ID)
	if err != nil {
		httpx.InternalError(w, h.log, "read onboarding", err)
		return
	}
	h.writeNextStep(w, r, u.ID, stored)
}

// AdvanceOnboarding records a step as completed or skipped and answers the
// step to show next. Writing a step at or before the stored one changes
// nothing.
func (h *Handler) AdvanceOnboarding(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Step string `json:"step"`
	}
	if !httpx.DecodeBody(w, r, &body, maxOnboardingBody, true) {
		return
	}
	if !onboarding.Valid(body.Step) {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid step", "code": "invalid_step"})
		return
	}
	userID := identity.CurrentUser(r.Context()).ID
	stored, err := h.store.AdvanceOnboarding(r.Context(), userID, body.Step, h.clock.Now())
	if err != nil {
		httpx.InternalError(w, h.log, "advance onboarding", err)
		return
	}
	h.writeNextStep(w, r, userID, stored)
}

// writeNextStep answers the step after stored. A User who already lives in a
// Home (they joined by Invite) walks their own steps but never creates one:
// where the next step is the Home they are done, and that is stored so the
// answer stays.
func (h *Handler) writeNextStep(w http.ResponseWriter, r *http.Request, userID, stored string) {
	next := onboarding.Next(stored)
	if next == onboarding.HomeStep {
		inHome, err := h.homes.HasHome(r.Context(), userID)
		if err != nil {
			httpx.InternalError(w, h.log, "look up home for onboarding", err)
			return
		}
		if inHome {
			if _, err := h.store.AdvanceOnboarding(r.Context(), userID, onboarding.Done, h.clock.Now()); err != nil {
				httpx.InternalError(w, h.log, "finish onboarding for a resident", err)
				return
			}
			next = onboarding.Done
		}
	}
	httpx.WriteJSON(w, http.StatusOK, onboardingState{Step: next})
}
