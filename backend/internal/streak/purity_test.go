package streak

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/puritytest"
)

// The rule files must have no database, HTTP or clock dependency. handler.go
// and store.go are the edges.
func TestPackageIsPure(t *testing.T) { puritytest.Check(t, "handler.go", "store.go") }
