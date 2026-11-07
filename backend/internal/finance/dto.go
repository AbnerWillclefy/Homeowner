package finance

// StatusResponse is the Finances status on the wire. Later tickets add fields.
type StatusResponse struct {
	Configured bool `json:"configured"`
}

// CredentialsRequest is the body of PUT /me/finance/credentials.
type CredentialsRequest struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}
