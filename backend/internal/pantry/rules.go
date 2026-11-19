// Package pantry is the User's private Pantry: generic items at home and
// whether each ran out. State is derived from events, never stored.
package pantry

import (
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/nfce"
)

// The two states an item can be in. There is no "running low".
const (
	InStock = "in_stock"
	RanOut  = "ran_out"
)

// StateOf is RanOut only when there is a run-out strictly after the latest
// purchase (or no purchase). A run-out on the purchase day is InStock: the
// User usually marks it, then shops.
func StateOf(latestPurchase, latestRunOut *time.Time) string {
	if latestRunOut != nil && (latestPurchase == nil || latestRunOut.After(*latestPurchase)) {
		return RanOut
	}
	return InStock
}

var accents = strings.NewReplacer(
	"Á", "A", "À", "A", "Â", "A", "Ã", "A", "Ä", "A", "É", "E", "È", "E", "Ê", "E", "Ë", "E",
	"Í", "I", "Ì", "I", "Î", "I", "Ï", "I", "Ó", "O", "Ò", "O", "Ô", "O", "Õ", "O", "Ö", "O",
	"Ú", "U", "Ù", "U", "Û", "U", "Ü", "U", "Ç", "C", "Ñ", "N")

// LineKey is the stable form of a receipt line's description: uppercase,
// accents removed, runs of spaces collapsed, digits kept (unlike
// finance.MerchantKey, which drops them: "LEITE 1L" and "LEITE 5L" are
// different products). Matches are saved under it.
// shortcut: the same product described differently at two stores is two keys,
// and the store's product code is not part of the key; upgrade when Users
// report asking twice.
func LineKey(description string) string {
	return strings.Join(strings.Fields(accents.Replace(strings.ToUpper(description))), " ")
}

// Limits of a receipt draft. maxCents and maxMilli keep every sum far from
// overflowing, whatever the model wrote.
const (
	maxDraftLines   = 200
	maxDraftText    = 120
	maxDraftUnit    = 10
	maxCents        = 10_000_000_000
	maxMilli        = 1_000_000_000
	sumToleranceCts = 5
)

// cpfRe finds a digit run, or a CPF written with its dots and dash.
var cpfRe = regexp.MustCompile(`\d{3}\.\d{3}\.\d{3}-\d{2}|\d+`)

// cleanText removes control characters and CPF-shaped runs (ddd.ddd.ddd-dd, or
// exactly 11 digits), which the model may copy from the consumer's line of the
// receipt, then trims. A longer digit run, such as a barcode, stays.
// shortcut: an 11-digit product code is dropped too; upgrade if Users report it.
func cleanText(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
	s = cpfRe.ReplaceAllStringFunc(s, func(m string) string {
		if strings.ContainsRune(m, '.') || len(m) == 11 {
			return ""
		}
		return m
	})
	return strings.Join(strings.Fields(s), " ")
}

// digitsOf keeps the digits of s.
func digitsOf(s string) string {
	return strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, s)
}

// ValidateDraft checks a draft read from a photo and returns it cleaned with
// the codes of the fields that fail. today is the date in São Paulo. A CNPJ
// that is not 14 digits and an access key that is not a valid NFC-e key are
// dropped, not failed: they are optional. The codes are storeName, issuedOn,
// totalCents (negative, or not the sum of the lines within 5 cents), lines
// (none, or over 200) and lines.N.description, .quantityMilli, .unit,
// .unitPriceCents and .totalCents for line N counted from 1.
func ValidateDraft(d llmalloc.ReceiptDraft, today time.Time) (llmalloc.ReceiptDraft, []string) {
	var bad []string
	d.StoreName = cleanText(d.StoreName)
	if n := utf8.RuneCountInString(d.StoreName); n < 1 || n > maxDraftText {
		bad = append(bad, "storeName")
	}
	if cnpj := digitsOf(d.StoreCNPJ); len(cnpj) == 14 {
		d.StoreCNPJ = cnpj
	} else {
		d.StoreCNPJ = ""
	}
	if key, err := nfce.ParseCode(d.AccessKey); err == nil {
		d.AccessKey = key
	} else {
		d.AccessKey = ""
	}
	if issued, err := time.Parse(time.DateOnly, d.IssuedOn); err != nil || issued.After(today) {
		bad = append(bad, "issuedOn")
	}
	if len(d.Lines) < 1 || len(d.Lines) > maxDraftLines {
		return d, append(bad, "lines")
	}
	var sum int64
	lines := make([]llmalloc.ReceiptDraftLine, len(d.Lines))
	for i, l := range d.Lines {
		l.Description, l.Unit = cleanText(l.Description), cleanText(l.Unit)
		code := func(field string, ok bool) {
			if !ok {
				bad = append(bad, fmt.Sprintf("lines.%d.%s", i+1, field))
			}
		}
		n := utf8.RuneCountInString(l.Description)
		code("description", n >= 1 && n <= maxDraftText)
		code("quantityMilli", l.QuantityMilli > 0 && l.QuantityMilli <= maxMilli)
		code("unit", utf8.RuneCountInString(l.Unit) <= maxDraftUnit)
		code("unitPriceCents", l.UnitPriceCents >= 0 && l.UnitPriceCents <= maxCents)
		code("totalCents", l.TotalCents >= 0 && l.TotalCents <= maxCents)
		if l.TotalCents >= 0 && l.TotalCents <= maxCents {
			sum += l.TotalCents
		}
		lines[i] = l
	}
	d.Lines = lines
	if d.TotalCents < 0 || d.TotalCents > maxCents || sum-d.TotalCents > sumToleranceCts || d.TotalCents-sum > sumToleranceCts {
		bad = append(bad, "totalCents")
	}
	return d, bad
}
