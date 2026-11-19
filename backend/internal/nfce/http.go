package nfce

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"time"
)

const maxBodyBytes = 1 << 20

// Hosts is the production table from state code (the key's first two digits)
// to the consultation endpoint. Supporting a state is one entry here and one
// fixture in nfcetest/testdata. Ceará is plain HTTP: its HTTPS chain is under
// the ICP-Brasil root, which Go does not trust, and the data is public.
var Hosts = map[string]string{
	"23": "http://nfce.sefaz.ce.gov.br/nfce/api/notasFiscal/qrcodev3/",
}

// parsers read each state's page.
var parsers = map[string]func(string) (Receipt, error){"23": parseCE}

// HTTP is the net/http Client. It never logs, and its errors carry no page.
type HTTP struct {
	hosts map[string]string
	hc    *http.Client
}

// NewHTTP returns a Client that fetches only from the endpoints in hosts. A
// redirect to any other host is refused: it is the other way an SSRF gets out.
func NewHTTP(hosts map[string]string) *HTTP {
	allowed := map[string]bool{}
	for _, h := range hosts {
		if u, err := url.Parse(h); err == nil {
			allowed[u.Host] = true
		}
	}
	return &HTTP{hosts: hosts, hc: &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if !allowed[req.URL.Host] || len(via) > 3 {
				return errors.New("redirect refused")
			}
			return nil
		},
	}}
}

// Fetch implements Client. The URL comes from the table and the body from the
// validated key, never from the User's input.
func (h *HTTP) Fetch(ctx context.Context, key string) (Receipt, error) {
	endpoint, ok := h.hosts[key[:2]]
	parse := parsers[key[:2]]
	if !ok || parse == nil {
		return Receipt{}, ErrUnsupportedState
	}
	body, _ := json.Marshal(map[string]string{"chave_acesso": key, "versao_qrcode": "3", "tipo_ambiente": "1"})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return Receipt{}, ErrUnavailable
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := h.hc.Do(req)
	if err != nil {
		return Receipt{}, ErrUnavailable // the cause is dropped: a transport error can quote the URL
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return Receipt{}, ErrUnavailable
	}
	raw, err := io.ReadAll(io.LimitReader(res.Body, maxBodyBytes+1))
	if err != nil || len(raw) > maxBodyBytes {
		return Receipt{}, ErrUnavailable
	}
	var out struct {
		XML string `json:"xml"`
	}
	if json.Unmarshal(raw, &out) != nil {
		return Receipt{}, ErrUnavailable
	}
	rc, err := parse(out.XML)
	if err != nil {
		return Receipt{}, ErrUnavailable
	}
	return rc, nil
}
