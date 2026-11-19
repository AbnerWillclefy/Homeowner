package pantry_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/nfce/nfcetest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

const photoPath = receiptsPath + "/photo"

// The marker sits after the JPEG header: nothing in the photo may reach a log or a column.
const marker = "PHOTO-MARKER-7f3a9c"

var jpeg = append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, marker...)

// readDraft is what the fake model answers: a store, a date before the fake clock's today (2026-03-04) and two lines.
const readDraft = `{"storeName":"Mercado Bom","storeCnpj":"12345678000199","accessKey":"","issuedOn":"2026-03-03","totalCents":1000,
	"lines":[{"description":"CAFE","quantityMilli":1000,"unit":"UN","unitPriceCents":600,"totalCents":600},
	{"description":"ARROZ","quantityMilli":2000,"unit":"UN","unitPriceCents":200,"totalCents":400}]}`

func startPhotos(t *testing.T) (*apitest.App, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com", "bia@example.com"),
		apitest.WithNFCe(), apitest.WithReceiptReader())
	app.ReceiptReader.Answer(readDraft)
	return app, app.SignInAs("ana@example.com")
}

func sendPhoto(c *apitest.Client, contentType string, body []byte) apitest.Response {
	return c.SendBytes(photoPath, contentType, body)
}

// draftOf is the draft the fake answers, as the client would send it back.
func draftOf(t *testing.T, edit func(map[string]any)) map[string]any {
	t.Helper()
	var d map[string]any
	if err := json.Unmarshal([]byte(readDraft), &d); err != nil {
		t.Fatal(err)
	}
	if edit != nil {
		edit(d)
	}
	return d
}

func TestAPhotoAnswersTheDraftAndSavesNothing(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	r := sendPhoto(ana, "image/jpeg", jpeg)
	apitest.ExpectStatus(t, r, http.StatusOK)
	d, _ := r.Body["draft"].(map[string]any)
	if d["storeName"] != "Mercado Bom" || d["totalCents"] != float64(1000) || len(d["lines"].([]any)) != 2 {
		t.Fatalf("draft = %s", r.Raw)
	}
	if got := app.ReceiptReader.LastRequest().Image; !bytes.Equal(got, jpeg) {
		t.Errorf("the model got %x, want the uploaded bytes", got)
	}
	for _, tbl := range []string{"finance_pantry_receipts", "finance_pantry_receipt_lines"} {
		if n := count(t, app, `SELECT count(*) FROM `+tbl); n != 0 {
			t.Errorf("%s has %d rows after a photo", tbl, n)
		}
	}
}

func TestADraftTheModelGotWrongIsStillAnswered(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	app.ReceiptReader.Answer(strings.Replace(readDraft, `"totalCents":1000,`, `"totalCents":5000,`, 1))
	r := sendPhoto(ana, "image/jpeg", jpeg)
	apitest.ExpectStatus(t, r, http.StatusOK)
	if r.Body["draft"].(map[string]any)["totalCents"] != float64(5000) {
		t.Errorf("draft = %s", r.Raw)
	}
}

func TestAPhotoAnswerDropsACPFAndABadCNPJ(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	app.ReceiptReader.Answer(strings.NewReplacer(`"CAFE"`, `"CAFE 111.444.777-35"`, `12345678000199`, `123`).Replace(readDraft))
	r := sendPhoto(ana, "image/jpeg", jpeg)
	apitest.ExpectStatus(t, r, http.StatusOK)
	d := r.Body["draft"].(map[string]any)
	if d["storeCnpj"] != "" || d["lines"].([]any)[0].(map[string]any)["description"] != "CAFE" || strings.Contains(string(r.Raw), "111.444") {
		t.Errorf("draft = %s", r.Raw)
	}
}

func TestAnUnusableUploadIsRefusedWithoutAModelCall(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	cases := []struct {
		name, contentType string
		body              []byte
		want              int
	}{
		{"a PNG", "image/png", []byte("\x89PNG\r\n\x1a\n"), http.StatusUnsupportedMediaType},
		{"PNG bytes labelled JPEG", "image/jpeg", []byte("\x89PNG\r\n\x1a\n"), http.StatusUnsupportedMediaType},
		{"a JSON body", "application/json", jpeg, http.StatusUnsupportedMediaType},
		{"an empty body", "image/jpeg", nil, http.StatusUnsupportedMediaType},
		{"1.5 MB plus a byte", "image/jpeg", append(slices.Clone(jpeg), make([]byte, 1536*1024+1-len(jpeg))...), http.StatusRequestEntityTooLarge},
	}
	for _, c := range cases {
		if r := sendPhoto(ana, c.contentType, c.body); r.Status != c.want {
			t.Errorf("%s: status = %d %s, want %d", c.name, r.Status, r.Raw, c.want)
		}
	}
	if n := app.ReceiptReader.Calls(); n != 0 {
		t.Errorf("model calls = %d, want 0", n)
	}
	if n := count(t, app, `SELECT coalesce(sum(calls), 0) FROM finance_pantry_photo_calls`); n != 0 {
		t.Errorf("a refused upload counted %d calls", n)
	}
	// Exactly the limit is read.
	exact := append(slices.Clone(jpeg), make([]byte, 1536*1024-len(jpeg))...)
	apitest.ExpectStatus(t, sendPhoto(ana, "image/jpeg", exact), http.StatusOK)
}

