package server

import (
	"errors"
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/homes"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/onboarding"
)

// maxOnboardingBody is far above any valid body; it only bounds abuse.
const maxOnboardingBody = 1024

type onboardingState struct {
	Step string `json:"step"`
}

// getOnboarding answers the step to show: the one after the stored step, or
// done. A User who already lives in a Home is done whatever is stored (they
// joined by Invite, or made a Home before onboarding existed), and that is
// stored so the answer stays.
func (s *server) getOnboarding(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r.Context())
	stored, err := s.users.OnboardingStep(r.Context(), u.ID)
	if err != nil {
		s.onboardingError(w, "read onboarding", err)
		return
	}
	if stored != onboarding.Done {
		_, err := s.homes.ForUser(r.Context(), u.ID)
		switch {
		case err == nil:
			stored, err = s.users.AdvanceOnboarding(r.Context(), u.ID, onboarding.Done,
				onboarding.Before(onboarding.Done), s.deps.Clock.Now())
			if err != nil {
				s.onboardingError(w, "finish onboarding for a resident", err)
				return
			}
		case !errors.Is(err, homes.ErrNoHome):
			s.onboardingError(w, "look up home for onboarding", err)
			return
		}
	}
	writeJSON(w, http.StatusOK, onboardingState{Step: onboarding.Next(stored)})
}

// putOnboarding records a step as completed or skipped and answers the step to
// show next. Writing a step at or before the stored one changes nothing.
func (s *server) putOnboarding(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Step string `json:"step"`
	}
	if !decodeBody(w, r, &body, maxOnboardingBody, true) {
		return
	}
	if !onboarding.Valid(body.Step) {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid step", "code": "invalid_step"})
		return
	}
	stored, err := s.users.AdvanceOnboarding(r.Context(), currentUser(r.Context()).ID,
		body.Step, onboarding.Before(body.Step), s.deps.Clock.Now())
	if err != nil {
		s.onboardingError(w, "advance onboarding", err)
		return
	}
	writeJSON(w, http.StatusOK, onboardingState{Step: onboarding.Next(stored)})
}

func (s *server) onboardingError(w http.ResponseWriter, what string, err error) {
	s.deps.Logger.Error(what, "error", err.Error())
	writeError(w, http.StatusInternalServerError, "internal error")
}
