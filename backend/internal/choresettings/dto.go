package choresettings

type effectiveResponse struct {
	Preference        string   `json:"preference"`
	Source            string   `json:"source"`
	Restricted        bool     `json:"restricted"`
	RestrictedBy      []string `json:"restrictedBy"`
	RestrictedByChore bool     `json:"restrictedByChore"`
}

type residentSettingsResponse struct {
	ID     string                       `json:"id"`
	You    bool                         `json:"you"`
	Chores map[string]effectiveResponse `json:"chores"`
}
