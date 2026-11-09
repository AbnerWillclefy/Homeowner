package voice

import (
	"encoding/json"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
)

// Relations of an open Task to the speaker.
const (
	relProposed  = "proposed_to_you"
	relCommitted = "committed_by_you"
	relPool      = "pool"
	relOther     = "held_by_other"
)

// taskRef is an open Task as sent to the model, plus the Chore name kept for
// the response.
type taskRef struct {
	id, choreID, choreName, relation string
	people                           int
}

// taskRefs derives each open Task's relation to the caller from their Day
// Plan. Mine goes first so a two-person Task the caller shares is theirs, not
// "held by other". Before the plan exists every Task endpoint answers
// no_plan_today, so nothing is offered.
func taskRefs(v dayplan.View) []taskRef {
	out := []taskRef{}
	if !v.Planned {
		return out
	}
	seen := map[string]bool{}
	add := func(t dayplan.TaskView, rel string) {
		if !seen[t.ID] {
			seen[t.ID] = true
			out = append(out, taskRef{t.ID, t.ChoreID, t.ChoreName, rel, t.People})
		}
	}
	for _, t := range v.Mine {
		if t.Committed {
			add(t, relCommitted)
		} else {
			add(t, relProposed)
		}
	}
	for _, t := range v.Pool {
		add(t, relPool)
	}
	for _, o := range v.Others {
		for _, t := range o.Tasks {
			add(t, relOther)
		}
	}
	return out
}

// taskVerb is the Task endpoint a tool maps to for a Task in this relation, or
// "" when the tool is not allowed for it. Go decides it, never the model.
// Restrictions, weekday limits and Drained are not checked here: the endpoint's
// restricted and drained errors cover them when the action is applied, and
// reading Check-ins and Restrictions is what voice must not do.
func taskVerb(tool string, t taskRef) string {
	switch {
	case t.relation == relProposed:
		return map[string]string{toolCommitTask: "accept", toolRefuseTask: "refuse", toolCompleteTask: "complete"}[tool]
	case t.relation == relCommitted && tool == toolCompleteTask:
		return "complete"
	case t.relation == relPool && t.people == 1:
		return map[string]string{toolCommitTask: "take", toolCompleteTask: "complete"}[tool]
	}
	return ""
}

// taskAction resolves each id the model named against the Tasks that were
// sent. Several allowed ones become candidates; none drops the action.
func taskAction(tool string, raw json.RawMessage, byID map[string]taskRef) *Action {
	var in struct {
		TaskIDs []string `json:"task_ids"`
	}
	if !strictDecode(raw, &in) {
		return nil
	}
	var found []Action
	done := map[string]bool{}
	for _, id := range in.TaskIDs {
		t, ok := byID[id]
		if !ok || done[id] {
			continue
		}
		done[id] = true
		if verb := taskVerb(tool, t); verb != "" {
			found = append(found, Action{Kind: verb, TaskID: t.id, ChoreID: t.choreID, ChoreName: t.choreName,
				Request: &HTTPRequest{Method: "POST", Path: "/home/tasks/" + t.id + "/" + verb}})
		}
	}
	switch len(found) {
	case 0:
		return nil
	case 1:
		return &found[0]
	}
	return &Action{Kind: tool, Candidates: found}
}
