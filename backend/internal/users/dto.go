package users

import "github.com/AbnerWillclefy/Homeowner/backend/internal/identity"

// PhotoURL turns a stored photo key into the URL the app loads, or nil when
// there is no photo or photos are off. The server builds it, so users and
// homes import no photos package.
type PhotoURL func(key *string) *string

// MeResponse is the signed-in User on the wire.
type MeResponse struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	DisplayName *string `json:"displayName"`
	Name        string  `json:"name"`
	PhotoURL    *string `json:"photoUrl"`
}

// NewMeResponse returns u as it goes on the wire.
func NewMeResponse(u identity.User, photoURL PhotoURL) MeResponse {
	return MeResponse{
		ID: u.ID, Email: u.Email, DisplayName: u.DisplayName,
		Name: ShownName(u.DisplayName, u.Email), PhotoURL: photoURL(u.PhotoKey),
	}
}
