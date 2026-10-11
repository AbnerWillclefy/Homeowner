package main

import (
	"fmt"
	"io"

	"github.com/SherClockHolmes/webpush-go"
)

// vapid prints a new VAPID key pair. It is a one-off human step: the private
// key goes into SSM, the public key into a Terraform variable (infra/README.md).
func vapid(w io.Writer) error {
	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		return fmt.Errorf("generate VAPID keys: %w", err)
	}
	_, err = fmt.Fprintf(w, "VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n", pub, priv)
	return err
}
