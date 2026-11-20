package finchat

import "time"

// SetQuestionTimeout shortens the question deadline for a test and returns the undo.
func SetQuestionTimeout(d time.Duration) (restore func()) {
	old := questionTimeout
	questionTimeout = d
	return func() { questionTimeout = old }
}
