package pantry_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/nfce/nfcetest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

const receiptsPath = "/me/finance/pantry/receipts"

func startReceipts(t *testing.T) (*apitest.App, *apitest.Client, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com", "bia@example.com"), apitest.WithNFCe())
	return app, app.SignInAs("ana@example.com"), app.SignInAs("bia@example.com")
}

func post(t *testing.T, c *apitest.Client, code string, want int) apitest.Response {
	t.Helper()
	r := c.Post(receiptsPath, map[string]any{"code": code})
	apitest.ExpectStatus(t, r, want)
	return r
}

func lines(r apitest.Response) []map[string]any {
	var out []map[string]any
	for _, l := range r.Body["lines"].([]any) {
		out = append(out, l.(map[string]any))
	}
	return out
}

func putLine(c *apitest.Client, receipt string, n int, body any) apitest.Response {
	return c.Put(fmt.Sprintf("%s/%s/lines/%d", receiptsPath, receipt, n), body)
}

func count(t *testing.T, app *apitest.App, q string, args ...any) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), q, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestPostingAKeySavesTheWholeReceipt(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	r := post(t, ana, nfcetest.Key, http.StatusCreated)
	ls := lines(r)
	if r.Body["storeName"] != "ATACADAO S.A." || r.Body["issuedOn"] != "2026-11-18" || r.Body["totalCents"] != float64(52384) || r.Body["readBy"] != "sefaz" || len(ls) != 34 {
		t.Fatalf("receipt = %s", r.Raw)
	}
	if ls[2]["description"] != "BOV.PATINHO MOIDO RE" || ls[2]["quantityMilli"] != float64(1496) || ls[2]["unit"] != "KG9" || ls[2]["unitPriceCents"] != float64(5990) || ls[2]["totalCents"] != float64(8961) || ls[2]["n"] != float64(3) || ls[2]["itemId"] != nil || ls[2]["ignored"] != false {
		t.Errorf("weighed line = %v", ls[2])
	}
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipt_lines`); n != 34 {
		t.Errorf("stored lines = %d, want 34", n)
	}
}

func TestPostingTheSameKeyTwiceReturnsTheSavedReceipt(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	first := post(t, ana, nfcetest.Key, http.StatusCreated)
	second := post(t, ana, "http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p="+nfcetest.Key+"|2|1|1|ABC123", http.StatusOK)
	if second.Body["id"] != first.Body["id"] || app.NFCe.Hits() != 1 {
		t.Errorf("second id = %v, hits = %d", second.Body["id"], app.NFCe.Hits())
	}
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipts`); n != 1 {
		t.Errorf("receipts = %d, want 1", n)
	}
}

func TestMatchesAreReusedOnTheNextTrip(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	first := post(t, ana, nfcetest.Key, http.StatusCreated)
	id := first.Body["id"].(string)
	margarina := add(t, ana, map[string]any{"name": "Margarina"})

	r := putLine(ana, id, 1, map[string]any{"itemId": margarina})
	apitest.ExpectStatus(t, r, http.StatusOK)
	r = putLine(ana, id, 2, map[string]any{"newItem": map[string]any{"name": "Requeijão", "brand": "Light"}})
	apitest.ExpectStatus(t, r, http.StatusOK)
	r = putLine(ana, id, 3, map[string]any{"ignore": true})
	apitest.ExpectStatus(t, r, http.StatusOK)
	if ls := lines(r); ls[0]["itemId"] != margarina || ls[1]["itemId"] == nil || ls[2]["ignored"] != true || ls[2]["itemId"] != nil || ls[3]["itemId"] != nil {
		t.Fatalf("after matching = %v", ls[:4])
	}
	if got := items(t, ana); len(got) != 2 || got[1]["name"] != "Requeijão" || got[1]["preferredBrand"] != "Light" {
		t.Errorf("pantry = %v", got)
	}

	second := post(t, ana, nfcetest.OtherKey, http.StatusCreated)
	ls := lines(second)
	if ls[0]["itemId"] != margarina || ls[1]["itemId"] == nil || ls[2]["ignored"] != true || ls[3]["itemId"] != nil || ls[3]["ignored"] != false {
		t.Errorf("second trip = %v", ls[:4])
	}
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipt_lines WHERE item_id IS NULL AND NOT ignored`); n != 2*31 {
		t.Errorf("unmatched lines = %d, want %d", n, 2*31)
	}

	// Re-matching corrects the saved match for later trips.
	other := add(t, ana, map[string]any{"name": "Manteiga"})
	apitest.ExpectStatus(t, putLine(ana, id, 1, map[string]any{"itemId": other}), http.StatusOK)
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_line_matches WHERE item_id = $1`, other); n != 1 {
		t.Errorf("corrected matches = %d, want 1", n)
	}
}

