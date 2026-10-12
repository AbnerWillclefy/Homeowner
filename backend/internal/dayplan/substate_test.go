package dayplan

import (
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

func TestSubStateKeepsOneResidentAndTheTasksNotGivenToOthers(t *testing.T) {
	t.Parallel()
	today := allocation.Date(0)
	full := allocation.State{
		Today:     today,
		Residents: []allocation.Resident{{ID: "r1", Energy: 3}, {ID: "r2", Energy: 5}},
		Tasks:     []allocation.Task{{ID: "t1"}, {ID: "t2"}, {ID: "t3"}},
	}

	tests := []struct {
		name     string
		resident string
		given    map[string]bool
		wantRes  []allocation.Resident
		wantIDs  []string
		wantOK   bool
	}{
		{"drops Tasks given to others and keeps the rest in order", "r1", map[string]bool{"t2": true},
			[]allocation.Resident{{ID: "r1", Energy: 3}}, []string{"t1", "t3"}, true},
		{"nothing given keeps every Task", "r2", nil,
			[]allocation.Resident{{ID: "r2", Energy: 5}}, []string{"t1", "t2", "t3"}, true},
		{"a Resident not in the Home is refused", "gone", nil, nil, nil, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, ok := subState(full, tc.resident, tc.given)
			if ok != tc.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tc.wantOK)
			}
			if !ok {
				return
			}
			if got.Today != today || !reflect.DeepEqual(got.Residents, tc.wantRes) {
				t.Fatalf("got today %v residents %v", got.Today, got.Residents)
			}
			var ids []string
			for _, task := range got.Tasks {
				ids = append(ids, task.ID)
			}
			if !reflect.DeepEqual(ids, tc.wantIDs) {
				t.Fatalf("tasks = %v, want %v", ids, tc.wantIDs)
			}
		})
	}
}