func TestThePhotoRouteWithoutAReaderIs503(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t, apitest.WithFinance(apitest.FinanceTestKey(), "ana@example.com"))
	apitest.ExpectStatus(t, sendPhoto(app.SignInAs("ana@example.com"), "image/jpeg", jpeg), http.StatusServiceUnavailable)
}

func TestThePhotoRouteIsBehindTheFinanceAllowlist(t *testing.T) {
	t.Parallel()
	app, _ := startPhotos(t)
	apitest.ExpectStatus(t, sendPhoto(app.SignInAs("eve@example.com"), "image/jpeg", jpeg), http.StatusForbidden)
	if n := app.ReceiptReader.Calls(); n != 0 {
		t.Errorf("model calls = %d, want 0", n)
	}
}

func TestTheEleventhPhotoOfTheDayIsRefusedAndTheNextDayWorks(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	bia := app.SignInAs("bia@example.com")
	for i := range 10 {
		if r := sendPhoto(ana, "image/jpeg", jpeg); r.Status != http.StatusOK {
			t.Fatalf("photo %d = %d %s", i+1, r.Status, r.Raw)
		}
	}
	r := sendPhoto(ana, "image/jpeg", jpeg)
	if r.Status != http.StatusTooManyRequests || r.Body["error"] != "photo_cap" || app.ReceiptReader.Calls() != 10 {
		t.Fatalf("eleventh = %d %s, model calls = %d", r.Status, r.Raw, app.ReceiptReader.Calls())
	}
	// The cap is per User.
	apitest.ExpectStatus(t, sendPhoto(bia, "image/jpeg", jpeg), http.StatusOK)
	// 2026-03-04 09:00 UTC is 06:00 in São Paulo: 18 hours later is 03:00 the next day there.
	app.Clock.Advance(18 * time.Hour)
	apitest.ExpectStatus(t, sendPhoto(ana, "image/jpeg", jpeg), http.StatusOK)
	if n := count(t, app, `SELECT count(*) FROM llm_call_events WHERE service = 'receipt' AND outcome = 'skipped_cap'`); n != 1 {
		t.Errorf("skipped_cap events = %d, want 1", n)
	}
}

func TestAnAnswerThatIsNotAReceiptIs502AndStillCounts(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	app.ReceiptReader.Answer("not json")
	r := sendPhoto(ana, "image/jpeg", jpeg)
	if r.Status != http.StatusBadGateway || r.Body["error"] != "photo_unreadable" {
		t.Fatalf("status = %d %s", r.Status, r.Raw)
	}
	if n := count(t, app, `SELECT sum(calls) FROM finance_pantry_photo_calls`); n != 1 {
		t.Errorf("counted calls = %d, want 1", n)
	}
	if n := count(t, app, `SELECT count(*) FROM llm_call_events WHERE service = 'receipt' AND outcome = 'invalid_response'`); n != 1 {
		t.Errorf("invalid_response events = %d, want 1", n)
	}
}

func TestAModelFailureIs502AndRecordsItsKind(t *testing.T) {
	t.Parallel()
	for outcome, fail := range map[string]func(*apitest.App){
		"error":   func(a *apitest.App) { a.ReceiptReader.Fail(errors.New("boom")) },
		"timeout": func(a *apitest.App) { a.ReceiptReader.Fail(context.DeadlineExceeded) },
	} {
		app, ana := startPhotos(t)
		fail(app)
		if r := sendPhoto(ana, "image/jpeg", jpeg); r.Status != http.StatusBadGateway || r.Body["error"] != "photo_unreadable" {
			t.Errorf("%s: status = %d %s", outcome, r.Status, r.Raw)
		}
		if n := count(t, app, `SELECT count(*) FROM llm_call_events WHERE service = 'receipt' AND outcome = $1`, outcome); n != 1 {
			t.Errorf("%s events = %d, want 1", outcome, n)
		}
	}
}

