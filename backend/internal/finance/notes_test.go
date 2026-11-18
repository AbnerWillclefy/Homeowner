package finance_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestANoteIsTrimmedStoredAndCleared(t *testing.T) {
	t.Parallel()
	_, ana := seedMonth(t)
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")

	res := patch(ana, boleto.ID, map[string]string{"note": "  Fone Bluetooth  "})
	if res.Status != http.StatusOK || res.Body["note"] != "Fone Bluetooth" {
		t.Fatalf("PATCH note = %d %s, want the trimmed note", res.Status, res.Raw)
	}
	if got := find(t, ana, "2026-11", "Pagamento de boleto"); got.Note == nil || *got.Note != "Fone Bluetooth" {
		t.Errorf("listed note = %v, want Fone Bluetooth", got.Note)
	}
	for name, body := range map[string]string{"empty": "", "spaces": "   "} {
		patch(ana, boleto.ID, map[string]string{"note": "x"})
		res := patch(ana, boleto.ID, map[string]string{"note": body})
		if res.Status != http.StatusOK || res.Body["note"] != nil {
			t.Errorf("%s clears: PATCH = %d %s, want note null", name, res.Status, res.Raw)
		}
	}
}

func TestPatchNoteRejectsBadInput(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")

	for name, c := range map[string]struct {
		body   map[string]any
		status int
		errMsg string
	}{
		"200 runes of two bytes": {map[string]any{"note": strings.Repeat("é", 200)}, http.StatusOK, ""},
		"200 astral runes":       {map[string]any{"note": strings.Repeat("😀", 200)}, http.StatusOK, ""},
		"200 runes plus spaces":  {map[string]any{"note": "  " + strings.Repeat("a", 200) + "  "}, http.StatusOK, ""},
		"201 runes":              {map[string]any{"note": strings.Repeat("é", 201)}, http.StatusBadRequest, "note too long"},
		"a number":               {map[string]any{"note": 5}, http.StatusBadRequest, ""},
		"a newline":              {map[string]any{"note": "a\nb"}, http.StatusBadRequest, "invalid transaction edit"},
		"a tab":                  {map[string]any{"note": "a\tb"}, http.StatusBadRequest, "invalid transaction edit"},
		"no field":               {map[string]any{}, http.StatusBadRequest, "invalid transaction edit"},
		"null alone":             {map[string]any{"note": nil}, http.StatusBadRequest, "invalid transaction edit"},
		"a note alone":           {map[string]any{"note": "x"}, http.StatusOK, ""},
	} {
		res := patch(ana, boleto.ID, c.body)
		if res.Status != c.status || (c.errMsg != "" && res.Body["error"] != c.errMsg) {
			t.Errorf("%s = %d %s, want %d %s", name, res.Status, res.Raw, c.status, c.errMsg)
		}
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE note IS NOT NULL AND char_length(note) > 200`); n != 0 {
		t.Errorf("rows with a note over 200 = %d, want 0", n)
	}
}

func TestANoteOnlyEditLeavesTheCategoryAlone(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")
	if boleto.CategorySetBy == nil || *boleto.CategorySetBy != "fallback" {
		t.Fatalf("boleto = %+v, want a fallback expense", boleto)
	}
	if res := patch(ana, boleto.ID, map[string]string{"note": "Fone"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	got := find(t, ana, "2026-11", "Pagamento de boleto")
	if *got.SpendingCategory != *boleto.SpendingCategory || *got.CategorySetBy != "fallback" || got.TypeSetBy != "auto" {
		t.Errorf("after a note = %+v, want the category and types as before %+v", got, boleto)
	}
	if n := scalar(t, app, `SELECT count(*) FROM finance_merchant_categories WHERE merchant_key = 'PAGAMENTO DE BOLETO'`); n != 0 {
		t.Errorf("merchant corrections = %d, want 0", n)
	}
}

func TestANoteSurvivesAReSync(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	boleto := find(t, ana, "2026-11", "Pagamento de boleto")
	patch(ana, boleto.ID, map[string]string{"note": "Fone"})

	app.Clock.Advance(25 * time.Hour)
	app.RunFinanceSync(t)

	if got := find(t, ana, "2026-11", "Pagamento de boleto"); got.Note == nil || *got.Note != "Fone" {
		t.Errorf("note after the sync = %v, want Fone", got.Note)
	}
}

func TestANoteOnOneInstallmentReachesTheWholePurchase(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	parts := insertParts(t, app, "SOLAR", time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC), -9000, 12, 1, 2, 3, 4, 5)
	insertPlan(t, app, "ana@example.com", "dearer", "SOLAR 1/12", "SOLAR", "2026-06-10", -9500, 1, 12)
	insertTxn(t, app, "SOLAR", "2026-10-02", -1234, "leisure")
	ctx := context.Background()
	for id, note := range map[string]string{"dearer": "other purchase", "SOLAR": "single charge"} {
		if _, err := app.DB.Exec(ctx, `UPDATE finance_transactions SET note = $2 WHERE provider_id = $1`, id, note); err != nil {
			t.Fatal(err)
		}
	}
	// A part the User typed as a transfer still shares the Note.
	if res := patch(ana, rowID(t, app, parts[1]), map[string]string{"type": "transfer"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	holding := func(note string) int64 {
		return scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE provider_id LIKE 'SOLAR-%' AND note IS NOT DISTINCT FROM NULLIF($1, '')`, note)
	}

	if res := patch(ana, rowID(t, app, parts[5]), map[string]string{"note": "Painel solar"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	if n := holding("Painel solar"); n != 5 {
		t.Errorf("parts holding the note = %d, want 5", n)
	}
	for id, want := range map[string]string{"dearer": "other purchase", "SOLAR": "single charge"} {
		if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE provider_id = $1 AND note = $2`, id, want); n != 1 {
			t.Errorf("%s lost its own note", id)
		}
	}
	if res := patch(ana, rowID(t, app, parts[2]), map[string]string{"note": "Outro"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	if n := holding("Outro"); n != 5 {
		t.Errorf("parts holding the changed note = %d, want 5", n)
	}
	if res := patch(ana, rowID(t, app, parts[3]), map[string]string{"note": ""}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	if n := holding(""); n != 5 {
		t.Errorf("parts without a note = %d, want 5", n)
	}
}

func TestAnInstallmentImportedLaterTakesThePurchaseNote(t *testing.T) {
	t.Parallel()
	app, ana := seedMonth(t)
	const part2 = `installment_number = 2 AND total_installments = 6 AND user_id = (SELECT id FROM users WHERE email = 'ana@example.com')`
	ctx := context.Background()
	// Part 1/6 is stored, then 2/6 goes missing and the next sync re-sends it.
	if _, err := app.DB.Exec(ctx, `
		INSERT INTO finance_transactions (user_id, source_id, provider_id, posted_on, amount_cents, currency, description, merchant_key, type, type_set_by,
			spending_category, category_set_by, installment_number, total_installments, created_at, updated_at)
		SELECT user_id, source_id, 'sib1', posted_on - interval '1 month', amount_cents, currency, description, merchant_key, type, type_set_by,
			'other', 'fallback', 1, total_installments, now(), now()
		FROM finance_transactions WHERE `+part2); err != nil {
		t.Fatal(err)
	}
	resync := func() {
		if _, err := app.DB.Exec(ctx, `DELETE FROM finance_transactions WHERE `+part2+`;
			UPDATE finance_sources SET import_cursor = NULL; UPDATE finance_items SET import_complete = false`); err != nil {
			t.Fatal(err)
		}
		app.Clock.Advance(25 * time.Hour)
		app.RunFinanceSync(t)
	}
	if res := patch(ana, rowID(t, app, "sib1"), map[string]string{"note": "Presente"}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	resync()
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE `+part2+` AND note = 'Presente'`); n != 1 {
		t.Errorf("re-imported 2/6 with the note = %d, want 1", n)
	}
	if res := patch(ana, rowID(t, app, "sib1"), map[string]string{"note": ""}); res.Status != http.StatusOK {
		t.Fatal(res.Raw)
	}
	resync()
	if n := scalar(t, app, `SELECT count(*) FROM finance_transactions WHERE `+part2+` AND note IS NULL`); n != 1 {
		t.Errorf("re-imported 2/6 without a note = %d, want 1", n)
	}
}
