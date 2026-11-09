// Package finance is the Finances feature, open only to Users on an allowlist
// of emails. Authentication proves who a caller is; the Allowlist decides
// whether they may use Finances.
package finance

import "strings"

// Allowlist is the set of emails that may use Finances. The zero value, and an
// empty one, allows nobody.
type Allowlist map[string]struct{}

// NewAllowlist returns the Allowlist of emails, compared ignoring case.
func NewAllowlist(emails []string) Allowlist {
	a := Allowlist{}
	for _, e := range emails {
		if e = strings.ToLower(strings.TrimSpace(e)); e != "" {
			a[e] = struct{}{}
		}
	}
	return a
}

// Allows reports whether email is on the list.
func (a Allowlist) Allows(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	_, ok := a[email]
	return email != "" && ok
}
