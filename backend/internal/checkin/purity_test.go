package checkin

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/puritytest"
)

// The rule files must have no database, HTTP or clock dependency. store.go is
// the one file that does I/O.
func TestPackageIsPure(t *testing.T) { puritytest.Check(t, "store.go") }
