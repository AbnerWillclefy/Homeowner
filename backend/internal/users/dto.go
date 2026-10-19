package users

import "github.com/AbnerWillclefy/Homeowner/backend/internal/identity"

// MeResponse is the signed-in User on the wire. PhotoURL is always null until
// resident photos land.
type MeResponse struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	DisplayName *string `json:"displayName"`
	Name        string  `json:"name"`
	PhotoURL    *string `json:"photoUrl"`
}

// NewMeResponse returns u as it goes on the wire.
func NewMeResponse(u identity.User) MeResponse {
	return MeResponse{
		ID: u.ID, Email: u.Email, DisplayName: u.DisplayName,
		Name: identity.ShownName(u.DisplayName, u.Email),
	}
}
