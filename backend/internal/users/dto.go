package users

import "github.com/AbnerWillclefy/Homeowner/backend/internal/identity"

// MeResponse is the signed-in User on the wire. PhotoURL is null when the User
// has no photo or photos are off.
type MeResponse struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	DisplayName *string `json:"displayName"`
	Name        string  `json:"name"`
	PhotoURL    *string `json:"photoUrl"`
}

// NewMeResponse returns u as it goes on the wire. photoURL turns the stored
// photo key into its public URL.
func NewMeResponse(u identity.User, photoURL func(*string) *string) MeResponse {
	return MeResponse{
		ID: u.ID, Email: u.Email, DisplayName: u.DisplayName,
		Name:     identity.ShownName(u.DisplayName, u.Email),
		PhotoURL: photoURL(u.PhotoKey),
	}
}
