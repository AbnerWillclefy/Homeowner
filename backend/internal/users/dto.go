package users

import "github.com/AbnerWillclefy/Homeowner/backend/internal/identity"

// MeResponse is the signed-in User on the wire. PhotoURL is null when the User
// has no photo or photos are off. Initials and AvatarTone are the avatar
// fallback, the same two fields GET /home/residents gives for every Resident,
// so the Me header and the list always agree.
type MeResponse struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	DisplayName *string `json:"displayName"`
	Name        string  `json:"name"`
	Initials    string  `json:"initials"`
	AvatarTone  string  `json:"avatarTone"`
	PhotoURL    *string `json:"photoUrl"`
	// Finance is whether the User may use Finances (the allowlist).
	Finance bool `json:"finance"`
}

// NewMeResponse returns u as it goes on the wire. photoURL turns the stored
// photo key into its public URL; finance is the allowlist answer.
func NewMeResponse(u identity.User, photoURL func(*string) *string, finance bool) MeResponse {
	name := identity.ShownName(u.DisplayName, u.Email)
	return MeResponse{
		ID: u.ID, Email: u.Email, DisplayName: u.DisplayName,
		Name:       name,
		Initials:   Initials(name),
		AvatarTone: AvatarTone(u.ID),
		PhotoURL:   photoURL(u.PhotoKey),
		Finance:    finance,
	}
}
