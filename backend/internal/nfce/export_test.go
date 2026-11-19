package nfce

import "time"

// SetTimeout lets a test shorten the client timeout.
func (h *HTTP) SetTimeout(d time.Duration) { h.hc.Timeout = d }
