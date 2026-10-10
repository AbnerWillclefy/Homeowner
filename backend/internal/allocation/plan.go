package allocation

// Baseline is the deterministic baseline allocator.
type Baseline struct{}

// Plan implements Allocator.
func (Baseline) Plan(s State) (Result, error) { return Plan(s) }

// Plan proposes a Day Plan for the state.
func Plan(s State) (Result, error) { return Result{}, nil }