func TestSavingAnInvalidDraftIs400WithItsFields(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	cases := []struct {
		name string
		edit func(map[string]any)
		want string
	}{
		{"sum off", func(d map[string]any) { d["totalCents"] = 2000 }, "totalCents"},
		{"quantity 0", func(d map[string]any) { d["lines"].([]any)[1].(map[string]any)["quantityMilli"] = 0 }, "lines.2.quantityMilli"},
		{"future date", func(d map[string]any) { d["issuedOn"] = "2026-03-05" }, "issuedOn"},
		{"no lines", func(d map[string]any) { d["lines"] = []any{} }, "lines"},
	}
	for _, c := range cases {
		r := ana.Post(receiptsPath, map[string]any{"draft": draftOf(t, c.edit)})
		fields, _ := r.Body["fields"].([]any)
		if r.Status != http.StatusBadRequest || r.Body["error"] != "invalid_draft" || !slices.Contains(fields, any(c.want)) {
			t.Errorf("%s: %d %s, want field %s", c.name, r.Status, r.Raw, c.want)
		}
	}
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipts`); n != 0 {
		t.Errorf("receipts = %d, want 0", n)
	}
}

func TestSavingABodyWithBothOrNeitherOfCodeAndDraftIs400(t *testing.T) {
	t.Parallel()
	_, ana := startPhotos(t)
	for name, body := range map[string]map[string]any{
		"both":    {"code": nfcetest.Key, "draft": draftOf(t, nil)},
		"neither": {},
		"null":    {"draft": nil},
	} {
		apitest.ExpectStatus(t, ana.Post(receiptsPath, body), http.StatusBadRequest)
		_ = name
	}
}

func TestSavingAConfirmedDraftStoresItAsReadByPhotoAndMatchesIt(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	r := ana.Post(receiptsPath, map[string]any{"draft": draftOf(t, nil)})
	apitest.ExpectStatus(t, r, http.StatusCreated)
	ls := lines(r)
	if r.Body["readBy"] != "photo" || r.Body["storeName"] != "Mercado Bom" || r.Body["issuedOn"] != "2026-03-03" || r.Body["totalCents"] != float64(1000) || len(ls) != 2 {
		t.Fatalf("receipt = %s", r.Raw)
	}
	if ls[0]["description"] != "CAFE" || ls[0]["itemId"] != nil || ls[0]["ignored"] != false || ls[1]["n"] != float64(2) {
		t.Errorf("lines = %v", ls)
	}
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipts WHERE read_by = 'photo' AND access_key IS NULL AND store_cnpj = '12345678000199'`); n != 1 {
		t.Errorf("stored photo receipts = %d, want 1", n)
	}
	// A line the User matched before is matched on the next photo receipt.
	item := add(t, ana, map[string]any{"name": "Café"})
	apitest.ExpectStatus(t, putLine(ana, r.Body["id"].(string), 1, map[string]any{"itemId": item}), http.StatusOK)
	second := ana.Post(receiptsPath, map[string]any{"draft": draftOf(t, func(d map[string]any) { d["issuedOn"] = "2026-03-02" })})
	apitest.ExpectStatus(t, second, http.StatusCreated)
	if lines(second)[0]["itemId"] != item {
		t.Errorf("second receipt's first line = %v, want matched to %s", lines(second)[0], item)
	}
}

func TestTheSameStoreDateAndTotalSavesOneReceipt(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	first := ana.Post(receiptsPath, map[string]any{"draft": draftOf(t, nil)})
	apitest.ExpectStatus(t, first, http.StatusCreated)
	// The store's case differs and a line is spelt otherwise: still the same trip.
	again := ana.Post(receiptsPath, map[string]any{"draft": draftOf(t, func(d map[string]any) {
		d["storeName"] = "MERCADO BOM"
		d["lines"].([]any)[0].(map[string]any)["description"] = "CAFE 500G"
		d["lines"].([]any)[0].(map[string]any)["quantityMilli"] = 3000
	})})
	apitest.ExpectStatus(t, again, http.StatusOK)
	if again.Body["id"] != first.Body["id"] || again.Body["storeName"] != "Mercado Bom" {
		t.Errorf("second = %s, want the first receipt", again.Raw)
	}
	// Another day, or another total, is another trip; so is another User.
	for name, edit := range map[string]func(map[string]any){
		"another date": func(d map[string]any) { d["issuedOn"] = "2026-03-02" },
		"another total": func(d map[string]any) {
			d["totalCents"] = 1001
			d["lines"].([]any)[0].(map[string]any)["totalCents"] = 601
		},
	} {
		if r := ana.Post(receiptsPath, map[string]any{"draft": draftOf(t, edit)}); r.Status != http.StatusCreated {
			t.Errorf("%s: %d %s", name, r.Status, r.Raw)
		}
	}
	apitest.ExpectStatus(t, app.SignInAs("bia@example.com").Post(receiptsPath, map[string]any{"draft": draftOf(t, nil)}), http.StatusCreated)
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipts`); n != 4 {
		t.Errorf("receipts = %d, want 4", n)
	}
}

func TestADraftWithAValidKeyDedupesAgainstASEFAZImport(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	sefaz := post(t, ana, nfcetest.Key, http.StatusCreated)
	r := ana.Post(receiptsPath, map[string]any{"draft": draftOf(t, func(d map[string]any) { d["accessKey"] = nfcetest.Key })})
	apitest.ExpectStatus(t, r, http.StatusOK)
	if r.Body["id"] != sefaz.Body["id"] || r.Body["readBy"] != "sefaz" {
		t.Errorf("photo of the same receipt = %s, want the SEFAZ one", r.Raw)
	}
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipts`); n != 1 {
		t.Errorf("receipts = %d, want 1", n)
	}
}

