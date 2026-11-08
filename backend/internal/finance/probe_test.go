package finance_test

import (
	"context"
	"fmt"
	"testing"
)

func TestProbe(t *testing.T) {
	app, _ := startSync(t, []string{"ana@example.com"})
	app.RunFinanceSync(t)
	rows, _ := app.DB.Query(context.Background(), `SELECT t.posted_on::text, t.description, t.amount_cents, t.type, coalesce(t.spending_category,''), t.merchant_key, s.kind, t.category_set_by FROM finance_transactions t JOIN finance_sources s ON s.id=t.source_id WHERE posted_on >= '2026-10-01' ORDER BY posted_on DESC`)
	for rows.Next() {
		var p, de, ty, c, mk, k string
		var by *string
		var a int64
		rows.Scan(&p, &de, &a, &ty, &c, &mk, &k, &by)
		fmt.Println(p, de, a, ty, c, mk, k, by)
	}
}
