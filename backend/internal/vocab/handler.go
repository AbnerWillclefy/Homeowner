package vocab

import (
	"net/http"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/httpx"
)

// ServeCategories answers GET /categories.
func ServeCategories(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string][]string{"categories": Categories()})
}

// ServeDemands answers GET /demands.
func ServeDemands(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string][]string{"demands": Demands()})
}
