package dayplan

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

func TestEnergyLeftIsEnergyLessTheEffortOfCommittedTasks(t *testing.T) {
	t.Parallel()
	tasks := []allocation.Task{{ID: "t1", Effort: 2}, {ID: "t2", Effort: 3}, {ID: "t3", Effort: 5}}
	tests := []struct {
		name      string
		energy    int
		committed map[string]bool
		want      int
	}{
		{"nothing committed keeps the Energy", 6, nil, 6},
		{"one committed Task is subtracted", 6, map[string]bool{"t2": true}, 3},
		{"several are summed", 6, map[string]bool{"t1": true, "t2": true}, 1},
		{"promises over the Energy leave 0, not a negative", 3, map[string]bool{"t3": true}, 0},
		{"a committed Task that is not open counts for nothing", 4, map[string]bool{"gone": true}, 4},
		{"no Energy stays 0", 0, map[string]bool{"t1": true}, 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := energyLeft(tc.energy, tasks, tc.committed); got != tc.want {
				t.Fatalf("energyLeft = %d, want %d", got, tc.want)
			}
		})
	}
}
