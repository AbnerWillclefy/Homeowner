package server

// AdminRoute is a registered admin route, for the guard test to walk.
type AdminRoute struct{ Method, Pattern string }

// AdminRoutes lists exactly what the admin sub-mux registers.
func AdminRoutes() []AdminRoute {
	out := make([]AdminRoute, 0, len(adminRoutes))
	for _, r := range adminRoutes {
		out = append(out, AdminRoute{r.method, r.pattern})
	}
	return out
}
