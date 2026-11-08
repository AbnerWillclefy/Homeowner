package finance

import (
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/puritytest"
)

// The rules must have no database, HTTP or clock dependency; the other files are the edge.
func TestPackageIsPure(t *testing.T) {
	puritytest.Check(t, "handler.go", "store.go", "sync.go", "events.go", "seal.go", "categorize.go")
}
