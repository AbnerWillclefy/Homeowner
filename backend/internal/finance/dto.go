package finance

// StatusResponse is the Finances status on the wire. Sources holds the
// connected Sources (none yet); LastSyncedAt is null until a first import.
type StatusResponse struct {
	Configured   bool    `json:"configured"`
	Sources      []any   `json:"sources"`
	Importing    bool    `json:"importing"`
	LastSyncedAt *string `json:"lastSyncedAt"`
}
