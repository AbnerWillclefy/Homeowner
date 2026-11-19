package pantry

import "encoding/json"

// Item is one Pantry item as the API returns it. RanOutOn is set only while
// the item is ran out.
type Item struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	PreferredBrand *string `json:"preferredBrand"`
	Fixed          bool    `json:"fixed"`
	State          string  `json:"state"`
	RanOutOn       *string `json:"ranOutOn,omitempty"`
}

// Patch is a decoded PATCH body: nil fields are left alone; BrandSet with a
// nil Brand clears the brand.
type Patch struct {
	Name     *string
	Brand    *string
	BrandSet bool
	Fixed    *bool
}

type createRequest struct {
	Name           *string `json:"name"`
	PreferredBrand *string `json:"preferredBrand"`
}

type patchRequest struct {
	Name           *string         `json:"name"`
	PreferredBrand json.RawMessage `json:"preferredBrand"`
	Fixed          *bool           `json:"fixed"`
}
