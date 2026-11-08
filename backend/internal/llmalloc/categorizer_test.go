package llmalloc_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
)

func categorizeWith(t *testing.T, answer string, merchants ...string) (map[int]string, *llmalloc.FakeClient, error) {
	t.Helper()
	fake := llmalloc.NewFakeClient()
	fake.Answer(answer)
	got, _, err := llmalloc.NewCategorizer(fake).Categorize(context.Background(), merchants)
	return got, fake, err
}

func TestACategorizerAnswerIsMappedByIndex(t *testing.T) {
	t.Parallel()
	got, _, err := categorizeWith(t, `{"items":[{"i":0,"c":"eating_out"},{"i":1,"c":"groceries"}]}`, "IFOOD", "SUPERMERCADO ZONA SUL")
	if err != nil {
		t.Fatal(err)
	}
	if want := map[int]string{0: "eating_out", 1: "groceries"}; !maps.Equal(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestTheCategorizerSendsOnlyIndexedMerchantTextAndAClosedSchema(t *testing.T) {
	t.Parallel()
	_, fake, err := categorizeWith(t, `{"items":[]}`, "IFOOD", "PIX MARIA SILVA", "NETFLIX COM", "TED JOAO", "DOC ANA", "TRANSF CARLOS", "TRANSFERENCIA PIX")
	if err != nil {
		t.Fatal(err)
	}
	req := fake.LastRequest()
	var in struct {
		Merchants []map[string]any `json:"merchants"`
	}
	if err := json.Unmarshal([]byte(req.User), &in); err != nil {
		t.Fatalf("user message %s: %v", req.User, err)
	}
	var sent []string
	for _, m := range in.Merchants {
		if len(m) != 2 || m["i"] == nil || m["d"] == nil {
			t.Fatalf("merchant %v, want only i and d", m)
		}
		sent = append(sent, m["d"].(string))
	}
	// Transfers to people never leave: their descriptions carry counterparties' names.
	if want := []string{"IFOOD", "NETFLIX COM"}; !slices.Equal(sent, want) {
		t.Errorf("sent %v, want %v", sent, want)
	}
	for _, name := range []string{"MARIA", "JOAO", "ANA", "CARLOS"} {
		if strings.Contains(req.User, name) {
			t.Errorf("the prompt holds %q", name)
		}
	}
	if regexp.MustCompile(`\d{2,}`).MatchString(req.User) {
		t.Errorf("the prompt holds a digit run: %s", req.User)
	}
	// The closed schema: no extra properties, and the 13 ids as the enum.
	b, _ := json.Marshal(req.Schema)
	var s struct {
		Properties struct {
			Items struct {
				Items struct {
					AdditionalProperties bool `json:"additionalProperties"`
					Properties           struct {
						C struct {
							Enum []string `json:"enum"`
						} `json:"c"`
					} `json:"properties"`
				} `json:"items"`
			} `json:"items"`
		} `json:"properties"`
	}
	if err := json.Unmarshal(b, &s); err != nil {
		t.Fatal(err)
	}
	if got := s.Properties.Items.Items.Properties.C.Enum; len(got) != 13 || !slices.Equal(got, llmalloc.SpendingCategories) {
		t.Errorf("enum = %v, want the 13 Spending Categories", got)
	}
	if s.Properties.Items.Items.AdditionalProperties {
		t.Error("the item schema is open")
	}
	if req.Thinking {
		t.Error("thinking is on")
	}
}

func TestACategoryOutsideTheThirteenIsInvalid(t *testing.T) {
	t.Parallel()
	_, _, err := categorizeWith(t, `{"items":[{"i":0,"c":"crypto"}]}`, "IFOOD")
	if !errors.Is(err, llmalloc.ErrInvalidResponse) {
		t.Fatalf("err = %v, want ErrInvalidResponse", err)
	}
}

func TestBrokenCategorizerAnswersAreInvalid(t *testing.T) {
	t.Parallel()
	for name, raw := range map[string]string{
		"not json":      `nope`,
		"no items":      `{}`,
		"unknown field": `{"items":[],"x":1}`,
		"unknown item":  `{"items":[{"i":0,"c":"other","x":1}]}`,
		"trailing":      `{"items":[]} {}`,
	} {
		if _, _, err := categorizeWith(t, raw, "IFOOD"); !errors.Is(err, llmalloc.ErrInvalidResponse) {
			t.Errorf("%s: err = %v, want ErrInvalidResponse", name, err)
		}
	}
}

func TestUnknownAndRepeatedIndexesAreDropped(t *testing.T) {
	t.Parallel()
	got, _, err := categorizeWith(t,
		`{"items":[{"i":7,"c":"pets"},{"i":0,"c":"pets"},{"i":0,"c":"health"},{"i":1,"c":"leisure"},{"i":-1,"c":"pets"}]}`, "A", "B")
	if err != nil {
		t.Fatal(err)
	}
	if want := map[int]string{1: "leisure"}; !maps.Equal(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestAnIndexKeepsItsPlaceWhenAMerchantIsHeldBack(t *testing.T) {
	t.Parallel()
	got, fake, err := categorizeWith(t, `{"items":[{"i":1,"c":"eating_out"},{"i":0,"c":"pets"}]}`, "PIX X", "IFOOD")
	if err != nil {
		t.Fatal(err)
	}
	// The held-back index 0 was never asked, so an answer for it is dropped.
	if want := map[int]string{1: "eating_out"}; !maps.Equal(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	if want := `{"merchants":[{"i":1,"d":"IFOOD"}]}`; fake.LastRequest().User != want {
		t.Errorf("user = %s, want %s", fake.LastRequest().User, want)
	}
}

func TestNothingToAskMakesNoCall(t *testing.T) {
	t.Parallel()
	got, fake, err := categorizeWith(t, `{"items":[]}`, "PIX FULANO")
	if err != nil || len(got) != 0 || fake.Calls() != 0 {
		t.Fatalf("got %v, %v, %d calls", got, err, fake.Calls())
	}
}

func TestMoreThanABatchOfMerchantsIsRefused(t *testing.T) {
	t.Parallel()
	m := make([]string, llmalloc.MaxCategorizerBatch+1)
	for i := range m {
		m[i] = fmt.Sprint("M", i)
	}
	if _, fake, err := categorizeWith(t, `{"items":[]}`, m...); err == nil || fake.Calls() != 0 {
		t.Fatalf("err = %v, calls = %d, want a refusal before any call", err, fake.Calls())
	}
}
