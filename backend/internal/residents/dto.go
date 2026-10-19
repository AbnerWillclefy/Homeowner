package residents

// listResponse is GET /home/residents on the wire.
//
// This file is the privacy boundary of the Residents list. The types here are
// plain structs filled field by field: they embed no User, profile, Check-in or
// Day Plan type, so a field added to one of those can never reach this body by
// accident. Nothing about Energy, Baseline, Check-ins, Preferences,
// Restrictions, email or user id is ever sent, not even for the caller.
type listResponse struct {
	// Date is today in the Home's time zone, as YYYY-MM-DD.
	Date      string         `json:"date"`
	Residents []residentView `json:"residents"`
}

// residentView is one Resident of the caller's Home.
type residentView struct {
	// ID is the Resident id, the one the Day Plan calls residentId.
	ID  string `json:"id"`
	You bool   `json:"you"`
	// Name is the display name, else the email's local part.
	Name string `json:"name"`
	// PhotoURL is the public photo URL, or null.
	PhotoURL *string `json:"photoUrl"`
	// Initials and AvatarTone are the avatar fallback. AvatarTone is a Category
	// id whose pastel the PWA draws; it is derived from the user id on the
	// server, so the id itself never leaves.
	Initials   string `json:"initials"`
	AvatarTone string `json:"avatarTone"`
	// Streak is the current Streak. DoneToday is how many Tasks they completed
	// today (a two-person Completion counts for both).
	Streak    int `json:"streak"`
	DoneToday int `json:"doneToday"`
}
