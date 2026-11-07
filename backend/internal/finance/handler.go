package finance

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// Status answers GET /me/finance.
func Status(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, StatusResponse{})
}
