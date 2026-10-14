package checkin

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// The rule files must have no database, HTTP or clock dependency. store.go is
// the one file that does I/O.
func TestPackageIsPure(t *testing.T) {
	forbidden := []string{
		"pgx", "net/http", "database/sql",
		"internal/platform/", "internal/server",
	}
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, ".", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	checked := 0
	for _, pkg := range pkgs {
		for name, file := range pkg.Files {
			if strings.HasSuffix(name, "_test.go") || filepath.Base(name) == "store.go" {
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