func TestMatchingAppliesToEveryLineOfTheReceiptWithTheSameKey(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	id := post(t, ana, nfcetest.Key, http.StatusCreated).Body["id"].(string)
	// Make line 4 read like line 1, as a receipt that rings the same product twice.
	if _, err := app.DB.Exec(context.Background(), `UPDATE finance_pantry_receipt_lines SET line_key = (SELECT line_key FROM finance_pantry_receipt_lines WHERE line_no = 1) WHERE line_no = 4`); err != nil {
		t.Fatal(err)
	}
	r := putLine(ana, id, 1, map[string]any{"ignore": true})
	apitest.ExpectStatus(t, r, http.StatusOK)
	if ls := lines(r); ls[0]["ignored"] != true || ls[3]["ignored"] != true || ls[1]["ignored"] != false {
		t.Errorf("lines = %v", ls[:4])
	}
}

func TestBuyingARanOutItemMakesItInStock(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	cafe := add(t, ana, map[string]any{"name": "Café"})
	// The receipt is dated 2026-11-18; the run-out is before it.
	app.Clock.Set(time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC))
	apitest.ExpectStatus(t, ana.Post("/me/finance/pantry/items/"+cafe+"/run-outs", nil), http.StatusNoContent)
	if got := items(t, ana); got[0]["state"] != "ran_out" {
		t.Fatalf("before = %v", got)
	}
	id := post(t, ana, nfcetest.Key, http.StatusCreated).Body["id"].(string)
	apitest.ExpectStatus(t, putLine(ana, id, 1, map[string]any{"itemId": cafe}), http.StatusOK)
	if got := items(t, ana); got[0]["state"] != "in_stock" {
		t.Errorf("after buying = %v", got)
	}
	// A run-out on a later day ends the cycle again, and its undo works.
	app.Clock.Set(time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC))
	apitest.ExpectStatus(t, ana.Post("/me/finance/pantry/items/"+cafe+"/run-outs", nil), http.StatusNoContent)
	if got := items(t, ana); got[0]["state"] != "ran_out" {
		t.Errorf("after a later run-out = %v", got)
	}
}

func TestAnOldReceiptDoesNotUndoANewerRunOut(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	cafe := add(t, ana, map[string]any{"name": "Café"})
	app.Clock.Set(time.Date(2026, 11, 25, 12, 0, 0, 0, time.UTC))
	apitest.ExpectStatus(t, ana.Post("/me/finance/pantry/items/"+cafe+"/run-outs", nil), http.StatusNoContent)
	id := post(t, ana, nfcetest.Key, http.StatusCreated).Body["id"].(string)
	apitest.ExpectStatus(t, putLine(ana, id, 1, map[string]any{"itemId": cafe}), http.StatusOK)
	if got := items(t, ana); got[0]["state"] != "ran_out" {
		t.Errorf("state = %v, want ran_out", got[0])
	}
}

func TestDeletingAnItemKeepsTheReceiptAndAsksAgain(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	id := post(t, ana, nfcetest.Key, http.StatusCreated).Body["id"].(string)
	item := add(t, ana, map[string]any{"name": "Margarina"})
	apitest.ExpectStatus(t, putLine(ana, id, 1, map[string]any{"itemId": item}), http.StatusOK)
	apitest.ExpectStatus(t, ana.Delete("/me/finance/pantry/items/"+item), http.StatusNoContent)
	if ls := lines(post(t, ana, nfcetest.Key, http.StatusOK)); len(ls) != 34 || ls[0]["itemId"] != nil {
		t.Errorf("line 1 after delete = %v", ls[0])
	}
	if ls := lines(post(t, ana, nfcetest.OtherKey, http.StatusCreated)); ls[0]["itemId"] != nil {
		t.Errorf("next trip = %v", ls[0])
	}
	_ = app
}

