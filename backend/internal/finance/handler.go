package finance

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// Status answers GET /me/finance. Its shape is final so later tickets fill the
// fields in without changing the contract.
func Status(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, StatusResponse{Sources: []any{}})
}
