package finance

// StatusResponse is the Finances status on the wire. Later tickets add fields.
type StatusResponse struct {
	Configured bool `json:"configured"`
}