func TestMatchValidation(t *testing.T) {
	t.Parallel()
	_, ana, _ := startReceipts(t)
	id := post(t, ana, nfcetest.Key, http.StatusCreated).Body["id"].(string)
	item := add(t, ana, map[string]any{"name": "Margarina"})
	cases := []struct {
		name string
		body any
		want int
	}{
		{"empty", map[string]any{}, 400},
		{"two choices", map[string]any{"itemId": item, "ignore": true}, 400},
		{"ignore false", map[string]any{"ignore": false}, 400},
		{"not a uuid", map[string]any{"itemId": "x"}, 400},
		{"new item without a name", map[string]any{"newItem": map[string]any{"brand": "x"}}, 400},
		{"new item over-long brand", map[string]any{"newItem": map[string]any{"name": "A", "brand": strings.Repeat("x", 61)}}, 400},
		{"extra key", map[string]any{"ignore": true, "x": 1}, 400},
		{"name taken", map[string]any{"newItem": map[string]any{"name": "margarina"}}, 409},
		{"unknown item", map[string]any{"itemId": "00000000-0000-4000-8000-000000000001"}, 404},
	}
	for _, c := range cases {
		if r := putLine(ana, id, 1, c.body); r.Status != c.want {
			t.Errorf("%s: status = %d, want %d (%s)", c.name, r.Status, c.want, r.Raw)
		}
	}
	if r := putLine(ana, id, 35, map[string]any{"ignore": true}); r.Status != 404 {
		t.Errorf("line 35: %d", r.Status)
	}
	if r := putLine(ana, id, 0, map[string]any{"ignore": true}); r.Status != 404 {
		t.Errorf("line 0: %d", r.Status)
	}
	if r := putLine(ana, id, 99999999999, map[string]any{"ignore": true}); r.Status != 404 {
		t.Errorf("line 99999999999: %d", r.Status)
	}
}

func TestPostValidation(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	for _, code := range []string{"", "abc", nfcetest.Key[:43], nfcetest.Key[:43] + "0"} {
		if r := post(t, ana, code, http.StatusBadRequest); r.Body["error"] != "invalid_code" {
			t.Errorf("%q: %s", code, r.Raw)
		}
	}
	apitest.ExpectStatus(t, ana.Post(receiptsPath, map[string]any{}), http.StatusBadRequest)
	// A valid key of a state with no host in the table.
	if r := post(t, ana, "35261175315333015807655140000123451111111116", http.StatusUnprocessableEntity); r.Body["error"] != "unsupported_state" {
		t.Errorf("unsupported: %s", r.Raw)
	}
	if app.NFCe.Hits() != 0 {
		t.Errorf("hits = %d, want 0", app.NFCe.Hits())
	}
}