func TestADraftWithAValidKeyIsStoredWithIt(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	apitest.ExpectStatus(t, ana.Post(receiptsPath, map[string]any{"draft": draftOf(t, func(d map[string]any) { d["accessKey"] = nfcetest.Key })}), http.StatusCreated)
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipts WHERE read_by = 'photo' AND access_key = $1`, nfcetest.Key); n != 1 {
		t.Errorf("receipts stored with the key = %d, want 1", n)
	}
}

func TestEachPhotoCallIsOneReceiptEventAndShowsInAdminAI(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	app.ReceiptReader.ReportUsage("claude-haiku-5-5", 3000, 400)
	apitest.ExpectStatus(t, sendPhoto(ana, "image/jpeg", jpeg), http.StatusOK)
	apitest.ExpectStatus(t, sendPhoto(ana, "image/jpeg", jpeg), http.StatusOK)
	if n := count(t, app, `SELECT count(*) FROM llm_call_events WHERE service = 'receipt' AND outcome = 'accepted'
		AND home_id IS NULL AND items_sent = 1 AND items_accepted = 2 AND input_tokens = 3000 AND output_tokens = 400 AND est_cost_micros > 0`); n != 2 {
		t.Errorf("receipt events = %d, want 2", n)
	}
	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/ai?range=7d")
	apitest.ExpectStatus(t, res, http.StatusOK)
	var out admin.AIResponse
	if err := json.Unmarshal(res.Raw, &out); err != nil {
		t.Fatal(err)
	}
	if got := out.Days[len(out.Days)-1].Services.Receipt; got.Outcomes.Accepted != 2 || got.InputTokens != 6000 || got.EstCostMicros == 0 {
		t.Errorf("receipt = %+v, want two accepted calls with cost", got)
	}
}

// Nothing in the photo, the draft or the answer may reach a log or a column.
func TestNothingOfThePhotoIsKeptOrLogged(t *testing.T) {
	t.Parallel()
	app, ana := startPhotos(t)
	app.ReceiptReader.Answer(strings.Replace(readDraft, `"CAFE"`, `"CAFE `+marker+`"`, 1))
	apitest.ExpectStatus(t, sendPhoto(ana, "image/jpeg", jpeg), http.StatusOK)
	app.ReceiptReader.Answer("garbage " + marker)
	apitest.ExpectStatus(t, sendPhoto(ana, "image/jpeg", jpeg), http.StatusBadGateway)
	app.ReceiptReader.Fail(errors.New("upstream said " + marker))
	apitest.ExpectStatus(t, sendPhoto(ana, "image/jpeg", jpeg), http.StatusBadGateway)
	apitest.ExpectStatus(t, ana.Post(receiptsPath, map[string]any{"draft": draftOf(t, nil)}), http.StatusCreated)

	for _, m := range []string{marker, "Mercado Bom", "12345678000199"} {
		if app.Logs.Contains(m) {
			t.Errorf("a log line holds %q", m)
		}
	}
	for _, tbl := range []string{"llm_call_events", "finance_pantry_photo_calls"} {
		if n := count(t, app, `SELECT count(*) FROM `+tbl+` x WHERE x::text LIKE '%`+marker+`%' OR x::text LIKE '%Mercado%'`); n != 0 {
			t.Errorf("%s has %d rows with the photo or the receipt", tbl, n)
		}
	}
	if n := count(t, app, `SELECT count(*) FROM finance_pantry_receipts x WHERE x::text LIKE '%`+marker+`%'`); n != 0 {
		t.Errorf("receipts hold the marker in %d rows", n)
	}
}
