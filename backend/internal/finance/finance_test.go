package finance

import "testing"

func TestAllowlistNeverAllowsBlank(t *testing.T) {
	a := NewAllowlist([]string{"", " ", "Ana@Example.com"})
	if a.Allows("") || a.Allows("  ") {
		t.Fatal("blank email must not be allowed")
	}
	if !a.Allows("ana@example.com") {
		t.Fatal("listed email must be allowed")
	}
}
