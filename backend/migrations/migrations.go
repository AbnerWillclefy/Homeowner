// Package migrations embeds the SQL migrations so the binary and the tests
// ship the same files.
package migrations

import "embed"

// FS holds the NNNN_description.sql files.
//
//go:embed *.sql
var FS embed.FS
