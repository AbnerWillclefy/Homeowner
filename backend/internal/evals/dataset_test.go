package evals

import (
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

const validDay = `{
  "name": "tiny",
  "today": "2026-03-02",
  "residents": [
    {"id": "r1", "energy": 5, "demand_restrictions": ["heavy_lifting"], "chore_restrictions": ["c9"],
     "preferences": {"c1": "like", "c2": "dislike"}, "last_done": {"c1": "2026-02-20"}}
  ],
  "tasks": [
    {"id": "t1", "chore_id": "c1", "effort": 2, "importance": "essential", "demands": ["bending"],
     "people": 1, "window_start": "2026-03-01", "window_end": "2026-03-02", "allowed_weekdays": [1, 2]}
  ]
}`

func TestParseBuildsState(t *testing.T) {
	day, err := Parse([]byte(validDay))
	if err != nil {
		t.Fatal(err)
	}
	if day.Name != "tiny" || day.State.Today != allocation.NewDate(2026, 3, 2) {
		t.Fatalf("day = %+v", day)
	}
	r := day.State.Residents[0]
	if r.Energy != 5 || r.Preferences["c1"] != allocation.Like || r.Preferences["c2"] != allocation.Dislike ||
		r.LastDone["c1"] != allocation.NewDate(2026, 2, 20) || r.ChoreRestrictions[0] != "c9" ||
		r.DemandRestrictions[0] != "heavy_lifting" {
		t.Errorf("resident = %+v", r)
	}
	tk := day.State.Tasks[0]
	if tk.Importance != allocation.Essential || tk.People != 1 || tk.WindowEnd != allocation.NewDate(2026, 3, 2) ||
		len(tk.AllowedWeekdays) != 2 || tk.Demands[0] != "bending" {
		t.Errorf("task = %+v", tk)
	}
}

func TestParseRejectsBadInput(t *testing.T) {
	tests := []struct{ name, from, to string }{
		{"unknown field", `"name": "tiny"`, `"name": "tiny", "title": "x"`},
		{"unknown nested field", `"energy": 5`, `"energy": 5, "mood": "ok"`},
		{"bad preference", `"like"`, `"love"`},
		{"bad importance", `"essential"`, `"urgent"`},
		{"bad demand", `"bending"`, `"flying"`},
		{"bad date", `"today": "2026-03-02"`, `"today": "02/03/2026"`},
		{"effort out of range", `"effort": 2`, `"effort": 6`},
		{"people not 1 or 2", `"people": 1`, `"people": 3`},
		{"weekday out of range", `[1, 2]`, `[1, 7]`},
		{"window reversed", `"window_start": "2026-03-01"`, `"window_start": "2026-03-05"`},
		{"negative energy", `"energy": 5`, `"energy": -1`},
		{"duplicate task id", `"tasks": [`, `"tasks": [{"id": "t1", "chore_id": "c1", "effort": 1, "importance": "normal", "people": 1, "window_start": "2026-03-01", "window_end": "2026-03-02"},`},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			bad := strings.Replace(validDay, tc.from, tc.to, 1)
			if bad == validDay {
				t.Fatal("test replaced nothing")
			}
			if _, err := Parse([]byte(bad)); err == nil {
				t.Error("want an error")
			}
		})
	}
}

// shippedDir is the dataset that ships with the evals.
const shippedDir = "testdata/days"

func TestShippedDaysLoad(t *testing.T) {
	days, err := LoadDir(shippedDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(days) < 8 || len(days) > 12 {
		t.Errorf("%d days, want 8 to 12", len(days))
	}
	for _, d := range days {
		if n := len(d.State.Residents); n < 2 || n > 4 {
			t.Errorf("%s: %d residents, want 2 to 4", d.Name, n)
		}
		if n := len(d.State.Tasks); n < 4 || n > 10 {
			t.Errorf("%s: %d tasks, want 4 to 10", d.Name, n)
		}
	}
}

// The baseline is deterministic and checked by the same referee, so any
// violation on a shipped day is a typo in the dataset.
func TestBaselineHasNoViolationsOnShippedDays(t *testing.T) {
	days, err := LoadDir(shippedDir)
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range days {
		res, err := allocation.Baseline{}.Plan(d.State)
		if err != nil {
			t.Errorf("%s: %v", d.Name, err)
			continue
		}
		if v := allocation.Check(res.DayPlan, d.State); len(v) != 0 {
			t.Errorf("%s: violations %+v", d.Name, v)
		}
	}
}

func TestLoadDirErrors(t *testing.T) {
	if _, err := LoadDir("testdata/missing"); err == nil {
		t.Error("missing directory: want an error")
	}
	if _, err := LoadDir(t.TempDir()); err == nil {
		t.Error("empty directory: want an error")
	}
}
