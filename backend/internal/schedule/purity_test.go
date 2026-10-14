package schedule

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/puritytest"
)

// The package must have no database, HTTP or clock dependency.
func TestPackageIsPure(t *testing.T) { puritytest.Check(t) }
