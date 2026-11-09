package voice

import (
	"encoding/json"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
)

// Refuse fails once either partner of a two-person Task committed.
func TestRefuseIsDroppedWhenThePartnerCommitted(t *testing.T) {
	task := func(committed bool) dayplan.TaskView {
		tv := dayplan.TaskView{Committed: committed}
		tv.ID, tv.People = "t1", 2
		return tv
	}
	v := dayplan.View{Planned: true, Mine: []dayplan.TaskView{task(false)},
		Others: []dayplan.ResidentTasks{{ResidentID: "b", Tasks: []dayplan.TaskView{task(true)}}}}
	ref := taskRefs(v)[0]
	if got := taskVerb(toolRefuseTask, ref); got != "" {
		t.Errorf("refuse = %q, want dropped", got)
	}
	if got := taskVerb(toolCommitTask, ref); got != "accept" {
		t.Errorf("commit = %q, want accept", got)
	}
}

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
