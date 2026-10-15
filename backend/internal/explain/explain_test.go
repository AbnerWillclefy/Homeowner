package explain_test

import (
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/explain"
)

func TestFingerprintIsOrderIndependent(t *testing.T) {
	t.Parallel()
	a := explain.Fingerprint(4, []explain.Pair{{TaskID: "t1", Reason: "importance"}, {TaskID: "t2", Reason: "liked"}})
	b := explain.Fingerprint(4, []explain.Pair{{TaskID: "t2", Reason: "liked"}, {TaskID: "t1", Reason: "importance"}})
	if a != b || a == "" {
		t.Fatalf("a = %q, b = %q", a, b)
	}
}

func TestFingerprintChangesWithAnyPairOrEnergy(t *testing.T) {
	t.Parallel()
	base := []explain.Pair{{TaskID: "t1", Reason: "importance"}}
	want := explain.Fingerprint(4, base)
	for name, got := range map[string]string{
		"energy": explain.Fingerprint(3, base),
		"reason": explain.Fingerprint(4, []explain.Pair{{TaskID: "t1", Reason: "taken"}}),
		"task":   explain.Fingerprint(4, []explain.Pair{{TaskID: "t2", Reason: "importance"}}),
		"extra":  explain.Fingerprint(4, append(append([]explain.Pair{}, base...), explain.Pair{TaskID: "t2", Reason: "x"})),
		"none":   explain.Fingerprint(4, nil),
		// a shifted boundary between task and reason must not collide
		"shift": explain.Fingerprint(4, []explain.Pair{{TaskID: "t", Reason: "1importance"}}),
	} {
		if got == want {
			t.Errorf("%s: fingerprint did not change", name)
		}
	}
}

func TestFingerprintDoesNotReorderTheCallersSlice(t *testing.T) {
	t.Parallel()
	ps := []explain.Pair{{TaskID: "b"}, {TaskID: "a"}}
	explain.Fingerprint(1, ps)
	if ps[0].TaskID != "b" {
		t.Fatal("the caller's slice was sorted")
	}
}

func TestValid(t *testing.T) {
	t.Parallel()
	ok := explain.Texts{EnUS: "You have two tasks today.", PtBR: "Você tem duas tarefas hoje."}
	if !explain.Valid(ok) {
		t.Fatal("a plain text must be valid")
	}
	for name, bad := range map[string]explain.Texts{
		"empty en":        {EnUS: "", PtBR: ok.PtBR},
		"blank pt":        {EnUS: ok.EnUS, PtBR: "   "},
		"too long":        {EnUS: ok.EnUS, PtBR: strings.Repeat("a", 401)},
		"control":         {EnUS: "a\x00b", PtBR: ok.PtBR},
		"newline":         {EnUS: "a\nb", PtBR: ok.PtBR},
		"markup":          {EnUS: "<b>hi</b>", PtBR: ok.PtBR},
		"angle":           {EnUS: ok.EnUS, PtBR: "a > b"},
		"url":             {EnUS: "see https://evil.example now", PtBR: ok.PtBR},
		"url upper":       {EnUS: ok.EnUS, PtBR: "veja HTTP://x.y"},
		"www":             {EnUS: "go to www.evil.example", PtBR: ok.PtBR},
		"scheme-relative": {EnUS: "visit //evil.example", PtBR: ok.PtBR},
	} {
		if explain.Valid(bad) {
			t.Errorf("%s must be invalid", name)
		}
	}
	if !explain.Valid(explain.Texts{EnUS: strings.Repeat("ã", 400), PtBR: ok.PtBR}) {
		t.Error("400 characters (not bytes) is the limit")
	}
}
