package schedule

import (
	"go/ast"
	"go/parser"
	"go/token"
	"strconv"
	"strings"
	"testing"
)

// The package must have no database, HTTP or clock dependency.
func TestPackageIsPure(t *testing.T) {
	forbidden := []string{
		"pgx", "net/http", "database/sql",
		"internal/clock", "internal/db", "internal/server", "internal/apitest",
	}
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
				for _, bad := range forbidden {
					if strings.Contains(path, bad) {
						t.Errorf("%s imports %q", name, path)
					}
				}
			}
			ast.Inspect(file, func(n ast.Node) bool {
				sel, ok := n.(*ast.SelectorExpr)
				if !ok {
					return true
				}
				if id, ok := sel.X.(*ast.Ident); ok && id.Name == "time" && sel.Sel.Name == "Now" {
					t.Errorf("%s calls time.Now", name)
				}
				return true
			})
		}
	}
	if checked == 0 {
		t.Fatal("no non-test files found to check")
	}
}
