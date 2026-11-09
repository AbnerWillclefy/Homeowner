package voice

import (
	"encoding/json"
	"testing"
)

// A null "required" is not a JSON Schema array and strict tool use can reject it.
func TestEveryToolSchemaRequiredIsAnArray(t *testing.T) {
	for _, tool := range tools() {
		b, err := json.Marshal(tool.InputSchema)
		if err != nil {
			t.Fatal(err)
		}
		var s struct {
			Required []string `json:"required"`
		}
		if err := json.Unmarshal(b, &s); err != nil {
			t.Fatal(err)
		}
		if s.Required == nil {
			t.Errorf("%s: required is null, want an array", tool.Name)
		}
	}
}
