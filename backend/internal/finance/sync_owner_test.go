package finance

import (
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
)

func TestSameParty(t *testing.T) {
	owner := pluggy.Party{Name: "João da Silva", Document: "416.799.495-00"}
	for name, tc := range map[string]struct {
		owner, other pluggy.Party
		want         bool
	}{
		"same document, other punctuation": {owner, pluggy.Party{Name: "X", Document: "41679949500"}, true},
		"same name other document":         {owner, pluggy.Party{Name: "João da Silva", Document: "111.111.111-11"}, false},
		"name only, accents and case":      {pluggy.Party{Name: "João da Silva"}, pluggy.Party{Name: " JOAO  DA silva"}, true},
		"owner document, other has none":   {owner, pluggy.Party{Name: "JOAO DA SILVA"}, true},
		"masked document falls to name":    {owner, pluggy.Party{Name: "João da Silva", Document: "***.799.495-**"}, true},
		"masked document, other name":      {owner, pluggy.Party{Name: "Maria", Document: "***.799.495-**"}, false},
		"different names":                  {owner, pluggy.Party{Name: "Maria"}, false},
		"owner empty":                      {pluggy.Party{}, pluggy.Party{Name: "Maria", Document: "123"}, false},
		"both names empty":                 {pluggy.Party{Document: "416.799.495-00"}, pluggy.Party{}, false},
	} {
		if got := sameParty(tc.owner, tc.other); got != tc.want {
			t.Errorf("%s: sameParty = %v, want %v", name, got, tc.want)
		}
	}
}

func TestToRowsMarksOwnCounterpart(t *testing.T) {
	d := time.Date(2026, 11, 7, 15, 0, 0, 0, time.UTC)
	owner := pluggy.Party{Name: "John Doe", Document: "416.799.495-00"}
	p := func(name, doc string) *pluggy.Party { return &pluggy.Party{Name: name, Document: doc} }
	for name, tc := range map[string]struct {
		cents int64
		cp    *pluggy.Party
		owner pluggy.Party
		want  bool
	}{
		"debit to the owner's document":   {-100, p("x", "416.799.495-00"), owner, true},
		"credit from the owner":           {100, p("John Doe", ""), owner, true},
		"same name, another document":     {-100, p("John Doe", "111.111.111-11"), owner, false},
		"same folded name, no document":   {-100, p("john  DOE", ""), pluggy.Party{Name: "John Doe"}, true},
		"no payment data":                 {-100, nil, owner, false},
		"owner without document and name": {-100, p("John Doe", ""), pluggy.Party{}, false},
	} {
		rows, _ := toRows([]pluggy.Transaction{{ID: "a", Date: d, Description: "x", AmountCents: tc.cents, Currency: "BRL", Status: "POSTED", Counterpart: tc.cp}}, false, tc.owner)
		if rows[0].OwnCounterpart != tc.want {
			t.Errorf("%s: OwnCounterpart = %v, want %v", name, rows[0].OwnCounterpart, tc.want)
		}
	}
}