func TestSefazFailuresAreSefazUnavailable(t *testing.T) {
	t.Parallel()
	page := nfcetest.Page("23-1.html")
	cases := []struct {
		name string
		fail func(*nfcetest.Server)
	}{
		{"500", func(s *nfcetest.Server) { s.Fail(500, "boom") }},
		{"oversize", func(s *nfcetest.Server) { s.Fail(200, strings.Repeat("x", 2<<20)) }},
		{"garbage html", func(s *nfcetest.Server) { s.Fail(200, `{"xml":"<p>nothing</p>"}`) }},
		{"truncated", func(s *nfcetest.Server) { s.Fail(200, `{"xml":"`+strings.ReplaceAll(page[:500], `"`, `'`)+`"}`) }},
	}
	for _, c := range cases {
		app, ana, _ := startReceipts(t)
		c.fail(app.NFCe)
		r := post(t, ana, nfcetest.Key, http.StatusBadGateway)
		if r.Body["error"] != "sefaz_unavailable" {
			t.Errorf("%s: %s", c.name, r.Raw)
		}
		if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipts`); n != 0 {
			t.Errorf("%s: receipts = %d, want 0", c.name, n)
		}
	}
}

func TestAForeignHostIsNeverFetched(t *testing.T) {
	t.Parallel()
	var foreign atomic.Int32
	evil := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { foreign.Add(1) }))
	t.Cleanup(evil.Close)
	app, ana, _ := startReceipts(t)

	post(t, ana, evil.URL+"/pages/ShowNFCe.html?p="+nfcetest.Key+"|2|1|1|ABC", http.StatusCreated)
	if foreign.Load() != 0 || app.NFCe.Hits() != 1 {
		t.Errorf("foreign hits = %d, table host hits = %d, want 0 and 1", foreign.Load(), app.NFCe.Hits())
	}
}

func TestARedirectToAnotherHostIsRefused(t *testing.T) {
	t.Parallel()
	var foreign atomic.Int32
	evil := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { foreign.Add(1) }))
	t.Cleanup(evil.Close)
	app, ana, _ := startReceipts(t)
	app.NFCe.RedirectTo(evil.URL)
	r := post(t, ana, nfcetest.Key, http.StatusBadGateway)
	if r.Body["error"] != "sefaz_unavailable" || foreign.Load() != 0 || app.NFCe.Hits() != 1 {
		t.Errorf("body = %s, foreign hits = %d, hits = %d", r.Raw, foreign.Load(), app.NFCe.Hits())
	}
}

func TestTheConsumerNeverReachesTheDatabaseOrAResponse(t *testing.T) {
	t.Parallel()
	app, ana, _ := startReceipts(t)
	r := post(t, ana, nfcetest.Key, http.StatusCreated)
	id := r.Body["id"].(string)
	again := post(t, ana, nfcetest.Key, http.StatusOK)
	m := putLine(ana, id, 1, map[string]any{"ignore": true})
	for _, body := range []string{string(r.Raw), string(again.Raw), string(m.Raw)} {
		if strings.Contains(body, "111.444") || strings.Contains(body, "11144477735") || strings.Contains(body, nfcetest.Name) {
			t.Errorf("response carries the consumer: %.200s", body)
		}
	}
	// Every text column of the new tables, as one string per row.
	for _, tbl := range []string{"finance_pantry_receipts", "finance_pantry_receipt_lines", "finance_pantry_line_matches"} {
		if n := count(t, app, `SELECT count(*) FROM `+tbl+` x WHERE x::text LIKE '%111.444%' OR x::text LIKE '%11144477735%' OR x::text LIKE '%CONSUMIDOR%'`); n != 0 {
			t.Errorf("%s has %d rows with the consumer", tbl, n)
		}
	}
}

func TestAnotherUsersReceiptAndItemAre404(t *testing.T) {
	t.Parallel()
	_, ana, bia := startReceipts(t)
	id := post(t, ana, nfcetest.Key, http.StatusCreated).Body["id"].(string)
	biaItem := add(t, bia, map[string]any{"name": "Café"})
	anaItem := add(t, ana, map[string]any{"name": "Café"})
	if r := putLine(bia, id, 1, map[string]any{"ignore": true}); r.Status != http.StatusNotFound {
		t.Errorf("Bia on Ana's receipt = %d", r.Status)
	}
	if r := putLine(ana, id, 1, map[string]any{"itemId": biaItem}); r.Status != http.StatusNotFound {
		t.Errorf("Ana matching Bia's item = %d", r.Status)
	}
	// Bia posting the same key gets her own receipt, not Ana's.
	if b := post(t, bia, nfcetest.Key, http.StatusCreated); b.Body["id"] == id {
		t.Error("Bia got Ana's receipt")
	}
	apitest.ExpectStatus(t, putLine(ana, id, 1, map[string]any{"itemId": anaItem}), http.StatusOK)
}

func TestReceiptRouteWithoutAClientIs503(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	apitest.ExpectStatus(t, app.SignInAs("ana@example.com").Post(receiptsPath, map[string]any{"code": nfcetest.Key}), http.StatusServiceUnavailable)
}
