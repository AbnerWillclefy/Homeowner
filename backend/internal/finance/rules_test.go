package finance

import (
	"testing"
	"time"
)

func TestMerchantKey(t *testing.T) {
	t.Parallel()
	for in, want := range map[string]string{
		"NETFLIX.COM":                      "NETFLIX COM",
		"Pagamento de boleto":              "PAGAMENTO DE BOLETO",
		"SALÁRIO EMPRESA XYZ LTDA":         "SALARIO EMPRESA XYZ LTDA",
		"Mercado Livre PARC 03/10":         "MERCADO LIVRE",
		"MERCADOLIVRE*PARC03/10 SP":        "MERCADOLIVRE SP",
		"PIX*João  12345":                  "PIX JOAO",
		"  açaí &  café - Ñandú  ":         "ACAI CAFE NANDU",
		"CONDOMÍNIO ÂÊÔ ÃÕ ÀÈ ÏÜ Ç":        "CONDOMINIO AEO AO AE IU C",
		"SMART FIT ACADEMIA 0042 PARC 2/6": "SMART FIT ACADEMIA",
		"123 / 456 ---":                    "",
		"":                                 "",
	} {
		if got := MerchantKey(in); got != want {
			t.Errorf("MerchantKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPostedOnIsTheSaoPauloDay(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ utc, want string }{
		{"2026-11-07T03:00:00Z", "2026-11-07"}, // São Paulo midnight
		{"2026-11-07T02:59:59Z", "2026-11-06"}, // the evening before
		{"2026-11-07T17:21:33Z", "2026-11-07"},
		{"2026-11-08T01:00:00Z", "2026-11-07"},
	} {
		at, _ := time.Parse(time.RFC3339, c.utc)
		if got := postedOn(at).Format(time.DateOnly); got != c.want {
			t.Errorf("postedOn(%s) = %s, want %s", c.utc, got, c.want)
		}
	}
}
