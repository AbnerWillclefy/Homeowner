package homes

import (
	"regexp"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/chores"
)

// settingsBody is the body of PUT /home.
type settingsBody struct {
	Timezone       string `json:"timezone"`
	AllocationTime string `json:"allocationTime"`
}

// newHomeBody is the body of POST /home: the settings plus the Chores the User
// reviewed, if any.
type newHomeBody struct {
	settingsBody
	Chores []chores.Input `json:"chores"`
}

// Response is a Home on the wire.
type Response struct {
	ID             string `json:"id"`
	Timezone       string `json:"timezone"`
	AllocationTime string `json:"allocationTime"`
}

// NewResponse returns h as it goes on the wire.
func NewResponse(h Home) Response {
	return Response{ID: h.ID, Timezone: h.Timezone, AllocationTime: h.AllocationTime}
}

var allocationTimePattern = regexp.MustCompile(`^([01][0-9]|2[0-3]):([0-5][0-9])$`)

// validate returns a stable machine code per invalid field, all at once.
// "not_quarter_hour" exists because the Allocator job runs every 15 minutes.
func (b settingsBody) validate() map[string]string {
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
