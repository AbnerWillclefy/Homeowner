package onboarding

import (
	"go/parser"
	"go/token"
	"strconv"
	"strings"
	"testing"
)

// The package must import nothing but the standard library.
func TestPackageIsPure(t *testing.T) {
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, ".", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	checked := 0
	for _, pkg := range pkgs {
		for name, file := range pkg.Files {
			if strings.HasSuffix(name, "_test.go") {
				continue
			}
			checked++
			for _, imp := range file.Imports {
				path, _ := strconv.Unquote(imp.Path.Value)
				if strings.Contains(strings.Split(path, "/")[0], ".") {
					t.Errorf("%s imports %q, which is not the standard library", name, path)
				}
			}
		}
	}
	if checked == 0 {
		t.Fatal("no non-test files found to check")
	}
}
