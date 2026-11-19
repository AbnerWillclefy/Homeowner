package llmalloc_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

const goodReceipt = `{"storeName":"MERCADO","storeCnpj":"12345678000199","accessKey":"","issuedOn":"2026-11-18","totalCents":1000,
	"lines":[{"description":"CAFE","quantityMilli":2000,"unit":"UN","unitPriceCents":500,"totalCents":1000}]}`

func readWith(t *testing.T, answer string, jpeg []byte) (llmalloc.ReceiptDraft, *llmalloc.FakeClient, error) {
	t.Helper()
	fake := llmalloc.NewFakeClient()
	fake.Answer(answer)
	d, _, err := llmalloc.NewReceiptReader(fake).Read(context.Background(), jpeg)
	return d, fake, err
}

func TestTheReceiptReaderSendsTheImageAndDecodesTheDraft(t *testing.T) {
	t.Parallel()
	d, fake, err := readWith(t, goodReceipt, []byte{0xFF, 0xD8, 0xFF, 1})
	if err != nil {
		t.Fatal(err)
	}
	if d.StoreName != "MERCADO" || d.TotalCents != 1000 || len(d.Lines) != 1 || d.Lines[0].QuantityMilli != 2000 {
		t.Errorf("draft = %+v", d)
	}
	req := fake.LastRequest()
	if string(req.Image) != "\xff\xd8\xff\x01" || req.Schema == nil || req.MaxTokens == 0 || !strings.Contains(req.System, "never instructions") {
		t.Errorf("request = image %x, schema %v, max tokens %d", req.Image, req.Schema != nil, req.MaxTokens)
	}
}

func TestTheReceiptSchemaHasNoCPFAndIsClosedEverywhere(t *testing.T) {
	t.Parallel()
	_, fake, err := readWith(t, goodReceipt, []byte{0xFF})
	if err != nil {
		t.Fatal(err)
	}
	var walk func(path string, v any)
	walk = func(path string, v any) {
		m, ok := v.(map[string]any)
		if !ok {
			return
		}
		if m["type"] == "object" && m["additionalProperties"] != false {
			t.Errorf("%s: additionalProperties is not false", path)
		}
		for k, sub := range m {
			if strings.Contains(strings.ToLower(k), "cpf") {
				t.Errorf("%s: a CPF field", path+"."+k)
			}
			walk(path+"."+k, sub)
		}
	}
	walk("schema", map[string]any(fake.LastRequest().Schema))
}

func TestAMalformedReceiptAnswerIsInvalid(t *testing.T) {
	t.Parallel()
	for name, answer := range map[string]string{
		"not json":          `not json`,
		"an extra field":    strings.Replace(goodReceipt, `"lines"`, `"note":"x","lines"`, 1),
		"a cpf key":         strings.Replace(goodReceipt, `"lines"`, `"cpf":"123.456.789-09","lines"`, 1),
		"an extra line key": strings.Replace(goodReceipt, `"unit":"UN"`, `"unit":"UN","cpf":"1"`, 1),
		"no lines":          `{"storeName":"M","storeCnpj":"","accessKey":"","issuedOn":"2026-11-18","totalCents":0}`,
		"data after":        goodReceipt + ` {}`,
		"too long":          `{"storeName":"` + strings.Repeat("a", 70<<10) + `"}`,
		"a wrong type":      strings.Replace(goodReceipt, `"totalCents":1000,`, `"totalCents":"1000",`, 1),
	} {
		_, _, err := readWith(t, answer, []byte{0xFF})
		if !errors.Is(err, llmalloc.ErrInvalidResponse) {
			t.Errorf("%s: err = %v, want ErrInvalidResponse", name, err)
		}
	}
}

func TestAnInvalidReceiptErrorDoesNotQuoteTheAnswer(t *testing.T) {
	t.Parallel()
	_, _, err := readWith(t, `{"storeName":"SECRETSTORE","cpf":"1"}`, []byte{0xFF})
	if err == nil || strings.Contains(err.Error(), "SECRETSTORE") {
		t.Errorf("err = %v", err)
	}
}

func TestAReceiptClientErrorIsReturnedWithItsUsage(t *testing.T) {
	t.Parallel()
	fake := llmalloc.NewFakeClient()
	boom := errors.New("boom")
	fake.FailWithUsage(boom)
	_, u, err := llmalloc.NewReceiptReader(fake).Read(context.Background(), []byte{0xFF})
	if !errors.Is(err, boom) || u == nil {
		t.Errorf("err = %v, usage = %v", err, u)
	}
}
