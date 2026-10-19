package photos

import "time"

type uploadRequest struct {
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
}

type uploadResponse struct {
	Key       string            `json:"key"`
	URL       string            `json:"url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	ExpiresAt time.Time         `json:"expiresAt"`
}

type confirmRequest struct {
	Key string `json:"key"`
}

type confirmResponse struct {
	PhotoURL *string `json:"photoUrl"`
}
