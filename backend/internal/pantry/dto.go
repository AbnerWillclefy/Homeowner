package pantry

import (
	"encoding/json"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

// Item is one Pantry item as the API returns it. RanOutOn is set only while
// the item is ran out; LastPriceCents and AvgDurationDays only once it has a
// purchase, or a completed purchase-to-run-out cycle.
type Item struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	PreferredBrand *string `json:"preferredBrand"`
	Fixed          bool    `json:"fixed"`
	State          string  `json:"state"`
	RanOutOn       *string `json:"ranOutOn,omitempty"`

	LastPriceCents  *int64 `json:"lastPriceCents,omitempty"`
	AvgDurationDays *int   `json:"avgDurationDays,omitempty"`
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

// Receipt is a saved receipt as the API returns it. The client derives the
// unmatched lines: no item and not ignored.
type Receipt struct {
	ID         string        `json:"id"`
	StoreName  string        `json:"storeName"`
	IssuedOn   string        `json:"issuedOn"`
	TotalCents int64         `json:"totalCents"`
	ReadBy     string        `json:"readBy"`
	Lines      []ReceiptLine `json:"lines"`
}

// ReceiptLine is one line; N is its number on the receipt, from 1.
type ReceiptLine struct {
	N              int     `json:"n"`
	Description    string  `json:"description"`
	QuantityMilli  int64   `json:"quantityMilli"`
	Unit           string  `json:"unit"`
	UnitPriceCents int64   `json:"unitPriceCents"`
	TotalCents     int64   `json:"totalCents"`
	ItemID         *string `json:"itemId"`
	Ignored        bool    `json:"ignored"`
}

// receiptRequest holds exactly one of its two fields: a SEFAZ code, or a draft
// read from a photo and confirmed by the User.
type receiptRequest struct {
	Code  *string                `json:"code"`
	Draft *llmalloc.ReceiptDraft `json:"draft"`
}

type newItemRequest struct {
	Name  *string `json:"name"`
	Brand *string `json:"brand"`
}

// matchRequest holds exactly one of its three fields.
type matchRequest struct {
	ItemID  *string         `json:"itemId"`
	NewItem *newItemRequest `json:"newItem"`
	Ignore  *bool           `json:"ignore"`
}

// Match is a decoded line choice: an existing item, a new one, or ignore.
type Match struct {
	ItemID   string
	NewName  string
	NewBrand *string
	NewItem  bool
	Ignore   bool
}

// ListRow is one line of the next shopping list. UnitPriceCents and PriceCents
// are absent for an item never bought.
type ListRow struct {
	ItemID         string  `json:"itemId"`
	Name           string  `json:"name"`
	PreferredBrand *string `json:"preferredBrand"`
	Fixed          bool    `json:"fixed"`
	QuantityMilli  int64   `json:"quantityMilli"`
	Unit           string  `json:"unit"`
	UnitPriceCents *int64  `json:"unitPriceCents,omitempty"`
	PriceCents     *int64  `json:"priceCents,omitempty"`
}

// ShoppingList is the answer of GET pantry/list. GroceriesLeftCents is absent
// with no groceries limit and negative when the User went over it.
type ShoppingList struct {
	Items              []ListRow `json:"items"`
	ExpectedTotalCents int64     `json:"expectedTotalCents"`
	GroceriesLeftCents *int64    `json:"groceriesLeftCents,omitempty"`
}

// Price is one purchase of an item: the unit price paid at a store on a day.
type Price struct {
	IssuedOn       string `json:"issuedOn"`
	UnitPriceCents int64  `json:"unitPriceCents"`
	StoreName      string `json:"storeName"`
}

// ItemDetail is the answer of GET pantry/items/{id}; Prices run newest first.
type ItemDetail struct {
	Item            Item    `json:"item"`
	AvgDurationDays *int    `json:"avgDurationDays,omitempty"`
	Prices          []Price `json:"prices"`
}

type listEditRequest struct {
	QuantityMilli *int64 `json:"quantityMilli"`
	Removed       *bool  `json:"removed"`
}
