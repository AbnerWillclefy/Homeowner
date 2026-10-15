package evals

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

// Day is one eval case: a name and the State both allocators plan.
type Day struct {
	Name  string
	State allocation.State
}

// dayFile is the JSON shape of a day. allocation.State has no JSON tags and
// must stay free of them (it is stdlib only), so the file has its own shape.
// It holds ids and numbers only, like what the model sees.
type dayFile struct {
	Name      string         `json:"name"`
	Today     string         `json:"today"`
	Residents []residentFile `json:"residents"`
	Tasks     []taskFile     `json:"tasks"`
}

type residentFile struct {
	ID                 string            `json:"id"`
	Energy             int               `json:"energy"`
	DemandRestrictions []string          `json:"demand_restrictions"`
	ChoreRestrictions  []string          `json:"chore_restrictions"`
	Preferences        map[string]string `json:"preferences"`
	LastDone           map[string]string `json:"last_done"`
}

type taskFile struct {
	ID              string   `json:"id"`
	ChoreID         string   `json:"chore_id"`
	Effort          int      `json:"effort"`
	Importance      string   `json:"importance"`
	Demands         []string `json:"demands"`
	People          int      `json:"people"`
	WindowStart     string   `json:"window_start"`
	WindowEnd       string   `json:"window_end"`
	AllowedWeekdays []int    `json:"allowed_weekdays"`
}

// LoadDir reads every *.json file of dir, in file name order, as a Day.
func LoadDir(dir string) ([]Day, error) {
	paths, err := filepath.Glob(filepath.Join(dir, "*.json"))
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(dir); err != nil {
		return nil, err
	}
	if len(paths) == 0 {
		return nil, fmt.Errorf("evals: no *.json days in %s", dir)
	}
	slices.Sort(paths)
	days := make([]Day, 0, len(paths))
	for _, p := range paths {
		raw, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		d, err := Parse(raw)
		if err != nil {
			return nil, fmt.Errorf("evals: %s: %w", filepath.Base(p), err)
		}
		days = append(days, d)
	}
	return days, nil
}

// Parse decodes one day strictly: unknown fields, bad enums, bad dates,
// duplicate ids and out-of-range numbers are errors, so a typo in the dataset
// fails loudly instead of skewing the numbers.
func Parse(raw []byte) (Day, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var f dayFile
	if err := dec.Decode(&f); err != nil {
		return Day{}, err
	}
	if err := dec.Decode(&json.RawMessage{}); err != io.EOF {
		return Day{}, errors.New("data after the day")
	}
	if f.Name == "" {
		return Day{}, errors.New("name is required")
	}
	today, err := parseDate(f.Today)
	if err != nil {
		return Day{}, fmt.Errorf("today: %w", err)
	}
	st := allocation.State{Today: today}

	seen := map[string]bool{}
	for _, r := range f.Residents {
		if r.ID == "" || seen[r.ID] {
			return Day{}, fmt.Errorf("resident id %q is empty or repeated", r.ID)
		}
		seen[r.ID] = true
		res, err := parseResident(r)
		if err != nil {
			return Day{}, err
		}
		st.Residents = append(st.Residents, res)
	}

	seen = map[string]bool{}
	for _, t := range f.Tasks {
		if t.ID == "" || seen[t.ID] {
			return Day{}, fmt.Errorf("task id %q is empty or repeated", t.ID)
		}
		seen[t.ID] = true
		task, err := parseTask(t)
		if err != nil {
			return Day{}, err
		}
		st.Tasks = append(st.Tasks, task)
	}
	return Day{Name: f.Name, State: st}, nil
}

// preferenceByName is the file's spelling of each Preference.
var preferenceByName = map[string]allocation.Preference{
	"like": allocation.Like, "neutral": allocation.Neutral, "dislike": allocation.Dislike,
}

func parseResident(r residentFile) (allocation.Resident, error) {
	if r.Energy < 0 {
		return allocation.Resident{}, fmt.Errorf("resident %s: negative energy", r.ID)
	}
	res := allocation.Resident{
		ID: r.ID, Energy: r.Energy, ChoreRestrictions: r.ChoreRestrictions,
		Preferences: map[string]allocation.Preference{},
		LastDone:    map[string]allocation.Date{},
	}
	for _, d := range r.DemandRestrictions {
		if !vocab.IsDemand(d) {
			return allocation.Resident{}, fmt.Errorf("resident %s: unknown demand %q", r.ID, d)
		}
		res.DemandRestrictions = append(res.DemandRestrictions, allocation.Demand(d))
	}
	for chore, p := range r.Preferences {
		pref, ok := preferenceByName[p]
		if !ok {
			return allocation.Resident{}, fmt.Errorf("resident %s: unknown preference %q", r.ID, p)
		}
		res.Preferences[chore] = pref
	}
	for chore, s := range r.LastDone {
		d, err := parseDate(s)
		if err != nil {
			return allocation.Resident{}, fmt.Errorf("resident %s: last_done %s: %w", r.ID, chore, err)
		}
		res.LastDone[chore] = d
	}
	return res, nil
}

func parseTask(t taskFile) (allocation.Task, error) {
	if t.ChoreID == "" {
		return allocation.Task{}, fmt.Errorf("task %s: chore_id is required", t.ID)
	}
	if t.Effort < 1 || t.Effort > 5 {
		return allocation.Task{}, fmt.Errorf("task %s: effort %d not in 1 to 5", t.ID, t.Effort)
	}
	if !vocab.IsImportance(t.Importance) {
		return allocation.Task{}, fmt.Errorf("task %s: unknown importance %q", t.ID, t.Importance)
	}
	if t.People != 1 && t.People != 2 {
		return allocation.Task{}, fmt.Errorf("task %s: people %d is not 1 or 2", t.ID, t.People)
	}
	start, err := parseDate(t.WindowStart)
	if err != nil {
		return allocation.Task{}, fmt.Errorf("task %s: window_start: %w", t.ID, err)
	}
	end, err := parseDate(t.WindowEnd)
	if err != nil {
		return allocation.Task{}, fmt.Errorf("task %s: window_end: %w", t.ID, err)
	}
	if end < start {
		return allocation.Task{}, fmt.Errorf("task %s: window_end is before window_start", t.ID)
	}
	for _, w := range t.AllowedWeekdays {
		if w < 0 || w > 6 {
			return allocation.Task{}, fmt.Errorf("task %s: weekday %d not in 0 to 6", t.ID, w)
		}
	}
	task := allocation.Task{ID: t.ID, ChoreID: t.ChoreID, Effort: t.Effort, Importance: allocation.Importance(t.Importance),
		People: t.People, WindowStart: start, WindowEnd: end, AllowedWeekdays: t.AllowedWeekdays}
	for _, d := range t.Demands {
		if !vocab.IsDemand(d) {
			return allocation.Task{}, fmt.Errorf("task %s: unknown demand %q", t.ID, d)
		}
		task.Demands = append(task.Demands, allocation.Demand(d))
	}
	return task, nil
}

func parseDate(s string) (allocation.Date, error) {
	t, err := time.Parse(time.DateOnly, s)
	if err != nil {
		return 0, fmt.Errorf("%q is not a YYYY-MM-DD date", s)
	}
	return allocation.DateOf(t), nil
}
