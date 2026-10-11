package vocab_test

import (
	"regexp"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/vocab"
)

var snakeCase = regexp.MustCompile(`^[a-z]+(_[a-z]+)*$`)

func TestIdsAreUniqueSnakeCaseAndNotEmpty(t *testing.T) {
	t.Parallel()
	for name, ids := range map[string][]string{"categories": vocab.Categories(), "demands": vocab.Demands()} {
		if len(ids) == 0 {
			t.Errorf("%s is empty", name)
		}
		seen := map[string]bool{}
		for _, id := range ids {
			if !snakeCase.MatchString(id) {
				t.Errorf("%s: %q is not snake_case", name, id)
			}
			if seen[id] {
				t.Errorf("%s: %q appears twice", name, id)
			}
			seen[id] = true
		}
	}
}

func TestValidityChecks(t *testing.T) {
	t.Parallel()
	if !vocab.IsCategory("kitchen") || vocab.IsCategory("heavy_lifting") || vocab.IsCategory("") {
		t.Error("IsCategory wrong")
	}
	if !vocab.IsDemand("heights") || vocab.IsDemand("kitchen") || vocab.IsDemand("") {
		t.Error("IsDemand wrong")
	}
	for _, i := range []allocation.Importance{allocation.Essential, allocation.Normal, allocation.NiceToHave} {
		if !vocab.IsImportance(string(i)) {
			t.Errorf("IsImportance(%q) = false", i)
		}
	}
	if vocab.IsImportance("kitchen") || vocab.IsImportance("") {
		t.Error("IsImportance accepts a non-Importance")
	}
}
