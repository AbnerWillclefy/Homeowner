package catalog

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/puritytest"
)

// The rule files must have no database, HTTP or clock dependency; they may
// import chores for the Fields type. handler.go is the HTTP edge.
func TestPackageIsPure(t *testing.T) { puritytest.Check(t, "handler.go") }
