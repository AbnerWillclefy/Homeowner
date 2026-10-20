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

// detailResponse is GET /home/residents/{id} on the wire: one Resident, their
// Streak and what they completed in the last 7 days. Like listResponse it is
// plain structs filled field by field, with no embedded User, profile, Check-in
// or Day Plan type, and the same privacy rule: never Energy, Baseline,
// Check-ins, Preferences, Restrictions, email or user id.
type detailResponse struct {
	// Date is today in the Home's time zone, as YYYY-MM-DD.
	Date       string  `json:"date"`
	ID         string  `json:"id"`
	You        bool    `json:"you"`
	Name       string  `json:"name"`
	PhotoURL   *string `json:"photoUrl"`
	Initials   string  `json:"initials"`
	AvatarTone string  `json:"avatarTone"`
	// Streak is the current Streak, as in the list and GET /home/streak.
	Streak int `json:"streak"`
	// DoneLast7Days is the number of Completions in Days.
	DoneLast7Days int `json:"doneLast7Days"`
	// Days has only the local dates with Completions, newest first.
	Days []dayView `json:"days"`
}

// dayView is the Completions of one local date, oldest first.
type dayView struct {
	Date        string           `json:"date"`
	Completions []completionView `json:"completions"`
}

// completionView is one Completion. ID is the Completion id, not the Task id.
type completionView struct {
	ID        string `json:"id"`
	ChoreID   string `json:"choreId"`
	ChoreName string `json:"choreName"`
	// Category is the Category id of the Chore.
	Category string `json:"category"`
	// CompletedAt is the UTC instant, RFC 3339.
	CompletedAt string `json:"completedAt"`
	// With is the other people on a two-person Completion; [] when solo.
	With []partnerView `json:"with"`
}

// partnerView is the other Resident on a two-person Completion.
type partnerView struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
