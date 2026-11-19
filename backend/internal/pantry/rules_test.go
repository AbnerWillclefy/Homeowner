package pantry

import (
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/nfce/nfcetest"
)

func day(d int) *time.Time {
	t := time.Date(2026, 11, d, 0, 0, 0, 0, time.UTC)
	return &t
}

func TestStateOf(t *testing.T) {
	cases := []struct {
		name             string
		purchase, ranOut *time.Time
		want             string
	}{
		{"no run-out", nil, nil, InStock},
		{"no run-out, a purchase", day(5), nil, InStock},
		{"run-out, no purchase", nil, day(5), RanOut},
		{"run-out after the purchase", day(3), day(5), RanOut},
		{"run-out before the purchase", day(5), day(3), InStock},
		{"run-out on the day of the purchase", day(5), day(5), InStock},
	}
	for _, c := range cases {
		if got := StateOf(c.purchase, c.ranOut); got != c.want {
			t.Errorf("%s: StateOf = %s, want %s", c.name, got, c.want)
		}
	}
}

func TestLineKey(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Leite  Integral 1L", "LEITE INTEGRAL 1L"},
		{"  Açúcar   Refinado ", "ACUCAR REFINADO"},
		{"LEITE 1L", "LEITE 1L"},
		{"LEITE 5L", "LEITE 5L"},
		{"pão de açaí", "PAO DE ACAI"},
		{"MARG.PRIMOR C/S", "MARG.PRIMOR C/S"},
	}
	for _, c := range cases {
		if got := LineKey(c.in); got != c.want {
			t.Errorf("LineKey(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

var today = time.Date(2026, 11, 18, 0, 0, 0, 0, time.UTC)

// draft is a valid draft of two lines totalling 1000 cents; each case edits it.
func draft(edit func(*llmalloc.ReceiptDraft)) llmalloc.ReceiptDraft {
	d := llmalloc.ReceiptDraft{StoreName: "Mercado", StoreCNPJ: "12345678000199", IssuedOn: "2026-11-18", TotalCents: 1000,
		Lines: []llmalloc.ReceiptDraftLine{
			{Description: "CAFE", QuantityMilli: 1000, Unit: "UN", UnitPriceCents: 600, TotalCents: 600},
			{Description: "ARROZ", QuantityMilli: 2000, Unit: "UN", UnitPriceCents: 200, TotalCents: 400},
		}}
	if edit != nil {
		edit(&d)
	}
	return d
}

func TestValidateDraft(t *testing.T) {
	cases := []struct {
		name string
		edit func(*llmalloc.ReceiptDraft)
		want []string
	}{
		{"valid", nil, nil},
		{"sum 5 cents under", func(d *llmalloc.ReceiptDraft) { d.TotalCents = 1005 }, nil},
		{"sum 5 cents over", func(d *llmalloc.ReceiptDraft) { d.TotalCents = 995 }, nil},
		{"sum 6 cents under", func(d *llmalloc.ReceiptDraft) { d.TotalCents = 1006 }, []string{"totalCents"}},
		{"sum 6 cents over", func(d *llmalloc.ReceiptDraft) { d.TotalCents = 994 }, []string{"totalCents"}},
		{"negative total", func(d *llmalloc.ReceiptDraft) { d.TotalCents = -1 }, []string{"totalCents"}},
		{"quantity zero", func(d *llmalloc.ReceiptDraft) { d.Lines[1].QuantityMilli = 0 }, []string{"lines.2.quantityMilli"}},
		{"quantity too large", func(d *llmalloc.ReceiptDraft) { d.Lines[0].QuantityMilli = 1 << 40 }, []string{"lines.1.quantityMilli"}},
		{"negative unit price", func(d *llmalloc.ReceiptDraft) { d.Lines[0].UnitPriceCents = -1 }, []string{"lines.1.unitPriceCents"}},
		{"zero unit price", func(d *llmalloc.ReceiptDraft) { d.Lines[0].UnitPriceCents = 0 }, nil},
		{"negative line total", func(d *llmalloc.ReceiptDraft) { d.Lines[0].TotalCents, d.TotalCents = -1, 399 }, []string{"lines.1.totalCents"}},
		{"issued today", func(d *llmalloc.ReceiptDraft) { d.IssuedOn = "2026-11-18" }, nil},
		{"issued tomorrow", func(d *llmalloc.ReceiptDraft) { d.IssuedOn = "2026-11-19" }, []string{"issuedOn"}},
		{"issued not a date", func(d *llmalloc.ReceiptDraft) { d.IssuedOn = "18/11/2026" }, []string{"issuedOn"}},
		{"no lines", func(d *llmalloc.ReceiptDraft) { d.Lines, d.TotalCents = nil, 0 }, []string{"lines"}},
		{"200 lines", func(d *llmalloc.ReceiptDraft) {
			d.Lines = slices.Repeat([]llmalloc.ReceiptDraftLine{d.Lines[0]}, 200)
			d.TotalCents = 200 * 600
		}, nil},
		{"201 lines", func(d *llmalloc.ReceiptDraft) { d.Lines = slices.Repeat([]llmalloc.ReceiptDraftLine{d.Lines[0]}, 201) }, []string{"lines"}},
		{"empty store", func(d *llmalloc.ReceiptDraft) { d.StoreName = "  " }, []string{"storeName"}},
		{"121 character store", func(d *llmalloc.ReceiptDraft) { d.StoreName = strings.Repeat("a", 121) }, []string{"storeName"}},
		{"120 character store", func(d *llmalloc.ReceiptDraft) { d.StoreName = strings.Repeat("a", 120) }, nil},
		{"empty description", func(d *llmalloc.ReceiptDraft) { d.Lines[0].Description = "" }, []string{"lines.1.description"}},
		{"121 character description", func(d *llmalloc.ReceiptDraft) { d.Lines[1].Description = strings.Repeat("a", 121) }, []string{"lines.2.description"}},
		{"long unit", func(d *llmalloc.ReceiptDraft) { d.Lines[0].Unit = "ABCDEFGHIJK" }, []string{"lines.1.unit"}},
		{"two problems", func(d *llmalloc.ReceiptDraft) { d.IssuedOn, d.TotalCents = "2027-01-01", 1 }, []string{"issuedOn", "totalCents"}},
	}
	for _, c := range cases {
		_, got := ValidateDraft(draft(c.edit), today)
		if !slices.Equal(got, c.want) {
			t.Errorf("%s: codes = %v, want %v", c.name, got, c.want)
		}
	}
}

func ptr[T any](v T) *T { return &v }

func TestBuildList(t *testing.T) {
	bought := func(id string, qty, price int64) ListInput {
		return ListInput{ItemID: id, Name: id, State: RanOut, Unit: "UN", LastQuantityMilli: &qty, LastUnitPriceCents: &price}
	}
	cases := []struct {
		name      string
		in        []ListInput
		wantIDs   []string
		wantTotal int64
		check     func(t *testing.T, rows []ListRow)
	}{
		{"ran-out item is in", []ListInput{bought("a", 1000, 500)}, []string{"a"}, 500, nil},
		{"fixed in-stock item is in", []ListInput{func() ListInput { i := bought("a", 1000, 500); i.State = InStock; i.Fixed = true; return i }()}, []string{"a"}, 500, nil},
		{"in-stock non-fixed item is out", []ListInput{func() ListInput { i := bought("a", 1000, 500); i.State = InStock; return i }()}, nil, 0, nil},
		{"removed by an edit is out", []ListInput{func() ListInput { i := bought("a", 1000, 500); i.Removed = true; return i }()}, nil, 0, nil},
		{"removed fixed item is out", []ListInput{func() ListInput {
			i := bought("a", 1000, 500)
			i.State = InStock
			i.Fixed = true
			i.Removed = true
			return i
		}()}, nil, 0, nil},
		{"quantity edit wins over last bought", []ListInput{func() ListInput { i := bought("a", 1000, 500); i.EditQuantityMilli = ptr(int64(3000)); return i }()}, []string{"a"}, 1500,
			func(t *testing.T, rows []ListRow) {
				if rows[0].QuantityMilli != 3000 {
					t.Errorf("quantity = %d, want 3000", rows[0].QuantityMilli)
				}
			}},
		{"never bought: one unit, no price, UN", []ListInput{{ItemID: "a", Name: "a", State: RanOut}}, []string{"a"}, 0,
			func(t *testing.T, rows []ListRow) {
				r := rows[0]
				if r.QuantityMilli != 1000 || r.UnitPriceCents != nil || r.PriceCents != nil || r.Unit != "UN" {
					t.Errorf("row = %+v", r)
				}
			}},
		{"0,755 kg at 5990 prices to the rounded cent", []ListInput{func() ListInput { i := bought("a", 755, 5990); i.Unit = "KG"; return i }()}, []string{"a"}, 4522, // 4522.45
			func(t *testing.T, rows []ListRow) {
				if *rows[0].PriceCents != 4522 || rows[0].Unit != "KG" {
					t.Errorf("row = %+v", rows[0])
				}
			}},
		{"rounds half up", []ListInput{bought("a", 500, 5)}, []string{"a"}, 3, nil}, // 2.5 -> 3
		{"total skips unpriced rows", []ListInput{bought("a", 2000, 300), {ItemID: "b", Name: "b", State: RanOut}}, []string{"a", "b"}, 600, nil},
		{"empty list totals 0", nil, nil, 0, nil},
	}
	for _, c := range cases {
		rows, total := BuildList(c.in)
		var ids []string
		for _, r := range rows {
			ids = append(ids, r.ItemID)
		}
		if len(ids) != len(c.wantIDs) || total != c.wantTotal {
			t.Errorf("%s: ids = %v total = %d, want %v, %d", c.name, ids, total, c.wantIDs, c.wantTotal)
			continue
		}
		for i := range ids {
			if ids[i] != c.wantIDs[i] {
				t.Errorf("%s: ids = %v, want %v", c.name, ids, c.wantIDs)
			}
		}
		if c.check != nil && len(rows) > 0 {
			c.check(t, rows)
		}
	}
}

func TestValidateDraftCleansWhatItKeeps(t *testing.T) {
	cases := []struct {
		name string
		edit func(*llmalloc.ReceiptDraft)
		got  func(llmalloc.ReceiptDraft) string
		want string
	}{
		{"a formatted CPF in a description", func(d *llmalloc.ReceiptDraft) { d.Lines[0].Description = "CAFE 123.456.789-09 CPF" }, func(d llmalloc.ReceiptDraft) string { return d.Lines[0].Description }, "CAFE CPF"},
		{"11 digits in a description", func(d *llmalloc.ReceiptDraft) { d.Lines[0].Description = "CAFE 12345678909" }, func(d llmalloc.ReceiptDraft) string { return d.Lines[0].Description }, "CAFE"},
		{"a 13-digit barcode stays", func(d *llmalloc.ReceiptDraft) { d.Lines[0].Description = "CAFE 7891000100103" }, func(d llmalloc.ReceiptDraft) string { return d.Lines[0].Description }, "CAFE 7891000100103"},
		{"a CPF in the store name", func(d *llmalloc.ReceiptDraft) { d.StoreName = "Mercado 123.456.789-09" }, func(d llmalloc.ReceiptDraft) string { return d.StoreName }, "Mercado"},
		{"a CPF in a unit", func(d *llmalloc.ReceiptDraft) { d.Lines[0].Unit = "12345678909" }, func(d llmalloc.ReceiptDraft) string { return d.Lines[0].Unit }, ""},
		{"a control character", func(d *llmalloc.ReceiptDraft) { d.Lines[0].Description = "CA\x00FE" }, func(d llmalloc.ReceiptDraft) string { return d.Lines[0].Description }, "CAFE"},
		{"a bad CNPJ is dropped", func(d *llmalloc.ReceiptDraft) { d.StoreCNPJ = "1234" }, func(d llmalloc.ReceiptDraft) string { return d.StoreCNPJ }, ""},
		{"a formatted CNPJ keeps its digits", func(d *llmalloc.ReceiptDraft) { d.StoreCNPJ = "12.345.678/0001-99" }, func(d llmalloc.ReceiptDraft) string { return d.StoreCNPJ }, "12345678000199"},
		{"a bad access key is dropped", func(d *llmalloc.ReceiptDraft) { d.AccessKey = "123" }, func(d llmalloc.ReceiptDraft) string { return d.AccessKey }, ""},
		{"a valid access key is kept", func(d *llmalloc.ReceiptDraft) { d.AccessKey = nfcetest.Key }, func(d llmalloc.ReceiptDraft) string { return d.AccessKey }, nfcetest.Key},
	}
	for _, c := range cases {
		d, codes := ValidateDraft(draft(c.edit), today)
		if got := c.got(d); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
		if len(codes) > 0 {
			t.Errorf("%s: codes = %v, want none", c.name, codes)
		}
	}
}

func TestAvgDuration(t *testing.T) {
	cases := []struct {
		name               string
		purchases, runOuts []*time.Time
		want               *int
	}{
		{"one cycle", []*time.Time{day(1)}, []*time.Time{day(11)}, ptr(10)},
		{"two cycles averaged", []*time.Time{day(1), day(12)}, []*time.Time{day(11), day(24)}, ptr(11)}, // 10 and 12...
		{"mean rounds half up", []*time.Time{day(1), day(12)}, []*time.Time{day(4), day(16)}, ptr(4)},   // 3 and 4 -> 3.5
		{"run-out with no earlier purchase ignored", []*time.Time{day(10)}, []*time.Time{day(5), day(15)}, ptr(5)},
		{"same-day run-out ignored", []*time.Time{day(5)}, []*time.Time{day(5)}, nil},
		{"two purchases then one run-out pairs the later", []*time.Time{day(1), day(10)}, []*time.Time{day(14)}, ptr(4)},
		{"no run-out is absent", []*time.Time{day(1)}, nil, nil},
		{"no purchase is absent", nil, []*time.Time{day(5)}, nil},
	}
	for _, c := range cases {
		var p, r []time.Time
		for _, d := range c.purchases {
			p = append(p, *d)
		}
		for _, d := range c.runOuts {
			r = append(r, *d)
		}
		got := AvgDuration(p, r)
		if (got == nil) != (c.want == nil) || (got != nil && *got != *c.want) {
			t.Errorf("%s: got %v, want %v", c.name, deref(got), deref(c.want))
		}
	}
}

func deref(p *int) any {
	if p == nil {
		return "absent"
	}
	return *p
}
