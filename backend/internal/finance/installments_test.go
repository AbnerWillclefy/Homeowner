package finance

import (
	"testing"
	"time"
)

func TestParseInstallment(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, desc   string
		metaN, metaM int
		n, m         int
		ok           bool
	}{
		{"metadata", "LOJA", 2, 6, 2, 6, true},
		{"metadata wins over text", "LOJA PARC 05/10", 2, 6, 2, 6, true},
		{"text", "Mercado Livre PARC 03/10", 0, 0, 3, 10, true},
		{"text glued and parcela", "LOJA*PARCELA03/12 SP", 0, 0, 3, 12, true},
		{"last installment", "LOJA PARC 10/10", 0, 0, 10, 10, true},
		{"bad metadata falls to text", "LOJA PARC 1/3", 5, 3, 1, 3, true},
		{"zero", "LOJA PARC 00/10", 0, 0, 0, 0, false},
		{"beyond total", "LOJA PARC 11/10", 0, 0, 0, 0, false},
		{"missing total", "LOJA PARC 3/", 0, 0, 0, 0, false},
		{"a date", "PAGAMENTO 10/11", 0, 0, 0, 0, false},
		{"single total", "LOJA PARC 1/1", 0, 0, 0, 0, false},
		{"three digits", "LOJA PARC 003/010", 0, 0, 0, 0, false},
	} {
		n, m, ok := ParseInstallment(c.desc, c.metaN, c.metaM)
		if n != c.n || m != c.m || ok != c.ok {
			t.Errorf("%s: got %d/%d %v, want %d/%d %v", c.name, n, m, ok, c.n, c.m, c.ok)
		}
	}
}

func TestProjectInstallments(t *testing.T) {
	t.Parallel()
	nov := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	got := ProjectInstallments([]Plan{
		{Name: "TV", Number: 3, Total: 10, AmountCents: 100, Month: nov},
		{Name: "Done", Number: 6, Total: 6, AmountCents: 50, Month: nov},
	}, nov, 12)
	if len(got) != 12 || len(got[0]) != 0 || len(got[1]) != 1 || got[1][0].Number != 4 || got[7][0].Number != 10 || len(got[8]) != 0 {
		t.Errorf("projection = %+v, want TV 4..10 over months 1..7 and nothing for Done", got)
	}
	if late := ProjectInstallments([]Plan{{Number: 1, Total: 3, Month: nov}}, nov.AddDate(0, 2, 0), 12); len(late[0]) != 1 || late[0][0].Number != 3 {
		t.Errorf("a horizon starting later = %+v, want only installment 3 first", late[0])
	}
}
