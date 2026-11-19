package nfce_test

import (
	"context"
	encjson "encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/nfce"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/nfce/nfcetest"
)

func fetch(t *testing.T, s *nfcetest.Server) (nfce.Receipt, error) {
	t.Helper()
	return nfce.NewHTTP(map[string]string{"23": s.URL + nfcetest.Path}).Fetch(context.Background(), nfcetest.Key)
}

func TestFetchParsesTheCearaFixture(t *testing.T) {
	t.Parallel()
	r, err := fetch(t, nfcetest.NewServer(t))
	if err != nil {
		t.Fatal(err)
	}
	if r.StoreName != "ATACADAO S.A." || r.CNPJ != "75315333015807" || r.IssuedOn.Format(time.DateOnly) != "2026-11-18" || r.TotalCents != 52384 || len(r.Lines) != 34 {
		t.Errorf("receipt = %+v", r)
	}
	if want := (nfce.Line{Description: "MARG.PRIMOR C/S", ProductCode: "2151", QuantityMilli: 1000, Unit: "PTE8", UnitPriceCents: 599, TotalCents: 599}); r.Lines[0] != want {
		t.Errorf("first line = %+v, want %+v", r.Lines[0], want)
	}
	if want := (nfce.Line{Description: "BOV.PATINHO MOIDO RE", ProductCode: "85424", QuantityMilli: 1496, Unit: "KG9", UnitPriceCents: 5990, TotalCents: 8961}); r.Lines[2] != want {
		t.Errorf("weighed line = %+v, want %+v", r.Lines[2], want)
	}
}

func TestFetchRefusesWhatItCannotRead(t *testing.T) {
	t.Parallel()
	page := nfcetest.Page("23-1.html")
	json := func(x string) string { b, _ := encjson.Marshal(map[string]string{"xml": x}); return string(b) }
	cases := []struct{ name, body string }{
		{"truncated page", json(page[:len(page)/2])},
		{"no item table", json(strings.Replace(page, "tabResult", "other", 1))},
		{"non-numeric price", json(strings.Replace(page, "<span class='valor'>5,99</span>", "<span class='valor'>abc</span>", 1))},
		{"no total", json(strings.ReplaceAll(strings.ReplaceAll(page, "Valor a pagar", "x"), "Valor total", "x"))},
		{"sefaz error", `{"erro":"404 - nao encontrada"}`},
		{"not json", `<html>`},
	}
	for _, c := range cases {
		s := nfcetest.NewServer(t)
		s.Fail(200, c.body)
		if _, err := fetch(t, s); err != nfce.ErrUnavailable {
			t.Errorf("%s: err = %v, want ErrUnavailable", c.name, err)
		}
	}
	if _, err := fetch(t, func() *nfcetest.Server {
		s := nfcetest.NewServer(t)
		s.Fail(200, json(strings.ReplaceAll(page, "Valor total", "x")))
		return s
	}()); err != nil {
		t.Errorf("a page with Valor a pagar needs no Valor total: %v", err)
	}
}

func TestFetchFailures(t *testing.T) {
	t.Parallel()
	s := nfcetest.NewServer(t)
	s.Fail(500, "boom")
	if _, err := fetch(t, s); err != nfce.ErrUnavailable {
		t.Errorf("500: %v", err)
	}
	s.Fail(200, strings.Repeat("x", 2<<20))
	if _, err := fetch(t, s); err != nfce.ErrUnavailable {
		t.Errorf("oversize: %v", err)
	}
	if _, err := nfce.ParseCode(nfcetest.OtherKey); err != nil {
		t.Errorf("OtherKey is not a valid key: %v", err)
	}
	if _, err := nfce.NewHTTP(map[string]string{}).Fetch(context.Background(), nfcetest.Key); err != nfce.ErrUnsupportedState {
		t.Errorf("no host: %v", err)
	}
}

func TestParseCode(t *testing.T) {
	t.Parallel()
	k := nfcetest.Key
	cases := []struct {
		name, in string
		ok       bool
	}{
		{"44 digits", k, true},
		{"with spaces", "2326 1175 3153 3301 5807 6551 4000 0123 4511 1111 1115", true},
		{"QR url", "http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=" + k + "|2|1|1|ABCDEF0123", true},
		{"QR url on another host", "http://evil.example/x?p=" + k + "|2|1|1|AB", true}, // only the key is kept
		{"bad check digit", k[:43] + "0", false},
		{"model 55", "23261175315333015807551400001234511111111116", false},
		{"43 digits", k[:43], false},
		{"url with no p", "http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html", false},
		{"p with extra characters", "http://x/?p=" + k + "|2|1|1|AB;rm", false},
		{"p of 43 digits", "http://x/?p=" + k[:43] + "|2", false},
		{"text", "hello", false},
	}
	for _, c := range cases {
		got, err := nfce.ParseCode(c.in)
		if (err == nil) != c.ok || (c.ok && got != k) {
			t.Errorf("%s: ParseCode = %q, %v", c.name, got, err)
		}
	}
}
