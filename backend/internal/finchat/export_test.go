package finchat

import "time"

// SetQuestionTimeout shortens the question deadline for a test and returns the undo.
func SetQuestionTimeout(d time.Duration) (restore func()) {
	old := questionTimeout
	questionTimeout = d
	return func() { questionTimeout = old }
}

// ToolResults is each tool's name with a zero value of its allowlist struct.
func ToolResults() map[string]any {
	out := map[string]any{}
	for _, t := range tools {
		out[t.name] = t.result
	}
	return out
}
