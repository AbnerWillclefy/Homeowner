package server

// AdminRoute is a registered admin route, for the guard test to walk.
// Probe is a request URI that a super admin gets a 200 for.
type AdminRoute struct{ Method, Pattern, Probe string }

// AdminRoutes lists exactly what the admin sub-mux registers.
func AdminRoutes() []AdminRoute {
	out := make([]AdminRoute, 0, len(adminRoutes))
	for _, r := range adminRoutes {
		probe := r.probe
		if probe == "" {
			probe = r.pattern
		}
		out = append(out, AdminRoute{r.method, r.pattern, probe})
	}
	return out
}
