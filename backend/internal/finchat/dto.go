package finchat

// Request is the body of POST /me/finance/chat: the whole conversation, which
// the server does not keep.
type Request struct {
	Screen   string    `json:"screen"`
	Locale   string    `json:"locale"`
	Messages []Message `json:"messages"`
}

// Message is one turn: Role is user or assistant.
type Message struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

// Response is the answer: plain text, and the questions left today.
type Response struct {
	Answer    string `json:"answer"`
	Remaining int    `json:"remaining"`
}
