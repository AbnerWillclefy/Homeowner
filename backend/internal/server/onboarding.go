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
// done (see nextStep).
func (s *server) getOnboarding(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r.Context())
	stored, err := s.users.OnboardingStep(r.Context(), u.ID)
	if err != nil {
		s.onboardingError(w, "read onboarding", err)
		return
	}
	s.writeNextStep(w, r, u.ID, stored)
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
	userID := currentUser(r.Context()).ID
	stored, err := s.users.AdvanceOnboarding(r.Context(), userID, body.Step, s.deps.Clock.Now())
	if err != nil {
		s.onboardingError(w, "advance onboarding", err)
		return
	}
	s.writeNextStep(w, r, userID, stored)
}

// writeNextStep answers the step after stored. A User who already lives in a
// Home (they joined by Invite) walks their own steps but never creates one:
// where the next step is the Home they are done, and that is stored so the
// answer stays.
func (s *server) writeNextStep(w http.ResponseWriter, r *http.Request, userID, stored string) {
	next := onboarding.Next(stored)
	if next == onboarding.HomeStep {
		_, err := s.homes.ForUser(r.Context(), userID)
		switch {
		case err == nil:
			if _, err := s.users.AdvanceOnboarding(r.Context(), userID, onboarding.Done, s.deps.Clock.Now()); err != nil {
				s.onboardingError(w, "finish onboarding for a resident", err)
				return
			}
			next = onboarding.Done
		case !errors.Is(err, homes.ErrNoHome):
			s.onboardingError(w, "look up home for onboarding", err)
			return
		}
	}
	writeJSON(w, http.StatusOK, onboardingState{Step: next})
}

func (s *server) onboardingError(w http.ResponseWriter, what string, err error) {
	s.deps.Logger.Error(what, "error", err.Error())
	writeError(w, http.StatusInternalServerError, "internal error")
}
