package evals

import (
	"os/exec"
	"strings"
	"testing"
)

// Eval code must never ship in the Lambda image, which is built from cmd/api.
func TestAPIDoesNotImportEvals(t *testing.T) {
	goBin, err := exec.LookPath("go")
	if err != nil {
		t.Skip("go tool not on PATH")
	}
	out, err := exec.Command(goBin, "list", "-deps", "-f", "{{.ImportPath}}", "../../cmd/api").CombinedOutput()
	if err != nil {
		t.Fatalf("go list: %v\n%s", err, out)
	}
	for _, pkg := range strings.Fields(string(out)) {
		if strings.Contains(pkg, "/internal/evals") || strings.Contains(pkg, "/cmd/evals") {
			t.Errorf("cmd/api depends on %s", pkg)
		}
	}
	if !strings.Contains(string(out), "/internal/server") {
		t.Errorf("go list did not see cmd/api's dependencies:\n%s", out)
	}
}
