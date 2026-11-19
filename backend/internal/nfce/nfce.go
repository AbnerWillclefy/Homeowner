// Package nfce is the app's one view of a state SEFAZ's NFC-e consultation
// page: a Client interface, the Receipt it returns and ParseCode, which turns
// what the User typed or scanned into an access key. NewHTTP is the only
// Client; tests run it against nfcetest, never a real SEFAZ.
//
// A Receipt has no field for the consumer's CPF or name, so nothing can carry them.
package nfce

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var (
	// ErrInvalidCode is input that is not an NFC-e access key or a QR URL carrying one.
	ErrInvalidCode = errors.New("nfce: invalid code")
	// ErrUnsupportedState is a key whose state has no host in the table.
	ErrUnsupportedState = errors.New("nfce: unsupported state")
	// ErrUnavailable is a SEFAZ that could not be reached or read: a timeout,
	// a network error, a bad status, an oversize body or a page the parser rejects.
	ErrUnavailable = errors.New("nfce: sefaz unavailable")
)

// Client reads receipts from SEFAZ.
type Client interface {
	// Fetch reads the receipt of a key ParseCode accepted.
	Fetch(ctx context.Context, key string) (Receipt, error)
}

// Receipt is one NFC-e as the page shows it. Money is in cents and quantities
// in thousandths. TotalCents is what the page says to pay, never recomputed.
type Receipt struct {
	StoreName string
	CNPJ      string // 14 digits
	IssuedOn  time.Time
	// TotalCents is the amount to pay, after any discount.
	TotalCents int64
	Lines      []Line
}

// Line is one item row. Unit is kept as the state serves it.
type Line struct {
	Description    string
	ProductCode    string
	QuantityMilli  int64
	Unit           string
	UnitPriceCents int64
	TotalCents     int64
}

var (
	keyRe = regexp.MustCompile(`^[0-9]{44}$`)
	// pRe is a QR code's p value: the key, then pipe-separated digits and hex.
	pRe = regexp.MustCompile(`^[0-9]{44}(\|[0-9A-Fa-f]*)*$`)
)

// ParseCode returns the access key in input: 44 digits (spaces allowed) or a
// QR URL whose p value starts with one. Only the key is kept; the URL's scheme,
// host and path are thrown away, so the User never chooses what is fetched.
func ParseCode(input string) (string, error) {
	input = strings.TrimSpace(input)
	key := strings.Join(strings.Fields(input), "")
	if !keyRe.MatchString(key) {
		u, err := url.Parse(input)
		if err != nil || !pRe.MatchString(u.Query().Get("p")) {
			return "", ErrInvalidCode
		}
		key = u.Query().Get("p")[:44]
	}
	if key[20:22] != "65" || !validCheckDigit(key) {
		return "", ErrInvalidCode
	}
	return key, nil
}

// validCheckDigit is the key's mod-11 check: weights 2..9 from the right.
func validCheckDigit(key string) bool {
	sum, w := 0, 2
	for i := 42; i >= 0; i-- {
		sum += int(key[i]-'0') * w
		if w++; w > 9 {
			w = 2
		}
	}
	dv := 11 - sum%11
	if dv >= 10 {
		dv = 0
	}
	return int(key[43]-'0') == dv
}
