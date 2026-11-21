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
		card  bool
	}{
		"card purchase, counterpart is the owner": {cents: 100, cp: p("x", "416.799.495-00"), owner: owner, card: true},
		"debit to the owner's document":           {-100, p("x", "416.799.495-00"), owner, true, false},
		"credit from the owner":                   {100, p("John Doe", ""), owner, true, false},
		"same name, another document":             {-100, p("John Doe", "111.111.111-11"), owner, false, false},
		"same folded name, no document":           {-100, p("john  DOE", ""), pluggy.Party{Name: "John Doe"}, true, false},
		"no payment data":                         {-100, nil, owner, false, false},
		"owner without document and name":         {-100, p("John Doe", ""), pluggy.Party{}, false, false},
	} {
		rows, _ := toRows([]pluggy.Transaction{{ID: "a", Date: d, Description: "x", AmountCents: tc.cents, Currency: "BRL", Status: "POSTED", Counterpart: tc.cp}}, tc.card, tc.owner, nil)
		if rows[0].OwnCounterpart != tc.want {
			t.Errorf("%s: OwnCounterpart = %v, want %v", name, rows[0].OwnCounterpart, tc.want)
		}
	}
}

func TestToRowsMarksAPixToAManualCardRecipient(t *testing.T) {
	d := time.Date(2026, 11, 7, 15, 0, 0, 0, time.UTC)
	owner := pluggy.Party{Name: "John Doe", Document: "416.799.495-00"}
	partner := pluggy.Party{Name: "Naiara Souza", Document: "999.999.999-99"}
	for name, tc := range map[string]struct {
		cents      int64
		cp         pluggy.Party
		recipients []string
		card       bool
		want       bool
	}{
		"a debit to the recipient":                {-100, partner, []string{"Naiara Souza"}, false, true},
		"case and accents differ":                 {-100, pluggy.Party{Name: "NAIARA  souza"}, []string{"Náiara Souza"}, false, true},
		"one of several recipients":               {-100, partner, []string{"Maria", "Naiara Souza"}, false, true},
		"a credit from the recipient":             {100, partner, []string{"Naiara Souza"}, false, false},
		"a card row":                              {100, partner, []string{"Naiara Souza"}, true, false},
		"a different name":                        {-100, pluggy.Party{Name: "Naiara Silva"}, []string{"Naiara Souza"}, false, false},
		"no recipients":                           {-100, partner, nil, false, false},
		"the owner still counts with a recipient": {-100, owner, []string{"Naiara Souza"}, false, true},
	} {
		cp := tc.cp
		rows, _ := toRows([]pluggy.Transaction{{ID: "a", Date: d, Description: "x", AmountCents: tc.cents, Currency: "BRL", Status: "POSTED", Counterpart: &cp}}, tc.card, owner, tc.recipients)
		if rows[0].OwnCounterpart != tc.want {
			t.Errorf("%s: OwnCounterpart = %v, want %v", name, rows[0].OwnCounterpart, tc.want)
		}
	}
}
